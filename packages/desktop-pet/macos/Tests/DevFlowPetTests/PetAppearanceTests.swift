import AppKit
import Foundation
import UniformTypeIdentifiers
import XCTest
import zlib
@testable import DevFlowPet

final class PetAppearanceTests: XCTestCase {
    private var temporary: URL!
    private var store: PetAppearanceStore!

    override func setUpWithError() throws {
        temporary = FileManager.default.temporaryDirectory.appendingPathComponent("dev-flow-appearance-\(UUID())")
        try FileManager.default.createDirectory(at: temporary, withIntermediateDirectories: true)
        store = PetAppearanceStore(directory: temporary.appendingPathComponent("installed").path)
    }

    override func tearDownWithError() throws {
        try FileManager.default.removeItem(at: temporary)
    }

    func testStaticPackIsCopiedAndWorksForEveryState() throws {
        let source = try staticPack()
        try writeJSON(["id": "test-pet", "name": "Test", "image": "./pet.png"], to: source.appendingPathComponent("pet.json"))
        let appearance = try store.importDirectory(source)
        try FileManager.default.removeItem(at: source)
        XCTAssertEqual(store.appearances(), [appearance])
        let library = try store.load(appearance.id)
        for clip in AnimationCatalog.requiredClips {
            XCTAssertEqual(try library.frames(for: clip).images.count, 1)
            XCTAssertEqual(library.catalog.clips[clip]?.restFrame, 0)
            let description = try XCTUnwrap(library.catalog.clips[clip])
            XCTAssertEqual(PlaybackRules.playback(clip: description, playIntro: true, useRestFrame: false,
                animationsEnabled: true, reduceMotion: false), .rest(frameIndex: 0))
        }
    }

    func testAnimatedPackPreservesDurations() throws {
        let source = try staticPack()
        try writeJSON(["id": "test-pet", "name": "Animated"], to: source.appendingPathComponent("pet.json"))
        let catalog = makeCatalog()
        try JSONEncoder.pretty.encode(catalog).write(to: source.appendingPathComponent("animations.json"))
        try FileManager.default.createDirectory(at: source.appendingPathComponent("Assets"), withIntermediateDirectories: true)
        try png(width: 16, height: 16).write(to: source.appendingPathComponent("Assets/frame.png"))
        let appearance = try store.importDirectory(source)
        let loaded = try store.load(appearance.id)
        XCTAssertEqual(loaded.catalog, catalog)
        let idle = try XCTUnwrap(loaded.catalog.clips[.idle])
        XCTAssertEqual(PlaybackRules.frameDuration(idle, index: 0), 0.08)
        XCTAssertEqual(PlaybackRules.frameDuration(idle, index: 1), 0.16)
    }

    func testReimportUpdatesOneAppearanceAndInvalidUpdatePreservesIt() throws {
        let source = try staticPack()
        _ = try store.importDirectory(source)
        try writeJSON(["id": "test-pet", "name": "Updated", "image": "pet.png"], to: source.appendingPathComponent("pet.json"))
        _ = try store.importDirectory(source)
        XCTAssertEqual(store.appearances().map(\.name), ["Updated"])
        try Data("not a PNG".utf8).write(to: source.appendingPathComponent("pet.png"))
        XCTAssertThrowsError(try store.importDirectory(source))
        XCTAssertEqual(store.appearances().map(\.name), ["Updated"])
        XCTAssertEqual(try store.load("test-pet").frames(for: .idle).images.count, 1)
    }

    func testImportRejectsEscapingPathsAndSymlinks() throws {
        let source = try staticPack()
        try png(width: 16, height: 16).write(to: temporary.appendingPathComponent("outside.png"))
        try writeJSON(["id": "test-pet", "name": "Escape", "image": "../outside.png"], to: source.appendingPathComponent("pet.json"))
        XCTAssertThrowsError(try store.importDirectory(source))
        try FileManager.default.createSymbolicLink(at: source.appendingPathComponent("link.png"),
                                                  withDestinationURL: temporary.appendingPathComponent("outside.png"))
        try writeJSON(["id": "test-pet", "name": "Link", "image": "link.png"], to: source.appendingPathComponent("pet.json"))
        XCTAssertThrowsError(try store.importDirectory(source))
        XCTAssertTrue(store.appearances().isEmpty)
    }

