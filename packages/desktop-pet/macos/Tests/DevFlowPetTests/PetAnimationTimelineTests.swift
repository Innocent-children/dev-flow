import XCTest
@testable import DevFlowPet

final class PetAnimationTimelineTests: XCTestCase {
    private let clip = AnimationCatalog.Clip(frames: ["0", "1", "2"], fps: 10,
        loopRange: 1...2, restFrame: 0, frameDurationsMilliseconds: [100, 200, 400])

    func testVariableDurationsAndLateCallbacksUseElapsedTime() {
        let timeline = PetAnimationTimeline(clip: clip, playback: .loop(0...2))
        XCTAssertEqual(timeline.sample(at: 0.09).frame, 0)
        XCTAssertEqual(timeline.sample(at: 0.15).frame, 1)
        XCTAssertEqual(timeline.sample(at: 0.35).frame, 2)
        // A late callback skips complete missed cycles rather than slowing every later frame.
        XCTAssertEqual(timeline.sample(at: 70.15).frame, 1)
        XCTAssertFalse(timeline.sample(at: 70.15).finished)
    }

    func testIntroRunsOnceBeforeItsOwnLoopRange() {
        let timeline = PetAnimationTimeline(clip: clip, playback: .introThenLoop(intro: 0...0, loop: 1...2))
        XCTAssertFalse(timeline.sample(at: 0.05).looping)
        XCTAssertEqual(timeline.sample(at: 0.15).frame, 1)
        XCTAssertTrue(timeline.sample(at: 0.15).looping)
        XCTAssertEqual(timeline.sample(at: 6.15).frame, 1)
    }

    func testFiniteCyclesAndOneShotHoldRestAfterFinalDuration() {
        let repeating = PetAnimationTimeline(clip: clip, playback: .repeatThenRest(cycles: 2, restFrame: 1))
        XCTAssertEqual(repeating.sample(at: 1.39).frame, 2)
        XCTAssertFalse(repeating.sample(at: 1.39).finished)
        XCTAssertEqual(repeating.sample(at: 1.41), .init(frame: 1, finished: true, looping: false))
        let once = PetAnimationTimeline(clip: clip, playback: .onceThenRest(lastFrameIndex: 2, restFrame: 0))
        XCTAssertFalse(once.sample(at: 0.69).finished)
        XCTAssertEqual(once.sample(at: 5), .init(frame: 0, finished: true, looping: false))
    }

    func testStaticAndFPSBasedPlayback() {
        let staticFrame = PetAnimationTimeline(clip: clip, playback: .rest(frameIndex: 2))
        XCTAssertEqual(staticFrame.sample(at: 0), .init(frame: 2, finished: true, looping: false))
        let uniform = AnimationCatalog.Clip(frames: ["0", "1"], fps: 4, loopRange: 0...1, restFrame: 0)
        let timeline = PetAnimationTimeline(clip: uniform, playback: .loop(0...1))
        XCTAssertEqual(timeline.sample(at: 0.3).frame, 1)
        XCTAssertEqual(timeline.sample(at: 20.1).frame, 0)
    }
}
