import AppKit

/// Arranges independent task cards above the character and reports explicit card actions.
@MainActor
final class PetBubbleStackView: NSView {
    static let bubbleWidth: CGFloat = 284
    static let characterSpacing: CGFloat = 8
    var onOpen: ((String) -> Void)?
    var onPin: ((String?) -> Void)?
    var onDismiss: ((String) -> Void)?
    var onResize: (() -> Void)?
    private let scroll = NSScrollView()
    private let document = NSView()
    private lazy var toggle = CardButton(id: "toggle", title: "", handler: { [weak self] _ in self?.expand() })
    private var rows: [NSView] = []
    private var cards: [PetTaskCollection.Card] = []
    private var pinned: String?
    private var strings = PetStrings.english
    private var language = PetLanguage.resolve()
    private var sync: Date?
    private var fallback = BubbleContent(title: "", stage: nil, summary: nil, taskUpdated: nil, lastSync: nil, blocker: nil)
    private(set) var isExpanded = false
    private var scrollToTop = false
    var maximumHeight: CGFloat = 400

    override init(frame: NSRect) {
        super.init(frame: frame)
        scroll.drawsBackground = false
        scroll.hasVerticalScroller = true
        scroll.documentView = document
        addSubview(scroll)
        addSubview(toggle)
        toggle.bezelStyle = .inline
        toggle.target = self
        toggle.action = #selector(expand)
    }
    required init?(coder: NSCoder) { fatalError("Created in code") }

    func update(_ content: BubbleContent) { fallback = content; cards = []; rebuild() }
    func update(cards: [PetTaskCollection.Card], pinned: String?, fallback: BubbleContent,
                sync: Date?, strings: PetStrings, language: PetLanguage) {
        self.cards = cards; self.pinned = pinned; self.fallback = fallback
        self.sync = sync; self.strings = strings; self.language = language
        rebuild()
    }
    func setExpanded(_ value: Bool) {
        guard value != isExpanded else { return }
        isExpanded = value; scrollToTop = value; rebuild()
    }
    @objc private func expand() { setExpanded(!isExpanded); onResize?() }

