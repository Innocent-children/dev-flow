import AppKit

/// Keeps task cards in one scroll surface across native layout transitions.
@MainActor
final class PetBubbleStackView: NSView {
    static let bubbleWidth: CGFloat = 256
    static let characterSpacing: CGFloat = 8
    var onOpen: ((String) -> Void)?
    var onPin: ((String?) -> Void)?
    var onDismiss: ((String) -> Void)?
    var onResize: (() -> Void)?
    private let scroll = NSScrollView()
    private let document = PetCardDocument()
    private let cardSurface = PetCardDocument()
    private let materialGroup: NSView
    private lazy var toggle = CardButton(id: "toggle", title: "", handler: { [weak self] _ in self?.expand() })
    private var rows: [PetCardRow] = []
    private var cards: [PetTaskCollection.Card] = []
    private var pinned: String?
    private var strings = PetStrings.english
    private var language = PetLanguage.resolve()
    private var sync: Date?
    private var message: BubbleContent?
    private(set) var isExpanded = false
    private var cardsNeedLayout = true
    var hasPendingLayout: Bool { cardsNeedLayout }
    var maximumHeight: CGFloat = 280

    override init(frame: NSRect) {
        if #available(macOS 26.0, *) {
            let glass = NSGlassEffectContainerView()
            glass.spacing = 0
            materialGroup = glass
        } else { materialGroup = NSView() }
        super.init(frame: frame)
        scroll.drawsBackground = false
        scroll.contentView.drawsBackground = false
        scroll.hasVerticalScroller = false
        scroll.hasHorizontalScroller = false
        scroll.autohidesScrollers = true
        scroll.scrollerStyle = .overlay
        scroll.documentView = document
        document.addSubview(materialGroup)
        if #available(macOS 26.0, *), let glass = materialGroup as? NSGlassEffectContainerView {
            glass.contentView = cardSurface
        } else { materialGroup.addSubview(cardSurface) }
        addSubview(scroll)
        addSubview(toggle)
        toggle.target = self
        toggle.action = #selector(expand)
        isHidden = true
        toggle.isHidden = true
    }
    required init?(coder: NSCoder) { fatalError("Created in code") }

    func update(_ content: BubbleContent) {
        guard !cards.isEmpty else { return }
        message = content
        rebuild()
    }
    func update(cards: [PetTaskCollection.Card], pinned: String?,
                sync: Date?, strings: PetStrings, language: PetLanguage) {
        let unchanged = message == nil && self.cards == cards && self.pinned == pinned && self.strings == strings && self.language == language
        self.cards = cards; self.pinned = pinned; message = nil
        self.sync = sync; self.strings = strings; self.language = language
        if unchanged && !cards.isEmpty {
            for (card, row) in zip(cards, rows) {
                row.bubble.update(BubbleRules.content(result: card.result, lastSyncAt: sync, strings: strings, language: language))
            }
            return
        }
        rebuild()
    }

    func setExpanded(_ value: Bool) {
        guard !isHidden else { return }
        guard value != isExpanded else { return }
        isExpanded = value
        scroll.contentView.scroll(to: .zero)
        updateToggle()
        cardsNeedLayout = true
        needsLayout = true
    }

    /// Retargets existing views inside the window's native animation transaction.
    func beginTransition() { arrangeCards(animated: true) }
    func finishTransition() {
        for (index, row) in rows.enumerated() { row.isHidden = !isExpanded && index >= 3 }
    }

    @objc private func expand() { setExpanded(!isExpanded); onResize?() }

    private func rebuild() {
        isHidden = cards.isEmpty
        if isHidden {
            isExpanded = false
            scroll.contentView.scroll(to: .zero)
        }
        let existing = Dictionary(uniqueKeysWithValues: rows.map { ($0.taskID, $0) })
        let entries: [(PetTaskCollection.Card?, BubbleContent)] = message.map { [(nil, $0)] } ?? cards.map {
            ($0, BubbleRules.content(result: $0.result, lastSyncAt: sync, strings: strings, language: language))
        }
        let next = entries.map { entry -> PetCardRow in
            let id = entry.0?.taskID
            let row = existing[id] ?? PetCardRow(taskID: id)
            row.bubble.update(entry.1)
            if let card = entry.0 {
                row.configure(card: card, pinned: pinned, strings: strings,
                    open: { [weak self] in self?.onOpen?($0) },
                    pin: { [weak self] id in guard let self else { return }; self.onPin?(self.pinned == id ? nil : id) },
                    dismiss: { [weak self] in self?.onDismiss?($0) })
            }
            if row.superview == nil { cardSurface.addSubview(row) }
            return row
        }
        for row in rows where !next.contains(where: { $0 === row }) { row.removeFromSuperview() }
        rows = next
        // Front card stays above the rear cards in both layouts.
        for row in rows.reversed() { cardSurface.addSubview(row, positioned: .above, relativeTo: nil) }
        updateToggle()
        cardsNeedLayout = true
        needsLayout = true
    }

    private func updateToggle() {
        let active = cards.filter { $0.result.summary.map { !$0.archived && !$0.lifecycle.isTerminal } ?? false }.count
        let blocked = cards.filter { $0.result.summary?.lifecycle == .blocked }.count
        toggle.title = "\(active) \(strings.petTasks) · \(blocked) \(strings.petBlocked)" + (cards.count > 3 && !isExpanded ? " · +\(cards.count - 3)" : "") + (isExpanded ? " ▴" : " ▾")
        toggle.isHidden = isHidden || (cards.count < 2 && !isExpanded)
    }

    private var footer: CGFloat { cards.count < 2 && !isExpanded ? 0 : 24 }
    private var documentHeight: CGFloat {
        if isExpanded { return 12 + rows.reduce(0) { $0 + $1.requiredHeight + 8 } }
        return 54 + CGFloat(max(0, min(rows.count, 3) - 1)) * 8
    }
    func requiredHeight(width: CGFloat) -> CGFloat { isHidden ? 0 : min(maximumHeight, documentHeight + footer) }

    private func arrangeCards(animated: Bool) {
        cardsNeedLayout = false
        var top: CGFloat = 6
        for (index, row) in rows.enumerated() {
            let visible = isExpanded || index < 3
            row.isHidden = false
            let width = Self.bubbleWidth - 24 - (isExpanded ? 0 : CGFloat(min(index, 2)) * 8)
            let height = isExpanded ? row.requiredHeight : 42
            let y = isExpanded ? top : 6 + CGFloat(max(0, min(rows.count, 3) - 1) - min(index, 2)) * 8
            let target = NSRect(x: 12 + (isExpanded ? 0 : CGFloat(min(index, 2)) * 4), y: y, width: width, height: height)
            if row.frame == .zero { row.frame = target }
            let proxy = animated ? row.animator() : row
            proxy.frame = target
            proxy.alphaValue = visible ? 1 : 0
            row.arrange(expanded: isExpanded, showsText: isExpanded || index == 0, width: width, animated: animated)
            top += height + 8
        }
    }

    override func layout() {
        super.layout()
        let toggleWidth = min(bounds.width - 24, toggle.intrinsicContentSize.width + 16)
        toggle.frame = NSRect(x: (bounds.width - toggleWidth) / 2, y: 0, width: toggleWidth, height: footer)
        scroll.frame = NSRect(x: 0, y: footer, width: bounds.width, height: max(0, bounds.height - footer))
        document.frame.size = NSSize(width: bounds.width, height: documentHeight)
        materialGroup.frame = document.bounds
        cardSurface.frame = materialGroup.bounds
        if cardsNeedLayout { arrangeCards(animated: false); finishTransition() }
    }
}

