# Feature 008 Contracts

These files are normative and are read together:

1. [`process-graph.md`](process-graph.md) — built-in nodes, edges, guards, effects, evidence,
   invalidation, exceptional behavior, and forbidden transitions.
2. [`mcp-tools-0.2.md`](mcp-tools-0.2.md) — exact six-tool Core Contract 0.2 inputs, outputs,
   payloads, recovery probe, and stable errors.
3. [`storage-generation-2.md`](storage-generation-2.md) — fresh SQLite Schema 2, explicit Schema 1 rejection/reset boundary, strict v2 codec,
   future safe-stop, and transaction behavior.
4. [`method-profiles.md`](method-profiles.md) — tool-neutral semantic steps and `plain`, `spec-kit`,
   and `openspec` Host rendering/fallback rules.

Authority rules:

- A stable identifier/table/schema clause overrides a diagram/example.
- The Feature spec defines user-visible requirements; these contracts close exact wire/process/data
  behavior.
- The implementation plan chooses repository files but cannot weaken these contracts.
- A change to a process node/edge, public field/error, persisted meaning, or method-step semantic ID
  requires a Feature amendment and renewed checklist/analyze review.
- No file here authorizes product version or public release mutation.
