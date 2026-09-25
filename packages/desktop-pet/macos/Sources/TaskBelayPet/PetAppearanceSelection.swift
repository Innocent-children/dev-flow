import Foundation

/// Keeps the displayed library and saved selection together. Failed loads or
/// preference writes preserve the previous selection.
final class PetAppearanceSelection {
    private let store: PetAppearanceStore
    private let preferences: PreferenceStore
    private let bundledLibrary: AssetLibrary?
    private(set) var id: String?
    private(set) var library: AssetLibrary?

    init(store: PetAppearanceStore, preferences: PreferenceStore, bundledLibrary: AssetLibrary?) {
        self.store = store
        self.preferences = preferences
        self.bundledLibrary = bundledLibrary
        library = bundledLibrary
    }

    func restore() throws {
        try select(preferences.current.selectedAppearance)
    }

    func select(_ id: String?) throws {
        let next = try id.map { try store.load($0) } ?? bundledLibrary
        if preferences.current.selectedAppearance != id {
            guard preferences.update({ $0.selectedAppearance = id }) else {
                throw AppearanceImportError(message: "cannot save appearance selection")
            }
        }
        self.id = id
        library = next
    }
}
