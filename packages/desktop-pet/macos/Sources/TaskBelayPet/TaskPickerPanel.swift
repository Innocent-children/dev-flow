import AppKit
import Foundation

/// The text of one row in the Task selection panel.
struct TaskPickerRow: Equatable {
    let taskID: String
    let title: String
    let detail: String
    let isWatching: Bool
}

/// Pure row formatting for the selection panel, kept separate from the table so
/// the targeted tests cover Chinese and English rows without a window.
enum TaskPickerRules {
    /// Builds one row. The stage uses the same node label the WebUI shows for the
    /// same Core node identifier; the origin tool is reported as delivered and
    /// never used to infer which session is in the foreground.
    static func row(
        summary: DesktopTaskSummary,
        strings: PetStrings,
        language: PetLanguage,
        watchingTaskID: String?
    ) -> TaskPickerRow {
        var parts: [String] = ["\(strings.pickerOriginPrefix): \(summary.originHost)"]
        parts.append(strings.nodeName(summary.currentNode))
        if let hint = repositoryHint(summary) { parts.append(hint) }
        return TaskPickerRow(
            taskID: summary.taskID,
            title: summary.requestSummary,
            detail: parts.joined(separator: " · "),
            isWatching: summary.taskID == watchingTaskID
        )
    }

    /// The repository hint: the claim keys, or the last path element of the
    /// worktree when no key was delivered.
    static func repositoryHint(_ summary: DesktopTaskSummary) -> String? {
        if !summary.repositoryKeys.isEmpty {
            return summary.repositoryKeys.joined(separator: ", ")
        }
        guard !summary.worktreePath.isEmpty else { return nil }
        return (summary.worktreePath as NSString).lastPathComponent
    }
}

/// The Task selection panel.
///
/// The panel reads `GET /api/tasks?page=...` only while it is open and loads the
/// next page only when `has_next` says one exists. It never walks every Task in
/// the background. It receives keyboard input only after the user opens it, and
/// confirming closes the panel so the desktop reads the new Task immediately.
@MainActor
final class TaskPickerPanel: NSPanel {
    /// The list generation the panel was opened with; a late response from an
    /// earlier session is dropped.
    let session: Int

    var onLoadPage: ((Int) async -> ListLoadResult)?
    var onChoose: ((String) -> Void)?
    var onDismiss: (() -> Void)?

    private let table = TaskPickerTableView()
    private let scrollView = NSScrollView()
    private let emptyLabel = NSTextField(labelWithString: "")
    private var strings: PetStrings = .english
    private var watchingTaskID: String?

    private var rows: [TaskPickerRow] = []
    private var nextPage = 2
    private var hasNext = false
    private var isLoading = false
    private var loadFailure: String?
    private var pageLoad: Task<Void, Never>?
    private var dismissed = false

    init(session: Int, size: NSSize = NSSize(width: 400, height: 440)) {
        self.session = session
        super.init(
            contentRect: NSRect(origin: .zero, size: size),
            styleMask: [.titled, .closable, .resizable, .utilityWindow],
            backing: .buffered,
            defer: false
        )
        isReleasedWhenClosed = false
        becomesKeyOnlyIfNeeded = false
        level = .floating
        isFloatingPanel = true
        minSize = NSSize(width: 320, height: 240)

        table.headerView = nil
        table.rowHeight = 44
        table.style = .inset
        table.dataSource = self
        table.delegate = self
        table.doubleAction = #selector(confirmSelection)
        table.target = self
        table.onReturnKey = { [weak self] in self?.confirmSelection() }
        let column = NSTableColumn(identifier: NSUserInterfaceItemIdentifier("Task"))
        column.width = size.width
        column.resizingMask = .autoresizingMask
        table.addTableColumn(column)
        table.columnAutoresizingStyle = .uniformColumnAutoresizingStyle

        scrollView.documentView = table
        scrollView.hasVerticalScroller = true
        scrollView.translatesAutoresizingMaskIntoConstraints = false

        let container = NSView()
        container.addSubview(scrollView)
        container.addSubview(emptyLabel)
        emptyLabel.translatesAutoresizingMaskIntoConstraints = false
        emptyLabel.alignment = .center
        emptyLabel.textColor = NSColor.secondaryLabelColor
        emptyLabel.isHidden = true
        contentView = container

        NSLayoutConstraint.activate([
            scrollView.topAnchor.constraint(equalTo: container.topAnchor),
            scrollView.leadingAnchor.constraint(equalTo: container.leadingAnchor),
            scrollView.trailingAnchor.constraint(equalTo: container.trailingAnchor),
            scrollView.bottomAnchor.constraint(equalTo: container.bottomAnchor),
            emptyLabel.centerXAnchor.constraint(equalTo: container.centerXAnchor),
            emptyLabel.centerYAnchor.constraint(equalTo: container.centerYAnchor),
        ])
    }

