import AppKit
import Foundation

/// The bubble text derived from one observation.
///
/// Line one is the Task short name, line two the current stage or the connection
/// result. The expanded area adds the wrapped request summary, the two distinct
/// timestamps, and the blocker reason Core already provides.
struct BubbleContent: Equatable {
    let title: String
    /// `nil` hides the second resident line.
    let stage: String?
    let summary: String?
    let taskUpdated: String?
    let lastSync: String?
    let blocker: String?

    var hasExpandedContent: Bool {
        summary != nil || taskUpdated != nil || lastSync != nil || blocker != nil
    }
}

/// Pure text decisions for the bubble, kept separate from the view so the
/// targeted tests cover every display phase without a window.
enum BubbleRules {
    /// Builds the bubble text for one presentation result.
    ///
    /// Core owns lifecycle, blocker, and terminal classification; these rules
    /// only choose which already-delivered text appears on which line. The
    /// disconnected view keeps the last record and marks it, so a stored node is
    /// never presented as live progress.
    static func content(
        result: PresentationRules.Result,
        lastSyncAt: Date?,
        strings: PetStrings,
        language: PetLanguage
    ) -> BubbleContent {
        let summary = result.summary
        let taskUpdated = summary.map {
            "\(strings.taskUpdatedPrefix) \(PetTimeFormatter.format($0.updatedAt, language: language))"
        }
        let lastSync = lastSyncAt.map {
            "\(strings.lastSyncPrefix) \(PetTimeFormatter.format($0, language: language))"
        }

        switch result.phase {
        case .disconnected:
            let stage = summary == nil
                ? strings.disconnected
                : "\(strings.disconnected) · \(strings.lastRecordMark)"
            return BubbleContent(
                title: summary?.requestSummary ?? strings.chooseTask,
                stage: stage,
                summary: summary?.requestSummary,
                taskUpdated: taskUpdated,
                lastSync: lastSync,
                blocker: strings.disconnectedDetail
            )
        case .noSelection:
            return BubbleContent(
                title: strings.chooseTask,
                stage: nil,
                summary: nil,
                taskUpdated: nil,
                lastSync: lastSync,
                blocker: nil
            )
        case .taskMissing:
            return BubbleContent(
                title: strings.chooseTask,
                stage: strings.taskUnavailable,
                summary: nil,
                taskUpdated: nil,
                lastSync: lastSync,
                blocker: nil
            )
        case .archived:
            return BubbleContent(
                title: summary?.requestSummary ?? strings.chooseTask,
                stage: marked(strings.archived, result: result, strings: strings),
                summary: summary?.requestSummary,
                taskUpdated: taskUpdated,
                lastSync: lastSync,
                blocker: nil
            )
        case .cancelled:
            return BubbleContent(
                title: summary?.requestSummary ?? strings.chooseTask,
                stage: marked(strings.cancelled, result: result, strings: strings),
                summary: summary?.requestSummary,
                taskUpdated: taskUpdated,
                lastSync: lastSync,
                blocker: nil
            )
        case .completed:
            return BubbleContent(
                title: summary?.requestSummary ?? strings.chooseTask,
                stage: marked(strings.completed, result: result, strings: strings),
                summary: summary?.requestSummary,
                taskUpdated: taskUpdated,
                lastSync: lastSync,
                blocker: nil
            )
        case .working(let node):
            return BubbleContent(
                title: summary?.requestSummary ?? strings.chooseTask,
                stage: marked(strings.nodeName(node), result: result, strings: strings),
                summary: summary?.requestSummary,
                taskUpdated: taskUpdated,
                lastSync: lastSync,
                blocker: nil
            )
        case .blocked(let node):
            // The resident line identifies blocked work while retaining its Core node.
            return BubbleContent(
                title: summary?.requestSummary ?? strings.chooseTask,
                stage: marked(node == "BLOCKED" ? strings.nodeName(node) : "\(strings.petBlockedStatus) · \(strings.nodeName(node))", result: result, strings: strings),
                summary: summary?.requestSummary,
                taskUpdated: taskUpdated,
                lastSync: lastSync,
                blocker: summary?.blocker ?? strings.blockedFallback
            )
        }
    }