@MainActor
private final class PetCardDocument: NSView {
    override var isFlipped: Bool { true }
}

/// A task's persistent content and controls; the stack owns its target geometry.
@MainActor
private final class PetCardRow: NSView {
    let taskID: String?
    let bubble = PetBubbleView(frame: .zero)
    private var openButton: CardOpenButton?
    private var pinButton: CardButton?
    private var dismissButton: CardButton?

    init(taskID: String?) {
        self.taskID = taskID
        super.init(frame: .zero)
        addSubview(bubble)
    }
    required init?(coder: NSCoder) { fatalError("Created in code") }

    func configure(card: PetTaskCollection.Card, pinned: String?, strings: PetStrings,
                   open: @escaping (String) -> Void, pin: @escaping (String) -> Void,
                   dismiss: @escaping (String) -> Void) {
        if openButton == nil {
            let button = CardOpenButton(id: card.taskID, handler: open)
            bubble.addInteraction(button)
            openButton = button
            let pin = CardButton(id: card.taskID, title: strings.petPin, handler: pin)
            addSubview(pin); pinButton = pin
        }
        openButton?.setAccessibilityLabel(bubble.content.title)
        pinButton?.title = pinned == card.taskID ? strings.petAuto : strings.petPin
        if card.unread && dismissButton == nil {
            let button = CardButton(id: card.taskID, title: strings.dismiss, handler: dismiss)
            addSubview(button); dismissButton = button
        } else if !card.unread {
            dismissButton?.removeFromSuperview(); dismissButton = nil
        }
    }

