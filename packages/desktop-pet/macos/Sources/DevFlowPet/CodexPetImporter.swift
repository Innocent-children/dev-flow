import CryptoKit
import Foundation
import ImageIO
import UniformTypeIdentifiers

/// Converts local Codex artwork to Dev Flow frames at import time.
/// Runtime task semantics and playback use the common Dev Flow catalog.
enum CodexPetImporter {
    private struct Manifest: Decodable {
        let id: String
        let displayName: String
        let spritesheetPath: String
        let spriteVersionNumber: Int?
    }

    private struct Row {
        let clip: AnimationClip
        let index: Int
        let durations: [Int]
    }

    /// Atlas limits cover standard Codex sheets and Dev Flow's high-resolution extension.
    private static let maximumAtlasBytes = 512 * 1024 * 1024
    private static let maximumAtlasDecodedBytes = 1024 * 1024 * 1024

    private static let rows = [
        Row(clip: .idle, index: 0, durations: [280, 110, 110, 140, 140, 320]),
        Row(clip: .runningRight, index: 1, durations: [120, 120, 120, 120, 120, 120, 120, 220]),
        Row(clip: .runningLeft, index: 2, durations: [120, 120, 120, 120, 120, 120, 120, 220]),
        Row(clip: .waving, index: 3, durations: [140, 140, 140, 280]),
        Row(clip: .complete, index: 4, durations: [140, 140, 140, 140, 280]),
        Row(clip: .disconnected, index: 5, durations: [140, 140, 140, 140, 140, 140, 140, 240]),
        Row(clip: .blocked, index: 6, durations: [150, 150, 150, 150, 150, 260]),
        Row(clip: .working, index: 7, durations: [120, 120, 120, 120, 120, 220]),
        Row(clip: .review, index: 8, durations: [150, 150, 150, 150, 150, 280]),
    ]

    static func convert(_ data: Data, from source: URL, into destination: URL) throws -> PetAppearance {
        let manifest = try JSONDecoder().decode(Manifest.self, from: data)
        let version = manifest.spriteVersionNumber ?? 1
        guard [1, 2].contains(version), !manifest.id.isEmpty, manifest.id.count <= 256,
              !manifest.displayName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
              manifest.displayName.count <= 100 else {
            throw AppearanceImportError(message: "invalid Codex pet identity or spriteVersionNumber; expected 1 or 2")
        }
        let bytes = try OwnedStorage.readRelativeData(in: source, path: manifest.spritesheetPath,
                                                       limit: Self.maximumAtlasBytes)
        let atlas = try AppearanceImages.decode(bytes, allowedTypes: [UTType.png.identifier, UTType.webP.identifier],
                                                maximumDecodedBytes: Self.maximumAtlasDecodedBytes)
        // Eight columns and the Codex cell ratio also define Dev Flow's scaled atlas layout.
        let columns = 8
        guard atlas.width % columns == 0 else {
            throw AppearanceImportError(message: "Codex sprite sheet width must be a multiple of \(columns)")
        }
        let cellWidth = atlas.width / columns
        guard cellWidth * 208 % 192 == 0 else {
            throw AppearanceImportError(message: "Codex sprite sheet width does not map to the 192:208 cell ratio")
        }
        let cellHeight = cellWidth * 208 / 192
        guard atlas.height >= cellHeight * 9 else {
            throw AppearanceImportError(message: "Codex sprite sheet must contain all nine animation rows")
        }
        var clips: [AnimationClip: AnimationCatalog.Clip] = [:]
        for row in rows {
            var frames: [String] = []
            for column in row.durations.indices {
                guard let frame = atlas.cropping(to: CGRect(x: column * cellWidth, y: row.index * cellHeight, width: cellWidth, height: cellHeight)) else {
                    throw AppearanceImportError(message: "cannot read Codex sprite cell")
                }
                let path = "\(row.clip.rawValue)/\(column).png"
                try OwnedStorage.writeAtomically(AppearanceImages.png(frame), to: destination.appendingPathComponent("Assets/" + path).path)
                frames.append(path)
            }
            clips[row.clip] = .init(frames: frames, fps: 8,
                loopRange: row.clip == .complete ? nil : 0...(frames.count - 1),
                restFrame: row.clip == .complete ? frames.count - 1 : 0,
                frameDurationsMilliseconds: row.durations)
        }
        let catalog = AnimationCatalog(canvas: .init(width: cellWidth, height: cellHeight),
            anchor: .init(x: Double(cellWidth) / 2, y: Double(cellHeight)), clips: clips)
        try OwnedStorage.writeAtomically(JSONEncoder.pretty.encode(catalog), to: destination.appendingPathComponent("animations.json").path)
        let digest = SHA256.hash(data: Data(manifest.id.utf8)).map { String(format: "%02x", $0) }.joined()
        return PetAppearance(id: "codex-" + String(digest.prefix(32)), name: manifest.displayName)
    }
}