    /// Prepares the panel for one opening. Language is read at runtime and never
    /// stored, so the panel is retitled for the current system preference.
    func configure(strings: PetStrings, watchingTaskID: String?) {
        self.strings = strings
        self.watchingTaskID = watchingTaskID
        title = strings.pickerTitle
        emptyLabel.stringValue = strings.pickerEmpty
    }

    /// Reads the first page. Called once per opening.
    func loadFirstPage() {
        rows = []
        nextPage = 2
        hasNext = false
        loadFailure = nil
        pageLoad = Task { await load(page: 1, append: false) }
    }

    /// Dismisses without choosing.
    func dismiss() {
        guard !dismissed else { return }
        dismissed = true
        pageLoad?.cancel()
        orderOut(nil)
        onDismiss?()
    }

    override func close() {
        dismiss()
        super.close()
    }

    @objc private func confirmSelection() {
        let index = table.selectedRow >= 0 ? table.selectedRow : 0
        if index == rows.count, footerKind == .loadMore {
            pageLoad = Task { await load(page: nextPage, append: true) }
            return
        }
        guard index < rows.count else { return }
        let chosen = rows[index]
        dismissed = true
        pageLoad?.cancel()
        orderOut(nil)
        onChoose?(chosen.taskID)
    }

    private func load(page: Int, append: Bool) async {
        guard !isLoading else { return }
        isLoading = true
        refreshFooter(selectWatching: false)
        let result = await onLoadPage?(page) ?? .notConnected
        isLoading = false
        guard !dismissed, !Task.isCancelled else { return }
        switch result {
        case .value(let list):
            if !append { rows = [] }
            let language = PetLanguage.resolve()
            rows.append(contentsOf: list.items.map {
                TaskPickerRules.row(summary: $0, strings: strings, language: language, watchingTaskID: watchingTaskID)
            })
            hasNext = list.hasNext
            nextPage = list.page + 1
            loadFailure = nil
        case .stale:
            return
        case .failure, .notConnected:
            loadFailure = strings.pickerUnavailable
            hasNext = false
        }
        refreshFooter(selectWatching: !append)
    }

    /// The footer occupies the last table row while another page exists, a load
    /// is running, or a load failed.
    private var footerKind: FooterKind {
        if isLoading { return .loading }
        if loadFailure != nil { return .failure }
        if hasNext { return .loadMore }
        return .none
    }

    private enum FooterKind { case none, loading, loadMore, failure }

    private var footerText: String? {
        switch footerKind {
        case .none: return nil
        case .loading: return strings.pickerLoading
        case .loadMore: return strings.pickerLoadMore
        case .failure: return loadFailure
        }
    }

    private func refreshFooter(selectWatching: Bool) {
        emptyLabel.isHidden = !(rows.isEmpty && footerText == nil)
        table.reloadData()
        guard selectWatching else { return }
        let watchingIndex = rows.firstIndex(where: \.isWatching) ?? (rows.isEmpty ? -1 : 0)
        if watchingIndex >= 0 {
            table.selectRowIndexes(IndexSet(integer: watchingIndex), byExtendingSelection: false)
        }
    }
}

/// A table view that treats Return as a confirmation. The panel is the only
/// place the desktop component accepts keyboard input.
final class TaskPickerTableView: NSTableView {
    var onReturnKey: (() -> Void)?

    override func keyDown(with event: NSEvent) {
        guard event.charactersIgnoringModifiers == "\r" || event.charactersIgnoringModifiers == "\n" else {
            super.keyDown(with: event)
            return
        }
        onReturnKey?()
    }
}

extension TaskPickerPanel: NSTableViewDataSource {
    nonisolated func numberOfRows(in tableView: NSTableView) -> Int {
        MainActor.assumeIsolated { rows.count + (footerText == nil ? 0 : 1) }
    }
}

extension TaskPickerPanel: NSTableViewDelegate {
    func tableView(_ tableView: NSTableView, viewFor tableColumn: NSTableColumn?, row: Int) -> NSView? {
        guard row < rows.count else { return footerView() }
        let identifier = NSUserInterfaceItemIdentifier("TaskPickerRow")
        let view = tableView.makeView(withIdentifier: identifier, owner: nil) as? TaskPickerRowView
            ?? TaskPickerRowView(identifier: identifier)
        view.apply(rows[row], watchingMark: strings.pickerSelectedMark)
        return view
    }

