import Foundation

/// Maps elapsed monotonic time to artwork frames without accumulating callback delays.
struct PetAnimationTimeline {
    struct Sample: Equatable {
        let frame: Int
        let finished: Bool
        let looping: Bool
    }

    private struct Segment {
        let frames: [Int]
        let ends: [TimeInterval]
        var duration: TimeInterval { ends.last ?? 0 }

        init(_ indices: [Int], clip: AnimationCatalog.Clip) {
            frames = indices
            var total: TimeInterval = 0
            ends = indices.map { index in
                total += PlaybackRules.frameDuration(clip, index: index)
                return total
            }
        }

        func frame(at time: TimeInterval) -> Int {
            frames[ends.firstIndex(where: { time < $0 }) ?? (frames.count - 1)]
        }
    }

    private let intro: Segment
    private let cycle: Segment
    private let cycles: Int?
    private let rest: Int

    init(clip: AnimationCatalog.Clip, playback: ClipPlayback) {
        var prefix: [Int] = []
        var repeating: [Int] = []
        var count: Int? = 0
        var resting = clip.restFrame
        switch playback {
        case .rest(let frame): resting = frame
        case .loop(let range): repeating = Array(range); count = nil
        case .introThenLoop(let prefixRange, let loop):
            prefix = Array(prefixRange); repeating = Array(loop); count = nil
        case .onceThenRest(let last, let frame):
            prefix = Array(0...last); resting = frame
        case .repeatThenRest(let repeats, let frame):
            repeating = Array(clip.frames.indices); count = max(1, repeats); resting = frame
        }
        intro = Segment(prefix, clip: clip)
        cycle = Segment(repeating, clip: clip)
        cycles = count
        rest = resting
    }

    func sample(at elapsed: TimeInterval) -> Sample {
        let time = max(0, elapsed)
        if time < intro.duration {
            return Sample(frame: intro.frame(at: time), finished: false, looping: false)
        }
        let remaining = time - intro.duration
        if cycle.duration > 0, cycles == nil || remaining < cycle.duration * Double(cycles!) {
            return Sample(frame: cycle.frame(at: remaining.truncatingRemainder(dividingBy: cycle.duration)),
                          finished: false, looping: cycles == nil)
        }
        return Sample(frame: rest, finished: true, looping: false)
    }
}