    private var actionHeight: CGFloat { pinButton.map { max(24, $0.intrinsicContentSize.height) } ?? 0 }
    var requiredHeight: CGFloat {
        bubble.requiredHeight(width: PetBubbleStackView.bubbleWidth - 24, expanded: true) + (actionHeight > 0 ? actionHeight + 4 : 0)
    }

    func arrange(expanded: Bool, showsText: Bool, width: CGFloat, animated: Bool) {
        let controlsHeight = expanded && actionHeight > 0 ? actionHeight + 4 : 0
        let height = expanded ? bubble.requiredHeight(width: width, expanded: true) : 42
        let proxy = animated ? bubble.animator() : bubble
        proxy.frame = NSRect(x: 0, y: controlsHeight, width: width, height: height)
        bubble.setExpanded(expanded, animated: animated, showsText: showsText)
        for button in [pinButton, dismissButton].compactMap({ $0 }) {
            button.isHidden = !expanded
            button.isEnabled = expanded
        }
        let dismissWidth = dismissButton.map { min(width / 2, $0.intrinsicContentSize.width) } ?? 0
        dismissButton?.frame = NSRect(x: width - dismissWidth - 4, y: 0, width: dismissWidth, height: actionHeight)
        if let pinButton {
            pinButton.frame = NSRect(x: 4, y: 0, width: min(width - dismissWidth - 16, pinButton.intrinsicContentSize.width), height: actionHeight)
        }
    }
}

@MainActor
private final class CardButton: NSButton {
    private let id: String
    private let handler: (String) -> Void
    init(id: String, title: String, handler: @escaping (String) -> Void) {
        self.id = id; self.handler = handler
        super.init(frame: .zero)
        self.title = title
        if #available(macOS 26.0, *) {
            bezelStyle = .glass
            borderShape = .capsule
        } else { bezelStyle = .accessoryBarAction }
        controlSize = .small
        font = .systemFont(ofSize: NSFont.smallSystemFontSize)
        target = self; action = #selector(activate)
    }
    required init?(coder: NSCoder) { fatalError("Created in code") }
    @objc private func activate() { handler(id) }
    override func acceptsFirstMouse(for event: NSEvent?) -> Bool { true }
}

/// An accessible hit region; the surrounding card supplies its native glass.
@MainActor
private final class CardOpenButton: NSView {
    private let id: String
    private let handler: (String) -> Void
    init(id: String, handler: @escaping (String) -> Void) {
        self.id = id; self.handler = handler
        super.init(frame: .zero)
        setAccessibilityElement(true)
        setAccessibilityRole(.button)
    }
    required init?(coder: NSCoder) { fatalError("Created in code") }
    override func accessibilityPerformPress() -> Bool { handler(id); return true }
    override func mouseDown(with event: NSEvent) {
        var ancestor = superview
        while ancestor != nil && !(ancestor is PetContentView) { ancestor = ancestor?.superview }
        guard let content = ancestor as? PetContentView else { handler(id); return }
        let id = self.id, handler = self.handler
        content.beginCardPress(with: event) { handler(id) }
        while let next = NSApp.nextEvent(matching: [.leftMouseDragged, .leftMouseUp], until: .distantFuture, inMode: .eventTracking, dequeue: true) {
            if next.type == .leftMouseUp { content.mouseUp(with: next); return }
            content.mouseDragged(with: next)
        }
    }
    override func acceptsFirstMouse(for event: NSEvent?) -> Bool { true }
}
