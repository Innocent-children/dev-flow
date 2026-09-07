import AppKit
import Foundation

/// The menu bar item and the one menu shared by the menu bar entry and a
/// right-click on the character.
///
/// The menu exposes task and appearance selection, idle activities, animation,
/// and visibility controls. When the
/// system reduce-motion setting is active, the menu states that animation is
/// limited by it.
@MainActor
final class PetMenu: NSObject, NSMenuDelegate {
    enum Action: Equatable {
        case chooseTask
        case chooseAppearance(String?)
        case importAppearance
        case openTaskList
        case retryConnection
        case toggleAnimations
        case toggleIdleActivities
        case setScale(Double)
        case toggleVisibility
        case quit
    }

    var onAction: ((Action) -> Void)?
    var onTrackingChanged: ((Bool) -> Void)?

    let menu = NSMenu()
    private let statusItem: NSStatusItem
    private let chooseTaskItem = NSMenuItem()
    private let appearanceItem = NSMenuItem()
    private let appearancesMenu = NSMenu()
    private let openTaskListItem = NSMenuItem()
    private let retryConnectionItem = NSMenuItem()
    private let animationsItem = NSMenuItem()
    private let idleActivitiesItem = NSMenuItem()
    private let sizeItem = NSMenuItem()
    private let sizeMenu = NSMenu()
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
        idleActivitiesEnabled: Bool,
        reduceMotion: Bool,
        appearances: [PetAppearance],
        selectedAppearance: String?,
        importingAppearance: Bool,
        scale: Double = 1
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
        idleActivitiesItem.title = strings.menuIdleActivities
        sizeItem.title = "\(strings.menuSize) (\(Int((scale * 100).rounded()))%)"
        for item in sizeMenu.items {
            item.state = (item.representedObject as? Double) == scale ? .on : .off
        }
        visibilityItem.title = isVisible ? strings.menuHide : strings.menuShow
        quitItem.title = strings.menuQuit

        // Only a disconnected desktop may ask Core to start the local service.
        retryConnectionItem.isEnabled = !isConnected
        animationsItem.state = animationsEnabled ? .on : .off
        idleActivitiesItem.state = idleActivitiesEnabled ? .on : .off

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
        menu.delegate = self
        add(chooseTaskItem, action: #selector(chooseTask))
        appearanceItem.submenu = appearancesMenu
        appearancesMenu.autoenablesItems = false
        menu.addItem(appearanceItem)
        add(openTaskListItem, action: #selector(openTaskList))
        menu.addItem(.separator())
        add(retryConnectionItem, action: #selector(retryConnection))
        add(animationsItem, action: #selector(toggleAnimations))
        add(idleActivitiesItem, action: #selector(toggleIdleActivities))
        sizeItem.submenu = sizeMenu
        for scale in [0.5, 0.75, 1.0, 1.25, 1.5, 2.0] {
            let item = NSMenuItem(title: "\(Int(scale * 100))%", action: #selector(setScale(_:)), keyEquivalent: "")
            item.target = self
            item.representedObject = scale
            sizeMenu.addItem(item)
        }
        menu.addItem(sizeItem)
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
        statusItem.button?.image = PetMenuBarIcon.makeImage()
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
    @objc private func toggleIdleActivities() { onAction?(.toggleIdleActivities) }
    @objc private func setScale(_ item: NSMenuItem) {
        if let scale = item.representedObject as? Double { onAction?(.setScale(scale)) }
    }
    @objc private func toggleVisibility() { onAction?(.toggleVisibility) }
    @objc private func quit() { onAction?(.quit) }

    func menuWillOpen(_ menu: NSMenu) { onTrackingChanged?(true) }
    func menuDidClose(_ menu: NSMenu) { onTrackingChanged?(false) }
}
