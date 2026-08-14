# Research: Govern and Resume a Single-Repository Task

## Decision 1: Official Go MCP SDK stable v1 line

**Decision**: Use the official `modelcontextprotocol/go-sdk` STDIO transport, requiring at least v1.7.0 and resolving the latest stable compatible v1 release when implementation begins.

**Rationale**: The official v1 line provides typed server tooling, local STDIO transport, protocol negotiation, and conformance coverage. `go.mod`/`go.sum` record the actual selected release, while product compatibility does not depend on one SDK patch number. Dev Flow uses only the bounded Tools-over-STDIO subset required by this feature and does not adopt HTTP, OAuth, sampling, or other SDK capabilities.

**Alternatives rejected**:

- community MCP SDK: unnecessary when an official SDK exists;
- custom JSON-RPC: duplicates protocol lifecycle and schema behavior;
- TypeScript Core: retains Node as the workflow runtime;
- HTTP transport: outside local MVP and increases security surface.

## Decision 2: SQLite current-state model

**Decision**: Use one SQLite database. `tasks` stores current authority; `task_events` stores compact
committed audit events.

**Rationale**: Transactions, uniqueness, and revision compare-and-swap solve the required
consistency problem without a custom file protocol.

**Alternatives rejected**:

- multiple JSON files: requires file locks, atomic replacement, cross-file consistency, and repair;
- full Event Sourcing: unnecessary replay and migration complexity;
- BoltDB/KV: possible, but queries and uniqueness are clearer in SQLite;
- external database: not appropriate for a local personal tool.

## Decision 3: `modernc.org/sqlite` stable v1 line

**Decision**: Use the latest stable CGo-free v1 driver compatible with the Go minimum through `database/sql`.

**Rationale**: It preserves cross-compilation and single-binary distribution. `go.mod`/`go.sum` record the actual module and transitive versions for reproducibility; specifications do not reject compatible patch or minor updates.

**Alternatives rejected**:

- `mattn/go-sqlite3`: requires CGo;
- shipping a database subprocess: adds lifecycle management;
- untagged driver version: weakens reproducibility.

## Decision 4: Snapshot authority plus compact events

**Decision**: Treat the task row as authority and write one event in the same transaction for every
committed mutation.

**Rationale**: Ordinary reads stay simple while recovery can inspect recent operation identity and
history.

**Alternatives rejected**:

- reconstructing state from events;
- dual-writing files and database;
- storing no events at all, which makes uncertain-response diagnosis harder.

## Decision 5: Explicit transition code, no state-machine framework

**Decision**: Represent phases and action outcomes with typed constants and an explicit transition
function/table.

**Rationale**: The state set is small and closed. Framework configuration would hide behavior and
make recovery harder to audit.

## Decision 6: Read-only Git fingerprint

**Decision**: Observe canonical root, branch/detached state, HEAD/unborn state, and hash of bounded
porcelain-v2 status bytes including untracked files.

**Rationale**: This detects relevant drift without storing source content or implementing snapshots.

**Alternatives rejected**:

- full Git diff: captures source and increases result/data size;
- content hashing every file: expensive and duplicates Git;
- HEAD only: misses worktree drift;
- allowing the Core to repair drift: violates the repository boundary.

## Decision 7: Dirty repositories are allowed but bound

**Decision**: A task may start in a dirty worktree. The exact fingerprint becomes part of every
action binding.

**Rationale**: Requiring a clean checkout would block common personal development work. Dev Flow
governs continuation, not cleanliness.

**Alternative rejected**: automatic stash/clean/reset, because it mutates user state.

## Decision 8: Immutable contract in v0.1

**Decision**: Goal, scope, exclusions, acceptance, and verification budget cannot change after task
creation.

**Rationale**: Contract revision requires evidence invalidation and user approval semantics that are
not needed to prove the initial journey.

**Alternative rejected**: silently replacing the requirement or adding an ungoverned update tool.

## Decision 9: One task per repository claim

**Decision**: Active-task uniqueness is enforced by a database uniqueness constraint on canonical
repository identity.

**Rationale**: Both host products will share one database; this prevents conflicting authorities.

**Alternatives rejected**:

- one task per host;
- warning-only conflict;
- lock files outside the database.

## Decision 10: Origin-host ownership, no handoff

**Decision**: A task records `codex` or `deepseek`. Only that host can mutate it.

**Rationale**: Host guidance and result projection may differ. Safe ownership transfer is a later
feature.

## Decision 11: Six tools

**Decision**:

```text
server_info
open_task
get_task
get_next_action
apply_action
cancel_task
```

**Rationale**: This is the smallest complete surface for creation/resume, read, authoritative
action, mutation, and explicit termination. Discovery is folded into `open_task`.

**Alternatives rejected**:

- separate list/find/start tools: expands surface before a task browser exists;
- generic transition tool: exposes internal state machine;
- revise-contract tool: deferred;
- recovery mutation tool: recovery is represented by task/next-action contracts.

## Decision 12: One result envelope

**Decision**: Every tool returns the same top-level envelope with `ok`, `request_id`, `tool`,
`result` or `error`, and optional `recovery`.

**Rationale**: Two host adapters can validate one schema and preserve stable domain failures.

## Decision 13: Core does not run tests

**Decision**: Host agents execute checks and submit bounded summaries.

**Rationale**: The Core governs budgets and evidence; executing arbitrary commands would turn it
into a generic shell authority.
