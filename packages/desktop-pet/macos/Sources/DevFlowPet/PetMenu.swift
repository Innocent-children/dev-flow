import AppKit
import Foundation

/// The menu bar item and the one menu shared by the menu bar entry and a
/// right-click on the character.
///
/// The menu exposes task and appearance selection plus animation and visibility
/// controls. When the
/// system reduce-motion setting is active, the menu states that animation is
/// limited by it.
@MainActor
final class PetMenu: NSObject {
    enum Action: Equatable {
        case chooseTask
        case chooseAppearance(String?)
        case importAppearance
        case openTaskList
        case retryConnection
        case toggleAnimations
        case toggleVisibility
        case quit
    }

    /// The delivered menu bar template icon inside `Resources/Assets`.
    private static let iconCandidates = ["MenuBarIcon.pdf", "MenuBarIcon.png"]

    var onAction: ((Action) -> Void)?

    let menu = NSMenu()
    private let statusItem: NSStatusItem
    private let chooseTaskItem = NSMenuItem()
    private let appearanceItem = NSMenuItem()
    private let appearancesMenu = NSMenu()
    private let openTaskListItem = NSMenuItem()
    private let retryConnectionItem = NSMenuItem()
    private let animationsItem = NSMenuItem()
    private let reduceMotionItem = NSMenuItem()
    private let visibilityItem = NSMenuItem()
    private let quitItem = NSMenuItem()

    override init() {
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.squareLength)
        super.init()
        buildMenu()
        installMenuBarIcon()
    }

    /// Retitles and re-enables every entry for the current language and state.
    func refresh(
        strings: PetStrings,
        isConnected: Bool,
        isVisible: Bool,
        animationsEnabled: Bool,
        reduceMotion: Bool,
        appearances: [PetAppearance],
        selectedAppearance: String?,
        importingAppearance: Bool
    ) {
        chooseTaskItem.title = strings.menuChooseTask
        appearanceItem.title = importingAppearance ? strings.importingAppearance : strings.menuChooseAppearance
        appearanceItem.isEnabled = !importingAppearance
        appearancesMenu.removeAllItems()
        appendAppearance(strings.bundledAppearance, id: nil, selected: selectedAppearance == nil)
        for appearance in appearances {
            appendAppearance(appearance.name, id: appearance.id, selected: selectedAppearance == appearance.id)
        }
        appearancesMenu.addItem(.separator())
        let importItem = NSMenuItem(title: strings.importAppearance, action: #selector(importAppearance), keyEquivalent: "")
        importItem.target = self
        appearancesMenu.addItem(importItem)
        openTaskListItem.title = strings.menuOpenTaskList
        retryConnectionItem.title = strings.menuRetryConnection
        animationsItem.title = strings.menuAnimations
        visibilityItem.title = isVisible ? strings.menuHide : strings.menuShow
        quitItem.title = strings.menuQuit

        // Only a disconnected desktop may ask Core to start the local service.
        retryConnectionItem.isEnabled = !isConnected
        animationsItem.state = animationsEnabled ? .on : .off

        reduceMotionItem.isHidden = !reduceMotion
        reduceMotionItem.title = reduceMotion ? strings.reduceMotionNote : ""
    }

    /// Shows the same menu for a right-click on the character or the bubble.
    func showContextMenu(at location: NSPoint, in view: NSView) {
        menu.popUp(positioning: nil, at: location, in: view)
    }

    func removeStatusItem() {
        NSStatusBar.system.removeStatusItem(statusItem)
    }

    private func buildMenu() {
        menu.autoenablesItems = false
        add(chooseTaskItem, action: #selector(chooseTask))
        appearanceItem.submenu = appearancesMenu
        appearancesMenu.autoenablesItems = false
        menu.addItem(appearanceItem)
        add(openTaskListItem, action: #selector(openTaskList))
        menu.addItem(.separator())
        add(retryConnectionItem, action: #selector(retryConnection))
        add(animationsItem, action: #selector(toggleAnimations))
        reduceMotionItem.isEnabled = false
        reduceMotionItem.isHidden = true
        menu.addItem(reduceMotionItem)
        menu.addItem(.separator())
        add(visibilityItem, action: #selector(toggleVisibility))
        add(quitItem, action: #selector(quit))
        statusItem.menu = menu
    }

    private func add(_ item: NSMenuItem, action: Selector) {
        item.target = self
        item.action = action
        menu.addItem(item)
    }

    private func installMenuBarIcon() {
        guard let resourceDirectory = AssetLibrary.bundleResourceDirectory() else { return }
        for candidate in Self.iconCandidates {
            let url = resourceDirectory.appendingPathComponent("Assets").appendingPathComponent(candidate)
            guard let image = NSImage(contentsOf: url) else { continue }
            image.isTemplate = true
            image.size = NSSize(width: 18, height: 18)
            statusItem.button?.image = image
            return
        }
    }

    @objc private func chooseTask() { onAction?(.chooseTask) }
    @objc private func chooseAppearance(_ item: NSMenuItem) { onAction?(.chooseAppearance(item.representedObject as? String)) }
    @objc private func importAppearance() { onAction?(.importAppearance) }

    private func appendAppearance(_ title: String, id: String?, selected: Bool) {
        let item = NSMenuItem(title: title, action: #selector(chooseAppearance(_:)), keyEquivalent: "")
        item.target = self
        item.representedObject = id
        item.state = selected ? .on : .off
        appearancesMenu.addItem(item)
    }
    @objc private func openTaskList() { onAction?(.openTaskList) }
    @objc private func retryConnection() { onAction?(.retryConnection) }
    @objc private func toggleAnimations() { onAction?(.toggleAnimations) }
    @objc private func toggleVisibility() { onAction?(.toggleVisibility) }
    @objc private func quit() { onAction?(.quit) }
}
