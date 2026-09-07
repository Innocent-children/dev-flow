import AppKit
import XCTest
@testable import DevFlowPet

final class SVGArtworkTests: XCTestCase {
    private let circle = Data("""
    <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
      <circle cx="32" cy="32" r="20" fill="#3288ef" stroke="#122345" stroke-width="2"/>
    </svg>
    """.utf8)

    func testStaticSVGIsPreservedAndRendersAtLargerSizes() throws {
        let root = try temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: root) }
        let source = root.appendingPathComponent("source")
        try FileManager.default.createDirectory(at: source, withIntermediateDirectories: true)
        try Data(#"{"id":"vector-pet","name":"Vector pet","image":"pet.svg"}"#.utf8)
            .write(to: source.appendingPathComponent("pet.json"))
        try circle.write(to: source.appendingPathComponent("pet.svg"))
        let store = PetAppearanceStore(directory: root.appendingPathComponent("installed").path)
        let appearance = try store.importDirectory(source)
        let stored = root.appendingPathComponent("installed/vector-pet/Assets/static.svg")
        XCTAssertEqual(try Data(contentsOf: stored), circle)
        try FileManager.default.removeItem(at: source)
        let library = try store.load(appearance.id)
        XCTAssertEqual(library.catalog.canvas, .init(width: 64, height: 64))
        let image = try XCTUnwrap(library.frames(for: .idle).image(at: 0))
        var target = NSRect(x: 0, y: 0, width: 256, height: 256)
        let rendered = try XCTUnwrap(image.cgImage(forProposedRect: &target, context: nil, hints: nil))
        XCTAssertGreaterThanOrEqual(rendered.width, 256)
        XCTAssertGreaterThanOrEqual(rendered.height, 256)
    }

    func testSVGRejectsScriptsRasterEmbeddingExternalReferencesAndDocumentTypes() throws {
        for content in [
            "<script>1</script>",
            "<image href=\"data:image/png;base64,AAAA\"/>",
            "<use href=\"https://example.invalid/pet.svg#body\"/>",
            "<path d=\"M0 0h10v10z\" fill=\"url(https://example.invalid/paint.svg#g)\"/>",
            "<path d=\"M0 0h10v10z\" style=\"fill:red\"/>",
        ] {
            let data = Data("<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"64\" height=\"64\">\(content)</svg>".utf8)
            XCTAssertThrowsError(try SVGArtwork.canvas(of: data), content)
        }
        XCTAssertThrowsError(try SVGArtwork.canvas(of: Data("<!DOCTYPE svg [<!ENTITY a 'x'>]>".utf8) + circle))
    }

    func testSVGRejectsOversizedAndInconsistentCanvases() {
        for replacement in ["width=\"5000\"", "width=\"32\"", "width=\"0\""] {
            let text = String(decoding: circle, as: UTF8.self).replacingOccurrences(of: "width=\"64\"", with: replacement)
            XCTAssertThrowsError(try SVGArtwork.canvas(of: Data(text.utf8)))
        }
    }

    func testProvidedVectorPackPreservesEveryFrame() throws {
        guard let path = ProcessInfo.processInfo.environment["DEV_FLOW_PET_TEST_FIXTURE"] else {
            throw XCTSkip("Set DEV_FLOW_PET_TEST_FIXTURE to check a SVG artwork pack")
        }
        let source = URL(fileURLWithPath: path)
        let catalog = try AnimationCatalog.decode(Data(contentsOf: source.appendingPathComponent("animations.json")))
        XCTAssertEqual(Set(catalog.clips.keys), Set(AnimationClip.allCases))
        let root = try temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: root) }
        let store = PetAppearanceStore(directory: root.path)
        let appearance = try store.importDirectory(source)
        let library = try store.load(appearance.id)
        var count = 0
        for (clip, description) in catalog.clips {
            let images = try library.frames(for: clip)
            XCTAssertEqual(images.images.count, description.frames.count)
            for frame in description.frames {
                XCTAssertTrue(frame.hasSuffix(".svg"))
                let original = try Data(contentsOf: source.appendingPathComponent("Assets/" + frame))
                let installed = try Data(contentsOf: root.appendingPathComponent(appearance.id + "/Assets/" + frame))
                XCTAssertEqual(original, installed)
                count += 1
            }
        }
        print("Verified SVG artwork: \(catalog.clips.count) clips, \(count) vector frames")
    }

    private func temporaryDirectory() throws -> URL {
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent("svg-artwork-\(UUID())")
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        return directory
    }
}
