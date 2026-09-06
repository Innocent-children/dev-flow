import Foundation

/// The common frame catalog used by bundled and imported appearances.
struct AnimationCatalog: Codable, Equatable {
    struct Canvas: Codable, Equatable {
        let width: Int
        let height: Int
    }

    struct Anchor: Codable, Equatable {
        let x: Double
        let y: Double
    }

    /// One delivered action. `loopRange` includes both ends; a one-shot action
    /// such as the celebration uses `nil`.
    struct Clip: Equatable {
        let frames: [String]
        let fps: Double
        let loopRange: ClosedRange<Int>?
        let restFrame: Int
        let frameDurationsMilliseconds: [Int]?

        init(frames: [String], fps: Double, loopRange: ClosedRange<Int>?, restFrame: Int,
             frameDurationsMilliseconds: [Int]? = nil) {
            self.frames = frames
            self.fps = fps
            self.loopRange = loopRange
            self.restFrame = restFrame
            self.frameDurationsMilliseconds = frameDurationsMilliseconds
        }

        var frameDuration: TimeInterval {
            fps > 0 ? 1.0 / fps : 0
        }

        /// The attention segment placed before the loop, when the clip has one.
        var introRange: ClosedRange<Int>? {
            guard let loopRange, loopRange.lowerBound > 0 else { return nil }
            return 0...(loopRange.lowerBound - 1)
        }
    }

    let canvas: Canvas
    let anchor: Anchor
    let clips: [AnimationClip: Clip]

    enum CodingKeys: String, CodingKey {
        case canvas
        case anchor
        case clips
    }

    private struct ClipPayload: Codable {
        let frames: [String]
        let fps: Double
        let loopRange: [Int]?
        let restFrame: Int
        let frameDurationsMilliseconds: [Int]?

        enum CodingKeys: String, CodingKey {
            case frames
            case fps
            case loopRange = "loop_range"
            case restFrame = "rest_frame"
            case frameDurationsMilliseconds = "frame_durations_ms"
        }
    }

    init(canvas: Canvas, anchor: Anchor, clips: [AnimationClip: Clip]) {
        self.canvas = canvas
        self.anchor = anchor
        self.clips = clips
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        canvas = try container.decode(Canvas.self, forKey: .canvas)
        anchor = try container.decode(Anchor.self, forKey: .anchor)
        let payload = try container.decode([String: ClipPayload].self, forKey: .clips)
        var decoded: [AnimationClip: Clip] = [:]
        for (key, value) in payload {
            guard let clip = AnimationClip(rawValue: key) else {
                throw DecodingError.dataCorruptedError(
                    forKey: .clips,
                    in: container,
                    debugDescription: "unknown animation clip \(key)"
                )
            }
            guard value.loopRange == nil || value.loopRange?.count == 2 else {
                throw DecodingError.dataCorruptedError(
                    forKey: .clips,
                    in: container,
                    debugDescription: "loop_range of \(key) needs a start and an end index"
                )
            }
            // The range is checked before it is formed, because a reversed pair
            // would otherwise trap instead of reporting an invalid manifest.
            if let bounds = value.loopRange {
                guard bounds[0] >= 0, bounds[0] <= bounds[1] else {
                    throw DecodingError.dataCorruptedError(
                        forKey: .clips,
                        in: container,
                        debugDescription: "loop_range of \(key) needs a start index and a later end index"
                    )
                }
            }
            let loopRange = value.loopRange.map { $0[0]...$0[1] }
            decoded[clip] = Clip(frames: value.frames, fps: value.fps, loopRange: loopRange, restFrame: value.restFrame,
                                 frameDurationsMilliseconds: value.frameDurationsMilliseconds)
        }
        clips = decoded
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(canvas, forKey: .canvas)
        try container.encode(anchor, forKey: .anchor)
        let payload = Dictionary(uniqueKeysWithValues: clips.map { key, value in
            (key.rawValue, ClipPayload(frames: value.frames, fps: value.fps,
                loopRange: value.loopRange.map { [$0.lowerBound, $0.upperBound] }, restFrame: value.restFrame,
                frameDurationsMilliseconds: value.frameDurationsMilliseconds))
        })
        try container.encode(payload, forKey: .clips)
    }
}

