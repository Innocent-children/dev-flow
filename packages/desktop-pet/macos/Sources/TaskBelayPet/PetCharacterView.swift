import AppKit
import Foundation
import QuartzCore

/// Renders the delivered frame animation of the current clip.
///
/// The view owns frame timing and completion callbacks. `PresentationRules`,
/// `PetActivityController`, and `PlaybackRules` select the artwork and playback.
/// The display link is active only while an animated clip is playing.
@MainActor
final class PetCharacterView: NSView {
    /// The delivered character size used for layout and clarity checks.
    static let characterSize = CGSize(width: 144, height: 144)

    private let imageView = NSImageView()
    private let diagnosticLabel = NSTextField(labelWithString: "")

    private var library: AssetLibrary?
    private var strings: PetStrings = .english
    private var frameLink: CADisplayLink?
    private var timeline: PetAnimationTimeline?
    private var startedAt: TimeInterval = 0
    private var requestedPlayback: ClipPlayback?
    private var displayedFrame: Int?
    private lazy var frameTarget = PetFrameTarget { [weak self] in self?.advance() }
    private var frames: ClipFrames?
    private var clipDescription: AnimationCatalog.Clip?
    private var currentClip: AnimationClip?
    private(set) var currentPlayback: ClipPlayback?
    var onPlaybackFinished: ((AnimationClip) -> Void)?
    var onArtworkLayoutChanged: (() -> Void)?
    private var topPadding: CGFloat = 0
    private var clipTopPadding: [AnimationClip: CGFloat] = [:]

    /// Transparent headroom of the entire clip, including proportional fitting.
    func topInset(in size: CGSize) -> CGFloat {
        guard let catalog = library?.catalog else { return 0 }
        let factor = min(size.width / CGFloat(catalog.canvas.width), size.height / CGFloat(catalog.canvas.height))
        let height = CGFloat(catalog.canvas.height) * factor
        return (size.height - height) / 2 + height * topPadding
    }

