import AppKit

/**
 * Uses the TB monogram without the app icon's background so macOS can tint it.
 */
enum PetMenuBarIcon {
    static func makeImage() -> NSImage {
        let url = Bundle.module.url(forResource: "taskbelay-menu-bar", withExtension: "svg")!
        let image = NSImage(contentsOf: url)!
        image.size = NSSize(width: 18, height: 18)
        image.isTemplate = true
        image.accessibilityDescription = "TaskBelay"
        return image
    }
}
