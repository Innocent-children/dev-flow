import Foundation
import ImageIO
import UniformTypeIdentifiers

struct PetAppearance: Codable, Equatable, Sendable {
    let id: String
    let name: String
}

struct AppearanceImportError: LocalizedError {
    let message: String
    var errorDescription: String? { message }
}

/// Reads bundled appearances and imports presentation data into the user's pet
/// directory. User copies take precedence for the same appearance ID.
final class PetAppearanceStore: @unchecked Sendable {
    private let root: URL
    private let bundledRoot: URL?
    private let manager = FileManager.default
    static let maximumPackBytes = 128 * 1024 * 1024
    private static let maximumClipDecodedBytes = 128 * 1024 * 1024

    init(directory: String, bundledDirectory: URL? = nil) {
        root = URL(fileURLWithPath: directory, isDirectory: true)
        bundledRoot = bundledDirectory
    }

    func appearances() -> [PetAppearance] {
        var entries: [String: PetAppearance] = [:]
        for directoryRoot in [bundledRoot, root].compactMap({ $0 }) {
            let directories = (try? manager.contentsOfDirectory(at: directoryRoot, includingPropertiesForKeys: [.isDirectoryKey],
                                                                options: [.skipsHiddenFiles])) ?? []
            for directory in directories {
                guard let appearance = try? readMetadata(directory), appearance.id == directory.lastPathComponent else { continue }
                entries[appearance.id] = appearance
            }
        }
        return entries.values.sorted { ($0.name, $0.id) < ($1.name, $1.id) }
    }

    func load(_ id: String) throws -> AssetLibrary {
        try validateID(id)
        let userDirectory = root.appendingPathComponent(id, isDirectory: true)
        let directory = manager.fileExists(atPath: userDirectory.path)
            ? userDirectory : (bundledRoot?.appendingPathComponent(id, isDirectory: true) ?? userDirectory)
        let appearance = try readMetadata(directory)
        guard appearance.id == id else { throw invalid("pet.json: id does not match the installed folder") }
        let catalog = try validatePack(directory)
        return try AssetLibrary(catalog: catalog, assetRoot: directory.appendingPathComponent("Assets"))
    }

    func importDirectory(_ source: URL) throws -> PetAppearance {
        let source = source.standardizedFileURL.resolvingSymlinksInPath()
        let manifest = try OwnedStorage.readRelativeData(in: source, path: "pet.json", limit: 256 * 1024)
        guard let object = try JSONSerialization.jsonObject(with: manifest) as? [String: Any] else {
            throw invalid("pet.json must be a JSON object")
        }
        try OwnedStorage.ensurePrivateDirectory(root.path)
        let staging = root.appendingPathComponent(".import-\(UUID().uuidString)", isDirectory: true)
        try OwnedStorage.ensurePrivateDirectory(staging.path)
        defer { try? manager.removeItem(at: staging) }

        let appearance: PetAppearance
        if object["spritesheetPath"] != nil {
            appearance = try CodexPetImporter.convert(manifest, from: source, into: staging)
        } else {
            guard Set(object.keys).isSubset(of: ["id", "name", "image"]) else {
                throw invalid("pet.json accepts id, name, and optional image")
            }
            appearance = try JSONDecoder().decode(PetAppearance.self, from: manifest)
            try validateMetadata(appearance)
            if let value = object["image"] {
                guard let path = value as? String else { throw invalid("pet.json: image must be a relative PNG path") }
                let data = try OwnedStorage.readRelativeData(in: source, path: path, limit: Self.maximumPackBytes)
                let image = try AppearanceImages.decode(data, allowedTypes: [UTType.png.identifier],
                                                        maximumDecodedBytes: Self.maximumClipDecodedBytes)
                let clips = Dictionary(uniqueKeysWithValues: AnimationCatalog.requiredClips.map { clip in
                    (clip, AnimationCatalog.Clip(frames: ["static.png"], fps: 1,
                        loopRange: clip == .complete ? nil : 0...0, restFrame: 0))
                })
                let catalog = AnimationCatalog(canvas: .init(width: image.width, height: image.height),
                    anchor: .init(x: Double(image.width) / 2, y: Double(image.height)), clips: clips)
                try OwnedStorage.writeAtomically(data, to: staging.appendingPathComponent("Assets/static.png").path)
                try writeCatalog(catalog, to: staging)
            } else {
                let catalog = try readCatalog(source)
                try validateImages(catalog, in: source, copyTo: staging)
                try writeCatalog(catalog, to: staging)
            }
        }
        try validateMetadata(appearance)
        try OwnedStorage.writeAtomically(JSONEncoder.pretty.encode(appearance), to: staging.appendingPathComponent("pet.json").path)
        // Validate the complete converted pack before replacing the installed copy.
        _ = try validatePack(staging)
        let destination = root.appendingPathComponent(appearance.id, isDirectory: true)
        if manager.fileExists(atPath: destination.path) {
            let values = try destination.resourceValues(forKeys: [.isDirectoryKey, .isSymbolicLinkKey])
            guard values.isDirectory == true, values.isSymbolicLink != true else {
                throw invalid("the installed appearance path is not a regular directory")
            }
            _ = try manager.replaceItemAt(destination, withItemAt: staging)
        } else {
            try manager.moveItem(at: staging, to: destination)
        }
        return appearance
    }

