import Foundation

/// The internal shutdown entry.
///
/// `stop` never creates a window, never starts the local service, and never
/// re-resolves an Adapter: cleaning up an existing desktop instance does not
/// depend on finding a Core again. Stopping compares the current user, the
/// recorded process start identity, and the executable path before signalling, so
/// a recycled PID is never mistaken for the running instance.
enum PetStopRequest {
    /// An orderly shutdown waits at most five seconds. A timeout keeps the
    /// runtime record so an uninstall or a confirmed reset that depends on it
    /// stops instead of continuing over a live instance.
    static let shutdownTimeout: TimeInterval = 5
    private static let pollInterval: TimeInterval = 0.1

    /// Returns the process exit code for one stop request.
    static func run(productRoot: String, corePath: String?) -> Int32 {
        let paths = PetPaths(productRoot: productRoot)
        let runtime = PetInstanceRuntime(paths: paths)
        let record = runtime.readRecord()
        let decision = InstanceRules.decideStop(
            record: record,
            liveIdentity: record.flatMap { NativeProcess.identity(pid: Int32($0.pid)) },
            currentUserID: NativeProcess.currentUserID(),
            requestedExecutablePath: nil,
            requestedCorePath: corePath
        )
        switch decision {
        case .nothingToStop:
            if FileManager.default.fileExists(atPath: paths.root) {
                guard let acquired = try? runtime.acquireLock(), acquired else {
                    return report("the desktop pet is starting or its runtime record is unavailable; retry stop")
                }
                runtime.release()
            }
            return 0
        case .otherCoreInUse:
            // Adapter maintenance must only stop instances using that Core.
            return 0
        case .expiredRecord:
            guard let record else { return 0 }
            return discardExpiredRecord(pid: Int32(record.pid), runtime: runtime)
        case .terminate(let pid):
            return terminate(pid: pid, runtime: runtime)
        }
    }

    private static func terminate(pid: Int32, runtime: PetInstanceRuntime) -> Int32 {
        guard NativeProcess.send(signal: SIGTERM, to: pid) else {
            return report("cannot signal the desktop pet process \(pid)")
        }
        let deadline = Date(timeIntervalSinceNow: shutdownTimeout)
        while Date() < deadline, NativeProcess.identity(pid: pid) != nil {
            Thread.sleep(forTimeInterval: pollInterval)
        }
        guard NativeProcess.identity(pid: pid) == nil else {
            return report("the desktop pet did not stop within \(Int(shutdownTimeout)) seconds")
        }
        // The instance removes its own record. A record left behind by an
        // abnormal end is discarded only while the lock is free.
        if let acquired = try? runtime.acquireLock(), acquired {
            runtime.discardRecord(naming: pid)
            runtime.release()
        }
        return 0
    }

    /// Removes a record that no longer describes a live matching process. The
    /// lock must be free, because a held lock means an instance is starting or
    /// running and its own record must survive.
    private static func discardExpiredRecord(pid: Int32, runtime: PetInstanceRuntime) -> Int32 {
        guard let acquired = try? runtime.acquireLock(), acquired else {
            return report("another desktop pet instance holds \(runtime.paths.instanceLock)")
        }
        runtime.discardRecord(naming: pid)
        runtime.release()
        return 0
    }

    private static func report(_ message: String) -> Int32 {
        FileHandle.standardError.write(Data("\(message)\n".utf8))
        return 1
    }
}