    func testImportRejectsMalformedTimings() throws {
        var catalog = makeCatalog()
        var clips = catalog.clips
        clips[.idle] = .init(frames: ["frame.png"], fps: 24, loopRange: 0...0, restFrame: 0,
                            frameDurationsMilliseconds: [0])
        catalog = .init(canvas: catalog.canvas, anchor: catalog.anchor, clips: clips)
        XCTAssertThrowsError(try catalog.validate())
    }

    func testCanvasOverflowIsRejectedAndPreservesTheInstalledAppearance() throws {
        let source = try staticPack()
        let appearance = try store.importDirectory(source)
        let catalog = AnimationCatalog(canvas: .init(width: 2_147_483_648, height: 2_147_483_648),
            anchor: .init(x: 0, y: 0), clips: makeCatalog().clips)
        try writeJSON(["id": appearance.id, "name": "Invalid canvas"], to: source.appendingPathComponent("pet.json"))
        try JSONEncoder.pretty.encode(catalog).write(to: source.appendingPathComponent("animations.json"))

        XCTAssertThrowsError(try store.importDirectory(source)) { error in
            XCTAssertTrue(error.localizedDescription.contains("128 MiB decoded"))
        }
        XCTAssertEqual(store.appearances(), [appearance])
        XCTAssertEqual(try store.load(appearance.id).catalog.canvas, .init(width: 16, height: 16))
    }

    func testImageBudgetsRejectLargeHeadersBeforeDecodingPixels() throws {
        let smallImage = try png(width: 16, height: 16)
        XCTAssertThrowsError(try AppearanceImages.decode(smallImage, allowedTypes: [UTType.png.identifier],
                                                        maximumDecodedBytes: 1023)) { error in
            XCTAssertTrue(error.localizedDescription.hasPrefix("decoded image exceeds"))
        }
        XCTAssertNoThrow(try AppearanceImages.decode(smallImage, allowedTypes: [UTType.png.identifier],
                                                     maximumDecodedBytes: 1024))
        let bytes = try pngWithDeclaredSize(width: 32_768, height: 32_768)
        let source = try staticPack()
        try bytes.write(to: source.appendingPathComponent("pet.png"))
        XCTAssertThrowsError(try store.importDirectory(source))
        try writeJSON(["id": "large-atlas", "displayName": "Large atlas", "spritesheetPath": "pet.png"],
                      to: source.appendingPathComponent("pet.json"))
        XCTAssertThrowsError(try store.importDirectory(source))
        XCTAssertTrue(store.appearances().isEmpty)
    }

    func testStaticHighResolutionImageWithinTheBudgetCanBeLoaded() throws {
        let source = try staticPack()
        try png(width: 1536, height: 1664).write(to: source.appendingPathComponent("pet.png"))
        let appearance = try store.importDirectory(source)
        XCTAssertEqual(try store.load(appearance.id).catalog.canvas, .init(width: 1536, height: 1664))
    }

    func testSelectionPersistsWithoutChangingTheWatchedTask() throws {
        let appearance = try store.importDirectory(staticPack())
        let preferences = PreferenceStore(path: temporary.appendingPathComponent("settings.json").path)
        preferences.update { $0.select(taskID: "watched-task", for: "data-root") }
        let selection = PetAppearanceSelection(store: store, preferences: preferences, bundledLibrary: nil)
        try selection.select(appearance.id)
        let reloaded = PreferenceStore(path: preferences.path)
        let restored = PetAppearanceSelection(store: store, preferences: reloaded, bundledLibrary: nil)
        try restored.restore()
        XCTAssertEqual(restored.id, appearance.id)
        XCTAssertEqual(reloaded.current.selectedTask(for: "data-root"), "watched-task")
        XCTAssertThrowsError(try restored.select("missing"))
        XCTAssertEqual(restored.id, appearance.id)
        XCTAssertEqual(reloaded.current.selectedAppearance, appearance.id)
        try restored.select(nil)
        XCTAssertNil(PreferenceStore(path: preferences.path).current.selectedAppearance)
    }