    private func rebuild() {
        rows.forEach { $0.removeFromSuperview() }; rows = []
        let visible = isExpanded ? cards : Array(cards.prefix(3))
        let entries: [(PetTaskCollection.Card?, BubbleContent)] = cards.isEmpty ? [(nil, fallback)] : visible.map {
            ($0, BubbleRules.content(result: $0.result, lastSyncAt: sync, strings: strings, language: language))
        }
        for (index, entry) in entries.enumerated() {
            let row = NSView()
            let bubble = PetBubbleView(frame: .zero)
            bubble.update(entry.1)
            bubble.setExpanded(isExpanded)
            row.addSubview(bubble)
            let height = isExpanded || index == 0 ? bubble.requiredHeight(width: Self.bubbleWidth - 12) : 48
            bubble.frame = NSRect(x: 0, y: isExpanded ? 28 : 0, width: Self.bubbleWidth - 12, height: height)
            row.frame.size = CGSize(width: Self.bubbleWidth - 12, height: height + (isExpanded ? 28 : 0))
            if let card = entry.0 {
                let open = CardButton(id: card.taskID, title: "", handler: { [weak self] in self?.onOpen?($0) })
                open.isBordered = false
                open.frame = bubble.frame
                open.setAccessibilityLabel(entry.1.title)
                row.addSubview(open)
                if isExpanded {
                    let pin = CardButton(id: card.taskID, title: pinned == card.taskID ? strings.petAuto : strings.petPin,
                        handler: { [weak self] id in guard let self else { return }; self.onPin?(self.pinned == id ? nil : id) })
                    pin.frame = NSRect(x: 4, y: 0, width: 130, height: 26)
                    row.addSubview(pin)
                    if card.unread {
                        let dismiss = CardButton(id: card.taskID, title: strings.dismiss, handler: { [weak self] in self?.onDismiss?($0) })
                        dismiss.frame = NSRect(x: 144, y: 0, width: 116, height: 26)
                        row.addSubview(dismiss)
                    }
                }
            }
            document.addSubview(row); rows.append(row)
        }
        let active = cards.filter { $0.result.summary.map { !$0.archived && !$0.lifecycle.isTerminal } ?? false }.count
        let blocked = cards.filter { $0.result.summary?.lifecycle == .blocked }.count
        toggle.title = "\(active) \(strings.petTasks) · \(blocked) \(strings.petBlocked)" + (cards.count > 3 && !isExpanded ? " · +\(cards.count - 3)" : "") + (isExpanded ? " ▴" : " ▾")
        toggle.isHidden = cards.isEmpty
        needsLayout = true
    }
    private var documentHeight: CGFloat {
        if isExpanded { return rows.reduce(0) { $0 + $1.frame.height + 8 } }
        return (rows.first?.frame.height ?? 0) + CGFloat(max(0, rows.count - 1)) * 38
    }
    func requiredHeight(width: CGFloat) -> CGFloat { min(maximumHeight, documentHeight + (cards.isEmpty ? 0 : 28)) }
    override func layout() {
        super.layout()
        let footer: CGFloat = cards.isEmpty ? 0 : 28
        toggle.frame = NSRect(x: 0, y: 0, width: bounds.width, height: footer)
        scroll.frame = NSRect(x: 0, y: footer, width: bounds.width, height: max(0, bounds.height - footer))
        document.frame = NSRect(x: 0, y: 0, width: bounds.width, height: documentHeight)
        var top = documentHeight
        for (index, row) in rows.enumerated() {
            let height = row.frame.height
            let y = isExpanded ? top - height : (index == 0 ? 0 : (rows.first?.frame.height ?? 0) - 10 + CGFloat(index - 1) * 38)
            row.frame.origin = CGPoint(x: isExpanded ? 0 : CGFloat(index) * 4, y: y)
            top -= height + 8
        }
        if !isExpanded, let first = rows.first { document.addSubview(first, positioned: .above, relativeTo: nil) }
        if scrollToTop {
            scroll.contentView.scroll(to: CGPoint(x: 0, y: max(0, documentHeight - scroll.contentView.bounds.height)))
            scroll.reflectScrolledClipView(scroll.contentView)
            scrollToTop = false
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
        self.title = title; bezelStyle = .inline; target = self; action = #selector(activate)
    }
    required init?(coder: NSCoder) { fatalError("Created in code") }
    @objc private func activate() { handler(id) }
    override func mouseDown(with event: NSEvent) {
        var ancestor = superview
        while ancestor != nil && !(ancestor is PetContentView) { ancestor = ancestor?.superview }
        guard title.isEmpty, let content = ancestor as? PetContentView else { super.mouseDown(with: event); return }
        let id = self.id, handler = self.handler
        content.beginCardPress(with: event) { handler(id) }
        while let next = NSApp.nextEvent(matching: [.leftMouseDragged, .leftMouseUp], until: .distantFuture, inMode: .eventTracking, dequeue: true) {
            if next.type == .leftMouseUp { content.mouseUp(with: next); return }
            content.mouseDragged(with: next)
        }
    }
    override func draw(_ dirtyRect: NSRect) {
        guard !title.isEmpty else { return }
        NSColor.controlBackgroundColor.setFill()
        NSBezierPath(roundedRect: bounds.insetBy(dx: 1, dy: 1), xRadius: 6, yRadius: 6).fill()
        let paragraph = NSMutableParagraphStyle()
        paragraph.alignment = .center
        paragraph.lineBreakMode = .byTruncatingTail
        let text = NSAttributedString(string: title, attributes: [.font: NSFont.systemFont(ofSize: 11),
            .foregroundColor: NSColor.labelColor, .paragraphStyle: paragraph])
        text.draw(in: NSRect(x: 4, y: (bounds.height - 15) / 2, width: bounds.width - 8, height: 15))
    }
    override func acceptsFirstMouse(for event: NSEvent?) -> Bool { true }
}
