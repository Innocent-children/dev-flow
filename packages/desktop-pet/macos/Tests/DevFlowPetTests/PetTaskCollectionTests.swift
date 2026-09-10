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
        let window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 284, height: 400), styleMask: [.borderless], backing: .buffered, defer: false)
        window.contentView = view
        window.isReleasedWhenClosed = false
        window.orderFrontRegardless()
        defer { window.orderOut(nil) }
        view.update(cards: tasks.cards, pinned: nil, fallback: BubbleRules.content(result: tasks.focus, lastSyncAt: Date(), strings: .chinese, language: .chinese), sync: Date(), strings: .chinese, language: .chinese)
        let collapsed = view.requiredHeight(width: 284)
        window.setContentSize(CGSize(width: 284, height: collapsed))
        view.frame.size = CGSize(width: 284, height: collapsed)
        view.layoutSubtreeIfNeeded()
        try render(view, name: "stacked")
        view.setExpanded(true)
        XCTAssertGreaterThan(view.requiredHeight(width: 284), collapsed)
        view.maximumHeight = 320
        window.setContentSize(CGSize(width: 284, height: 320))
        view.frame.size.height = view.requiredHeight(width: 284)
        view.layoutSubtreeIfNeeded()
        XCTAssertLessThanOrEqual(view.frame.height, 320)
        try render(view, name: "expanded")
        var opened: String?
        view.onOpen = { opened = $0 }
        let buttons = descendants(view).compactMap { $0 as? NSButton }
        let second = try XCTUnwrap(buttons.first { $0.accessibilityLabel() == titles[1] })
        second.performClick(nil)
        XCTAssertEqual(opened, "task-1")
        for scale in [0.5, 0.75, 1, 1.25, 1.5, 2] {
            let size = CGSize(width: max(284, 144 * scale), height: view.frame.height + 144 * scale + 8)
            let screen = CGRect(x: 0, y: 0, width: 900, height: 700)
            let origin = PositionRules.constrain(position: .init(x: 895, y: 695), windowSize: size, visibleFrame: screen, fallbackInset: 24)
            XCTAssertTrue(screen.contains(CGRect(origin: origin, size: size)))
        }
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