    func testPreferenceWriteFailureKeepsTheSelection() throws {
        let appearance = try store.importDirectory(staticPack())
        let blockedPath = temporary.appendingPathComponent("file-parent")
        try Data().write(to: blockedPath)
        let preferences = PreferenceStore(path: blockedPath.appendingPathComponent("settings.json").path)
        let selection = PetAppearanceSelection(store: store, preferences: preferences, bundledLibrary: nil)
        XCTAssertThrowsError(try selection.select(appearance.id))
        XCTAssertNil(selection.id)
        XCTAssertNil(preferences.current.selectedAppearance)
    }

    func testCodexAtlasesMapTheExpectedRowsAndTimings() throws {
        for version in [1, 2] {
            let source = temporary.appendingPathComponent("codex-\(version)")
            try FileManager.default.createDirectory(at: source, withIntermediateDirectories: true)
            var manifest: [String: Any] = ["id": "Atlas \(version)", "displayName": "Codex \(version)", "spritesheetPath": "./sheet.png"]
            if version == 2 { manifest["spriteVersionNumber"] = 2 }
            try writeJSON(manifest, to: source.appendingPathComponent("pet.json"))
            try png(width: 1536, height: version == 1 ? 1872 : 2288, rowColors: true).write(to: source.appendingPathComponent("sheet.png"))
            let appearance = try store.importDirectory(source)
            let library = try store.load(appearance.id)
            XCTAssertEqual(library.catalog.canvas, .init(width: 192, height: 208))
            XCTAssertEqual(Set(library.catalog.clips.keys), Set(AnimationClip.allCases))
            XCTAssertEqual(library.catalog.clips.values.reduce(0) { $0 + $1.frames.count }, 57)
            XCTAssertEqual(library.catalog.clips[.complete]?.frames.count, 5)
            XCTAssertNil(library.catalog.clips[.complete]?.loopRange)
            XCTAssertEqual(library.catalog.clips[.idle]?.frameDurationsMilliseconds, [280, 110, 110, 140, 140, 320])
            let workingFrame = temporary.appendingPathComponent("installed/\(appearance.id)/Assets/working/0.png")
            let bitmap = try XCTUnwrap(NSBitmapImageRep(data: Data(contentsOf: workingFrame)))
            let color = try XCTUnwrap(bitmap.colorAt(x: 0, y: 0)?.usingColorSpace(.deviceRGB))
            let sourceBitmap = try XCTUnwrap(NSBitmapImageRep(data: Data(contentsOf: source.appendingPathComponent("sheet.png"))))
            let expected = try XCTUnwrap(sourceBitmap.colorAt(x: 0, y: 7 * 208)?.usingColorSpace(.deviceRGB))
            XCTAssertEqual(color.redComponent, expected.redComponent, accuracy: 0.01)
            let additionalRows: [(AnimationClip, Int, [Int])] = [
                (.runningRight, 1, [120, 120, 120, 120, 120, 120, 120, 220]),
                (.runningLeft, 2, [120, 120, 120, 120, 120, 120, 120, 220]),
                (.waving, 3, [140, 140, 140, 280]),
                (.review, 8, [150, 150, 150, 150, 150, 280]),
            ]
            for (clip, row, durations) in additionalRows {
                let description = try XCTUnwrap(library.catalog.clips[clip])
                XCTAssertEqual(description.frameDurationsMilliseconds, durations)
                XCTAssertEqual(try library.frames(for: clip).images.count, durations.count)
                let path = temporary.appendingPathComponent("installed/\(appearance.id)/Assets/\(clip.rawValue)/0.png")
                let frame = try XCTUnwrap(NSBitmapImageRep(data: Data(contentsOf: path)))
                let actual = try XCTUnwrap(frame.colorAt(x: 0, y: 0)?.usingColorSpace(.deviceRGB))
                let expected = try XCTUnwrap(sourceBitmap.colorAt(x: 0, y: row * 208)?.usingColorSpace(.deviceRGB))
                XCTAssertEqual(actual.redComponent, expected.redComponent, accuracy: 0.01, clip.rawValue)
            }
        }
    }