    /// Appends the short read-only mark. Read-only is an additional flag, so it
    /// never replaces the stage the Task is actually in.
    private static func marked(_ stage: String, result: PresentationRules.Result, strings: PetStrings) -> String {
        result.detailReadiness == .readOnly ? "\(stage) · \(strings.readOnlyHint)" : stage
    }
}

/// The bubble above the character. Collapsed it shows the two resident lines;
/// hovering expands the detail area while keeping the character in place.
@MainActor
final class PetBubbleView: NSView {
    static let bubbleWidth: CGFloat = 232
    static let characterSpacing: CGFloat = 8

    private let container: NSView
    private let surface = NSView()
    private var interactionView: NSView?
    private let symbol = NSImageView()
    private let navigationHint = NSImageView()
    private let titleLabel = PetBubbleView.makeLabel(size: 12, weight: .medium, lines: 1)
    private let stageLabel = PetBubbleView.makeLabel(size: 10, weight: .regular, lines: 1)
    private let summaryLabel = PetBubbleView.makeLabel(size: 12, weight: .regular, lines: 4)
    private let taskUpdatedLabel = PetBubbleView.makeLabel(size: 10, weight: .regular, lines: 1)
    private let lastSyncLabel = PetBubbleView.makeLabel(size: 10, weight: .regular, lines: 1)
    private let blockerLabel = PetBubbleView.makeLabel(size: 12, weight: .regular, lines: 3)

    private(set) var content = BubbleContent(title: "", stage: nil, summary: nil, taskUpdated: nil, lastSync: nil, blocker: nil)
    private(set) var isExpanded = false
    private var showsText = true

