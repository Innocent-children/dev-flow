import AppKit
import Foundation

/// Renders the delivered frame animation of the current clip.
///
/// The view owns only playback. Which clip plays, whether its attention segment
/// is shown, and whether a static frame replaces the loop are decided by
/// `PresentationRules` and `PlaybackRules`. Every timer stops when the view is
/// hidden or the desktop quits, so no animation keeps running in the background.
@MainActor
final class PetCharacterView: NSView {
    /// The delivered character size used for layout and clarity checks.
    static let characterSize = CGSize(width: 144, height: 144)

    private let imageView = NSImageView()
    private let diagnosticLabel = NSTextField(labelWithString: "")

    private var library: AssetLibrary?
    private var strings: PetStrings = .english
    private var timer: Timer?
    private var frames: ClipFrames?
    private var clipDescription: AnimationCatalog.Clip?
    private var currentClip: AnimationClip?
    private(set) var currentPlayback: ClipPlayback?

    /// Remaining explicit frames before the loop or the static frame takes over.
    private var sequence: [Int] = []
    private var loopRange: ClosedRange<Int>?
    private var restFrame: Int?
    private var loopCursor = 0

    override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        wantsLayer = true
        layer?.backgroundColor = NSColor.clear.cgColor

        imageView.imageScaling = .scaleProportionallyUpOrDown
        imageView.animates = false
        imageView.translatesAutoresizingMaskIntoConstraints = false
        addSubview(imageView)

        diagnosticLabel.font = NSFont.systemFont(ofSize: 10)
        diagnosticLabel.textColor = NSColor.secondaryLabelColor
        diagnosticLabel.alignment = .center
        diagnosticLabel.lineBreakMode = .byWordWrapping
        diagnosticLabel.maximumNumberOfLines = 2
        diagnosticLabel.translatesAutoresizingMaskIntoConstraints = false
        diagnosticLabel.isHidden = true
        addSubview(diagnosticLabel)