    func testCodexReimportRejectsAMissingNinthRowAndPreservesTheInstalledPack() throws {
        let source = try staticPack()
        try writeJSON(["id": "nine-rows", "displayName": "Nine rows", "spritesheetPath": "pet.png"],
                      to: source.appendingPathComponent("pet.json"))
        try png(width: 1536, height: 1872).write(to: source.appendingPathComponent("pet.png"))
        let appearance = try store.importDirectory(source)
        try png(width: 1536, height: 1664).write(to: source.appendingPathComponent("pet.png"))
        XCTAssertThrowsError(try store.importDirectory(source)) { error in
            XCTAssertEqual(error.localizedDescription, "Codex sprite sheet must contain all nine animation rows")
        }
        XCTAssertEqual(store.appearances(), [appearance])
        XCTAssertEqual(try store.load(appearance.id).frames(for: .review).images.count, 6)
    }

    func testHighResolutionAtlasPreservesCellSizeRowsAndTimings() throws {
        let source = try staticPack()
        try writeJSON(["id": "scaled-atlas", "displayName": "Scaled atlas", "spritesheetPath": "pet.png",
                       "spriteVersionNumber": 2], to: source.appendingPathComponent("pet.json"))
        try autoreleasepool {
            try png(width: 12288, height: 14976, rowColors: true, rowHeight: 1664)
                .write(to: source.appendingPathComponent("pet.png"))
        }
        let appearance = try store.importDirectory(source)
        let library = try store.load(appearance.id)
        XCTAssertEqual(library.catalog.canvas, .init(width: 1536, height: 1664))
        XCTAssertEqual(Set(library.catalog.clips.keys), Set(AnimationClip.allCases))
        XCTAssertEqual(library.catalog.clips[.working]?.frameDurationsMilliseconds, [120, 120, 120, 120, 120, 220])
        XCTAssertEqual(library.catalog.clips[.disconnected]?.frames.count, 8)
        let frame = temporary.appendingPathComponent("installed/\(appearance.id)/Assets/working/0.png")
        let bitmap = try XCTUnwrap(NSBitmapImageRep(data: Data(contentsOf: frame)))
        XCTAssertEqual(bitmap.pixelsWide, 1536)
        XCTAssertEqual(bitmap.pixelsHigh, 1664)
        let color = try XCTUnwrap(bitmap.colorAt(x: 0, y: 0)?.usingColorSpace(.deviceRGB))
        let standard = try XCTUnwrap(NSBitmapImageRep(data: png(width: 1536, height: 1872, rowColors: true)))
        let expected = try XCTUnwrap(standard.colorAt(x: 0, y: 7 * 208)?.usingColorSpace(.deviceRGB))
        XCTAssertEqual(color.redComponent, expected.redComponent, accuracy: 0.01)
    }

