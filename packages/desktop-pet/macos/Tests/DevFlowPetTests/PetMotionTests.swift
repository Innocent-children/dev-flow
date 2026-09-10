import AppKit
import XCTest
@testable import DevFlowPet

@MainActor
final class PetMotionTests: XCTestCase {
    func testHeadroomUsesAllPosesAndKeepsFullCanvasArtwork() {
        func pose(topInset: CGFloat) -> NSImage {
            NSImage(size: NSSize(width: 64, height: 64), flipped: false) { _ in
                NSColor.blue.setFill()
                NSRect(x: 8, y: 0, width: 48, height: 64 - topInset).fill()
                return true
            }
        }
        let lower = pose(topInset: 24)
        let taller = pose(topInset: 16)
        XCTAssertEqual(PetCharacterView.transparentTopFraction([lower, taller]), 14.0 / 64, accuracy: 0.001)
        XCTAssertEqual(PetCharacterView.transparentTopFraction([pose(topInset: 0)]), 0)
        XCTAssertEqual(lower.size, NSSize(width: 64, height: 64))
    }
    private func makeWindow() -> PetWindow {
        _ = NSApplication.shared
        let window = PetWindow()
        let tasks = PetTaskCollection()
        tasks.update((0..<5).map { TestFixtures.summary(taskID: "motion-\($0)",
            requestSummary: "Task \($0): Native motion with a longer description", lifecycle: .active) }, readiness: .ready)
        window.content.bubble.update(cards: tasks.cards, pinned: nil,
            sync: nil, strings: .english, language: .english)
        window.layout(atOrigin: CGPoint(x: 200, y: 200))
        window.orderFrontRegardless()
        window.content.layoutSubtreeIfNeeded()
        return window
    }

    private func descendants(_ view: NSView) -> [NSView] {
        view.subviews.flatMap { [$0] + descendants($0) }
    }

