import Foundation

/// User preferences for the desktop component. Language is read from the system
/// at runtime and never stored; Task nodes, actions, terminal outcomes, and
/// history are not preferences and are never written here.
struct PetPreferences: Codable, Equatable {
    struct Position: Codable, Equatable {
        let x: Double
        let y: Double
    }

    var position: Position?
    var animationsEnabled: Bool
    var idleActivitiesEnabled: Bool
    var scale: Double
    var pinnedTasks: [String: String]
    var selectedAppearance: String?

    enum CodingKeys: String, CodingKey {
        case position
        case animationsEnabled = "animations_enabled"
        case idleActivitiesEnabled = "idle_activities_enabled"
        case scale
        case pinnedTasks = "pinned_tasks"
        case selectedAppearance = "selected_appearance"
    }

    static let `default` = PetPreferences(position: nil, animationsEnabled: true, pinnedTasks: [:])

    init(position: Position?, animationsEnabled: Bool, pinnedTasks: [String: String], selectedAppearance: String? = nil,
         idleActivitiesEnabled: Bool = true, scale: Double = 1) {
        self.position = position
        self.animationsEnabled = animationsEnabled
        self.idleActivitiesEnabled = idleActivitiesEnabled
        self.scale = scale
        self.pinnedTasks = pinnedTasks
        self.selectedAppearance = selectedAppearance
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        position = try container.decodeIfPresent(Position.self, forKey: .position)
        animationsEnabled = try container.decodeIfPresent(Bool.self, forKey: .animationsEnabled) ?? true
        idleActivitiesEnabled = try container.decodeIfPresent(Bool.self, forKey: .idleActivitiesEnabled) ?? true
        scale = try container.decodeIfPresent(Double.self, forKey: .scale) ?? 1
        guard scale.isFinite, (0.5...2).contains(scale) else {
            throw DecodingError.dataCorruptedError(forKey: .scale, in: container, debugDescription: "pet scale must be between 0.5 and 2")
        }
        pinnedTasks = try container.decodeIfPresent([String: String].self, forKey: .pinnedTasks) ?? [:]
        selectedAppearance = try container.decodeIfPresent(String.self, forKey: .selectedAppearance)
    }

    func selectedTask(for dataRootDigest: String) -> String? {
        guard dataRootDigest.isEmpty == false else { return nil }
        return pinnedTasks[dataRootDigest]
    }

    mutating func select(taskID: String?, for dataRootDigest: String) {
        guard dataRootDigest.isEmpty == false else { return }
        guard let taskID, taskID.isEmpty == false else {
            pinnedTasks.removeValue(forKey: dataRootDigest)
            return
        }
        pinnedTasks[dataRootDigest] = taskID
    }
}

/// Loads and saves preferences with private permissions and atomic writes. A
/// missing or unreadable file yields the current defaults; there is no reader
/// for a superseded format.
final class PreferenceStore {
    let path: String
    private let lock = NSLock()
    private var value: PetPreferences

    var current: PetPreferences {
        lock.lock(); defer { lock.unlock() }
        return value
    }

    init(path: String) {
        self.path = path
        value = PreferenceStore.load(path: path)
    }

    static func load(path: String) -> PetPreferences {
        guard let data = try? OwnedStorage.readBoundedData(path),
              let preferences = try? JSONDecoder().decode(PetPreferences.self, from: data) else {
            return .default
        }
        return preferences
    }

    @discardableResult
    func update(_ mutate: (inout PetPreferences) -> Void) -> Bool {
        lock.lock(); defer { lock.unlock() }
        var next = value
        mutate(&next)
        guard next != value, write(next) else { return false }
        value = next
        return true
    }

    @discardableResult
    func save() -> Bool {
        lock.lock(); defer { lock.unlock() }
        return write(value)
    }

    private func write(_ next: PetPreferences) -> Bool {
        guard let data = try? JSONEncoder.pretty.encode(next) else { return false }
        do {
            try OwnedStorage.writeAtomically(data, to: path)
            return true
        } catch {
            return false
        }
    }
}

extension JSONEncoder {
    static let pretty: JSONEncoder = {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        return encoder
    }()
}

/// Keeps a remembered window position inside the currently visible work area.
enum PositionRules {
    /// Bounds automatic walking around the last manual placement and the current screen.
    static func walkingRange(centerX: Double, windowWidth: Double, visibleFrame: CGRect) -> ClosedRange<Double>? {
        let lower = max(centerX - 120, visibleFrame.minX + 16)
        let upper = min(centerX + 120, visibleFrame.maxX - windowWidth - 16)
        return lower <= upper ? lower...upper : nil
    }

    /// Returns the position to use for a window of `windowSize` inside
    /// `visibleFrame`. A display that was removed or rearranged moves the whole
    /// window back into a visible area instead of leaving it unreachable.
    static func constrain(
        position: PetPreferences.Position?,
        windowSize: CGSize,
        visibleFrame: CGRect,
        fallbackInset: Double
    ) -> CGPoint {
        guard visibleFrame.width >= windowSize.width, visibleFrame.height >= windowSize.height else {
            return CGPoint(x: visibleFrame.minX, y: visibleFrame.minY)
        }
        guard let position else {
            return CGPoint(
                x: visibleFrame.maxX - windowSize.width - fallbackInset,
                y: visibleFrame.minY + fallbackInset
            )
        }
        let maxX = visibleFrame.maxX - windowSize.width
        let maxY = visibleFrame.maxY - windowSize.height
        let x = min(max(position.x, visibleFrame.minX), maxX)
        // AppKit window frames use a bottom-left origin, so the remembered y is
        // the lower edge of the window.
        let y = min(max(position.y, visibleFrame.minY), maxY)
        return CGPoint(x: x, y: y)
    }
}
