import AppKit
import XCTest
@testable import DevFlowPet

final class PetTaskCollectionTests: XCTestCase {
    func testBlockedPriorityAndStableFocus() {
        let tasks = PetTaskCollection()
        tasks.update([TestFixtures.summary(taskID: "a"), TestFixtures.summary(taskID: "b")], readiness: .ready)
        XCTAssertEqual(tasks.focusID, "a")
        tasks.update([TestFixtures.summary(taskID: "b"), TestFixtures.summary(taskID: "a"), TestFixtures.summary(taskID: "c", lifecycle: .blocked)], readiness: .ready)
        XCTAssertEqual(tasks.focusID, "c")
        XCTAssertEqual(tasks.cards.count, 3)
        tasks.update([TestFixtures.summary(taskID: "c", lifecycle: .blocked), TestFixtures.summary(taskID: "d", lifecycle: .blocked)], readiness: .ready)
        XCTAssertEqual(tasks.focusID, "c")
    }

    func testCompletionHandoffAndUnreadConsumption() {
        var now = Date(timeIntervalSince1970: 0)
        let tasks = PetTaskCollection(now: { now })
        tasks.update([TestFixtures.summary(taskID: "a"), TestFixtures.summary(taskID: "b")], readiness: .ready)
        tasks.update([TestFixtures.summary(taskID: "a", lifecycle: .done), TestFixtures.summary(taskID: "b")], readiness: .ready)
        XCTAssertEqual(tasks.focusID, "a")
        XCTAssertTrue(tasks.focus.playIntro)
        tasks.consumePrompts()
        XCTAssertFalse(tasks.focus.playIntro)
        now = now.addingTimeInterval(2.999)
        tasks.update([TestFixtures.summary(taskID: "b")], readiness: .ready)
        XCTAssertEqual(tasks.focusID, "a")
        now = now.addingTimeInterval(0.001)
        tasks.update([TestFixtures.summary(taskID: "b")], readiness: .ready)
        XCTAssertEqual(tasks.focusID, "b")
        XCTAssertTrue(tasks.cards.first(where: { $0.taskID == "a" })!.unread)
        tasks.acknowledge("a")
        XCTAssertEqual(tasks.cards.count, 1)
    }

    func testPinAndDiscontinuousObservation() {
        let tasks = PetTaskCollection()
        tasks.update([TestFixtures.summary(taskID: "a")], readiness: .ready)
        tasks.disconnect()
        XCTAssertTrue(tasks.cards[0].result.isStaleSummary)
        tasks.pin("a")
        tasks.update([TestFixtures.summary(taskID: "a", lifecycle: .done), TestFixtures.summary(taskID: "b")], readiness: .ready)
        XCTAssertEqual(tasks.focusID, "a")
        XCTAssertFalse(tasks.focus.playIntro)
        XCTAssertFalse(tasks.cards.contains(where: \.unread))
        tasks.pin(nil)
        XCTAssertEqual(tasks.focusID, "b")
        tasks.update([TestFixtures.summary(taskID: "b", lifecycle: .cancelled)], readiness: .ready)
        XCTAssertNil(tasks.focusID)
        XCTAssertEqual(tasks.focus.phase, .noSelection)
    }