        NSLayoutConstraint.activate([
            imageView.topAnchor.constraint(equalTo: topAnchor),
            imageView.bottomAnchor.constraint(equalTo: bottomAnchor),
            imageView.leadingAnchor.constraint(equalTo: leadingAnchor),
            imageView.trailingAnchor.constraint(equalTo: trailingAnchor),
            diagnosticLabel.centerXAnchor.constraint(equalTo: centerXAnchor),
            diagnosticLabel.centerYAnchor.constraint(equalTo: centerYAnchor),
            diagnosticLabel.leadingAnchor.constraint(greaterThanOrEqualTo: leadingAnchor, constant: 6),
            diagnosticLabel.trailingAnchor.constraint(lessThanOrEqualTo: trailingAnchor, constant: -6),
        ])
    }

    required init?(coder: NSCoder) {
        fatalError("PetCharacterView is created in code")
    }

    override var intrinsicContentSize: NSSize { Self.characterSize }

    func configure(library: AssetLibrary?, strings: PetStrings) {
        stopPlayback()
        self.library = library
        self.strings = strings
        diagnosticLabel.stringValue = strings.assetsUnavailable
    }

    /// Starts the clip chosen for the current display phase.
    ///
    /// `playIntro` shows the attention segment once; `useRestFrame` shows the
    /// clip's dedicated static frame and runs no timer. Calling this with the
    /// same clip and the same playback only restarts the sequence when the
    /// playback actually changed, so a steady phase does not stutter.
    func play(clip: AnimationClip, playback: ClipPlayback, restart: Bool) {
        guard let library else {
            showDiagnostic(clip: clip)
            return
        }
        diagnosticLabel.isHidden = true
        guard let description = library.catalog.clips[clip] else {
            stopPlayback()
            showDiagnostic(clip: clip)
            return
        }
        let decoded: ClipFrames
        do {
            decoded = try library.frames(for: clip)
        } catch {
            stopPlayback()
            showDiagnostic(clip: clip)
            return
        }

        let unchanged = currentClip == clip && clipDescription == description && currentPlayback == playback && !restart
        frames = decoded
        clipDescription = description
        currentClip = clip
        currentPlayback = playback
        switch playback {
        case .rest(let frameIndex):
            if unchanged { return }
            stopTimer()
            sequence = []
            loopRange = nil
            restFrame = frameIndex
            show(frameIndex)
        case .loop(let range):
            if unchanged { return }
            sequence = []
            loopRange = range
            restFrame = nil
            loopCursor = range.lowerBound
            show(loopCursor)
            scheduleNextFrame(after: loopCursor)
        case .introThenLoop(let intro, let loop):
            if unchanged { return }
            sequence = Array(intro.lowerBound...intro.upperBound)
            loopRange = loop
            restFrame = nil
            loopCursor = loop.lowerBound - 1
            advance()
        case .onceThenRest(let lastFrameIndex, let rest):
            if unchanged { return }
            sequence = Array(0...max(lastFrameIndex, 0))
            loopRange = nil
            restFrame = rest
            advance()
        }
    }

    /// The hover reaction allowed by the animation rules: the attention segment
    /// of a quietly looping clip is shown once. Alert clips keep their quiet
    /// loop so hovering never repeats a blocked or disconnected prompt, and the
    /// celebration is never replayed.
    func reactToHover(clip: AnimationClip) {
        guard timer != nil, sequence.isEmpty,
              let description = clipDescription, description.loopRange != nil,
              let intro = description.introRange,
              clip == .idle || clip == .working else {
            return
        }
        sequence = Array(intro.lowerBound...intro.upperBound)
        if let range = description.loopRange { loopCursor = range.lowerBound - 1 }
    }

    /// Stops every timer and releases the retained frames.
    func stopPlayback() {
        pausePlayback()
        frames = nil
        clipDescription = nil
        currentClip = nil
        imageView.image = nil
        library?.releaseFrames()
    }

    /// Keeps the current picture while dragging or preparing a fresh observation.
    func pausePlayback() {
        stopTimer()
        sequence = []
        loopRange = nil
        restFrame = nil
        currentPlayback = nil
    }

    private func showDiagnostic(clip: AnimationClip) {
        stopTimer()
        imageView.image = nil
        diagnosticLabel.stringValue = "\(strings.assetsUnavailable)\n\(clip.rawValue)"
        diagnosticLabel.isHidden = false
        wantsLayer = true
        layer?.borderWidth = 1
        layer?.borderColor = NSColor.separatorColor.cgColor
        layer?.cornerRadius = 12
    }

    private func scheduleNextFrame(after index: Int) {
        stopTimer()
        guard let description = clipDescription else { return }
        let interval = PlaybackRules.frameDuration(description, index: index)
        guard interval > 0 else { return }
        let scheduled = Timer(timeInterval: interval, repeats: false) { [weak self] _ in
            MainActor.assumeIsolated {
                self?.advance()
            }
        }
        RunLoop.main.add(scheduled, forMode: .common)
        timer = scheduled
    }

    private func stopTimer() {
        timer?.invalidate()
        timer = nil
        layer?.borderWidth = 0
    }

    private func advance() {
        if !sequence.isEmpty {
            let index = sequence.removeFirst()
            show(index)
            scheduleNextFrame(after: index)
            return
        }
        guard let loopRange else {
            stopTimer()
            if let restFrame {
                currentPlayback = .rest(frameIndex: restFrame)
                show(restFrame)
            }
            return
        }
        currentPlayback = .loop(loopRange)
        loopCursor = loopCursor >= loopRange.upperBound ? loopRange.lowerBound : loopCursor + 1
        show(loopCursor)
        scheduleNextFrame(after: loopCursor)
    }

    private func show(_ index: Int) {
        guard let image = frames?.image(at: index) else { return }
        imageView.image = image
    }
}