    /// A small alpha mask measures all poses once; vector artwork keeps its original representation.
    static func transparentTopFraction(_ images: [NSImage]) -> CGFloat {
        let side = 64
        var top = side
        for image in images {
            guard let bitmap = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: side, pixelsHigh: side,
                bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false,
                colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0),
                  let context = NSGraphicsContext(bitmapImageRep: bitmap) else { return 0 }
            NSGraphicsContext.saveGraphicsState()
            NSGraphicsContext.current = context
            image.draw(in: NSRect(x: 0, y: 0, width: side, height: side), from: .zero,
                       operation: .copy, fraction: 1)
            NSGraphicsContext.restoreGraphicsState()
            for y in 0..<top {
                if (0..<side).contains(where: { (bitmap.colorAt(x: $0, y: y)?.alphaComponent ?? 0) > 0 }) {
                    top = y
                    break
                }
            }
            if top == 0 { return 0 }
        }
        // Keep two sample rows around the silhouette for antialiasing and fine details.
        return top == side ? 0 : CGFloat(max(0, top - 2)) / CGFloat(side)
    }

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

    /// Locates the artwork anchor after proportional fitting in AppKit coordinates.
    func referencePoint(in size: CGSize) -> CGPoint {
        guard let catalog = library?.catalog else { return CGPoint(x: size.width / 2, y: 0) }
        let canvas = CGSize(width: catalog.canvas.width, height: catalog.canvas.height)
        let factor = min(size.width / canvas.width, size.height / canvas.height)
        return CGPoint(
            x: (size.width - canvas.width * factor) / 2 + catalog.anchor.x * factor,
            y: (size.height - canvas.height * factor) / 2 + (canvas.height - catalog.anchor.y) * factor)
    }

    func configure(library: AssetLibrary?, strings: PetStrings) {
        stopPlayback()
        self.library = library
        self.strings = strings
        clipTopPadding = [:]
        topPadding = 0
        onArtworkLayoutChanged?()
        diagnosticLabel.stringValue = strings.assetsUnavailable
    }

    /// Starts the clip chosen for the current display phase.
    ///
    /// `playIntro` shows the attention segment once; `useRestFrame` shows the
    /// clip's dedicated static frame and runs no timer. Calling this with the
    /// same clip and the same playback only restarts the sequence when the
    /// playback actually changed, so a steady phase does not stutter.
    @discardableResult
    func play(clip: AnimationClip, playback: ClipPlayback, restart: Bool) -> Bool {
        guard let library else {
            showDiagnostic(clip: clip)
            return false
        }
        diagnosticLabel.isHidden = true
        guard let description = library.catalog.clips[clip] else {
            stopPlayback()
            showDiagnostic(clip: clip)
            return false
        }
        let decoded: ClipFrames
        do {
            decoded = try library.frames(for: clip)
        } catch {
            stopPlayback()
            showDiagnostic(clip: clip)
            return false
        }

        let unchanged = currentClip == clip && clipDescription == description && requestedPlayback == playback && !restart
        if unchanged { return true }
        stopFrameLink()
        frames = decoded
        clipDescription = description
        currentClip = clip
        currentPlayback = playback
        requestedPlayback = playback
        let padding = clipTopPadding[clip] ?? Self.transparentTopFraction(decoded.images)
        clipTopPadding[clip] = padding
        if topPadding != padding {
            topPadding = padding
            onArtworkLayoutChanged?()
        }
        displayedFrame = nil
        imageView.setAccessibilityIdentifier("pet-animation-\(clip.rawValue)")
        timeline = PetAnimationTimeline(clip: description, playback: playback)
        startedAt = CACurrentMediaTime()
        show(timeline!.sample(at: 0).frame)
        if case .rest = playback { return true }
        let link = displayLink(target: frameTarget, selector: #selector(PetFrameTarget.tick))
        link.add(to: .main, forMode: .common)
        frameLink = link
        return true
    }

    /// The hover reaction allowed by the animation rules: the attention segment
    /// of a quietly looping clip is shown once. Alert clips keep their quiet
    /// loop so hovering never repeats a blocked or disconnected prompt, and the
    /// celebration is never replayed.
    func reactToHover(clip: AnimationClip) {
        guard frameLink != nil, currentClip == clip,
              let description = clipDescription, let loop = description.loopRange,
              let intro = description.introRange,
              timeline?.sample(at: CACurrentMediaTime() - startedAt).looping == true,
              clip == .idle || clip == .working else { return }
        timeline = PetAnimationTimeline(clip: description, playback: .introThenLoop(intro: intro, loop: loop))
        startedAt = CACurrentMediaTime()
        advance()
    }

    /// Stops display updates and releases the retained frames.
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
        stopFrameLink()
        timeline = nil
        currentPlayback = nil
        requestedPlayback = nil
    }

    private func showDiagnostic(clip: AnimationClip) {
        stopFrameLink()
        imageView.image = nil
        diagnosticLabel.stringValue = "\(strings.assetsUnavailable)\n\(clip.rawValue)"
        diagnosticLabel.isHidden = false
        wantsLayer = true
        layer?.borderWidth = 1
        layer?.borderColor = NSColor.separatorColor.cgColor
        layer?.cornerRadius = 12
    }

    private func stopFrameLink() {
        frameLink?.invalidate()
        frameLink = nil
        layer?.borderWidth = 0
    }

    private func advance() {
        guard let timeline else { return }
        let sample = timeline.sample(at: CACurrentMediaTime() - startedAt)
        show(sample.frame)
        if sample.finished {
            stopFrameLink()
            self.timeline = nil
            currentPlayback = .rest(frameIndex: sample.frame)
            if let currentClip { onPlaybackFinished?(currentClip) }
        } else if sample.looping, let range = clipDescription?.loopRange {
            currentPlayback = .loop(range)
        }
    }

    deinit { frameLink?.invalidate() }

    private func show(_ index: Int) {
        guard displayedFrame != index, let image = frames?.image(at: index) else { return }
        displayedFrame = index
        imageView.image = image
    }
}

/// A display-link target whose callback holds the view weakly.
@MainActor
private final class PetFrameTarget: NSObject {
    private let callback: () -> Void
    init(_ callback: @escaping () -> Void) { self.callback = callback }
    @objc func tick() { callback() }
}
