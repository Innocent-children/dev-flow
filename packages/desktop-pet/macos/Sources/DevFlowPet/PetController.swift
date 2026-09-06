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
        window.content.handler = self
        window.content.character.configure(library: selection.library, strings: strings)
        menu.onAction = { [weak self] action in self?.handle(action) }

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
        window.content.bubble.update(content)
        window.relayoutForBubble()
        if !dragging { play(update.presentation, allowPrompt: allowPrompt) }
    }

    /// Chooses the playback for the current phase. The animation switch in the
    /// menu and the system reduce-motion setting both select the clip's dedicated
    /// static frame; re-enabling animation never replays a prompt the user did
    /// not observe continuously.
    private func play(_ result: PresentationRules.Result, allowPrompt: Bool) {
        guard let library else {
            window.content.character.play(clip: result.clip, playback: .rest(frameIndex: 0), restart: true)
            return
        }
        guard let description = library.catalog.clips[result.clip] else {
            window.content.character.play(clip: result.clip, playback: .rest(frameIndex: 0), restart: true)
            return
        }
        let playback = PlaybackRules.playback(
            clip: description,
            playIntro: allowPrompt && result.playIntro,
            useRestFrame: result.useRestFrame || (result.clip == .complete && !allowPrompt),
            animationsEnabled: preferences.current.animationsEnabled,
            reduceMotion: NativeProcess.reduceMotionEnabled()
        )
        window.content.character.play(clip: result.clip, playback: playback, restart: allowPrompt && result.playIntro)
    }

    private func refreshMenu() {
        menu.refresh(
            strings: strings,
            isConnected: isConnected,
            isVisible: window.isVisible,
            animationsEnabled: preferences.current.animationsEnabled,
            reduceMotion: NativeProcess.reduceMotionEnabled(),
            appearances: availableAppearances,
            selectedAppearance: appearanceSelection.id,
            importingAppearance: importingAppearance
        )
    }

    // MARK: - Menu actions

    private func handle(_ action: PetMenu.Action) {
        switch action {
        case .chooseTask:
            openPicker()
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
            refreshMenu()
            if let lastUpdate { present(lastUpdate) }
        case .toggleVisibility:
            setWindowVisible(!window.isVisible)
        case .quit:
            shutdown()
        }
    }

    // MARK: - Appearance selection

    private func applyAppearance() {
        window.content.character.configure(library: library, strings: strings)
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
                return
            }
            let store = self.appearanceStore
            Task { @MainActor in
                defer {
                    self.importingAppearance = false
                    self.refreshMenu()
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
        preferences.update { preferences in
            preferences.position = PetPreferences.Position(x: origin.x, y: origin.y)
        }
    }

    func petWindowDraggingChanged(_ isDragging: Bool) {
        dragging = isDragging
        if isDragging {
            window.content.character.pausePlayback()
        } else if let lastUpdate {
            present(lastUpdate)
        }
    }

    func petWindowHoverChanged(_ hovering: Bool) {
        window.content.bubble.setExpanded(hovering)
        window.relayoutForBubble()
        if hovering, !dragging, let lastUpdate {
            window.content.character.reactToHover(clip: lastUpdate.presentation.clip)
        }
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
        if firstShow {
            window.orderFrontRegardless()
            refreshMenu()
        }
    }

    /// Hiding stops animation and polling; showing restores the remembered
    /// position and reads again. Showing is a first read, so the observer clears
    /// the previous prompt basis.
    private func setWindowVisible(_ visible: Bool) {
        guard visible != window.isVisible else { return }
        if visible {
            applyVisibility(firstShow: true)
            Task { await observer?.beginObserving() }
        } else {
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
                self.refreshMenu()
                if let update = self.lastUpdate { self.present(update) }
            }
        })
    }

    private func handleSleep() {
        sleeping = true
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
        window.layout(atOrigin: constrainedOrigin(window.frame.origin))
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
        guard !runtime.isShutdownStarted else { return }
        runtime.beginShutdown()
        exiting = true
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