    @MainActor
    func testStackLayoutAndNativeRender() throws {
        let tasks = PetTaskCollection()
        let titles = ["视频转码：等待服务恢复", "完善接口自动化测试", "优化桌面宠物多任务气泡", "检查超长任务标题在展开视图中的换行与滚动表现，确保每个任务都可以独立打开", "同步使用说明"]
        tasks.update((0..<5).map { TestFixtures.summary(taskID: "task-\($0)", requestSummary: titles[$0], lifecycle: $0 == 0 ? .blocked : .active) }, readiness: .ready)
        let view = PetBubbleStackView(frame: .zero)
        let window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 256, height: 400), styleMask: [.borderless], backing: .buffered, defer: false)
        window.contentView = view
        window.isReleasedWhenClosed = false
        window.orderFrontRegardless()
        defer { window.orderOut(nil) }
        view.update(cards: tasks.cards, pinned: nil, sync: Date(), strings: .chinese, language: .chinese)
        let collapsed = view.requiredHeight(width: 256)
        window.setContentSize(CGSize(width: 256, height: collapsed))
        view.frame.size = CGSize(width: 256, height: collapsed)
        view.layoutSubtreeIfNeeded()
        try render(view, name: "stacked")
        let compactBubbles = descendants(view).compactMap { $0 as? PetBubbleView }.map(ObjectIdentifier.init)
        view.setExpanded(true)
        let expandedBubbles = descendants(view).compactMap { $0 as? PetBubbleView }.map(ObjectIdentifier.init)
        XCTAssertTrue(compactBubbles.allSatisfy(expandedBubbles.contains), "expansion preserves native glass views")
        XCTAssertGreaterThan(view.requiredHeight(width: 256), collapsed)
        view.maximumHeight = 320
        window.setContentSize(CGSize(width: 256, height: 320))
        view.frame.size.height = view.requiredHeight(width: 256)
        view.layoutSubtreeIfNeeded()
        XCTAssertLessThanOrEqual(view.frame.height, 320)
        try render(view, name: "expanded")
        view.finishTransition()
        let scroll = try XCTUnwrap(descendants(view).compactMap { $0 as? NSScrollView }.first)
        XCTAssertFalse(scroll.hasVerticalScroller)
        XCTAssertFalse(scroll.hasHorizontalScroller)
        let originalScrollY = scroll.contentView.bounds.minY
        scroll.contentView.scroll(to: CGPoint(x: 0, y: originalScrollY + 24))
        scroll.reflectScrolledClipView(scroll.contentView)
        XCTAssertGreaterThan(scroll.contentView.bounds.minY, originalScrollY, "content still scrolls with hidden indicators")
        var opened: String?
        view.onOpen = { opened = $0 }
        let second = try XCTUnwrap(descendants(view).first { $0.accessibilityLabel() == titles[1] && $0.accessibilityRole() == .button })
        XCTAssertTrue(second.accessibilityPerformPress())
        XCTAssertEqual(opened, "task-1")
        for scale in [0.5, 0.75, 1, 1.25, 1.5, 2] {
            let size = CGSize(width: max(256, 144 * scale), height: view.frame.height + 144 * scale + 8)
            let screen = CGRect(x: 0, y: 0, width: 900, height: 700)
            let origin = PositionRules.constrain(position: .init(x: 895, y: 695), windowSize: size, visibleFrame: screen, fallbackInset: 24)
            XCTAssertTrue(screen.contains(CGRect(origin: origin, size: size)))
        }
    }

    @MainActor
    func testEmptyCardsHideTheBubbleAndResetExpansion() {
        let view = PetBubbleStackView(frame: .zero)
        let tasks = PetTaskCollection()
        XCTAssertTrue(view.isHidden)
        XCTAssertEqual(view.requiredHeight(width: 256), 0)
        view.setExpanded(true)
        XCTAssertFalse(view.isExpanded)

        tasks.update([TestFixtures.summary(taskID: "a")], readiness: .ready)
        view.update(cards: tasks.cards, pinned: nil, sync: nil, strings: .english, language: .english)
        XCTAssertFalse(view.isHidden)
        view.setExpanded(true)
        XCTAssertTrue(view.isExpanded)
        XCTAssertGreaterThan(view.requiredHeight(width: 256), 0)

        view.update(cards: [], pinned: nil, sync: nil, strings: .english, language: .english)
        XCTAssertTrue(view.isHidden)
        XCTAssertFalse(view.isExpanded)
        XCTAssertEqual(view.requiredHeight(width: 256), 0)
        XCTAssertTrue(descendants(view).compactMap { $0 as? PetBubbleView }.isEmpty)
        XCTAssertTrue(view.subviews.compactMap { $0 as? NSButton }.allSatisfy(\.isHidden))
        view.update(BubbleContent(title: "Connection message", stage: nil, summary: nil,
            taskUpdated: nil, lastSync: nil, blocker: nil))
        XCTAssertTrue(view.isHidden, "a message cannot create a taskless bubble")

        view.update(cards: tasks.cards, pinned: nil, sync: nil, strings: .english, language: .english)
        XCTAssertFalse(view.isHidden)
        XCTAssertFalse(view.isExpanded)
        XCTAssertEqual(descendants(view).compactMap { $0 as? PetBubbleView }.count, 1)
    }

    @MainActor
    func testEmptyBubbleLayoutPreservesCharacterAndReleasesMouseArea() async throws {
        _ = NSApplication.shared
        let window = PetWindow()
        window.motionEnabled = false
        window.layout(atOrigin: CGPoint(x: 100, y: 100))
        window.orderFrontRegardless()
        defer { window.orderOut(nil) }
        let tasks = PetTaskCollection()
        tasks.update([TestFixtures.summary(taskID: "a")], readiness: .ready)
        for scale in [0.5, 1, 2] {
            window.content.setScale(scale)
            window.content.bubble.update(cards: tasks.cards, pinned: nil, sync: nil, strings: .english, language: .english)
            window.relayoutForBubble()
            try await Task.sleep(nanoseconds: 50_000_000)
            window.content.layoutSubtreeIfNeeded()
            let characterOrigin = window.content.character.frame.origin
            let windowOrigin = window.frame.origin
            let bubblePoint = NSPoint(x: window.content.bubble.frame.midX, y: window.content.bubble.frame.midY)
            XCTAssertTrue(window.content.containsInteractivePoint(bubblePoint))
            let screenPoint = window.convertPoint(toScreen: window.content.convert(bubblePoint, to: nil))
            window.content.screenMouseLocation = { screenPoint }

            window.content.bubble.update(cards: [], pinned: nil, sync: nil, strings: .english, language: .english)
            window.relayoutForBubble()
            try await Task.sleep(nanoseconds: 50_000_000)
            window.content.layoutSubtreeIfNeeded()
            XCTAssertEqual(window.frame.origin, windowOrigin)
            XCTAssertEqual(window.content.character.frame.origin, characterOrigin)
            XCTAssertEqual(window.frame.height, 144 * scale, accuracy: 0.01)
            XCTAssertFalse(window.content.containsInteractivePoint(bubblePoint))
            XCTAssertTrue(window.ignoresMouseEvents)
            let characterPoint = NSPoint(x: window.content.character.frame.midX, y: window.content.character.frame.midY)
            XCTAssertTrue(window.content.containsInteractivePoint(characterPoint))
        }
    }

    @MainActor
    func testPetAndNativeGlassOverTheSameBackground() throws {
        guard #available(macOS 27.0, *) else { return }
        let size = NSSize(width: 640, height: 200)
        let scene = NSImage(size: size, flipped: false) { rect in
            NSGradient(colors: [.systemBlue, .systemTeal, .systemOrange])!.draw(in: rect, angle: 15)
            NSColor.white.withAlphaComponent(0.55).setFill()
            for x in stride(from: 0, to: 640, by: 64) { NSRect(x: x, y: 0, width: 24, height: 200).fill() }
            return true
        }
        let root = NSView(frame: NSRect(origin: .zero, size: size))
        let background = NSImageView(frame: root.bounds)
        background.image = scene
        root.addSubview(background)
        let window = NSWindow(contentRect: root.bounds, styleMask: [.borderless, .nonactivatingPanel], backing: .buffered, defer: false)
        window.isOpaque = false
        window.backgroundColor = .clear
        window.contentView = root
        window.isReleasedWhenClosed = false
        window.orderFrontRegardless()
        defer { window.orderOut(nil) }
        let pet = PetBubbleView(frame: NSRect(x: 32, y: 80, width: 264, height: 48))
        pet.update(BubbleContent(title: "Pet component", stage: "Same background", summary: nil, taskUpdated: nil, lastSync: nil, blocker: nil))
        root.addSubview(pet)
        let native = NSGlassEffectView(frame: NSRect(x: 344, y: 80, width: 264, height: 48))
        native.style = .regular
        native.cornerRadius = 24
        native.effectIsInteractive = true
        let content = NSView()
        let title = NSTextField(labelWithString: "Native NSGlassEffectView")
        title.frame = NSRect(x: 16, y: 16, width: 232, height: 18)
        content.addSubview(title)
        native.contentView = content
        root.addSubview(native)
        root.layoutSubtreeIfNeeded()
        try render(root, name: "same-window-comparison")
    }

    @MainActor
    private func descendants(_ view: NSView) -> [NSView] { view.subviews.flatMap { [$0] + descendants($0) } }

    @MainActor
    private func render(_ view: NSView, name: String) throws {
        guard let directory = ProcessInfo.processInfo.environment["PET_VISUAL_OUTPUT"] else { return }
        try FileManager.default.createDirectory(atPath: directory, withIntermediateDirectories: true)
        let bitmap = try XCTUnwrap(view.bitmapImageRepForCachingDisplay(in: view.bounds))
        view.cacheDisplay(in: view.bounds, to: bitmap)
        let data = try XCTUnwrap(bitmap.representation(using: .png, properties: [:]))
        try data.write(to: URL(fileURLWithPath: directory).appendingPathComponent(name + ".png"))
    }
}
