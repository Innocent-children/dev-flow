import AppKit
import Foundation

/// The interactions the desktop window reports upward. The window owns hit
/// testing, dragging, and hover; every product decision stays in the controller.
@MainActor
protocol PetWindowHandling: AnyObject {
    /// A click that was not a drag: open the current Task page.
    func petWindowDidRequestOpen()
    /// A right-click: show the same menu the menu bar entry uses.
    func petWindowDidRequestMenu(at location: NSPoint, in view: NSView)
    /// The window settled at a new position, which is remembered.
    func petWindowDidMove(toOrigin origin: CGPoint)
    /// Hovering expanded or collapsed the bubble.
    func petWindowHoverChanged(_ hovering: Bool)
    func petWindowCharacterHoverChanged(_ hovering: Bool)
    func petWindowPressedChanged(_ pressed: Bool)
    func petWindowDraggingChanged(_ dragging: Bool)
}

/// The floating panel that carries the character and its bubble.
///
/// The panel is non-activating, so passive updates, blocked prompts, and the
/// celebration never take keyboard focus from another application and never
/// play a sound. The window bounds wrap the character and the actual bubble
/// content; no screen-sized transparent window is created.
@MainActor
final class PetWindow: NSPanel {
    let content: PetContentView
    var onWalkingFinished: (() -> Void)?
    private var walkingTimer: Timer?

    var isWalking: Bool { walkingTimer != nil }

    init() {
        let contentView = PetContentView()
        content = contentView
        super.init(
            contentRect: NSRect(origin: .zero, size: contentView.requiredSize),
            styleMask: [.borderless, .nonactivatingPanel],
            backing: .buffered,
            defer: false
        )
        self.contentView = contentView
        isFloatingPanel = true
        becomesKeyOnlyIfNeeded = true
        level = .floating
        isOpaque = false
        backgroundColor = .clear
        hasShadow = false
        isMovableByWindowBackground = false
        hidesOnDeactivate = false
        isReleasedWhenClosed = false
        ignoresMouseEvents = false
        animationBehavior = .none
    }

    /// Places the window so the character's reference point stays where the user
    /// left it, then sizes the window around the current bubble content.
    func layout(atOrigin origin: CGPoint) {
        let size = content.requiredSize
        setFrame(NSRect(origin: origin, size: size), display: true)
    }

    /// Moves the panel temporarily; manual drag completion owns saved preferences.
    func startWalking(toX targetX: Double, duration: TimeInterval) {
        stopWalking()
        let startX = frame.minX
        let started = ProcessInfo.processInfo.systemUptime
        let timer = Timer(timeInterval: 1.0 / 30, repeats: true) { [weak self] _ in
            MainActor.assumeIsolated {
                guard let self else { return }
                let progress = min(1, (ProcessInfo.processInfo.systemUptime - started) / duration)
                self.setFrameOrigin(CGPoint(x: startX + (targetX - startX) * progress, y: self.frame.minY))
                if progress >= 1 {
                    self.stopWalking()
                    self.onWalkingFinished?()
                }
            }
        }
        walkingTimer = timer
        RunLoop.main.add(timer, forMode: .common)
    }

    func stopWalking() {
        walkingTimer?.invalidate()
        walkingTimer = nil
    }

    /// Resizes for a bubble expansion without moving the character. AppKit uses
    /// a bottom-left origin, so keeping the origin fixed grows the window upward.
    func relayoutForBubble() {
        guard isVisible else { return }
        let size = content.requiredSize
        let origin = PositionRules.constrain(
            position: PetPreferences.Position(x: frame.minX, y: frame.minY),
            windowSize: size,
            visibleFrame: screen?.visibleFrame ?? NSScreen.main?.visibleFrame ?? frame,
            fallbackInset: 24
        )
        setFrame(NSRect(origin: origin, size: size), display: true)
    }
}

/// The character plus its bubble, and the hit testing for click, drag, hover,
/// and right-click.
@MainActor
final class PetContentView: NSView {
    /// Moving further than this during a press makes it a drag, so releasing the
    /// button does not open the browser.
    static let dragThreshold: CGFloat = 4

    weak var handler: PetWindowHandling?

    let character = PetCharacterView(frame: .zero)
    let bubble = PetBubbleView(frame: .zero)

    private var trackingArea: NSTrackingArea?
    private var characterTrackingArea: NSTrackingArea?
    private var pressScreenLocation: NSPoint?
    private var pressWindowOrigin: CGPoint?
    private var isDragging = false
    private var scale: CGFloat = 1
    private lazy var characterWidth = character.widthAnchor.constraint(equalToConstant: PetCharacterView.characterSize.width)
    private lazy var characterHeight = character.heightAnchor.constraint(equalToConstant: PetCharacterView.characterSize.height)

    override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        wantsLayer = true
        layer?.backgroundColor = NSColor.clear.cgColor

        character.translatesAutoresizingMaskIntoConstraints = false
        bubble.translatesAutoresizingMaskIntoConstraints = false
        addSubview(bubble)
        addSubview(character)

