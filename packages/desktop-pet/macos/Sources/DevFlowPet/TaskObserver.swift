import Foundation

/// The connection phase the desktop currently shows.
enum ConnectionPhase: Equatable {
    case connected(url: String)
    case disconnected
    /// The Core executable disappeared or its identity changed, so the desktop
    /// exits and asks the user to open it again from the launcher.
    case mustExit(reason: ExitReason)
}

enum ExitReason: String, Equatable {
    case coreExecutableMissing = "core_executable_missing"
    case coreIdentityChanged = "core_identity_changed"
    case dataRootDigestChanged = "data_root_digest_changed"
}

/// One published observation for the window and the bubble.
struct ObservationUpdate: Equatable {
    let connection: ConnectionPhase
    let presentation: PresentationRules.Result
    let lastSyncAt: Date?
    let selectedTaskID: String?
}

enum ListLoadResult: Equatable {
    case value(TaskListResponse)
    /// A late response from a closed panel or a superseded page; it is dropped.
    case stale
    case failure(WebUIFailure)
    case notConnected
}

/// Owns polling, request attribution, and connection recovery.
///
/// Connection generation, Task selection generation, and list generation bound
/// which response may be displayed; a late response is dropped instead of
/// overwriting a newer selection. Background recovery is read-only, and only an
/// explicit retry may ask Core to start the local service.
actor TaskObserver {
    /// After a finished request the desktop waits five seconds before reading
    /// the selected Task again.
    static let pollInterval: TimeInterval = 5
    /// While disconnected the desktop checks the service every fifteen seconds.
    static let reconnectInterval: TimeInterval = 15

    private let core: CoreRuntimeClient
    private let expectedCoreIdentity: String
    private let expectedDataRootDigest: String
    private let presentation: PresentationState
    private let preferences: PreferenceStore
    private let makeClient: @Sendable (String) -> WebUIReading?
    private let onUpdate: @Sendable (ObservationUpdate) -> Void

    private var client: WebUIReading?
    private var connectionGeneration = 0
    private var selectionGeneration = 0
    private var listGeneration = 0
    private var selectedTaskID: String?
    private var isObserving = false
    private var observationGeneration = 0
    private var defaultSelectionResolved = false
    private var loop: Task<Void, Never>?
    private var exitReason: ExitReason?

    init(
        core: CoreRuntimeClient,
        expectedCoreIdentity: String,
        expectedDataRootDigest: String,
        preferences: PreferenceStore,
        now: @escaping () -> Date = Date.init,
        makeClient: @escaping @Sendable (String) -> WebUIReading? = { LoopbackWebUIClient(origin: $0) },
        onUpdate: @escaping @Sendable (ObservationUpdate) -> Void
    ) {
        self.core = core
        self.expectedCoreIdentity = expectedCoreIdentity
        self.expectedDataRootDigest = expectedDataRootDigest
        self.preferences = preferences
        self.presentation = PresentationState(now: now)
        self.makeClient = makeClient
        self.onUpdate = onUpdate
    }

    // MARK: - Visibility and refresh

    /// Starts observation when the window becomes visible. Showing the window
    /// again is a first read, so it clears the previous prompt basis.
    func beginObserving() {
        guard !isObserving else { return }
        isObserving = true
        presentation.noteDiscontinuity()
        restartLoop()
    }

    /// Cancels observation and invalidates its outstanding responses while hidden.
    func endObserving() {
        isObserving = false
        observationGeneration += 1
        listGeneration += 1
        loop?.cancel()
        loop = nil
        presentation.noteDiscontinuity()
    }

    /// Cancels the polling loop and every in-flight request. Called once during
    /// the orderly shutdown, after animation and the window already stopped.
    func cancel() {
        endObserving()
    }

    /// Refreshes immediately after a Task switch, showing the window, or waking
    /// from sleep.
    func refreshNow(clearSelectionContinuity: Bool = true) {
        if clearSelectionContinuity {
            presentation.noteDiscontinuity()
        }
        restartLoop()
    }

    func select(taskID: String?) {
        guard taskID != selectedTaskID else { return }
        selectionGeneration += 1
        selectedTaskID = taskID
        defaultSelectionResolved = true
        preferences.update { preferences in
            preferences.select(taskID: taskID, for: expectedDataRootDigest)
        }
        presentation.noteDiscontinuity()
        presentation.discardLastKnownSummary()
        restartLoop()
    }

    func currentSelection() -> String? {
        selectedTaskID
    }

    /// Restores the remembered selection for this data directory. A missing
    /// default is resolved later from the blocked and active lists.
    func restoreSelectionFromPreferences() {
        selectedTaskID = preferences.current.selectedTask(for: expectedDataRootDigest)
        defaultSelectionResolved = selectedTaskID != nil
    }

    // MARK: - Explicit retry

    /// The only path that may ask Core to start the local service after the
    /// initial open. It re-verifies identity before the desktop reads again.
    func retryConnection() async {
        noteReadFailure()
        restartLoop(allowStart: true)
    }

    // MARK: - Task list panel

    /// Opens a list session. Responses from an earlier session are stale.
    func beginListSession() -> Int {
        listGeneration += 1
        return listGeneration
    }

    func loadList(page: Int, lifecycle: TaskLifecycle?, session: Int) async -> ListLoadResult {
        guard session == listGeneration else { return .stale }
        guard let client else { return .notConnected }
        let connectionAtRequest = connectionGeneration
        let result = await client.taskList(page: page, lifecycle: lifecycle)
        guard session == listGeneration, connectionAtRequest == connectionGeneration, !Task.isCancelled else { return .stale }
        switch result {
        case .value(let value): return .value(value)
        case .notFound, .failure:
            return .notConnected
        }
    }

    // MARK: - Polling loop

    private func restartLoop(allowStart: Bool = false) {
        guard isObserving else { return }
        loop?.cancel()
        observationGeneration += 1
        let generation = observationGeneration
        loop = Task { [weak self] in
            await self?.runLoop(generation: generation, allowStart: allowStart)
        }
    }

    private func isCurrent(_ generation: Int) -> Bool {
        isObserving && generation == observationGeneration && !Task.isCancelled
    }

    private func runLoop(generation: Int, allowStart: Bool) async {
        var mayStart = allowStart
        while isCurrent(generation) {
            let interval = await observeOnce(generation: generation, allowStart: mayStart)
            mayStart = false
            guard isCurrent(generation), exitReason == nil else { return }
            do {
                try await Task.sleep(nanoseconds: UInt64(interval * 1_000_000_000))
            } catch {
                return
            }
        }
    }

    /// Performs one observation round and returns how long to wait afterwards.
    private func observeOnce(generation: Int, allowStart: Bool) async -> TimeInterval {
        // Check the selected executable and service even while task reads succeed.
        let connected = await establishConnection(allowStart: allowStart, generation: generation)
        guard isCurrent(generation) else { return Self.pollInterval }
        guard connected else {
            if let exitReason {
                publish(connection: .mustExit(reason: exitReason))
                return Self.reconnectInterval
            }
            noteReadFailure()
            presentation.apply(.disconnected)
            publish(connection: .disconnected)
            return Self.reconnectInterval
        }
        guard let client else { return Self.reconnectInterval }

        if !defaultSelectionResolved {
            let resolved = await resolveDefaultSelection(client: client, generation: generation)
            guard isCurrent(generation) else { return Self.pollInterval }
            guard resolved else {
                noteReadFailure()
                presentation.apply(.disconnected)
                publish(connection: .disconnected)
                return Self.reconnectInterval
            }
        }
        guard let taskID = selectedTaskID else {
            presentation.apply(.noSelection)
            publish(connection: .connected(url: client.origin))
            return Self.pollInterval
        }

        let selectionAtRequest = selectionGeneration
        let connectionAtRequest = connectionGeneration
        let result = await client.taskDetail(taskID: taskID)
        guard selectionAtRequest == selectionGeneration,
              connectionAtRequest == connectionGeneration,
              isCurrent(generation) else {
            return Self.pollInterval
        }
        switch result {
        case .value(let detail):
            presentation.apply(.task(detail.summary, detailReadiness: detail.readiness))
            publish(connection: .connected(url: client.origin))
            return Self.pollInterval
        case .notFound:
            presentation.apply(.taskMissing)
            publish(connection: .connected(url: client.origin))
            return Self.pollInterval
        case .failure:
            noteReadFailure()
            presentation.apply(.disconnected)
            publish(connection: .disconnected)
            return Self.reconnectInterval
        }
    }

    /// A failed read drops the connection immediately; recovery is read-only and
    /// uses the same Core status command.
    private func noteReadFailure() {
        client = nil
        connectionGeneration += 1
        presentation.noteDiscontinuity()
    }

    private func publish(connection: ConnectionPhase) {
        let update = ObservationUpdate(
            connection: connection,
            presentation: presentation.result,
            lastSyncAt: presentation.lastSyncAt,
            selectedTaskID: selectedTaskID
        )
        onUpdate(update)
    }

    // MARK: - Connection establishment

    private enum ConnectionAttempt: Equatable {
        case connected(url: String)
        case serviceDown
        case mustExit(ExitReason)
    }

    @discardableResult
    private func establishConnection(allowStart: Bool, generation: Int) async -> Bool {
        let previousOrigin = client?.origin
        let attempt = await attemptConnection(allowStart: allowStart, generation: generation)
        guard isCurrent(generation) else { return false }
        switch attempt {
        case .connected(let url):
            if previousOrigin != url {
                connectionGeneration += 1
                presentation.noteDiscontinuity()
                if presentation.lastSyncAt == nil { publish(connection: .connected(url: url)) }
            }
            exitReason = nil
            return true
        case .serviceDown:
            exitReason = nil
            return false
        case .mustExit(let reason):
            exitReason = reason
            return false
        }
    }

    private func attemptConnection(allowStart: Bool, generation: Int) async -> ConnectionAttempt {
        guard FileManager.default.fileExists(atPath: core.corePath) else {
            return .mustExit(.coreExecutableMissing)
        }
        var coreResult = await core.status()
        guard isCurrent(generation) else { return .serviceDown }
        if let reason = changedIdentity(coreResult) { return .mustExit(reason) }
        var decision = ActivationRules.decide(coreResult: coreResult, alreadyStartedService: !allowStart)
        if case .startServiceThenRetry = decision {
            coreResult = await core.startService()
            guard isCurrent(generation) else { return .serviceDown }
            if let reason = changedIdentity(coreResult) { return .mustExit(reason) }
            decision = ActivationRules.decide(coreResult: coreResult, alreadyStartedService: true)
        }
        guard case .activate(let url, _) = decision else {
            guard case .reject(let rejection) = decision else { return .serviceDown }
            switch rejection {
            case .incompatible:
                return .mustExit(.dataRootDigestChanged)
            case .coreUnavailable(.processUnavailable):
                return .mustExit(.coreExecutableMissing)
            case .coreUnavailable, .identityMismatch, .noConnectableService:
                return .serviceDown
            }
        }
        guard let candidate = client?.origin == url ? client : makeClient(url) else { return .serviceDown }
        let status = await candidate.systemStatus()
        guard isCurrent(generation) else { return .serviceDown }
        switch status {
        case .value(let live):
            guard live.coreIdentity == expectedCoreIdentity else {
                return .mustExit(.coreIdentityChanged)
            }
            guard live.dataRootDigest == expectedDataRootDigest else {
                return .mustExit(.dataRootDigestChanged)
            }
            guard ActivationRules.verify(
                live: live,
                expectedCoreIdentity: expectedCoreIdentity,
                expectedDataRootDigest: expectedDataRootDigest,
                expectedURL: url
            ) else {
                return .serviceDown
            }
            client = candidate
            return .connected(url: url)
        case .notFound:
            return .serviceDown
        case .failure:
            return .serviceDown
        }
    }

    // MARK: - Default selection

    private func changedIdentity(_ result: CoreStatusResult) -> ExitReason? {
        guard case .status(let status) = result else { return nil }
        if status.coreIdentity != expectedCoreIdentity { return .coreIdentityChanged }
        if status.dataRootDigest != expectedDataRootDigest { return .dataRootDigestChanged }
        return nil
    }

    /// Resolves the default watched Task when nothing is remembered: the most
    /// recently updated blocked Task first, then the most recently updated
    /// active Task, otherwise the desktop stays idle.
    private func resolveDefaultSelection(client: WebUIReading, generation: Int) async -> Bool {
        for lifecycle in [TaskLifecycle.blocked, .active] {
            let result = await client.taskList(page: 1, lifecycle: lifecycle)
            guard isCurrent(generation), !defaultSelectionResolved else { return false }
            switch result {
            case .value(let list):
                guard let newest = list.items.max(by: { $0.updatedAt < $1.updatedAt }) else { continue }
                selectionGeneration += 1
                selectedTaskID = newest.taskID
                defaultSelectionResolved = true
                preferences.update { preferences in
                    preferences.select(taskID: newest.taskID, for: expectedDataRootDigest)
                }
                presentation.noteDiscontinuity()
                return true
            case .notFound, .failure:
                return false
            }
        }
        defaultSelectionResolved = true
        return true
    }
}
