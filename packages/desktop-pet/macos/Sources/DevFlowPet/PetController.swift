import AppKit
import Foundation

/// Coordinates the window, the menu, the selection panel, and the observation
/// loop.
///
/// The controller decides wording, posture, and page navigation only. Core
/// decides the Task phase, the blocker, and the terminal outcome, and the
/// observer applies the attribution and prompt rules. Nothing here persists a
/// second process cursor or reinterprets a Core result.
@MainActor
final class PetController: PetWindowHandling {
    /// How long an exit or navigation message stays readable before the desktop
    /// closes or the next observation replaces it.
    private static let messageDelay: TimeInterval = 5

    private let preferences: PreferenceStore
    private let core: CoreRuntimeClient
    private let expectedCoreIdentity: String
    private let expectedDataRootDigest: String
    private let appearanceStore: PetAppearanceStore
    private let appearanceSelection: PetAppearanceSelection
    private var library: AssetLibrary? { appearanceSelection.library }
    private var availableAppearances: [PetAppearance] = []
    private var importingAppearance = false
    private let runtime: PetInstanceRuntime
    private let onShutdown: () -> Void

    private let window: PetWindow
    private let menu = PetMenu()
    private var picker: TaskPickerPanel?
    private var observer: TaskObserver?
    private var observers: [NSObjectProtocol] = []

    private let language = PetLanguage.resolve()
    private var strings: PetStrings
    private var lastUpdate: ObservationUpdate?
    private var isConnected = false
    private var transientMessage: String?
    private var transientTask: Task<Void, Never>?
    private var exiting = false
    private var sleeping = false
    private var dragging = false
    private var pressed = false
    private var menuTracking = false
    private var pickingTask = false
    private var showingAppearanceError = false
    private var awaitingObservation = true
    private var activityCenter = CGPoint.zero
    private let activities = PetActivityController()
    private var activityTimer: Timer?
    private var activityDeadline: TimeInterval?
    private var appliedPlayback: PetActivityController.PlaybackRequest?
    private var appliedWalk: PetActivityController.WalkRequest?

    init(
        preferences: PreferenceStore,
        core: CoreRuntimeClient,
        expectedCoreIdentity: String,
        expectedDataRootDigest: String,
        library: AssetLibrary?,
        runtime: PetInstanceRuntime,
        onShutdown: @escaping () -> Void
    ) {
        self.preferences = preferences
        self.core = core
        self.expectedCoreIdentity = expectedCoreIdentity
        self.expectedDataRootDigest = expectedDataRootDigest
        self.runtime = runtime
        self.onShutdown = onShutdown
        strings = PetStrings.forLanguage(language)
        let store = PetAppearanceStore(directory: runtime.paths.appearances)
        let selection = PetAppearanceSelection(store: store, preferences: preferences, bundledLibrary: library)
        appearanceStore = store
        appearanceSelection = selection
        availableAppearances = store.appearances()
        var restoreError: Error?
        do { try selection.restore() } catch { restoreError = error }

        window = PetWindow()
        window.content.setScale(preferences.current.scale)
        window.content.handler = self
        window.content.bubble.onOpen = { [weak self] id in
            guard let self, let card = self.lastUpdate?.cards.first(where: { $0.taskID == id }) else { return }
            self.openPage(phase: card.result.phase, selectedTaskID: id)
        }
        window.content.bubble.onPin = { [weak self] id in Task { await self?.observer?.select(taskID: id) } }
        window.content.bubble.onDismiss = { [weak self] id in Task { await self?.observer?.acknowledge(taskID: id) } }
        window.content.bubble.onResize = { [weak self] in self?.window.relayoutForBubble(animated: true) }
        window.content.character.onArtworkLayoutChanged = { [weak self] in
            guard let self else { return }
            self.window.content.updateArtworkSpacing()
            self.window.relayoutForBubble(animated: true)
        }
        window.content.character.configure(library: selection.library, strings: strings)
        activities.configure(catalog: selection.library?.catalog)
        window.content.character.onPlaybackFinished = { [weak self] clip in
            guard let self else { return }
            self.activities.playbackFinished(clip)
            self.applyActivityOutput()
        }
        window.onWalkingFinished = { [weak self] in
            guard let self else { return }
            self.updateActivityGeometry()
            self.activities.walkingFinished()
            self.applyActivityOutput()
        }
        menu.onAction = { [weak self] action in self?.handle(action) }
        menu.onTrackingChanged = { [weak self] tracking in
            self?.menuTracking = tracking
            if tracking { self?.window.stopBubbleTransitions() }
            self?.refreshActivities()
            if !tracking { self?.window.content.synchronizeHover() }
        }

        registerWorkspaceObservers()
        applyVisibility(firstShow: true)
        refreshMenu()
        if let restoreError {
            DispatchQueue.main.async { [weak self] in self?.showAppearanceError(restoreError, restoring: true) }
        }
    }

