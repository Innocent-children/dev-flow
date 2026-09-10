import Foundation

/// Maintains the desktop's observed cards, focus and unread results. Core owns task state.
final class PetTaskCollection {
    struct Card: Equatable {
        let taskID: String
        let result: PresentationRules.Result
        let unread: Bool
    }

    private(set) var pinnedID: String?
    private(set) var focusID: String?
    private(set) var cards: [Card] = []
    private var states: [String: PresentationState] = [:]
    private var unread: [String: DesktopTaskSummary] = [:]
    private var active: [DesktopTaskSummary] = []
    private var holdUntil: Date?
    private var continuous = false
    private let now: () -> Date

    init(now: @escaping () -> Date = Date.init) { self.now = now }

    var observedIDs: Set<String> { Set(active.map(\.taskID)).union(pinnedID.map { [$0] } ?? []) }
    var remainingHold: TimeInterval? { holdUntil.map { max(0, $0.timeIntervalSince(now())) } }
    var focus: PresentationRules.Result {
        if let focusID, let state = states[focusID] { return state.result }
        let state = PresentationState()
        if pinnedID != nil { state.apply(.taskMissing) }
        return state.result
    }

    func pin(_ id: String?) { pinnedID = id; holdUntil = nil; chooseFocus(); rebuild() }

    func acknowledge(_ id: String) {
        unread.removeValue(forKey: id)
        if focusID == id { holdUntil = nil }
        chooseFocus(); rebuild()
    }

    func interrupt() {
        continuous = false
        holdUntil = nil
        states.values.forEach { $0.noteDiscontinuity() }
    }

    func disconnect() {
        interrupt()
        states.values.forEach { $0.apply(.disconnected) }
        rebuild()
    }

    func consumePrompts() { states.values.forEach { $0.consumePrompt() }; rebuild() }

    func update(_ summaries: [DesktopTaskSummary], readiness: Readiness) {
        let previousFocus = focusID
        let oldOrder = Dictionary(uniqueKeysWithValues: active.enumerated().map { ($0.element.taskID, $0.offset) })
        var seen = Set<String>()
        let unique = summaries.filter { seen.insert($0.taskID).inserted }
        for summary in unique {
            let state = states[summary.taskID] ?? PresentationState(now: now)
            let previous = state.result.summary
            let finished = continuous && previous != nil && previous?.lifecycle.isTerminal == false
                && summary.lifecycle == .done && !summary.archived
            state.apply(.task(summary, detailReadiness: readiness))
            states[summary.taskID] = state
            if finished {
                unread[summary.taskID] = summary
                if previousFocus == summary.taskID && pinnedID == nil { holdUntil = now().addingTimeInterval(3) }
            }
            if !summary.lifecycle.isTerminal && !summary.archived { unread.removeValue(forKey: summary.taskID) }
        }
        active = unique.filter { !$0.archived && [.active, .blocked, .unknown].contains($0.lifecycle) }
        active.sort { a, b in
            if priority(a) != priority(b) { return priority(a) < priority(b) }
            if let x = oldOrder[a.taskID], let y = oldOrder[b.taskID] { return x < y }
            if oldOrder[a.taskID] != nil { return true }
            if oldOrder[b.taskID] != nil { return false }
            return newer(a, b)
        }
        if let pinnedID, !seen.contains(pinnedID) {
            let state = PresentationState(now: now)
            state.apply(.taskMissing)
            states[pinnedID] = state
        }
        continuous = true
        chooseFocus()
        rebuild()
        let retained = Set(active.map(\.taskID)).union(unread.keys).union(pinnedID.map { [$0] } ?? [])
        states = states.filter { retained.contains($0.key) }
    }

    private func priority(_ summary: DesktopTaskSummary) -> Int { summary.lifecycle == .blocked ? 0 : 1 }
    private func newer(_ a: DesktopTaskSummary, _ b: DesktopTaskSummary) -> Bool {
        a.updatedAt == b.updatedAt ? a.taskID < b.taskID : a.updatedAt > b.updatedAt
    }
    private func chooseFocus() {
        if let pinnedID { focusID = pinnedID; return }
        if let deadline = holdUntil, deadline > now(), let focusID, unread[focusID] != nil { return }
        holdUntil = nil
        let candidates = active.sorted { a, b in priority(a) == priority(b) ? newer(a, b) : priority(a) < priority(b) }
        if let current = active.first(where: { $0.taskID == focusID }),
           let first = candidates.first, priority(current) == priority(first) { return }
        focusID = candidates.first?.taskID
    }
    private func rebuild() {
        var ids: [String] = []
        if let focusID, states[focusID] != nil { ids.append(focusID) }
        ids += active.map(\.taskID).filter { !ids.contains($0) }
        ids += unread.values.sorted(by: newer).map(\.taskID).filter { !ids.contains($0) }
        cards = ids.compactMap { id in states[id].map { Card(taskID: id, result: $0.result, unread: unread[id] != nil) } }
    }
}
