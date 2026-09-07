import Foundation

/// Chooses local artwork and deadlines. Task state comes from PresentationRules;
/// the desktop adapter runs timers, renders frames, and moves the window.
final class PetActivityController {
    struct Controls: Equatable {
        var visible = true
        var connected = true
        var animationsEnabled = true
        var idleActivitiesEnabled = true
        var reduceMotion = false
        var interactionBlocked = false
        var dragging = false
    }

    struct Geometry {
        var originX: Double
        var walkingRange: ClosedRange<Double>?
        var scale: Double = 1
    }

    struct PlaybackRequest: Equatable {
        let clip: AnimationClip
        let playback: ClipPlayback
        let serial: Int
    }

    struct WalkRequest: Equatable {
        let targetX: Double
        let duration: TimeInterval
        let serial: Int
    }

    private struct Artwork: Equatable {
        let clip: AnimationClip
        let playback: ClipPlayback
    }

    private let now: () -> TimeInterval
    private let random: () -> Double
    private var catalog: AnimationCatalog?
    private var controls = Controls(visible: false)
    private var result: PresentationRules.Result?
    private var taskID: String?
    private var baseArtwork: Artwork?
    private var activityArtwork: Artwork?
    private var failedClips: Set<AnimationClip> = []
    private var serial = 0
    private var celebrating = false
    private var terminalReadyAt: TimeInterval?
    private var randomAt: TimeInterval?
    private var hoverAt: TimeInterval?
    private var lastWaveAt: TimeInterval?
    private var lastChoice: AnimationClip?
    private var greetingPending = true
    private var windowHovered = false
    private var characterHovered = false
    private var characterExitedAt: TimeInterval?

    var geometry = Geometry(originX: 0, walkingRange: nil)
    private(set) var playback: PlaybackRequest?
    private(set) var walk: WalkRequest?
    var currentActivity: AnimationClip? { activityArtwork?.clip }

    init(now: @escaping () -> TimeInterval = { ProcessInfo.processInfo.systemUptime },
         random: @escaping () -> Double = { Double.random(in: 0..<1) }) {
        self.now = now
        self.random = random
    }

    func configure(catalog: AnimationCatalog?) {
        self.catalog = catalog
        failedClips = []
        result = nil
        baseArtwork = nil
        celebrating = false
        terminalReadyAt = nil
        lastChoice = nil
        greetingPending = true
        cancelActivity()
        playback = nil
    }

    /// Repeated reads of the same display state preserve the current animation.
    func update(_ next: PresentationRules.Result, taskID: String?, controls nextControls: Controls,
                allowPrompt: Bool = false) {
        let changedTask = self.taskID != taskID || result?.phase != next.phase
        let changedAnimation = controls.animationsEnabled != nextControls.animationsEnabled
            || controls.reduceMotion != nextControls.reduceMotion
            || controls.visible != nextControls.visible || controls.dragging != nextControls.dragging
        let newPrompt = allowPrompt && next.playIntro
        let newlyVisible = !controls.visible && nextControls.visible
        let wasCelebrating = celebrating
        self.taskID = taskID
        result = next
        controls = nextControls

        if changedTask || changedAnimation || newPrompt || baseArtwork == nil {
            cancelActivity()
            celebrating = false
            baseArtwork = taskArtwork(next, allowPrompt: newPrompt && !controls.dragging)
            if next.phase == .completed, newPrompt, case .onceThenRest = baseArtwork?.playback {
                celebrating = true
            }
            if changedTask || newlyVisible || newPrompt || wasCelebrating {
                terminalReadyAt = PresentationRules.needsTerminalRest(next.phase) && !celebrating ? now() + 3 : nil
            }
            if newPrompt { playback = nil }
        }

        if !controls.visible {
            greetingPending = true
        } else if !controls.animationsEnabled || controls.reduceMotion || !controls.idleActivitiesEnabled {
            greetingPending = false
        } else if controls.connected && !PresentationRules.permitsIdleActivities(next.phase) {
            greetingPending = false
        }
        reconcile()
    }