    /// Starts observation. The observer publishes on the main actor because the
    /// window, the bubble, and the menu are all main-actor state.
    func start() {
        let observer = TaskObserver(
            core: core,
            expectedCoreIdentity: expectedCoreIdentity,
            expectedDataRootDigest: expectedDataRootDigest,
            preferences: preferences
        ) { [weak self] update in
            Task { @MainActor in self?.apply(update) }
        }
        self.observer = observer
        Task {
            await observer.restoreSelectionFromPreferences()
            await observer.beginObserving()
        }
    }

    // MARK: - Observation

    private func apply(_ update: ObservationUpdate) {
        guard window.isVisible, !sleeping, !exiting else { return }
        lastUpdate = update
        awaitingObservation = false
        transientMessage = nil
        switch update.connection {
        case .connected:
            isConnected = true
        case .disconnected:
            isConnected = false
        case .mustExit(let reason):
            isConnected = false
            refreshMenu()
            exitFor(reason: reason)
            return
        }
        present(update, allowPrompt: true)
        refreshMenu()
    }

    private func present(_ update: ObservationUpdate, allowPrompt: Bool = false) {
        guard window.isVisible, !sleeping, !exiting else { return }
        window.motionEnabled = preferences.current.animationsEnabled && !NativeProcess.reduceMotionEnabled()
        let content: BubbleContent
        if let message = transientMessage {
            content = BubbleContent(title: message, stage: nil, summary: nil, taskUpdated: nil, lastSync: nil, blocker: nil)
        } else {
            content = BubbleRules.content(
                result: update.presentation,
                lastSyncAt: update.lastSyncAt,
                strings: strings,
                language: language
            )
        }
        window.content.bubble.maximumHeight = max(70, min(280, (window.screen?.visibleFrame.height ?? 700) - 144 * preferences.current.scale - 32))
        if transientMessage != nil { window.content.bubble.update(content) }
        else {
            window.content.bubble.update(cards: update.cards, pinned: update.pinnedTaskID, fallback: content,
                sync: update.lastSyncAt, strings: strings, language: language)
        }
        window.relayoutForBubble(animated: true)
        play(update.presentation, allowPrompt: allowPrompt)
    }

    private func play(_ result: PresentationRules.Result, allowPrompt: Bool) {
        window.motionEnabled = preferences.current.animationsEnabled && !NativeProcess.reduceMotionEnabled()
        updateActivityGeometry()
        let current = preferences.current
        activities.update(result, taskID: lastUpdate?.selectedTaskID,
            controls: .init(visible: window.isVisible && !sleeping && !exiting && !awaitingObservation,
                connected: isConnected, animationsEnabled: current.animationsEnabled,
                idleActivitiesEnabled: current.idleActivitiesEnabled, reduceMotion: NativeProcess.reduceMotionEnabled(),
                interactionBlocked: pressed || menuTracking || pickingTask || importingAppearance || showingAppearanceError,
                dragging: dragging), allowPrompt: allowPrompt)
        applyActivityOutput()
    }

    private func refreshActivities() {
        play(lastUpdate?.presentation ?? PresentationState().result, allowPrompt: false)
    }

    private func updateActivityGeometry() {
        activities.geometry = .init(originX: window.frame.minX,
            walkingRange: PositionRules.walkingRange(centerX: activityCenter.x, windowWidth: window.frame.width,
                visibleFrame: window.screen?.visibleFrame ?? NSScreen.main?.visibleFrame ?? .zero),
            scale: preferences.current.scale)
    }

