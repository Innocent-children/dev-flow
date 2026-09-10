const { presentation } = require("./observation.cjs");

const active = (s) => s && !s.archived && !["done", "cancelled"].includes(s.lifecycle);
const priority = (s) => s.lifecycle === "blocked" ? 0 : 1;
const newest = (a, b) => (Date.parse(b.updated_at) || 0) - (Date.parse(a.updated_at) || 0) || a.task_id.localeCompare(b.task_id);

// Owns desktop focus and unread cards; task lifecycle comes from Core summaries.
class TaskCollection {
  constructor(now = Date.now) {
    this.now = now;
    this.pinned = null;
    this.focus = null;
    this.states = new Map();
    this.unread = new Map();
    this.active = [];
    this.continuous = false;
    this.holdUntil = 0;
  }
  get observedIDs() { return new Set([...this.active.map(s => s.task_id), ...(this.pinned ? [this.pinned] : [])]); }
  get remainingHold() { return Math.max(0, this.holdUntil - this.now()); }
  pin(id) { this.pinned = id; this.holdUntil = 0; this.choose(); }
  acknowledge(id) { this.unread.delete(id); if (this.focus === id) this.holdUntil = 0; this.choose(); }
  interrupt() { this.continuous = false; this.holdUntil = 0; }
  disconnect() {
    this.interrupt();
    for (const [id, state] of this.states) this.states.set(id, presentation(null, state, false));
  }
  update(summaries, readiness = "ready") {
    const unique = new Map(summaries.map(s => [s.task_id, s]));
    const order = new Map(this.active.map((s, i) => [s.task_id, i]));
    for (const [id, summary] of unique) {
      const previous = this.states.get(id);
      const result = presentation(summary, previous, true, true, this.continuous);
      result.readiness = readiness;
      this.states.set(id, result);
      if (this.continuous && active(previous?.summary) && summary.lifecycle === "done" && !summary.archived) {
        this.unread.set(id, summary);
        if (this.focus === id && !this.pinned) this.holdUntil = this.now() + 3000;
      }
      if (active(summary)) this.unread.delete(id);
    }
    this.active = [...unique.values()].filter(active).sort((a, b) => {
      if (priority(a) !== priority(b)) return priority(a) - priority(b);
      if (order.has(a.task_id) && order.has(b.task_id)) return order.get(a.task_id) - order.get(b.task_id);
      if (order.has(a.task_id)) return -1;
      if (order.has(b.task_id)) return 1;
      return newest(a, b);
    });
    if (this.pinned && !unique.has(this.pinned)) this.states.set(this.pinned, presentation(null, null, true, true));
    this.continuous = true;
    this.choose();
    const retained = new Set([...this.observedIDs, ...this.unread.keys()]);
    for (const id of this.states.keys()) if (!retained.has(id)) this.states.delete(id);
  }
  choose() {
    if (this.pinned) { this.focus = this.pinned; return; }
    if (this.remainingHold && this.unread.has(this.focus)) return;
    this.holdUntil = 0;
    const choices = [...this.active].sort((a, b) => priority(a) - priority(b) || newest(a, b));
    const current = this.active.find(s => s.task_id === this.focus);
    if (current && choices.length && priority(current) === priority(choices[0])) return;
    this.focus = choices[0]?.task_id ?? null;
  }
  get display() { return this.states.get(this.focus) ?? presentation(null, null, true, Boolean(this.pinned)); }
  consumePrompts() {
    for (const [id, state] of this.states) this.states.set(id, { ...state, prompt: false });
  }
  get cards() {
    const ids = new Set([...(this.states.has(this.focus) ? [this.focus] : []), ...this.active.map(s => s.task_id), ...[...this.unread.values()].sort(newest).map(s => s.task_id)]);
    return [...ids].map(id => ({ taskID: id, result: this.states.get(id), unread: this.unread.has(id) }));
  }
}
module.exports = { TaskCollection };