    var nextDeadline: TimeInterval? {
        guard canUseIdleActivities, !controls.interactionBlocked, !controls.dragging else { return nil }
        return [terminalReadyAt, hoverAt, randomAt].compactMap { $0 }.min()
    }

    func tick() {
        if let deadline = terminalReadyAt, now() >= deadline { terminalReadyAt = nil }
        if let deadline = hoverAt, now() >= deadline {
            hoverAt = nil
            if idleReady && characterHovered { _ = startWave() }
        }
        if let deadline = randomAt, now() >= deadline {
            randomAt = nil
            if idleReady && !windowHovered && activityArtwork == nil { chooseActivity() }
        }
        reconcile()
    }

    func windowHoverChanged(_ hovering: Bool) {
        guard windowHovered != hovering else { return }
        windowHovered = hovering
        randomAt = nil
        if hovering, activityArtwork?.clip != .waving { cancelActivity() }
        if !hovering { characterHoverChanged(false) }
        reconcile()
    }

    func characterHoverChanged(_ hovering: Bool) {
        guard characterHovered != hovering else { return }
        characterHovered = hovering
        hoverAt = nil
        if hovering {
            if idleReady && (characterExitedAt.map { now() - $0 >= 2 } ?? true) {
                hoverAt = now() + 0.4
            }
        } else {
            characterExitedAt = now()
        }
    }

    func dropped() {
        if idleReady { _ = startWave() }
        reconcile()
    }

    /// Called only after the player actually completes its finite sequence.
    func playbackFinished(_ clip: AnimationClip) {
        if celebrating && clip == .complete {
            celebrating = false
            if let description = description(for: .complete) {
                baseArtwork = Artwork(clip: .complete, playback: .rest(frameIndex: description.restFrame))
            }
            terminalReadyAt = now() + 3
        } else if activityArtwork?.clip == clip && walk == nil {
            activityArtwork = nil
            randomAt = nil
        }
        reconcile()
    }

    func walkingFinished() {
        guard walk != nil else { return }
        walk = nil
        activityArtwork = nil
        if idleReady && !windowHovered && random() < 0.3 { _ = startWave() }
        reconcile()
    }

    /// An unreadable clip is excluded until this appearance is loaded again.
    func playbackFailed(_ clip: AnimationClip) {
        failedClips.insert(clip)
        if activityArtwork?.clip == clip { cancelActivity() }
        if celebrating && clip == .complete {
            celebrating = false
            terminalReadyAt = now() + 3
        }
        if let result { baseArtwork = taskArtwork(result, allowPrompt: false) }
        reconcile()
    }

    func resetInteractions() {
        windowHovered = false
        characterHovered = false
        characterExitedAt = nil
        cancelActivity()
        reconcile()
    }

    func interrupt() {
        cancelActivity()
        reconcile()
    }

    private var canUseIdleActivities: Bool {
        guard let result else { return false }
        return controls.visible && controls.connected && controls.animationsEnabled
            && controls.idleActivitiesEnabled && !controls.reduceMotion
            && PresentationRules.permitsIdleActivities(result.phase)
    }

    private var idleReady: Bool {
        canUseIdleActivities && !controls.interactionBlocked && !controls.dragging && !celebrating
            && (terminalReadyAt.map { now() >= $0 } ?? true)
    }

    private func reconcile() {
        guard controls.visible, !controls.dragging else {
            cancelActivity()
            playback = nil
            return
        }
        guard idleReady else {
            cancelActivity()
            if let baseArtwork { show(baseArtwork) }
            return
        }
        terminalReadyAt = nil
        if greetingPending {
            greetingPending = false
            _ = startWave()
        }
        if let activityArtwork {
            show(activityArtwork)
            return
        }
        if let idle = description(for: .idle) {
            show(Artwork(clip: .idle, playback: PlaybackRules.playback(clip: idle,
                playIntro: false, useRestFrame: false, animationsEnabled: true, reduceMotion: false)))
        } else if let baseArtwork { show(baseArtwork) }
        if !windowHovered && randomAt == nil && hasAdditionalArtwork {
            randomAt = now() + 6 + random() * 6
        }
    }