    /// Applies only changed requests. Ordinary reads retain the running animation and timer.
    private func applyActivityOutput() {
        if appliedWalk != activities.walk {
            window.stopWalking()
            appliedWalk = nil
        }
        if appliedPlayback != activities.playback {
            appliedPlayback = activities.playback
            if let request = activities.playback {
                let succeeded = window.content.character.play(clip: request.clip, playback: request.playback, restart: true)
                if !succeeded {
                    activities.playbackFailed(request.clip)
                    if activities.playback != request || activities.walk != appliedWalk {
                        applyActivityOutput()
                        return
                    }
                }
            } else {
                window.content.character.pausePlayback()
            }
        }
        if let walk = activities.walk, appliedWalk != walk {
            appliedWalk = walk
            window.startWalking(toX: walk.targetX, duration: walk.duration)
        }
        let deadline = activities.nextDeadline
        guard deadline != activityDeadline || (deadline != nil && activityTimer == nil) else { return }
        activityTimer?.invalidate()
        activityTimer = nil
        activityDeadline = deadline
        guard let deadline else { return }
        let timer = Timer(timeInterval: max(0.01, deadline - ProcessInfo.processInfo.systemUptime), repeats: false) { [weak self] _ in
            MainActor.assumeIsolated {
                guard let self else { return }
                self.activityTimer = nil
                self.activityDeadline = nil
                self.updateActivityGeometry()
                self.activities.tick()
                self.applyActivityOutput()
            }
        }
        activityTimer = timer
        RunLoop.main.add(timer, forMode: .common)
    }

    private func refreshMenu() {
        menu.refresh(
            strings: strings,
            isConnected: isConnected,
            isVisible: window.isVisible,
            animationsEnabled: preferences.current.animationsEnabled,
            idleActivitiesEnabled: preferences.current.idleActivitiesEnabled,
            reduceMotion: NativeProcess.reduceMotionEnabled(),
            appearances: availableAppearances,
            selectedAppearance: appearanceSelection.id,
            importingAppearance: importingAppearance,
            scale: preferences.current.scale
        )
    }

    // MARK: - Menu actions

    private func handle(_ action: PetMenu.Action) {
        switch action {
        case .chooseTask:
            openPicker()
        case .resumeAutomatic:
            Task { await observer?.select(taskID: nil) }
        case .chooseAppearance(let id):
            do {
                try appearanceSelection.select(id)
                applyAppearance()
            } catch { showAppearanceError(error) }
        case .importAppearance:
            importAppearance()
        case .openTaskList:
            openListPage()
        case .retryConnection:
            Task { await observer?.retryConnection() }
        case .toggleAnimations:
            preferences.update { $0.animationsEnabled.toggle() }
            window.motionEnabled = preferences.current.animationsEnabled && !NativeProcess.reduceMotionEnabled()
            refreshMenu()
            if let lastUpdate { present(lastUpdate) }
        case .toggleIdleActivities:
            preferences.update { $0.idleActivitiesEnabled.toggle() }
            refreshMenu()
            refreshActivities()
        case .setScale(let scale):
            setScale(scale)
        case .toggleVisibility:
            setWindowVisible(!window.isVisible)
        case .quit:
            shutdown()
        }
    }

    // MARK: - Appearance selection

    private func setScale(_ scale: Double) {
        guard scale.isFinite, (0.5...2).contains(scale), scale != preferences.current.scale else { return }
        let size = window.content.requiredSize(atScale: scale)
        let previous = window.content.referencePoint(atScale: preferences.current.scale)
        let next = window.content.referencePoint(atScale: scale)
        let origin = PositionRules.constrain(
            position: .init(x: window.frame.minX + previous.x - next.x,
                            y: window.frame.minY + previous.y - next.y),
            windowSize: size,
            visibleFrame: window.screen?.visibleFrame ?? NSScreen.main?.visibleFrame ?? .zero,
            fallbackInset: 24)
        guard preferences.update({ value in
            value.scale = scale
            value.position = .init(x: origin.x, y: origin.y)
        }) else {
            showTransient(strings.sizeSaveFailed)
            return
        }
        activities.interrupt()
        applyActivityOutput()
        window.content.setScale(scale)
        window.layout(atOrigin: origin)
        if let lastUpdate { present(lastUpdate) }
        activityCenter = origin
        window.content.synchronizeHover()
        refreshMenu()
        refreshActivities()
    }

    private func applyAppearance() {
        window.content.character.configure(library: library, strings: strings)
        activities.configure(catalog: library?.catalog)
        appliedPlayback = nil
        if window.isVisible, !sleeping {
            if let lastUpdate { present(lastUpdate) }
            else { play(PresentationState().result, allowPrompt: false) }
        }
        refreshMenu()
    }