    func tableView(_ tableView: NSTableView, heightOfRow row: Int) -> CGFloat {
        row < rows.count ? 44 : 28
    }

    func tableView(_ tableView: NSTableView, shouldSelectRow row: Int) -> Bool {
        row < rows.count || footerKind == .loadMore
    }

    private func footerView() -> NSView {
        let identifier = NSUserInterfaceItemIdentifier("TaskPickerFooter")
        let view = tableViewFooter(identifier: identifier)
        view.title = footerText ?? ""
        view.isEnabled = footerKind == .loadMore
        view.onActivate = { [weak self] in
            guard let self, self.footerKind == .loadMore else { return }
            let page = self.nextPage
            self.pageLoad = Task { await self.load(page: page, append: true) }
        }
        return view
    }

    private func tableViewFooter(identifier: NSUserInterfaceItemIdentifier) -> TaskPickerFooterView {
        let reused = table.makeView(withIdentifier: identifier, owner: nil) as? TaskPickerFooterView
        return reused ?? TaskPickerFooterView(identifier: identifier)
    }
}

/// One selectable Task row: the request summary on the first line and the origin
/// tool, stage, and repository hint on the second.
final class TaskPickerRowView: NSTableRowView {
    private let titleLabel = NSTextField(labelWithString: "")
    private let detailLabel = NSTextField(labelWithString: "")
    private let watchingLabel = NSTextField(labelWithString: "")

    init(identifier: NSUserInterfaceItemIdentifier) {
        super.init(frame: .zero)
        self.identifier = identifier
        for label in [titleLabel, detailLabel, watchingLabel] {
            label.translatesAutoresizingMaskIntoConstraints = false
            label.lineBreakMode = .byTruncatingTail
            label.maximumNumberOfLines = 1
            addSubview(label)
        }
        titleLabel.font = NSFont.systemFont(ofSize: 13, weight: .medium)
        detailLabel.font = NSFont.systemFont(ofSize: 11)
        detailLabel.textColor = NSColor.secondaryLabelColor
        watchingLabel.font = NSFont.systemFont(ofSize: 10, weight: .semibold)
        watchingLabel.textColor = NSColor.controlAccentColor
        NSLayoutConstraint.activate([
            titleLabel.topAnchor.constraint(equalTo: topAnchor, constant: 5),
            titleLabel.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 8),
            titleLabel.trailingAnchor.constraint(lessThanOrEqualTo: watchingLabel.leadingAnchor, constant: -6),
            watchingLabel.centerYAnchor.constraint(equalTo: titleLabel.centerYAnchor),
            watchingLabel.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -8),
            detailLabel.topAnchor.constraint(equalTo: titleLabel.bottomAnchor, constant: 2),
            detailLabel.leadingAnchor.constraint(equalTo: titleLabel.leadingAnchor),
            detailLabel.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -8),
        ])
    }

    required init?(coder: NSCoder) {
        fatalError("TaskPickerRowView is created in code")
    }

    func apply(_ row: TaskPickerRow, watchingMark: String) {
        titleLabel.stringValue = row.title
        detailLabel.stringValue = row.detail
        watchingLabel.stringValue = row.isWatching ? watchingMark : ""
        watchingLabel.isHidden = !row.isWatching
    }
}

/// The load-next-page footer row.
final class TaskPickerFooterView: NSTableRowView {
    private let button = NSButton(title: "", target: nil, action: nil)

    var onActivate: (() -> Void)?
    var title: String {
        get { button.title }
        set { button.title = newValue }
    }
    var isEnabled: Bool {
        get { button.isEnabled }
        set { button.isEnabled = newValue }
    }

    init(identifier: NSUserInterfaceItemIdentifier) {
        super.init(frame: .zero)
        self.identifier = identifier
        button.translatesAutoresizingMaskIntoConstraints = false
        button.isBordered = false
        button.font = NSFont.systemFont(ofSize: 12)
        button.target = self
        button.action = #selector(activate)
        addSubview(button)
        NSLayoutConstraint.activate([
            button.centerYAnchor.constraint(equalTo: centerYAnchor),
            button.centerXAnchor.constraint(equalTo: centerXAnchor),
        ])
    }

    required init?(coder: NSCoder) {
        fatalError("TaskPickerFooterView is created in code")
    }

    @objc private func activate() { onActivate?() }
}