    func testCodexReimportValidatesConvertedFilesBeforeReplacingTheInstalledPack() throws {
        let source = try staticPack()
        try writeJSON(["id": "updated-atlas", "displayName": "Original", "spritesheetPath": "pet.png"],
                      to: source.appendingPathComponent("pet.json"))
        try png(width: 1536, height: 1872).write(to: source.appendingPathComponent("pet.png"))
        let appearance = try store.importDirectory(source)
        let preferences = PreferenceStore(path: temporary.appendingPathComponent("settings.json").path)
        let selection = PetAppearanceSelection(store: store, preferences: preferences, bundledLibrary: nil)
        try selection.select(appearance.id)
        try writeJSON(["id": "updated-atlas", "displayName": "Too many PNG bytes", "spritesheetPath": "pet.png"],
                      to: source.appendingPathComponent("pet.json"))
        // Dense 8-bit artwork passes the source limits but its nine clips exceed 128 MiB.
        try autoreleasepool {
            try png(width: 7680, height: 9360, noisy: true).write(to: source.appendingPathComponent("pet.png"))
        }
        XCTAssertThrowsError(try store.importDirectory(source)) { error in
            XCTAssertEqual(error.localizedDescription, "artwork files exceed 128 MiB")
        }
        XCTAssertEqual(store.appearances(), [appearance])
        XCTAssertEqual(try store.load(appearance.id).catalog.canvas, .init(width: 192, height: 208))
        XCTAssertEqual(selection.id, appearance.id)
        XCTAssertEqual(preferences.current.selectedAppearance, appearance.id)
    }

    func testProvidedCodexPack() throws {
        guard let path = ProcessInfo.processInfo.environment["DEV_FLOW_PET_TEST_FIXTURE"] else {
            throw XCTSkip("Set DEV_FLOW_PET_TEST_FIXTURE to check a local Codex pack")
        }
        let appearance = try store.importDirectory(URL(fileURLWithPath: path))
        let library = try store.load(appearance.id)
        XCTAssertEqual(Set(library.catalog.clips.keys), Set(AnimationClip.allCases))
        let expectedCounts: [AnimationClip: Int] = [.idle: 6, .working: 6, .blocked: 6, .complete: 5,
            .disconnected: 8, .runningRight: 8, .runningLeft: 8, .waving: 4, .review: 6]
        for (clip, count) in expectedCounts {
            XCTAssertEqual(try library.frames(for: clip).images.count, count, clip.rawValue)
        }
        let assets = temporary.appendingPathComponent("installed/\(appearance.id)/Assets")
        let paths = library.catalog.clips.values.flatMap(\.frames)
        let bytes = try paths.reduce(0) { total, path in total + (try Data(contentsOf: assets.appendingPathComponent(path))).count }
        print("Imported Codex fixture: \(library.catalog.clips.count) clips, \(paths.count) frames, \(bytes) PNG bytes")
    }

    @MainActor
    func testMenuReflectsTheSelectedAppearanceAndPlayerResetsOnReplacement() throws {
        _ = NSApplication.shared
        let menu = PetMenu()
        defer { menu.removeStatusItem() }
        menu.refresh(strings: .english, isConnected: true, isVisible: true, animationsEnabled: true, idleActivitiesEnabled: true,
            reduceMotion: false, appearances: [.init(id: "test-pet", name: "Test")],
            selectedAppearance: "test-pet", importingAppearance: false, scale: 1.5)
        let sizes = try XCTUnwrap(menu.menu.items.first { $0.title == "Pet size (150%)" }?.submenu)
        XCTAssertEqual(sizes.items.map(\.title), ["50%", "75%", "100%", "125%", "150%", "200%"])
        XCTAssertEqual(sizes.items.first { $0.title == "150%" }?.state, .on)
        let submenu = try XCTUnwrap(menu.menu.items.first { $0.title == "Choose appearance" }?.submenu)
        XCTAssertEqual(submenu.items.first { $0.title == "Test" }?.state, .on)
        XCTAssertEqual(submenu.items.first { $0.title == "Bundled appearance" }?.state, .off)
        XCTAssertNotNil(submenu.items.first { $0.title == "Import appearance…" })
        XCTAssertEqual(menu.menu.items.first { $0.title == "Idle activities" }?.state, .on)
        menu.refresh(strings: .chinese, isConnected: true, isVisible: true, animationsEnabled: true, idleActivitiesEnabled: false,
            reduceMotion: false, appearances: [], selectedAppearance: nil, importingAppearance: false)
        XCTAssertEqual(menu.menu.items.first { $0.title == "待机活动" }?.state, .off)
        let appearance = try store.importDirectory(staticPack())
        let view = PetCharacterView(frame: .zero)
        view.configure(library: try store.load(appearance.id), strings: .english)
        view.play(clip: .idle, playback: .loop(0...0), restart: false)
        view.configure(library: try store.load(appearance.id), strings: .english)
        XCTAssertNil(view.currentPlayback)
        view.play(clip: .complete, playback: .rest(frameIndex: 0), restart: false)
        XCTAssertEqual(view.currentPlayback, .rest(frameIndex: 0))
        view.stopPlayback()
    }

