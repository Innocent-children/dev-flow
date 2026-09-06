import Foundation

/// Why a click could not hand a page to the browser.
enum NavigationBlock: Equatable {
    /// The re-check found no reachable local service.
    case serviceUnreachable
    /// The re-checked service reports a different Core or data directory.
    case identityMismatch
    /// The confirmed origin or the Task identifier cannot form a legal address.
    case invalidAddress
}

/// The page a click opens. The desktop never submits a Task operation; the page
/// keeps using the WebUI's own origin, session, and revision checks.
enum NavigationTarget: Equatable {
    case taskDetail(url: String)
    case taskList(url: String)
    case blocked(NavigationBlock)
}

/// Pure navigation decisions, separated from the browser call so the targeted
/// tests cover every phase without opening a page.
enum NavigationRules {
    /// Chooses the page for the current display phase.
    ///
    /// A missing Task and no selection both open the list; an archived Task
    /// still opens its own detail because Core keeps it readable.
    static func target(
        origin: String,
        phase: DisplayPhase,
        selectedTaskID: String?
    ) -> NavigationTarget {
        guard LoopbackWebUIClient.isConfirmedLoopbackOrigin(origin) else {
            return .blocked(.invalidAddress)
        }
        switch phase {
        case .noSelection, .taskMissing:
            return .taskList(url: "\(origin)/tasks")
        // The controller has verified the service before choosing a target;
        // a recovered connection can open the task immediately.
        case .disconnected, .archived, .cancelled, .completed, .working, .blocked:
            guard let selectedTaskID, !selectedTaskID.isEmpty,
                  let segment = LoopbackWebUIClient.pathSegment(selectedTaskID) else {
                return .taskList(url: "\(origin)/tasks")
            }
            return .taskDetail(url: "\(origin)/tasks/\(segment)")
        }
    }

    /// Re-checks the service immediately before navigation, using the same Core
    /// and the same expected identity the launcher verified, so an outdated
    /// address can never open the wrong service.
    static func recheck(
        coreResult: CoreStatusResult,
        live: SystemStatusResponse?,
        expectedCoreIdentity: String,
        expectedDataRootDigest: String
    ) -> NavigationBlock? {
        guard case .status(let status) = coreResult else { return .serviceUnreachable }
        guard status.readiness == .ready || status.readiness == .readOnly else {
            return .serviceUnreachable
        }
        guard let live else { return .serviceUnreachable }
        guard ActivationRules.verify(
            live: live,
            expectedCoreIdentity: expectedCoreIdentity,
            expectedDataRootDigest: expectedDataRootDigest,
            expectedURL: status.url
        ) else {
            if live.coreIdentity != expectedCoreIdentity || live.dataRootDigest != expectedDataRootDigest {
                return .identityMismatch
            }
            return .serviceUnreachable
        }
        return nil
    }
}
