# Data Model: TEST Evidence Schema Exposure

## Persistence Disposition

`not-applicable`. No stored entity or schema changes.

## ApplyBranch

Fields remain the existing apply request fields. `action_kind` is a const per branch and `payload` is the matching
concrete node payload or null only under the existing recovery contract. There are exactly nine branches.

## EvidenceInput Branches

| Source | command_count | full_suite | Meaning |
| --- | --- | --- | --- |
| `automated` | integer 1..20 | boolean | Codex/Host automatic verification, counted against budget |
| `user` | const 0 | const false | completed developer-run verification, retained as manual evidence |
| `static` | const 0 | const false | static inspection without command execution |
| `host_observed` | const 0 | const false | observed Host fact without budgeted command attribution |

All branches require source, name, status, summary, command_count and full_suite. Names are unique per TEST payload.

## ManualHandoffItem

A normalized nonempty string describing verification still awaiting user execution. Once the user returns a completed
result, it becomes a source=user EvidenceInput and is removed from manual_handoff_items.

## Invariants

- Evidence source aliases are rejected.
- Only automated evidence increases automaticCommands.
- Completed TEST pass has no failed items, findings, unverified items or outstanding manual handoff items.
- Existing evidence plus incoming automated evidence stays within the immutable budget.
- Invalid schema or workflow input causes zero Task/store writes.

