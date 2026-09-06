import AppKit
import Foundation
import XCTest
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
        for clip in AnimationClip.allCases {
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

    func testImportRejectsOversizedImageAndMalformedTimings() throws {
        let source = try staticPack()
        try png(width: 1025, height: 1).write(to: source.appendingPathComponent("pet.png"))
        XCTAssertThrowsError(try store.importDirectory(source))
        var catalog = makeCatalog()
        var clips = catalog.clips
        clips[.idle] = .init(frames: ["frame.png"], fps: 24, loopRange: 0...0, restFrame: 0,
                            frameDurationsMilliseconds: [0])
        catalog = .init(canvas: catalog.canvas, anchor: catalog.anchor, clips: clips)
        XCTAssertThrowsError(try catalog.validate())
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
            XCTAssertEqual(library.catalog.clips[.complete]?.frames.count, 5)
            XCTAssertNil(library.catalog.clips[.complete]?.loopRange)
            XCTAssertEqual(library.catalog.clips[.idle]?.frameDurationsMilliseconds, [280, 110, 110, 140, 140, 320])
            let workingFrame = temporary.appendingPathComponent("installed/\(appearance.id)/Assets/working/0.png")
            let bitmap = try XCTUnwrap(NSBitmapImageRep(data: Data(contentsOf: workingFrame)))
            let color = try XCTUnwrap(bitmap.colorAt(x: 0, y: 0)?.usingColorSpace(.deviceRGB))
            let sourceBitmap = try XCTUnwrap(NSBitmapImageRep(data: Data(contentsOf: source.appendingPathComponent("sheet.png"))))
            let expected = try XCTUnwrap(sourceBitmap.colorAt(x: 0, y: 7 * 208)?.usingColorSpace(.deviceRGB))
            XCTAssertEqual(color.redComponent, expected.redComponent, accuracy: 0.01)
        }
    }

    func testProvidedCodexPack() throws {
        guard let path = ProcessInfo.processInfo.environment["DEV_FLOW_PET_TEST_FIXTURE"] else {
            throw XCTSkip("Set DEV_FLOW_PET_TEST_FIXTURE to check a local Codex pack")
        }
        let appearance = try store.importDirectory(URL(fileURLWithPath: path))
        let library = try store.load(appearance.id)
        XCTAssertEqual(Set(library.catalog.clips.keys), Set(AnimationClip.allCases))
        XCTAssertEqual(try library.frames(for: .working).images.count, 6)
    }

    @MainActor
    func testMenuReflectsTheSelectedAppearanceAndPlayerResetsOnReplacement() throws {
        _ = NSApplication.shared
        let menu = PetMenu()
        defer { menu.removeStatusItem() }
        menu.refresh(strings: .english, isConnected: true, isVisible: true, animationsEnabled: true,
            reduceMotion: false, appearances: [.init(id: "test-pet", name: "Test")],
            selectedAppearance: "test-pet", importingAppearance: false)
        let submenu = try XCTUnwrap(menu.menu.items.first { $0.title == "Choose appearance" }?.submenu)
        XCTAssertEqual(submenu.items.first { $0.title == "Test" }?.state, .on)
        XCTAssertEqual(submenu.items.first { $0.title == "Bundled appearance" }?.state, .off)
        XCTAssertNotNil(submenu.items.first { $0.title == "Import appearance…" })
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
        let clips = Dictionary(uniqueKeysWithValues: AnimationClip.allCases.map { clip in
            (clip, AnimationCatalog.Clip(frames: ["frame.png", "frame.png"], fps: 24,
                loopRange: clip == .complete ? nil : 0...1, restFrame: 0, frameDurationsMilliseconds: [80, 160]))
        })
        return .init(canvas: .init(width: 16, height: 16), anchor: .init(x: 8, y: 16), clips: clips)
    }

    private func png(width: Int, height: Int, rowColors: Bool = false) throws -> Data {
        var pixels = [UInt8](repeating: 0, count: width * height * 4)
        for y in 0..<height {
            for x in 0..<width {
                let index = (y * width + x) * 4
                pixels[index] = rowColors ? UInt8((y / 208) * 20) : 64
                pixels[index + 3] = 255
            }
        }
        let provider = try XCTUnwrap(CGDataProvider(data: Data(pixels) as CFData))
        let image = try XCTUnwrap(CGImage(width: width, height: height, bitsPerComponent: 8, bitsPerPixel: 32,
            bytesPerRow: width * 4, space: CGColorSpaceCreateDeviceRGB(),
            bitmapInfo: CGBitmapInfo(rawValue: CGImageAlphaInfo.premultipliedLast.rawValue),
            provider: provider, decode: nil, shouldInterpolate: false, intent: .defaultIntent))
        return try AppearanceImages.png(image)
    }
}
