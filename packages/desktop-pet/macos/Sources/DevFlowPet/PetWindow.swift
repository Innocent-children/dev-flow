import AppKit
import Foundation
import QuartzCore

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
    private var walkingRevision = 0
    private(set) var isWalking = false
    var motionEnabled = true {
        didSet {
            if oldValue && !motionEnabled { stopWalking(); stopBubbleResize() }
        }
    }
    private var hoverTimer: Timer?
    private var resizeRevision = 0
    private var resizeTarget: NSRect?
    private var requestedHover = false
    private var localMouseMonitor: Any?
    private var globalMouseMonitor: Any?


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
        acceptsMouseMovedEvents = true
        localMouseMonitor = NSEvent.addLocalMonitorForEvents(matching: .mouseMoved) { [weak self] event in
            MainActor.assumeIsolated { self?.updateMousePassthrough() }
            return event
        }
        globalMouseMonitor = NSEvent.addGlobalMonitorForEvents(matching: .mouseMoved) { [weak self] _ in
            MainActor.assumeIsolated { self?.updateMousePassthrough() }
        }
    }

    deinit {
        hoverTimer?.invalidate()
        if let localMouseMonitor { NSEvent.removeMonitor(localMouseMonitor) }
        if let globalMouseMonitor { NSEvent.removeMonitor(globalMouseMonitor) }
    }

    private func updateMousePassthrough() {
        guard isVisible, NSEvent.pressedMouseButtons == 0 else { return }
        let point = content.convert(convertPoint(fromScreen: NSEvent.mouseLocation), from: nil)
        ignoresMouseEvents = !content.characterInteractionFrame.contains(point) && !content.bubble.frame.contains(point)
    }

    /// Places the window so the character's reference point stays where the user
    /// left it, then sizes the window around the current bubble content.
    func layout(atOrigin origin: CGPoint) {
        stopBubbleResize()
        let size = content.requiredSize
        setFrame(NSRect(origin: origin, size: size), display: true)
    }

    /// Moves the panel temporarily; manual drag completion owns saved preferences.
    func startWalking(toX targetX: Double, duration: TimeInterval) {
        stopWalking()
        guard motionEnabled, duration > 0, targetX.isFinite else { return }
        isWalking = true
        let revision = walkingRevision
        PetMotion.animate(duration: duration, enabled: true, spring: false) {
            self.animator().setFrameOrigin(CGPoint(x: targetX, y: self.frame.minY))
        } completion: { [weak self] in
            guard let self, self.isWalking, self.walkingRevision == revision else { return }
            self.isWalking = false
            self.onWalkingFinished?()
        }
    }

    func stopWalking() {
        walkingRevision += 1
        guard isWalking else { return }
        isWalking = false
        let position = frame.origin
        PetMotion.animate(enabled: false) { self.animator().setFrameOrigin(position) }
    }

    /// Resizes for a bubble expansion without moving the character. AppKit uses
    /// a bottom-left origin, so keeping the origin fixed grows the window upward.
    func relayoutForBubble(animated: Bool = false) {
        guard isVisible else { return }
        let size = content.requiredSize
        let origin = PositionRules.constrain(
            position: PetPreferences.Position(x: frame.minX, y: frame.minY),
            windowSize: size,
            visibleFrame: screen?.visibleFrame ?? NSScreen.main?.visibleFrame ?? frame,
            fallbackInset: 24
        )
        let target = NSRect(origin: origin, size: size)
        if target == resizeTarget && !content.bubble.hasPendingLayout { return }
        if target == frame && resizeTarget == nil && !content.bubble.hasPendingLayout { return }
        resizeRevision += 1
        let revision = resizeRevision
        let animate = animated && motionEnabled && !NativeProcess.reduceMotionEnabled()
        resizeTarget = target
        PetMotion.animate(enabled: animate) {
            self.content.bubble.beginTransition()
            self.animator().setFrame(target, display: true)
        } completion: { [weak self] in
            guard let self, self.resizeRevision == revision else { return }
            self.resizeTarget = nil
            self.content.bubble.finishTransition()
        }
    }

    /// Brief pointer crossings retain the current layout; a settled hover expands it gently.
    func setBubbleHovered(_ hovering: Bool) {
        guard requestedHover != hovering || (hoverTimer == nil && content.bubble.isExpanded != hovering) else { return }
        requestedHover = hovering
        hoverTimer?.invalidate()
        hoverTimer = nil
        guard content.bubble.isExpanded != hovering else { return }
        let timer = Timer(timeInterval: hovering ? 0.12 : 0.16, repeats: false) { [weak self] _ in
            MainActor.assumeIsolated {
                guard let self, self.isVisible else { return }
                self.hoverTimer = nil
                self.content.bubble.setExpanded(hovering)
                self.relayoutForBubble(animated: true)
            }
        }
        hoverTimer = timer
        RunLoop.main.add(timer, forMode: .common)
    }

    func stopBubbleTransitions() {
        hoverTimer?.invalidate()
        hoverTimer = nil
        requestedHover = false
        stopBubbleResize()
    }

    func stopBubbleResize() {
        resizeRevision += 1
        let target = resizeTarget
        resizeTarget = nil
        PetMotion.animate(enabled: false) {
            if let target { self.animator().setFrame(target, display: true) }
            self.content.bubble.beginTransition()
        }
        content.bubble.finishTransition()
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
    var screenMouseLocation: () -> NSPoint = { NSEvent.mouseLocation }

    let character = PetCharacterView(frame: .zero)
    let bubble = PetBubbleStackView(frame: .zero)

    private var trackingArea: NSTrackingArea?
    private var characterTrackingArea: NSTrackingArea?
    private var pressScreenLocation: NSPoint?
    private var pressWindowOrigin: CGPoint?
    private var isDragging = false
    private var cardClick: (() -> Void)?
    private var scale: CGFloat = 1
    private lazy var characterWidth = character.widthAnchor.constraint(equalToConstant: PetCharacterView.characterSize.width)
    private lazy var characterHeight = character.heightAnchor.constraint(equalToConstant: PetCharacterView.characterSize.height)
    private lazy var bubbleSpacing = bubble.bottomAnchor.constraint(equalTo: character.topAnchor,
        constant: -PetBubbleView.characterSpacing)

    override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        wantsLayer = true
        layer?.backgroundColor = NSColor.clear.cgColor

        character.translatesAutoresizingMaskIntoConstraints = false
        bubble.translatesAutoresizingMaskIntoConstraints = false
        addSubview(character)
        addSubview(bubble)

        NSLayoutConstraint.activate([
            characterWidth,
            characterHeight,
            character.bottomAnchor.constraint(equalTo: bottomAnchor),
            character.centerXAnchor.constraint(equalTo: centerXAnchor),

            bubble.widthAnchor.constraint(equalToConstant: PetBubbleStackView.bubbleWidth),
            bubble.topAnchor.constraint(equalTo: topAnchor),
            bubble.centerXAnchor.constraint(equalTo: centerXAnchor),
            bubbleSpacing,
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
        let bubbleHeight = bubble.requiredHeight(width: PetBubbleStackView.bubbleWidth)
        let size = CGSize(width: PetCharacterView.characterSize.width * scale,
                          height: PetCharacterView.characterSize.height * scale)
        return CGSize(
            width: max(PetBubbleStackView.bubbleWidth, PetCharacterView.characterSize.width * scale),
            height: bubbleHeight + PetBubbleView.characterSpacing + size.height - character.topInset(in: size)
        )
    }

    func updateArtworkSpacing() {
        let size = CGSize(width: PetCharacterView.characterSize.width * scale,
                          height: PetCharacterView.characterSize.height * scale)
        bubbleSpacing.constant = character.topInset(in: size) - PetBubbleView.characterSpacing
        needsLayout = true
    }

    var characterInteractionFrame: NSRect {
        var frame = character.frame
        frame.size.height -= character.topInset(in: frame.size)
        return frame
    }

    /// Resizes the character independently of bubble typography and content.
    func setScale(_ value: Double) {
        guard value.isFinite, (0.5...2).contains(value) else { return }
        scale = value
        characterWidth.constant = PetCharacterView.characterSize.width * scale
        characterHeight.constant = PetCharacterView.characterSize.height * scale
        updateArtworkSpacing()
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
        if characterTrackingArea?.rect != characterInteractionFrame {
            if let characterTrackingArea { removeTrackingArea(characterTrackingArea) }
            let area = NSTrackingArea(rect: characterInteractionFrame, options: [.mouseEnteredAndExited, .activeAlways],
                owner: self, userInfo: ["character": true])
            addTrackingArea(area)
            characterTrackingArea = area
        }
    }

    override func mouseEntered(with event: NSEvent) {
        synchronizeHover()
    }

    override func mouseExited(with event: NSEvent) {
        synchronizeHover()
    }

    /// Tracking-area changes and menu dismissal reconcile the actual pointer position.
    func synchronizeHover() {
        guard let window, window.isVisible else { return }
        let point = convert(window.convertPoint(fromScreen: screenMouseLocation()), from: nil)
        let inside = bounds.contains(point)
        handler?.petWindowHoverChanged(inside)
        handler?.petWindowCharacterHoverChanged(inside && characterInteractionFrame.contains(point))
    }

    override func mouseDown(with event: NSEvent) {
        (window as? PetWindow)?.stopBubbleTransitions()
        handler?.petWindowPressedChanged(true)
        pressScreenLocation = NSEvent.mouseLocation
        pressWindowOrigin = window?.frame.origin
        isDragging = false
    }

    func beginCardPress(with event: NSEvent, open: @escaping () -> Void) {
        cardClick = open
        mouseDown(with: event)
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
        let clickedCard = cardClick
        cardClick = nil
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
        if let clickedCard { clickedCard() }
        else { handler?.petWindowDidRequestOpen() }
        synchronizeHover()
    }

    override func rightMouseDown(with event: NSEvent) {
        handler?.petWindowDidRequestMenu(at: convert(event.locationInWindow, from: nil), in: self)
    }

    /// The panel never becomes key from a passive update, so it accepts first
    /// mouse to keep dragging and clicking immediate.
    override func acceptsFirstMouse(for event: NSEvent?) -> Bool { true }
}