    override init(frame frameRect: NSRect) {
        if #available(macOS 26.0, *) {
            let glass = NSGlassEffectView()
            glass.style = .regular
            glass.tintColor = nil
            glass.cornerRadius = 21
            glass.contentView = surface
            if #available(macOS 27.0, *) { glass.effectIsInteractive = true }
            container = glass
        } else {
            let background = NSVisualEffectView()
            background.material = .popover
            background.state = .active
            background.wantsLayer = true
            background.layer?.cornerRadius = 20
            background.layer?.masksToBounds = true
            background.addSubview(surface)
            container = background
        }
        super.init(frame: frameRect)
        addSubview(container)
        symbol.image = NSImage(systemSymbolName: "sparkle", accessibilityDescription: nil)
        symbol.contentTintColor = .controlAccentColor
        navigationHint.image = NSImage(systemSymbolName: "arrow.up.right", accessibilityDescription: nil)
        navigationHint.contentTintColor = .tertiaryLabelColor
        surface.addSubview(symbol)
        surface.addSubview(navigationHint)
        stageLabel.textColor = .secondaryLabelColor
        for label in [titleLabel, stageLabel] + detailLabels {
            surface.addSubview(label)
        }
        for label in detailLabels { label.textColor = .secondaryLabelColor }
        blockerLabel.textColor = .systemOrange
        update(content)
    }

    required init?(coder: NSCoder) {
        fatalError("PetBubbleView is created in code")
    }

    private var detailLabels: [NSTextField] {
        [summaryLabel, taskUpdatedLabel, lastSyncLabel, blockerLabel]
    }

    func update(_ next: BubbleContent) {
        content = next
        symbol.isHidden = next.title.isEmpty
        navigationHint.isHidden = next.title.isEmpty
        titleLabel.stringValue = next.title
        stageLabel.stringValue = next.stage ?? ""
        summaryLabel.stringValue = next.summary ?? ""
        taskUpdatedLabel.stringValue = next.taskUpdated ?? ""
        lastSyncLabel.stringValue = next.lastSync ?? ""
        blockerLabel.stringValue = next.blocker ?? ""
        updateVisibility()
    }

    func setExpanded(_ expanded: Bool, animated: Bool = false, showsText: Bool = true) {
        isExpanded = expanded
        self.showsText = showsText
        titleLabel.maximumNumberOfLines = expanded ? 4 : 1
        titleLabel.lineBreakMode = expanded ? .byWordWrapping : .byTruncatingTail
        updateVisibility(animated: animated)
    }

    private func updateVisibility(animated: Bool = false) {
        for view in [symbol, navigationHint, titleLabel, stageLabel] as [NSView] {
            (animated ? view.animator() : view).alphaValue = showsText ? 1 : 0
        }
        stageLabel.isHidden = stageLabel.stringValue.isEmpty
        for label in detailLabels {
            label.isHidden = label.stringValue.isEmpty || (label === summaryLabel && content.summary == content.title)
            (animated ? label.animator() : label).alphaValue = isExpanded && showsText ? 1 : 0
        }
        needsLayout = true
    }

    func addInteraction(_ view: NSView) {
        interactionView?.removeFromSuperview()
        interactionView = view
        surface.addSubview(view)
    }

    /// Measurement reads the target layout, independently of in-flight view geometry.
    private func visibleRows(expanded: Bool) -> [(NSTextField, CGFloat)] {
        var rows: [(NSTextField, CGFloat)] = [(titleLabel, 0)]
        if !stageLabel.stringValue.isEmpty { rows.append((stageLabel, 1)) }
        if expanded {
            var firstDetail = true
            for label in detailLabels where !label.stringValue.isEmpty {
                if label === summaryLabel && content.summary == content.title { continue }
                rows.append((label, firstDetail ? 6 : 3))
                firstDetail = false
            }
        }
        return rows
    }

    func requiredHeight(width: CGFloat, expanded: Bool? = nil) -> CGFloat {
        let expanded = expanded ?? isExpanded
        return max(42, 12 + visibleRows(expanded: expanded).reduce(0) {
            $0 + $1.1 + textHeight($1.0, width: max(width - 58, 40), titleLines: expanded ? 4 : 1)
        })
    }

    override func layout() {
        super.layout()
        container.frame = bounds
        surface.frame = bounds
        interactionView?.frame = bounds
        let width = max(bounds.width - 58, 40)
        symbol.frame = NSRect(x: 13, y: bounds.height - 29, width: 14, height: 14)
        navigationHint.frame = NSRect(x: bounds.width - 22, y: bounds.height - 27, width: 9, height: 9)
        var top = bounds.height - 6
        for (label, spacing) in visibleRows(expanded: isExpanded) {
            let height = textHeight(label, width: width)
            top -= spacing + height
            label.frame = NSRect(x: 36, y: top, width: width, height: height)
        }
    }

    private func textHeight(_ label: NSTextField, width: CGFloat, titleLines: Int? = nil) -> CGFloat {
        let font = label.font ?? NSFont.systemFont(ofSize: 12)
        let lineHeight = ceil(font.ascender - font.descender + font.leading)
        let text = NSAttributedString(string: label.stringValue, attributes: [.font: font])
        let measured = text.boundingRect(
            with: NSSize(width: width, height: .greatestFiniteMagnitude),
            options: [.usesLineFragmentOrigin, .usesFontLeading]
        ).height
        let lines = label === titleLabel ? (titleLines ?? label.maximumNumberOfLines) : label.maximumNumberOfLines
        return min(max(ceil(measured), lineHeight), lineHeight * CGFloat(max(lines, 1)))
    }

    private static func makeLabel(size: CGFloat, weight: NSFont.Weight, lines: Int) -> NSTextField {
        let label = NSTextField(labelWithString: "")
        label.font = NSFont.systemFont(ofSize: size, weight: weight)
        label.textColor = .labelColor
        label.lineBreakMode = lines == 1 ? .byTruncatingTail : .byWordWrapping
        label.maximumNumberOfLines = lines
        label.cell?.wraps = lines != 1
        label.cell?.isScrollable = false
        return label
    }
}
