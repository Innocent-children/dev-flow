import Foundation

/// The outcome of one Core process invocation. A failing Core process does not
/// guarantee JSON on stdout, so callers inspect the exit code and the output
/// together.
struct ProcessOutcome: Equatable {
    let exitCode: Int32
    let stdout: Data
    let stderr: String
    let timedOut: Bool
}

protocol ProcessRunning {
    func run(
        executable: String,
        arguments: [String],
        environment: [String: String],
        timeout: TimeInterval
    ) async -> ProcessOutcome?
}

/// Runs a Core executable with a bounded wait. This is the only place that
/// spawns a process for the desktop component.
final class SystemProcessRunner: ProcessRunning {
    func run(
        executable: String,
        arguments: [String],
        environment: [String: String],
        timeout: TimeInterval
    ) async -> ProcessOutcome? {
        await withCheckedContinuation { continuation in
            let process = Process()
            process.executableURL = URL(fileURLWithPath: executable)
            process.arguments = arguments
            process.environment = environment
            let outputPipe = Pipe()
            let errorPipe = Pipe()
            process.standardOutput = outputPipe
            process.standardError = errorPipe
            process.standardInput = FileHandle.nullDevice

            let state = ContinuationState()
            process.terminationHandler = { finished in
                let stdout = outputPipe.fileHandleForReading.readDataToEndOfFile()
                let stderr = String(data: errorPipe.fileHandleForReading.readDataToEndOfFile(), encoding: .utf8) ?? ""
                state.resumeOnce(continuation, ProcessOutcome(
                    exitCode: finished.terminationStatus,
                    stdout: stdout,
                    stderr: stderr,
                    timedOut: false
                ))
            }
            do {
                try process.run()
            } catch {
                state.resumeOnce(continuation, nil)
                return
            }
            DispatchQueue.global().asyncAfter(deadline: .now() + timeout) {
                guard process.isRunning else { return }
                process.terminate()
                let stdout = outputPipe.fileHandleForReading.readDataToEndOfFile()
                let stderr = String(data: errorPipe.fileHandleForReading.readDataToEndOfFile(), encoding: .utf8) ?? ""
                state.resumeOnce(continuation, ProcessOutcome(
                    exitCode: process.terminationStatus,
                    stdout: stdout,
                    stderr: stderr,
                    timedOut: true
                ))
            }
        }
    }

    /// Guarantees a single continuation resume when the timeout and the
    /// termination handler race. The lock makes the shared flag safe to capture
    /// from both handlers.
    private final class ContinuationState: @unchecked Sendable {
        private let lock = NSLock()
        private var resumed = false

        func resumeOnce(_ continuation: CheckedContinuation<ProcessOutcome?, Never>, _ value: ProcessOutcome?) {
            lock.lock()
            let shouldResume = !resumed
            resumed = true
            lock.unlock()
            if shouldResume { continuation.resume(returning: value) }
        }
    }
}

enum CoreCommandFailure: Equatable {
    case processUnavailable
    case timedOut
    case exited(code: Int32, detail: String)
    case invalidOutput
}

enum CoreStatusResult: Equatable {
    case status(CoreRuntimeStatus)
    case failed(CoreCommandFailure)
}

/// Calls the selected Adapter's Core executable for WebUI runtime status. The
/// desktop never persists a second process cursor and never interprets a Core
/// result beyond the fields Core already reports.
struct CoreRuntimeClient {
    /// A single Core invocation waits at most ten seconds.
    static let invocationTimeout: TimeInterval = 10

    let corePath: String
    let dataDirectory: String
    let runner: ProcessRunning

    func status() async -> CoreStatusResult {
        await invoke(["webui", "status", "--json"])
    }

    /// Only an explicit open or retry may ask Core to start the local service.
    func startService() async -> CoreStatusResult {
        await invoke(["webui", "start", "--no-open", "--json"])
    }

    private func invoke(_ arguments: [String]) async -> CoreStatusResult {
        var environment = ProcessInfo.processInfo.environment
        environment["DEV_FLOW_DATA_DIR"] = dataDirectory
        guard let outcome = await runner.run(
            executable: corePath,
            arguments: arguments,
            environment: environment,
            timeout: Self.invocationTimeout
        ) else {
            return .failed(.processUnavailable)
        }
        if outcome.timedOut {
            return .failed(.timedOut)
        }
        guard outcome.exitCode == 0 else {
            let detail = outcome.stderr.trimmingCharacters(in: .whitespacesAndNewlines)
            return .failed(.exited(code: outcome.exitCode, detail: detail))
        }
        guard let status = try? CoreRuntimeStatus.decode(outcome.stdout) else {
            return .failed(.invalidOutput)
        }
        return .status(status)
    }
}