    private var hasAdditionalArtwork: Bool {
        [AnimationClip.runningRight, .runningLeft, .waving, .review].contains { description(for: $0) != nil }
    }

    private func cancelActivity() {
        activityArtwork = nil
        walk = nil
        randomAt = nil
        hoverAt = nil
    }

    private func description(for clip: AnimationClip) -> AnimationCatalog.Clip? {
        failedClips.contains(clip) ? nil : catalog?.clips[clip]
    }

    private func taskArtwork(_ result: PresentationRules.Result, allowPrompt: Bool) -> Artwork {
        let clip = result.clip == .review && description(for: .review) == nil ? .working : result.clip
        guard let description = description(for: clip) else {
            return Artwork(clip: clip, playback: .rest(frameIndex: 0))
        }
        return Artwork(clip: clip, playback: PlaybackRules.playback(clip: description,
            playIntro: allowPrompt, useRestFrame: result.useRestFrame || (clip == .complete && !allowPrompt),
            animationsEnabled: controls.animationsEnabled, reduceMotion: controls.reduceMotion))
    }

    private func show(_ artwork: Artwork, force: Bool = false) {
        guard force || playback?.clip != artwork.clip || playback?.playback != artwork.playback else { return }
        serial += 1
        playback = PlaybackRequest(clip: artwork.clip, playback: artwork.playback, serial: serial)
    }

    private var canWave: Bool {
        description(for: .waving) != nil && (lastWaveAt.map { now() - $0 >= 20 } ?? true)
    }

    @discardableResult
    private func startWave() -> Bool {
        guard idleReady && canWave, let clip = description(for: .waving) else { return false }
        cancelActivity()
        lastWaveAt = now()
        lastChoice = .waving
        let artwork = Artwork(clip: .waving,
            playback: .repeatThenRest(cycles: random() < 0.5 ? 1 : 2, restFrame: clip.restFrame))
        activityArtwork = artwork
        show(artwork, force: true)
        return true
    }

    private func walkingDistance(_ clip: AnimationClip) -> Double {
        guard let range = geometry.walkingRange else { return 0 }
        let space = clip == .runningRight ? range.upperBound - geometry.originX : geometry.originX - range.lowerBound
        return min(80, max(0, space))
    }

    private func chooseActivity() {
        var choices: [(AnimationClip, Double)] = [(.runningRight, 25), (.runningLeft, 25), (.waving, 20), (.review, 30)]
        choices.removeAll { clip, _ in
            description(for: clip) == nil || (clip == .waving && !canWave)
                || ((clip == .runningRight || clip == .runningLeft) && walkingDistance(clip) < 40)
        }
        if choices.count > 1 { choices.removeAll { $0.0 == lastChoice } }
        guard !choices.isEmpty else { return }
        let value = random() * choices.reduce(0) { $0 + $1.1 }
        var upper = 0.0
        let selected = choices.first { choice in upper += choice.1; return value < upper }?.0 ?? choices[choices.count - 1].0
        if selected == .waving { _ = startWave(); return }
        guard let clip = description(for: selected) else { return }
        lastChoice = selected
        if selected == .review {
            let duration = clip.frames.indices.reduce(0) { $0 + PlaybackRules.frameDuration(clip, index: $1) }
            let cycles = max(1, Int(ceil((3 + random() * 2) / duration)))
            activityArtwork = Artwork(clip: selected, playback: .repeatThenRest(cycles: cycles, restFrame: clip.restFrame))
        } else {
            let distance = 40 + random() * (walkingDistance(selected) - 40)
            serial += 1
            walk = WalkRequest(targetX: geometry.originX + (selected == .runningRight ? distance : -distance),
                duration: distance / (20 * geometry.scale), serial: serial)
            activityArtwork = Artwork(clip: selected, playback: .loop(0...(clip.frames.count - 1)))
        }
        if let activityArtwork { show(activityArtwork, force: true) }
    }
}