    private func importAppearance() {
        guard !importingAppearance else { return }
        importingAppearance = true
        refreshMenu()
        refreshActivities()
        let panel = NSOpenPanel()
        panel.canChooseDirectories = true
        panel.canChooseFiles = false
        panel.allowsMultipleSelection = false
        panel.message = strings.appearanceImportInstructions
        panel.prompt = strings.importAppearance
        NSApp.activate(ignoringOtherApps: true)
        panel.begin { [weak self] response in
            guard let self else { return }
            guard response == .OK, let url = panel.url else {
                self.importingAppearance = false
                self.refreshMenu()
                self.refreshActivities()
                self.window.content.synchronizeHover()
                return
            }
            let store = self.appearanceStore
            Task { @MainActor in
                defer {
                    self.importingAppearance = false
                    self.refreshMenu()
                    self.refreshActivities()
                    self.window.content.synchronizeHover()
                }
                do {
                    let appearance = try await Task.detached(priority: .userInitiated) {
                        try store.importDirectory(url)
                    }.value
                    guard !self.exiting else { return }
                    self.availableAppearances = store.appearances()
                    try self.appearanceSelection.select(appearance.id)
                    self.applyAppearance()
                } catch {
                    if !self.exiting { self.showAppearanceError(error) }
                }
            }
        }
    }

    private func showAppearanceError(_ error: Error, restoring: Bool = false) {
        guard !exiting else { return }
        showingAppearanceError = true
        refreshActivities()
        defer {
            showingAppearanceError = false
            refreshActivities()
            window.content.synchronizeHover()
        }
        let alert = NSAlert()
        alert.messageText = strings.appearanceFailed
        alert.informativeText = (restoring ? strings.appearanceRestoreFailed + "\n\n" : "") + error.localizedDescription
        alert.addButton(withTitle: strings.dismiss)
        NSApp.activate(ignoringOtherApps: true)
        alert.runModal()
    }

    // MARK: - Window interaction

    func petWindowDidRequestOpen() {
        openCurrentTaskPage()
    }

    func petWindowDidRequestMenu(at location: NSPoint, in view: NSView) {
        refreshMenu()
        menu.showContextMenu(at: location, in: view)
    }

    func petWindowDidMove(toOrigin origin: CGPoint) {
        let origin = constrainedOrigin(origin)
        window.layout(atOrigin: origin)
        activityCenter = origin
        preferences.update { preferences in
            preferences.position = PetPreferences.Position(x: origin.x, y: origin.y)
        }
    }

    func petWindowDraggingChanged(_ isDragging: Bool) {
        dragging = isDragging
        refreshActivities()
        if !isDragging {
            activities.dropped()
            applyActivityOutput()
        }
    }

    func petWindowPressedChanged(_ isPressed: Bool) {
        pressed = isPressed
        refreshActivities()
    }

    func petWindowHoverChanged(_ hovering: Bool) {
        activities.windowHoverChanged(hovering)
        applyActivityOutput()
        window.setBubbleHovered(hovering)
        if hovering, !dragging, activities.currentActivity == nil, let clip = activities.playback?.clip {
            window.content.character.reactToHover(clip: clip)
        }
    }

    func petWindowCharacterHoverChanged(_ hovering: Bool) {
        if hovering { activities.windowHoverChanged(true) }
        activities.characterHoverChanged(hovering)
        applyActivityOutput()
    }

    // MARK: - Visibility

    private func applyVisibility(firstShow: Bool) {
        let visibleFrame = window.screen?.visibleFrame ?? NSScreen.main?.visibleFrame ?? .zero
        let origin = PositionRules.constrain(
            position: preferences.current.position,
            windowSize: window.content.requiredSize,
            visibleFrame: visibleFrame,
            fallbackInset: 24
        )
        window.layout(atOrigin: origin)
        activityCenter = origin
        if firstShow {
            window.orderFrontRegardless()
            window.content.synchronizeHover()
            refreshMenu()
        }
    }

    /// Hiding stops animation and polling; showing restores the remembered
    /// position and reads again. Showing is a first read, so the observer clears
    /// the previous prompt basis.
    private func setWindowVisible(_ visible: Bool) {
        guard visible != window.isVisible else { return }
        awaitingObservation = true
        refreshActivities()
        activities.resetInteractions()
        if visible {
            applyVisibility(firstShow: true)
            Task { await observer?.beginObserving() }
        } else {
            window.stopBubbleTransitions()
            window.orderOut(nil)
            window.content.character.stopPlayback()
            picker?.dismiss()
            Task { await observer?.endObserving() }
        }
        refreshMenu()
    }