/// The activation decision made from one Core status result plus the live
/// service check.
enum ActivationDecision: Equatable {
    /// The service is reachable and matches the verified identity.
    case activate(url: String, readiness: Readiness)
    /// No service is running; this explicit open may start one.
    case startServiceThenRetry
    /// The condition must be reported and the desktop must not activate.
    case reject(ActivationRejection)
}

enum ActivationRejection: Equatable {
    case coreUnavailable(CoreCommandFailure)
    case incompatible
    case identityMismatch
    case noConnectableService
}

enum ActivationRules {
    /// Decides what an explicit open does with a Core status result.
    ///
    /// `unavailable` means no service is recorded, so this explicit open may
    /// request one. `incompatible` and command failures are reported and stop
    /// the attempt. Local read-only storage without a connectable service never
    /// activates the desktop.
    static func decide(coreResult: CoreStatusResult, alreadyStartedService: Bool) -> ActivationDecision {
        switch coreResult {
        case .failed(let failure):
            return .reject(.coreUnavailable(failure))
        case .status(let status):
            switch status.readiness {
            case .ready:
                guard !status.url.isEmpty else { return .reject(.noConnectableService) }
                return .activate(url: status.url, readiness: .ready)
            case .readOnly:
                guard !status.url.isEmpty else { return .reject(.noConnectableService) }
                return .activate(url: status.url, readiness: .readOnly)
            case .unavailable:
                return alreadyStartedService ? .reject(.noConnectableService) : .startServiceThenRetry
            case .incompatible:
                return .reject(.incompatible)
            case .unknown:
                return .reject(.incompatible)
            }
        }
    }

    /// Confirms that the live service reports the identity the launcher already
    /// verified for the same Core and data directory.
    static func verify(
        live: SystemStatusResponse,
        expectedCoreIdentity: String,
        expectedDataRootDigest: String,
        expectedURL: String
    ) -> Bool {
        guard live.coreIdentity == expectedCoreIdentity,
              live.dataRootDigest == expectedDataRootDigest else {
            return false
        }
        guard !live.url.isEmpty, live.url == expectedURL else { return false }
        return live.readiness == .ready || live.readiness == .readOnly
    }
}

/// The activation result of the desktop's own Core re-check.
enum ActivationOutcome: Equatable {
    case activated(readiness: Readiness)
    case blocked(ActivationRejection)
}

/// Confirms the Core status and the live service before a window appears.
///
/// The desktop re-checks the same Core instead of trusting a launcher result that
/// may already be stale. An explicit open may ask Core to start the service once;
/// local read-only storage without a connectable service never activates the
/// desktop.
enum PetActivation {
    static func activate(
        core: CoreRuntimeClient,
        expectedCoreIdentity: String,
        expectedDataRootDigest: String
    ) async -> ActivationOutcome {
        var decision = ActivationRules.decide(coreResult: await core.status(), alreadyStartedService: false)
        if case .startServiceThenRetry = decision {
            decision = ActivationRules.decide(coreResult: await core.startService(), alreadyStartedService: true)
        }
        guard case .activate(let url, let readiness) = decision else {
            guard case .reject(let rejection) = decision else {
                return .blocked(.noConnectableService)
            }
            return .blocked(rejection)
        }
        guard let client = LoopbackWebUIClient(origin: url) else {
            return .blocked(.noConnectableService)
        }
        guard case .value(let live) = await client.systemStatus() else {
            return .blocked(.noConnectableService)
        }
        guard ActivationRules.verify(
            live: live,
            expectedCoreIdentity: expectedCoreIdentity,
            expectedDataRootDigest: expectedDataRootDigest,
            expectedURL: url
        ) else {
            return .blocked(.identityMismatch)
        }
        return .activated(readiness: readiness)
    }

    /// The failure detail written to stderr when activation does not succeed.
    static func description(_ outcome: ActivationOutcome, strings: PetStrings) -> String {
        guard case .blocked(let rejection) = outcome else {
            return "the Core runtime is already active"
        }
        switch rejection {
        case .coreUnavailable(let failure):
            return "the Core command failed: \(failure)"
        case .incompatible:
            return strings.exitDataRootChanged
        case .identityMismatch:
            return strings.exitCoreIdentityChanged
        case .noConnectableService:
            return strings.disconnectedDetail
        }
    }
}
