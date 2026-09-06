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
            // `BLOCKED` keeps the node label Core already provides, which reads
            // as a temporary block, and never restates every block as waiting
            // for an approval.
            return BubbleContent(
                title: summary?.requestSummary ?? strings.chooseTask,
                stage: marked(strings.nodeName(node), result: result, strings: strings),
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
    static let bubbleWidth: CGFloat = 220
    static let characterSpacing: CGFloat = 8

    private let container = NSVisualEffectView()
    private let titleLabel = PetBubbleView.makeLabel(size: 13, weight: .semibold, lines: 1)
    private let stageLabel = PetBubbleView.makeLabel(size: 12, weight: .regular, lines: 1)
    private let summaryLabel = PetBubbleView.makeLabel(size: 12, weight: .regular, lines: 4)
    private let taskUpdatedLabel = PetBubbleView.makeLabel(size: 12, weight: .regular, lines: 1)
    private let lastSyncLabel = PetBubbleView.makeLabel(size: 12, weight: .regular, lines: 1)
    private let blockerLabel = PetBubbleView.makeLabel(size: 12, weight: .regular, lines: 3)

    private(set) var content = BubbleContent(title: "", stage: nil, summary: nil, taskUpdated: nil, lastSync: nil, blocker: nil)
    private(set) var isExpanded = false

    override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        container.material = .hudWindow
        container.state = .active
        container.blendingMode = .behindWindow
        container.wantsLayer = true
        container.layer?.cornerRadius = 10
        container.layer?.masksToBounds = true
        addSubview(container)
        for label in [titleLabel, stageLabel] + detailLabels {
            container.addSubview(label)
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
        titleLabel.stringValue = next.title
        stageLabel.stringValue = next.stage ?? ""
        summaryLabel.stringValue = next.summary ?? ""
        taskUpdatedLabel.stringValue = next.taskUpdated ?? ""
        lastSyncLabel.stringValue = next.lastSync ?? ""
        blockerLabel.stringValue = next.blocker ?? ""
        updateVisibility()
    }

    func setExpanded(_ expanded: Bool) {
        isExpanded = expanded
        updateVisibility()
    }

    private func updateVisibility() {
        stageLabel.isHidden = stageLabel.stringValue.isEmpty
        for label in detailLabels {
            label.isHidden = !isExpanded || label.stringValue.isEmpty
        }
        needsLayout = true
    }

    /// Measurement and placement share the same visible rows and line limits.
    private var visibleRows: [(NSTextField, CGFloat)] {
        var rows: [(NSTextField, CGFloat)] = [(titleLabel, 0)]
        if !stageLabel.isHidden { rows.append((stageLabel, 1)) }
        var firstDetail = true
        for label in detailLabels where !label.isHidden {
            rows.append((label, firstDetail ? 6 : 3))
            firstDetail = false
        }
        return rows
    }

    func requiredHeight(width: CGFloat) -> CGFloat {
        16 + visibleRows.reduce(0) { $0 + $1.1 + textHeight($1.0, width: max(width - 20, 40)) }
    }

    override func layout() {
        super.layout()
        container.frame = bounds
        let width = max(bounds.width - 20, 40)
        var top = bounds.height - 8
        for (label, spacing) in visibleRows {
            let height = textHeight(label, width: width)
            top -= spacing + height
            label.frame = NSRect(x: 10, y: top, width: width, height: height)
        }
    }

    private func textHeight(_ label: NSTextField, width: CGFloat) -> CGFloat {
        let font = label.font ?? NSFont.systemFont(ofSize: 12)
        let lineHeight = ceil(font.ascender - font.descender + font.leading)
        let text = NSAttributedString(string: label.stringValue, attributes: [.font: font])
        let measured = text.boundingRect(
            with: NSSize(width: width, height: .greatestFiniteMagnitude),
            options: [.usesLineFragmentOrigin, .usesFontLeading]
        ).height
        return min(max(ceil(measured), lineHeight), lineHeight * CGFloat(max(label.maximumNumberOfLines, 1)))
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