    func testNativeExpansionRetargetsAndPreservesCardAndScrollIdentity() async throws {
        let window = makeWindow()
        defer { window.stopBubbleTransitions(); window.orderOut(nil) }
        let stack = window.content.bubble
        let cards = descendants(stack).compactMap { $0 as? PetBubbleView }
        let scroll = try XCTUnwrap(descendants(stack).compactMap { $0 as? NSScrollView }.first)
        let document = scroll.documentView
        let collapsed = window.frame
        stack.setExpanded(true)
        window.relayoutForBubble(animated: true)
        try await Task.sleep(nanoseconds: 70_000_000)
        let intermediate = window.frame
        XCTAssertGreaterThan(intermediate.height, collapsed.height)
        XCTAssertLessThan(intermediate.height, window.content.requiredSize.height)
        stack.setExpanded(false)
        window.relayoutForBubble(animated: true)
        XCTAssertEqual(window.frame.height, intermediate.height, accuracy: 2, "retarget keeps the current frame")
        try await Task.sleep(nanoseconds: 600_000_000)
        XCTAssertEqual(window.frame.height, collapsed.height, accuracy: 1)
        XCTAssertEqual(window.frame.origin, collapsed.origin)
        XCTAssertTrue(scroll.documentView === document)
        let remaining = descendants(stack).compactMap { $0 as? PetBubbleView }
        XCTAssertEqual(Set(cards.map(ObjectIdentifier.init)), Set(remaining.map(ObjectIdentifier.init)))
        if #available(macOS 27.0, *) {
            XCTAssertTrue(descendants(stack).contains { $0 is NSGlassEffectContainerView })
            XCTAssertTrue(descendants(stack).compactMap { $0 as? NSGlassEffectView }.allSatisfy(\.effectIsInteractive))
        }
    }

    func testDisablingMotionSettlesResizeAndCancelsWalkingCompletion() async throws {
        let window = makeWindow()
        defer { window.stopWalking(); window.stopBubbleTransitions(); window.orderOut(nil) }
        window.content.bubble.setExpanded(true)
        window.relayoutForBubble(animated: true)
        try await Task.sleep(nanoseconds: 50_000_000)
        window.motionEnabled = false
        try await Task.sleep(nanoseconds: 30_000_000)
        XCTAssertEqual(window.frame.height, window.content.requiredSize.height, accuracy: 1)
        window.motionEnabled = true
        var completions = 0
        window.onWalkingFinished = { completions += 1 }
        window.startWalking(toX: window.frame.minX + 60, duration: 0.3)
        try await Task.sleep(nanoseconds: 70_000_000)
        window.motionEnabled = false
        let stopped = window.frame.origin
        try await Task.sleep(nanoseconds: 400_000_000)
        XCTAssertEqual(window.frame.origin, stopped)
        XCTAssertEqual(completions, 0)
        XCTAssertFalse(window.isWalking)
    }

    func testNativeControlsScrollAndExpansionNearScreenEdge() async throws {
        let window = makeWindow()
        defer { window.stopBubbleTransitions(); window.orderOut(nil) }
        let screen = try XCTUnwrap(window.screen).visibleFrame
        window.layout(atOrigin: CGPoint(x: screen.maxX - window.frame.width - 16,
                                       y: screen.maxY - window.frame.height - 16))
        let stack = window.content.bubble
        stack.setExpanded(true)
        window.relayoutForBubble(animated: true)
        try await Task.sleep(nanoseconds: 500_000_000)
        XCTAssertTrue(screen.insetBy(dx: -1, dy: -1).contains(window.frame))
        let scroll = try XCTUnwrap(descendants(stack).compactMap { $0 as? NSScrollView }.first)
        XCTAssertGreaterThan(try XCTUnwrap(scroll.documentView).frame.height, scroll.contentSize.height)
        scroll.contentView.scroll(to: CGPoint(x: 0, y: 24))
        XCTAssertEqual(scroll.contentView.bounds.minY, 24, accuracy: 1)
        scroll.contentView.scroll(to: .zero)
        let buttons = descendants(stack).compactMap { $0 as? NSButton }
        let pin = try XCTUnwrap(buttons.first { $0.title == PetStrings.english.petPin && !$0.isHidden && scroll.bounds.contains(scroll.convert($0.bounds, from: $0)) })
        XCTAssertGreaterThan(pin.frame.width, 20)
        var pinned: String?
        stack.onPin = { pinned = $0 }
        pin.performClick(nil)
        XCTAssertNotNil(pinned)
        let hit = stack.hitTest(stack.superview!.convert(NSPoint(x: pin.bounds.midX, y: pin.bounds.midY), from: pin))
        XCTAssertTrue(hit === pin || hit?.isDescendant(of: pin) == true)
        // Optional on-screen capture supplements the native window assertions.
        if let directory = ProcessInfo.processInfo.environment["PET_NATIVE_OUTPUT"] {
            try FileManager.default.createDirectory(atPath: directory, withIntermediateDirectories: true)
            try await Task.sleep(nanoseconds: 1_500_000_000)
            let capture = Process()
            capture.executableURL = URL(fileURLWithPath: "/usr/sbin/screencapture")
            let rect = window.frame
            let top = NSScreen.screens[0].frame.maxY - rect.maxY
            let region = "\(Int(rect.minX)),\(Int(top)),\(Int(rect.width)),\(Int(rect.height))"
            capture.arguments = ["-x", "-R", region, directory + "/expanded-native.png"]
            try capture.run()
            capture.waitUntilExit()
            XCTAssertEqual(capture.terminationStatus, 0)
        }
    }

    func testStationaryPointerKeepsBubbleExpandedThroughTrackingAreaExitEvents() async throws {
        let window = makeWindow()
        defer { window.stopBubbleTransitions(); window.orderOut(nil) }
        let handler = HoverHandler(window: window)
        window.content.handler = handler
        let character = window.content.character
        var pointer = window.convertToScreen(window.content.convert(character.frame, to: nil)).origin
        pointer.x += character.frame.width / 2
        pointer.y += character.frame.height / 2
        window.content.screenMouseLocation = { pointer }
        let event = try XCTUnwrap(NSEvent.enterExitEvent(with: .mouseExited, location: .zero,
            modifierFlags: [], timestamp: 0, windowNumber: window.windowNumber,
            context: nil, eventNumber: 0, trackingNumber: 0, userData: nil))
        window.content.synchronizeHover()
        // Resizing can deliver exits for replaced or recomputed tracking areas.
        for _ in 0..<12 {
            try await Task.sleep(nanoseconds: 50_000_000)
            window.content.updateTrackingAreas()
            window.content.mouseExited(with: event)
        }
        XCTAssertTrue(window.content.bubble.isExpanded)
        XCTAssertTrue(handler.windowHover.allSatisfy { $0 })
        XCTAssertTrue(handler.characterHover.allSatisfy { $0 })
        pointer = CGPoint(x: window.frame.maxX + 30, y: window.frame.maxY + 30)
        window.content.mouseExited(with: event)
        try await Task.sleep(nanoseconds: 600_000_000)
        XCTAssertFalse(window.content.bubble.isExpanded)
        XCTAssertEqual(handler.windowHover.last, false)
        XCTAssertEqual(handler.characterHover.last, false)
    }
}

@MainActor
private final class HoverHandler: PetWindowHandling {
    let window: PetWindow
    var windowHover: [Bool] = []
    var characterHover: [Bool] = []
    init(window: PetWindow) { self.window = window }
    func petWindowHoverChanged(_ hovering: Bool) {
        windowHover.append(hovering)
        window.setBubbleHovered(hovering)
    }
    func petWindowCharacterHoverChanged(_ hovering: Bool) { characterHover.append(hovering) }
    func petWindowDidRequestOpen() {}
    func petWindowDidRequestMenu(at location: NSPoint, in view: NSView) {}
    func petWindowDidMove(toOrigin origin: CGPoint) {}
    func petWindowPressedChanged(_ pressed: Bool) {}
    func petWindowDraggingChanged(_ dragging: Bool) {}
}