        NSLayoutConstraint.activate([
            characterWidth,
            characterHeight,
            character.bottomAnchor.constraint(equalTo: bottomAnchor),
            character.centerXAnchor.constraint(equalTo: centerXAnchor),

            bubble.widthAnchor.constraint(equalToConstant: PetBubbleView.bubbleWidth),
            bubble.topAnchor.constraint(equalTo: topAnchor),
            bubble.centerXAnchor.constraint(equalTo: centerXAnchor),
            bubble.bottomAnchor.constraint(equalTo: character.topAnchor, constant: -PetBubbleView.characterSpacing),
        ])
    }

    required init?(coder: NSCoder) {
        fatalError("PetContentView is created in code")
    }

    /// The window size for the current bubble content and expansion state.
    var requiredSize: CGSize {
        requiredSize(atScale: Double(scale))
    }

    func requiredSize(atScale scale: Double) -> CGSize {
        let bubbleHeight = bubble.requiredHeight(width: PetBubbleView.bubbleWidth)
        return CGSize(
            width: max(PetBubbleView.bubbleWidth, PetCharacterView.characterSize.width * scale),
            height: bubbleHeight + PetBubbleView.characterSpacing + PetCharacterView.characterSize.height * scale
        )
    }

    /// Resizes the character independently of bubble typography and content.
    func setScale(_ value: Double) {
        guard value.isFinite, (0.5...2).contains(value) else { return }
        scale = value
        characterWidth.constant = PetCharacterView.characterSize.width * scale
        characterHeight.constant = PetCharacterView.characterSize.height * scale
        needsLayout = true
    }

    func referencePoint(atScale scale: Double) -> CGPoint {
        let size = CGSize(width: PetCharacterView.characterSize.width * scale,
                          height: PetCharacterView.characterSize.height * scale)
        let point = character.referencePoint(in: size)
        return CGPoint(x: (requiredSize(atScale: scale).width - size.width) / 2 + point.x, y: point.y)
    }

    override func updateTrackingAreas() {
        super.updateTrackingAreas()
        if trackingArea == nil {
            let area = NSTrackingArea(rect: .zero, options: [.mouseEnteredAndExited, .activeAlways, .inVisibleRect], owner: self)
            addTrackingArea(area)
            trackingArea = area
        }
        if characterTrackingArea?.rect != character.frame {
            if let characterTrackingArea { removeTrackingArea(characterTrackingArea) }
            let area = NSTrackingArea(rect: character.frame, options: [.mouseEnteredAndExited, .activeAlways],
                owner: self, userInfo: ["character": true])
            addTrackingArea(area)
            characterTrackingArea = area
        }
    }

    override func mouseEntered(with event: NSEvent) {
        if event.trackingArea?.userInfo?["character"] as? Bool == true {
            handler?.petWindowCharacterHoverChanged(true)
        } else {
            handler?.petWindowHoverChanged(true)
        }
    }

    override func mouseExited(with event: NSEvent) {
        if event.trackingArea?.userInfo?["character"] as? Bool == true {
            handler?.petWindowCharacterHoverChanged(false)
        } else {
            handler?.petWindowHoverChanged(false)
        }
    }

    /// Menus and panels consume pointer events; reconcile hover when they close.
    func synchronizeHover() {
        guard let window, window.isVisible else { return }
        let point = convert(window.mouseLocationOutsideOfEventStream, from: nil)
        let inside = visibleRect.contains(point)
        handler?.petWindowHoverChanged(inside)
        handler?.petWindowCharacterHoverChanged(inside && character.frame.contains(point))
    }

    override func mouseDown(with event: NSEvent) {
        handler?.petWindowPressedChanged(true)
        pressScreenLocation = NSEvent.mouseLocation
        pressWindowOrigin = window?.frame.origin
        isDragging = false
    }

    override func mouseDragged(with event: NSEvent) {
        guard let window, let start = pressScreenLocation, let origin = pressWindowOrigin else { return }
        let current = NSEvent.mouseLocation
        let delta = CGPoint(x: current.x - start.x, y: current.y - start.y)
        if !isDragging {
            guard hypot(delta.x, delta.y) > Self.dragThreshold else { return }
            isDragging = true
            handler?.petWindowDraggingChanged(true)
        }
        // Window movement preserves the point the user grabbed.
        window.setFrameOrigin(CGPoint(x: origin.x + delta.x, y: origin.y + delta.y))
    }

    override func mouseUp(with event: NSEvent) {
        let dragged = isDragging
        let origin = window?.frame.origin
        pressScreenLocation = nil
        pressWindowOrigin = nil
        isDragging = false
        if dragged {
            if let origin { handler?.petWindowDidMove(toOrigin: origin) }
            handler?.petWindowPressedChanged(false)
            handler?.petWindowDraggingChanged(false)
            synchronizeHover()
            return
        }
        handler?.petWindowPressedChanged(false)
        handler?.petWindowDidRequestOpen()
        synchronizeHover()
    }

    override func rightMouseDown(with event: NSEvent) {
        handler?.petWindowDidRequestMenu(at: convert(event.locationInWindow, from: nil), in: self)
    }

    /// The panel never becomes key from a passive update, so it accepts first
    /// mouse to keep dragging and clicking immediate.
    override func acceptsFirstMouse(for event: NSEvent?) -> Bool { true }
}