    private func readMetadata(_ directory: URL) throws -> PetAppearance {
        let values = try directory.resourceValues(forKeys: [.isDirectoryKey, .isSymbolicLinkKey])
        guard values.isDirectory == true, values.isSymbolicLink != true else {
            throw invalid("appearance must be a regular directory")
        }
        let data = try OwnedStorage.readRelativeData(in: directory, path: "pet.json", limit: 256 * 1024)
        let appearance = try JSONDecoder().decode(PetAppearance.self, from: data)
        try validateMetadata(appearance)
        return appearance
    }

    private func readCatalog(_ directory: URL) throws -> AnimationCatalog {
        let data = try OwnedStorage.readRelativeData(in: directory, path: "animations.json", limit: 256 * 1024)
        let catalog = try AnimationCatalog.decode(data)
        let canvas = catalog.canvas
        guard catalog.clips.values.reduce(0, { $0 + $1.frames.count }) <= 512 else { throw invalid("a pack supports at most 512 frame references") }
        for clip in catalog.clips.values {
            guard (0.1...120).contains(clip.fps),
                  clip.frameDurationsMilliseconds?.allSatisfy({ $0 >= 9 }) ?? true,
                  canvas.width <= Self.maximumClipDecodedBytes / 4 / canvas.height / clip.frames.count else {
                throw invalid("actions require 0.1–120 fps, frame durations of at least 9 ms, and at most 128 MiB decoded")
            }
        }
        return catalog
    }

    private func validatePack(_ directory: URL) throws -> AnimationCatalog {
        let catalog = try readCatalog(directory)
        try validateImages(catalog, in: directory)
        return catalog
    }

    private func validateImages(_ catalog: AnimationCatalog, in directory: URL, copyTo destination: URL? = nil) throws {
        let paths = Set(catalog.clips.values.flatMap(\.frames))
        var bytes = 0
        for path in paths.sorted() {
            let relative = "Assets/" + path
            let data = try OwnedStorage.readRelativeData(in: directory, path: relative, limit: Self.maximumPackBytes)
            bytes += data.count
            guard bytes <= Self.maximumPackBytes else { throw invalid("PNG files exceed 128 MiB") }
            let image = try AppearanceImages.decode(data, allowedTypes: [UTType.png.identifier],
                                                    maximumDecodedBytes: Self.maximumClipDecodedBytes)
            guard image.width == catalog.canvas.width, image.height == catalog.canvas.height else {
                throw invalid("\(path): PNG dimensions must match canvas")
            }
            if let destination { try OwnedStorage.writeAtomically(data, to: destination.appendingPathComponent(relative).path) }
        }
    }

    private func writeCatalog(_ catalog: AnimationCatalog, to directory: URL) throws {
        try OwnedStorage.writeAtomically(JSONEncoder.pretty.encode(catalog), to: directory.appendingPathComponent("animations.json").path)
    }

    private func validateMetadata(_ appearance: PetAppearance) throws {
        try validateID(appearance.id)
        guard !appearance.name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty, appearance.name.count <= 100 else {
            throw invalid("name must contain 1–100 characters")
        }
    }

    private func validateID(_ id: String) throws {
        guard id.range(of: "^[a-z0-9][a-z0-9_-]{0,63}$", options: .regularExpression) != nil else {
            throw invalid("id must contain 1–64 lowercase letters, digits, hyphens or underscores")
        }
    }

    private func invalid(_ message: String) -> AppearanceImportError { AppearanceImportError(message: message) }
}

/// Bounded image decoding shared by PNG packs and Codex atlas conversion.
enum AppearanceImages {
    static func decode(_ data: Data, allowedTypes: [String], maximumDecodedBytes: Int) throws -> CGImage {
        guard let source = CGImageSourceCreateWithData(data as CFData, nil),
              let type = CGImageSourceGetType(source), allowedTypes.contains(type as String),
              CGImageSourceGetCount(source) == 1,
              let properties = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any],
              let width = properties[kCGImagePropertyPixelWidth] as? Int,
              let height = properties[kCGImagePropertyPixelHeight] as? Int,
              let depth = properties[kCGImagePropertyDepth] as? Int,
              width > 0, height > 0, (1...16).contains(depth) else {
            throw AppearanceImportError(message: "image is invalid or unsupported")
        }
        // Reserve four channels at the source bit depth before ImageIO allocates pixels.
        let bytesPerPixel = 4 * ((depth + 7) / 8)
        guard width <= maximumDecodedBytes / bytesPerPixel / height else {
            throw AppearanceImportError(message: "decoded image exceeds \(maximumDecodedBytes / (1024 * 1024)) MiB")
        }
        guard let image = CGImageSourceCreateImageAtIndex(source, 0,
            [kCGImageSourceShouldCacheImmediately: true] as CFDictionary) else {
            throw AppearanceImportError(message: "image is invalid or unsupported")
        }
        return image
    }

    static func png(_ image: CGImage) throws -> Data {
        let data = NSMutableData()
        guard let destination = CGImageDestinationCreateWithData(data, UTType.png.identifier as CFString, 1, nil) else {
            throw AppearanceImportError(message: "cannot create PNG frame")
        }
        CGImageDestinationAddImage(destination, image, nil)
        guard CGImageDestinationFinalize(destination) else { throw AppearanceImportError(message: "cannot encode PNG frame") }
        return data as Data
    }
}