    private func registerWorkspaceObservers() {
        let workspace = NSWorkspace.shared.notificationCenter
        observers.append(workspace.addObserver(
            forName: NSWorkspace.willSleepNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            MainActor.assumeIsolated { self?.handleSleep() }
        })
        observers.append(workspace.addObserver(
            forName: NSWorkspace.didWakeNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            MainActor.assumeIsolated { self?.handleWake() }
        })
        observers.append(NotificationCenter.default.addObserver(
            forName: NSApplication.didChangeScreenParametersNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            MainActor.assumeIsolated { self?.handleScreenChange() }
        })
        observers.append(workspace.addObserver(
            forName: NSWorkspace.accessibilityDisplayOptionsDidChangeNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            MainActor.assumeIsolated {
                guard let self else { return }
                self.window.motionEnabled = self.preferences.current.animationsEnabled && !NativeProcess.reduceMotionEnabled()
                self.refreshMenu()
                if let update = self.lastUpdate { self.present(update) }
            }
        })
    }

    private func handleSleep() {
        sleeping = true
        window.stopBubbleTransitions()
        awaitingObservation = true
        refreshActivities()
        activities.resetInteractions()
        window.content.character.stopPlayback()
        picker?.dismiss()
        Task { await observer?.endObserving() }
    }

    /// Waking reads again, and the first result never replays a historical
    /// prompt.
    private func handleWake() {
        sleeping = false
        guard window.isVisible else { return }
        Task {
            await observer?.refreshNow()
            await observer?.beginObserving()
        }
    }

    /// A removed or rearranged display moves the whole window back into a
    /// visible work area instead of leaving it unreachable.
    private func handleScreenChange() {
        guard window.isVisible else { return }
        activities.interrupt()
        applyActivityOutput()
        window.layout(atOrigin: constrainedOrigin(window.frame.origin))
        activityCenter = constrainedOrigin(activityCenter)
        refreshActivities()
    }

    private func constrainedOrigin(_ origin: CGPoint) -> CGPoint {
        PositionRules.constrain(
            position: PetPreferences.Position(x: origin.x, y: origin.y),
            windowSize: window.content.requiredSize,
            visibleFrame: window.screen?.visibleFrame ?? NSScreen.main?.visibleFrame ?? .zero,
            fallbackInset: 24
        )
    }

    // MARK: - Task selection

    /// Opens the selection panel. The panel reads pages only while it is open,
    /// and confirming closes it so the desktop reads the new Task immediately.
    private func openPicker() {
        picker?.dismiss()
        pickingTask = true
        refreshActivities()
        Task { @MainActor in
            guard let observer else { return }
            let session = await observer.beginListSession()
            presentPicker(session: session, observer: observer)
        }
    }

    private func presentPicker(session: Int, observer: TaskObserver) {
        let panel = TaskPickerPanel(session: session)
        panel.configure(strings: strings, watchingTaskID: lastUpdate?.selectedTaskID)
        panel.onLoadPage = { page in
            await observer.loadList(page: page, lifecycle: nil, session: session)
        }
        panel.onChoose = { [weak self] taskID in
            self?.window.content.character.stopPlayback()
            if let self {
                self.lastUpdate = nil
                self.awaitingObservation = true
                self.pickingTask = false
                self.refreshActivities()
                self.window.content.bubble.update(BubbleContent(
                    title: self.strings.pickerLoading, stage: nil, summary: nil,
                    taskUpdated: nil, lastSync: nil, blocker: nil
                ))
                self.window.relayoutForBubble()
            }
            self?.picker = nil
            Task { await observer.select(taskID: taskID) }
            // A closed panel supersedes its own session, so a late page cannot
            // arrive after the new selection.
            Task { _ = await observer.beginListSession() }
        }
        panel.onDismiss = { [weak self] in
            self?.picker = nil
            self?.pickingTask = false
            self?.refreshActivities()
            self?.window.content.synchronizeHover()
            Task { _ = await observer.beginListSession() }
        }
        panel.isReleasedWhenClosed = false
        picker = panel
        panel.center()
        panel.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
        panel.loadFirstPage()
    }

    // MARK: - Navigation

    private func openListPage() {
        openPage(phase: .noSelection, selectedTaskID: nil)
    }

    /// Re-checks the service with the same Core before navigating, so an
    /// outdated address can never open the wrong service.
    private func openCurrentTaskPage() {
        guard let update = lastUpdate else {
            openPage(phase: .noSelection, selectedTaskID: nil)
            return
        }
        openPage(phase: update.presentation.phase, selectedTaskID: update.selectedTaskID)
    }