    private func staticPack() throws -> URL {
        let source = temporary.appendingPathComponent("source-\(UUID())")
        try FileManager.default.createDirectory(at: source, withIntermediateDirectories: true)
        try writeJSON(["id": "test-pet", "name": "Test", "image": "pet.png"], to: source.appendingPathComponent("pet.json"))
        try png(width: 16, height: 16).write(to: source.appendingPathComponent("pet.png"))
        return source
    }

    private func writeJSON(_ object: [String: Any], to url: URL) throws {
        try JSONSerialization.data(withJSONObject: object).write(to: url)
    }

    private func makeCatalog() -> AnimationCatalog {
        let clips = Dictionary(uniqueKeysWithValues: AnimationCatalog.requiredClips.map { clip in
            (clip, AnimationCatalog.Clip(frames: ["frame.png", "frame.png"], fps: 24,
                loopRange: clip == .complete ? nil : 0...1, restFrame: 0, frameDurationsMilliseconds: [80, 160]))
        })
        return .init(canvas: .init(width: 16, height: 16), anchor: .init(x: 8, y: 16), clips: clips)
    }

    private func png(width: Int, height: Int, rowColors: Bool = false, rowHeight: Int = 208,
                     noisy: Bool = false) throws -> Data {
        let context = try XCTUnwrap(CGContext(data: nil, width: width, height: height, bitsPerComponent: 8,
            bytesPerRow: width * 4, space: CGColorSpaceCreateDeviceRGB(),
            bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue))
        if noisy {
            let count = context.bytesPerRow * height / MemoryLayout<UInt64>.size
            let words = try XCTUnwrap(context.data).bindMemory(to: UInt64.self, capacity: count)
            var state: UInt64 = 0x123456789abcdef
            for index in 0..<count {
                state ^= state >> 12
                state ^= state << 25
                state ^= state >> 27
                words[index] = state &* 0x2545f4914f6cdd1d
            }
        } else {
            for y in stride(from: 0, to: height, by: rowHeight) {
                let red = rowColors ? Double((y / rowHeight) * 20) : 64
                context.setFillColor(red: red / 255, green: 0, blue: 0, alpha: 1)
                context.fill(CGRect(x: 0, y: max(0, height - y - rowHeight), width: width,
                                    height: min(rowHeight, height - y)))
            }
        }
        let image = try XCTUnwrap(context.makeImage())
        return try AppearanceImages.png(image)
    }

    private func pngWithDeclaredSize(width: UInt32, height: UInt32) throws -> Data {
        var data = try png(width: 16, height: 16)
        for (offset, value) in [(16, width), (20, height)] {
            var encoded = value.bigEndian
            withUnsafeBytes(of: &encoded) { data.replaceSubrange(offset..<(offset + 4), with: $0) }
        }
        let checksum = data[12..<29].withUnsafeBytes { buffer in
            UInt32(crc32(0, buffer.bindMemory(to: UInt8.self).baseAddress, uInt(buffer.count)))
        }
        var encoded = checksum.bigEndian
        withUnsafeBytes(of: &encoded) { data.replaceSubrange(29..<33, with: $0) }
        return data
    }
}
