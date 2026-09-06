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
    private var pressScreenLocation: NSPoint?
    private var pressWindowOrigin: CGPoint?
    private var isDragging = false

    override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        wantsLayer = true
        layer?.backgroundColor = NSColor.clear.cgColor

        character.translatesAutoresizingMaskIntoConstraints = false
        bubble.translatesAutoresizingMaskIntoConstraints = false
        addSubview(bubble)
        addSubview(character)

        NSLayoutConstraint.activate([
            character.widthAnchor.constraint(equalToConstant: PetCharacterView.characterSize.width),
            character.heightAnchor.constraint(equalToConstant: PetCharacterView.characterSize.height),
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
        let bubbleHeight = bubble.requiredHeight(width: PetBubbleView.bubbleWidth)
        return CGSize(
            width: max(PetBubbleView.bubbleWidth, PetCharacterView.characterSize.width),
            height: bubbleHeight + PetBubbleView.characterSpacing + PetCharacterView.characterSize.height
        )
    }

    override func updateTrackingAreas() {
        super.updateTrackingAreas()
        if let trackingArea { removeTrackingArea(trackingArea) }
        let area = NSTrackingArea(
            rect: .zero,
            options: [.mouseEnteredAndExited, .activeAlways, .inVisibleRect],
            owner: self
        )
        addTrackingArea(area)
        trackingArea = area
    }

    override func mouseEntered(with event: NSEvent) {
        handler?.petWindowHoverChanged(true)
    }

    override func mouseExited(with event: NSEvent) {
        handler?.petWindowHoverChanged(false)
    }

    override func mouseDown(with event: NSEvent) {
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
            handler?.petWindowDraggingChanged(false)
            return
        }
        handler?.petWindowDidRequestOpen()
    }

    override func rightMouseDown(with event: NSEvent) {
        handler?.petWindowDidRequestMenu(at: convert(event.locationInWindow, from: nil), in: self)
    }

    /// The panel never becomes key from a passive update, so it accepts first
    /// mouse to keep dragging and clicking immediate.
    override func acceptsFirstMouse(for event: NSEvent?) -> Bool { true }
}
