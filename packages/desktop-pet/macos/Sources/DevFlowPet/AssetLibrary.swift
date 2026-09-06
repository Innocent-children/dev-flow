import AppKit
import Foundation

/// The decoded frames of the one clip that is playing.
struct ClipFrames: Equatable {
    let clip: AnimationClip
    let images: [NSImage]

    func image(at index: Int) -> NSImage? {
        guard index >= 0, index < images.count else { return nil }
        return images[index]
    }

    static func == (lhs: ClipFrames, rhs: ClipFrames) -> Bool {
        lhs.clip == rhs.clip && lhs.images.count == rhs.images.count
    }
}

enum AssetError: Error, Equatable {
    case catalogMissing
    case catalogUnreadable
    case catalogInvalid(String)
    case frameOutsideAssetRoot(AnimationClip, String)
    case frameMissing(AnimationClip, String)
}

/// Reads `Resources/animations.json` and the PNG frames it lists.
///
/// Only the clip that is playing is decoded and retained, so a desktop
/// component that stays open for days does not hold every delivered frame in
/// memory. Frame paths come from the catalog and are resolved inside the asset
/// root only; the library never follows a path that escapes it.
final class AssetLibrary {
    let catalog: AnimationCatalog
    let canvasSize: CGSize

    private let assetRoot: URL
    private var cachedClip: AnimationClip?
    private var cachedFrames: ClipFrames?

    convenience init(resourceDirectory: URL) throws {
        let catalogURL = resourceDirectory.appendingPathComponent("animations.json")
        guard FileManager.default.fileExists(atPath: catalogURL.path) else {
            throw AssetError.catalogMissing
        }
        let data: Data
        do {
            data = try Data(contentsOf: catalogURL)
        } catch {
            throw AssetError.catalogUnreadable
        }
        let decoded: AnimationCatalog
        do {
            decoded = try AnimationCatalog.decode(data)
        } catch {
            throw AssetError.catalogInvalid(String(describing: error))
        }
        try self.init(catalog: decoded, assetRoot: resourceDirectory.appendingPathComponent("Assets"))
    }

    init(catalog: AnimationCatalog, assetRoot: URL) throws {
        try catalog.validate()
        self.catalog = catalog
        self.assetRoot = assetRoot.standardizedFileURL
        canvasSize = CGSize(width: catalog.canvas.width, height: catalog.canvas.height)
    }

    /// The asset root of a built application bundle, or `nil` when the process
    /// was started without an assembled bundle.
    static func bundleResourceDirectory(_ bundle: Bundle = .main) -> URL? {
        bundle.resourceURL
    }

    /// Returns the frames of `clip`, decoding them on first request and
    /// releasing the previously cached clip.
    func frames(for clip: AnimationClip) throws -> ClipFrames {
        if let cachedFrames, cachedClip == clip { return cachedFrames }
        guard let description = catalog.clips[clip] else {
            throw AssetError.catalogInvalid("clip \(clip.rawValue) is absent")
        }
        var images: [NSImage] = []
        images.reserveCapacity(description.frames.count)
        for frame in description.frames {
            let url = try resolvedFrameURL(clip: clip, frame: frame)
            guard let image = NSImage(contentsOf: url) else {
                throw AssetError.frameMissing(clip, frame)
            }
            image.size = canvasSize
            images.append(image)
        }
        cachedClip = clip
        cachedFrames = ClipFrames(clip: clip, images: images)
        return ClipFrames(clip: clip, images: images)
    }

    /// Releases the retained frames. Hiding, sleeping, and quitting call this so
    /// no animation timer keeps decoded frames alive.
    func releaseFrames() {
        cachedClip = nil
        cachedFrames = nil
    }

    private func resolvedFrameURL(clip: AnimationClip, frame: String) throws -> URL {
        let url = assetRoot.appendingPathComponent(frame).standardizedFileURL
        let root = assetRoot.path
        guard url.path == root || url.path.hasPrefix(root + "/") else {
            throw AssetError.frameOutsideAssetRoot(clip, frame)
        }
        return url
    }
}