    private func openPage(phase: DisplayPhase, selectedTaskID: String?) {
        Task { @MainActor in
            let coreResult = await core.status()
            var live: SystemStatusResponse?
            var origin: String?
            if case .status(let status) = coreResult, let client = LoopbackWebUIClient(origin: status.url) {
                if case .value(let value) = await client.systemStatus() {
                    live = value
                    origin = status.url
                }
            }
            if let block = NavigationRules.recheck(
                coreResult: coreResult,
                live: live,
                expectedCoreIdentity: expectedCoreIdentity,
                expectedDataRootDigest: expectedDataRootDigest
            ) {
                isConnected = false
                refreshMenu()
                showTransient(block == .identityMismatch ? strings.exitCoreIdentityChanged : strings.disconnectedDetail)
                Task { await observer?.refreshNow() }
                return
            }
            guard let origin else {
                showTransient(strings.disconnectedDetail)
                return
            }
            switch NavigationRules.target(origin: origin, phase: phase, selectedTaskID: selectedTaskID) {
            case .taskDetail(let url), .taskList(let url):
                // A failed open keeps the current picture so the user can click
                // again. Background refresh never opens a browser.
                if !NativeProcess.openInBrowser(url) {
                    petLog.error("the default browser did not accept \(url, privacy: .private)")
                } else if let selectedTaskID {
                    await observer?.acknowledge(taskID: selectedTaskID)
                }
            case .blocked(let block):
                showTransient(block == .identityMismatch ? strings.exitCoreIdentityChanged : strings.disconnectedDetail)
            }
        }
    }

    /// Replaces the bubble text briefly. The next observation restores the
    /// regular content, so no separate state is persisted.
    private func showTransient(_ message: String) {
        transientMessage = message
        transientTask?.cancel()
        if let lastUpdate { present(lastUpdate) }
        transientTask = Task { @MainActor [weak self] in
            try? await Task.sleep(nanoseconds: UInt64(Self.messageDelay * 1_000_000_000))
            guard !Task.isCancelled, let self else { return }
            self.transientMessage = nil
            if let update = self.lastUpdate { self.present(update) }
        }
    }

    // MARK: - Shutdown

    private func exitFor(reason: ExitReason) {
        guard !exiting else { return }
        exiting = true
        refreshActivities()
        let message: String
        switch reason {
        case .coreExecutableMissing: message = strings.exitCoreMissing
        case .coreIdentityChanged: message = strings.exitCoreIdentityChanged
        case .dataRootDigestChanged: message = strings.exitDataRootChanged
        }
        petLog.error("exiting: \(reason.rawValue, privacy: .public)")
        isConnected = false
        transientMessage = message
        window.content.bubble.update(BubbleContent(
            title: message, stage: nil, summary: nil, taskUpdated: nil, lastSync: nil, blocker: nil
        ))
        window.relayoutForBubble()
        window.content.character.stopPlayback()
        refreshMenu()
        Task { @MainActor [weak self] in
            try? await Task.sleep(nanoseconds: UInt64(Self.messageDelay * 1_000_000_000))
            self?.shutdown()
        }
    }

    /// The orderly shutdown: cancel requests, stop animation, save preferences,
    /// close the window and the menu bar entry, remove this instance's own
    /// runtime record, and release the lock. A normal quit never force-kills
    /// another process and never stops the WebUI.
    func shutdown() {
        window.stopBubbleTransitions()
        guard !runtime.isShutdownStarted else { return }
        runtime.beginShutdown()
        exiting = true
        refreshActivities()
        transientTask?.cancel()
        picker?.orderOut(nil)
        picker = nil
        for observer in observers {
            NSWorkspace.shared.notificationCenter.removeObserver(observer)
            NotificationCenter.default.removeObserver(observer)
        }
        observers = []
        let running = observer
        observer = nil
        window.content.character.stopPlayback()
        preferences.save()
        window.orderOut(nil)
        menu.removeStatusItem()
        runtime.release()
        if let running {
            Task {
                await running.cancel()
                self.onShutdown()
            }
        } else {
            onShutdown()
        }
    }

    /// Asks a running instance to show its window again. `SIGUSR1` carries no
    /// Task or connection state, only the request to become visible.
    func restoreVisibility() {
        guard window.isVisible else {
            setWindowVisible(true)
            return
        }
        window.orderFrontRegardless()
    }
}