enum AnimationCatalogError: Error, Equatable {
    case missingClip(AnimationClip)
    case emptyFrames(AnimationClip)
    case unsafeFramePath(AnimationClip, String)
    case invalidFrameRate(AnimationClip)
    case invalidFrameDurations(AnimationClip)
    case restFrameOutOfRange(AnimationClip)
    case loopRangeOutOfRange(AnimationClip)
    case celebrationMustNotLoop
    case canvasSizeInvalid
}

extension AnimationCatalog {
    /// Confirms that all five clips are present and that every index and frame
    /// path is legal. The build check runs the same rules over the delivered
    /// assets.
    func validate() throws {
        guard canvas.width > 0, canvas.height > 0 else { throw AnimationCatalogError.canvasSizeInvalid }
        for clip in AnimationClip.allCases {
            guard let description = clips[clip] else { throw AnimationCatalogError.missingClip(clip) }
            guard !description.frames.isEmpty else { throw AnimationCatalogError.emptyFrames(clip) }
            for frame in description.frames {
                guard !frame.isEmpty,
                      !frame.hasPrefix("/"),
                      !frame.split(separator: "/").contains("..") else {
                    throw AnimationCatalogError.unsafeFramePath(clip, frame)
                }
            }
            guard description.fps > 0 else { throw AnimationCatalogError.invalidFrameRate(clip) }
            if let durations = description.frameDurationsMilliseconds {
                guard durations.count == description.frames.count,
                      durations.allSatisfy({ $0 > 0 && $0 <= 60_000 }) else {
                    throw AnimationCatalogError.invalidFrameDurations(clip)
                }
            }
            guard description.restFrame >= 0, description.restFrame < description.frames.count else {
                throw AnimationCatalogError.restFrameOutOfRange(clip)
            }
            if let loopRange = description.loopRange {
                guard loopRange.lowerBound >= 0,
                      loopRange.lowerBound <= loopRange.upperBound,
                      loopRange.upperBound < description.frames.count else {
                    throw AnimationCatalogError.loopRangeOutOfRange(clip)
                }
            } else if clip != .complete {
                throw AnimationCatalogError.loopRangeOutOfRange(clip)
            }
            if clip == .complete, description.loopRange != nil {
                throw AnimationCatalogError.celebrationMustNotLoop
            }
        }
    }

    static func decode(_ data: Data) throws -> AnimationCatalog {
        let catalog = try JSONDecoder().decode(AnimationCatalog.self, from: data)
        try catalog.validate()
        return catalog
    }
}

/// How a clip is played right now.
enum ClipPlayback: Equatable {
    /// Show one dedicated static frame and run no timer.
    case rest(frameIndex: Int)
    /// Play the attention segment once, then keep looping the quiet segment.
    case introThenLoop(intro: ClosedRange<Int>, loop: ClosedRange<Int>)
    /// Loop immediately without an attention segment.
    case loop(ClosedRange<Int>)
    /// Play every frame once, then hold the rest frame.
    case onceThenRest(lastFrameIndex: Int, restFrame: Int)
}

enum PlaybackRules {
    static func frameDuration(_ clip: AnimationCatalog.Clip, index: Int) -> TimeInterval {
        if let durations = clip.frameDurationsMilliseconds, durations.indices.contains(index) {
            return Double(durations[index]) / 1000
        }
        return clip.frameDuration
    }

    /// Chooses playback for one clip. Turning animations off, the system
    /// reduce-motion setting, and any first read of a terminal state all use the
    /// clip's dedicated static frame; re-enabling animation never replays a
    /// prompt the user did not observe continuously.
    static func playback(
        clip description: AnimationCatalog.Clip,
        playIntro: Bool,
        useRestFrame: Bool,
        animationsEnabled: Bool,
        reduceMotion: Bool
    ) -> ClipPlayback {
        if description.frames.count == 1 || !animationsEnabled || reduceMotion || useRestFrame {
            return .rest(frameIndex: description.restFrame)
        }
        guard let loopRange = description.loopRange else {
            guard playIntro else { return .rest(frameIndex: description.restFrame) }
            return .onceThenRest(lastFrameIndex: description.frames.count - 1, restFrame: description.restFrame)
        }
        guard playIntro, let intro = description.introRange else {
            return .loop(loopRange)
        }
        return .introThenLoop(intro: intro, loop: loopRange)
    }
}
