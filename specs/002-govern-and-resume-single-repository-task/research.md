# Research: Govern and Resume a Single-Repository Task

## Decision 1: Official Go MCP SDK v1.7.0

**Decision**: Phase 1–2 added no placeholder dependency. Phase 7 resolved the official
`github.com/modelcontextprotocol/go-sdk` release list and selected stable v1.7.0, the then-latest
stable compatible v1 release and the specification's minimum. `go.mod` records that exact release;
it is neither a pseudo-version, a branch commit, nor a fork.

**Rationale**: The official v1 line provides typed server tooling, local STDIO transport, protocol
negotiation, and conformance coverage, but Phase 1–2 has no MCP consumer. Deferring resolution avoids
dummy imports and keeps the foundational checkpoint at one direct production dependency.
`go.mod`/`go.sum` record the selected release and its SDK-owned transitive dependencies. Dev Flow
uses only raw Tool handlers and the bounded Tools-over-STDIO subset required by this feature; it does
not adopt HTTP, OAuth, sampling, resources, prompts, roots, or other SDK capabilities.

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
committed mutation. Use the closed operation kinds `open_task`, `apply_action`, and `cancel_task`.
The task's LastOperation and the transaction's TaskEvent are validated before SQL as exact
projections of the same request, optional action, revisions, payload digest, and commit time.

**Rationale**: Ordinary reads stay simple while the latest LastOperation proves one exact committed
mutation. TaskEvent remains a same-transaction audit fact used by invariants and tests; runtime
recovery does not list, query, or replay events and conservatively rejects an older unprovable
operation.

**Alternatives rejected**:

- reconstructing state from events;
- adding a Store event-list/replay API for recovery;
- dual-writing files and database;
- storing no events at all, which makes uncertain-response diagnosis harder.

## Decision 5: Explicit transition code, no state-machine framework

**Decision**: Represent phases and action outcomes with typed constants, one explicit transition
table, and a pure function that evaluates that table.

**Rationale**: The state set is small and closed. Framework configuration would hide behavior and
make recovery harder to audit.

## Decision 6: Read-only Git fingerprint

**Decision**: Observe canonical root, branch/detached state, HEAD/unborn state, and a normalized,
content-sensitive worktree fingerprint. Parse bounded porcelain-v2 `-z` records including untracked
paths, sort their normalized representation, and include status, path, available mode/index object
identity, plus a current content digest or deleted/missing sentinel. Only modified and untracked
ordinary paths reported by status are hashed, with the fixed read-only command
`git hash-object --no-filters -- <path>` passed as direct process arguments; shell invocation and
`-w` are forbidden.

**Rationale**: Hashing raw status alone misses a second byte change at the same dirty path. Git's
read-only object calculation detects that change without returning, persisting, or logging source
bytes. The fixed 1,024-path limit bounds the observation's path set, while every fixed Git subprocess
uses the same per-command timeout and combined stdout/stderr limit. Disappearing or inconsistent
paths fail safely without retry loops.

**Alternatives rejected**:

- full Git diff: captures source and increases result/data size;
- content hashing every repository file: expensive and duplicates Git; only status-identified paths
  are eligible;
- HEAD only: misses worktree drift;
- allowing the Core to repair drift: violates the repository boundary.

Dirty submodules fail closed with `ErrDirtySubmodule`, a stable repository-layer sentinel that also
matches `ErrGitObservation`. The Core does not recurse, does not accept a single ambiguous dirty bit
as a complete fingerprint, and never modifies the submodule.

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
The Store maps only the repository-identity primary key or claimed task ID uniqueness conflict to
`ACTIVE_TASK_CONFLICT`. Fixed conflict-target/`RETURNING` SQL identifies the repository key; for a
no-row result, a fixed repository-key query must confirm that key exists. For a candidate task-ID
conflict, `errors.As` and the modernc extended uniqueness code gate a fixed claim-key existence
query. Neither no-row nor a driver code alone is treated as the constraint identity. Foreign-key,
check, trigger, ignored insert, locked, I/O, schema, and other execution errors remain
`STORAGE_UNAVAILABLE`; error text is neither parsed nor exposed.

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
- recovery mutation tool: optional `recovery_apply` on the existing ApplyAction and the closed
  `RESOLVE_BLOCKER` payload provide the required mutations without a seventh tool.

## Decision 12: One result envelope

**Decision**: Every tool returns the same top-level envelope with `ok`, `request_id`, `tool`,
`result` or `error`, and optional `recovery`.

**Rationale**: Two host adapters can validate one schema and preserve stable domain failures. The
maximum valid 786,432-byte Task projection plus at most 131,072 bytes of envelope overhead remains
strictly below the 1,048,576-byte result limit.

## Decision 13: Core does not run tests

**Decision**: Host agents execute checks and submit bounded summaries.

**Rationale**: The Core governs budgets and evidence; executing arbitrary commands would turn it
into a generic shell authority.

## Decision 14: Fixed Core Limits 0.1

**Decision**: Use the single numeric table in `spec.md` as Core Limits 0.1 and one Go constant source.
Do not add configuration files, environment overrides, policy objects, or a limits framework.

**Rationale**: The values are conservative for a local personal development tool: KiB-scale text
fields, a 256 KiB Contract aggregate, a 128 KiB Outcome narrative aggregate, a 768 KiB Task
aggregate, a 1 MiB public result and persisted-snapshot ceiling, a 1,024-path fingerprint ceiling,
a 1 MiB Git-output ceiling, a 10-second Git deadline, and a 5-second SQLite busy window. They bound
memory, persistence, subprocess, and lock contention without inventing a tuning surface before real
usage demonstrates variation.

Aggregate limits count the actual compact JSON bytes produced after normalization by
`encoding/json` with HTML escaping disabled and no encoder newline. Required JSON escaping still
counts. Contract construction and final Task invariants enforce their aggregate limits before a
Store transaction; the Store's larger snapshot limit remains a defensive check. This makes every
Domain-valid Task persistable and leaves bounded room for its result envelope rather than relying on
the codec to reject an otherwise valid object.

## Decision 15: Binding permits only implementation worktree change

**Decision**: Every apply re-observes the repository. Ordinary non-implementation actions require
exact issuance binding equality. `IMPLEMENT_CHANGE` may update only the worktree fingerprint and
persists that fresh observation as the next binding; repository/common-directory identity,
branch/detached, and HEAD/unborn remain exact. Feature 002's sole blocker condition is
`restore_issuance_binding`: `RESOLVE_BLOCKER` requires every structured field/digest to equal the
retained issuance binding, may refresh only observation time, and may return only to its stored
`resume_phase`. Observation time is excluded from both digests.

**Rationale**: This permits the one action intended to edit files while detecting repository
replacement and Git-history/context changes. The Core validates the current observation but cannot
attribute a file modification to a particular external process, so it makes no process-level
authorship claim.

## Decision 16: Reads classify but never reconcile by mutation

**Decision**: `get_task` and `get_next_action` preserve their current no-observation behavior when no
OperationProbe is supplied. With a probe they observe and return the transient typed
RecoveryAssessment for every phase, including terminal and `BLOCKED`, but never persist a binding,
assessment, event, phase, revision, LastOperation, or blocker. Observer failure returns an error,
not an invented unavailable assessment. A new `BLOCKED` snapshot can be committed only by an
explicit recovery apply-action transaction.

**Rationale**: Read-after-write remains safe and repeatable, while all state changes retain exact
revision/action identity and an auditable transaction.

## Decision 17: Strict JSON belongs at technical boundaries

**Decision**: Domain types validate typed values and never accept `map[string]any`. Store codecs use
strict JSON decoding and re-run Domain invariants; MCP inputs independently reject unknown and
duplicate fields at the adapter boundary.

**Rationale**: Closure is enforced where untrusted serialized data enters without coupling Domain
logic to JSON Schema or duplicating parsing rules.

## Decision 18: Task Evidence is the sole retained evidence authority

**Decision**: Retain each EvidenceSummary exactly once in `Task.Evidence`. Outcome stores only
canonical `automated_evidence_ids` and `manual_evidence_ids`; IDs are unique within and across the
lists and must resolve to automated and user evidence respectively.

**Rationale**: Copying EvidenceSummary into Outcome creates a second authority and lets terminal
construction bypass command-count, full-suite, or manual-handoff policy. Task validation evaluates
the verification budget once over retained evidence, then validates Outcome references against that
same collection.

There is no formal user data at this checkpoint. The representation change uses the existing typed
snapshot boundary and does not add migration compatibility code or increment the schema version.

## Decision 19: Fail closed on unknown workflow phases

**Decision**: `DONE` and `CANCELLED` return `TASK_TERMINAL`; an invalid or unknown Phase returns
`INVALID_ARGUMENT`. A valid nonterminal phase omitted from the closed blueprint mapping is an
internal invariant failure, not a terminal result. `HANDOFF/PREPARE_HANDOFF` allows
`read_repository` as well as `prepare_delivery_summary` because repository observation is required.

**Rationale**: Terminal status, invalid caller input, and an implementation defect are materially
different conditions and must not share one stable error code or contradictory effect contract.

## Decision 20: Core-derived OperationProbe digest and optional recovery apply

**Decision**: Reads accept the closed OperationProbe defined in `data-model.md`. The caller echoes
the original request/action/source revision/source phase/issuance digest and nullable original
payload; Core never accepts a caller payload digest or classification. The existing ApplyAction
gains only optional `recovery_apply: {operation_id, source_phase}`. Its presence makes the
enclosing action fields a probe; `operation_id` is the original uncertain ApplyAction request ID,
while the recovery call's request ID remains response correlation. Null is allowed only in this
mode. Core canonicalizes the payload and calculates the same normal apply-operation digest; the
recovery discriminator is excluded so exact committed normal work can be proved. A reconciliation
commit persists the probed operation ID in LastOperation and TaskEvent, preserving exact proof if
the recovery response is also lost. The normal ApplyAction request ID is required before dispatch
and retained by the caller, so response loss cannot hide the future probe identity.

**Rationale**: The existing ApplyAction carries every identity field except the original operation
ID and source phase. One optional two-field discriminator closes the ambiguous
`PREPARE_HANDOFF` phase and post-commit read-back without nesting or duplicating normal input.

**Alternatives rejected**:

- caller-supplied payload digest: cannot prove it describes the submitted payload;
- storing an attempted-operation journal: creates a second persistent authority;
- a separate recovery method/tool or OperationKind: exceeds the bounded surface and duplicates the
  workflow;
- free-form mode strings, maps, or inferred model intent: not closed or deterministic.

## Decision 21: One transient RecoveryAssessment

**Decision**: Application returns `GetTaskResult` instead of a bare Task. Only GetTaskResult and
NextActionResult use the exact `RecoveryAssessment` model in `data-model.md`; it includes the
Core-derived operation digest, probed/current identities,
authoritative/issuance/observed digests, repository relation, exact/unrelated/contradictory latest
LastOperation relation, evidence state, optional exact committed proof, action retry safety, closed
advice, optional condition, and fresh observation time. It contains no path or
raw/source/command/environment content and is never persisted.

**Rationale**: One typed projection makes repeated-read behavior and privacy testable without
polluting Task or creating an “assessment snapshot.” A null assessment preserves ordinary reads.
ApplyAction independently classifies explicit recovery input but returns only its ordinary Task
result shape.

**Alternatives rejected**:

- embedding assessment in Task or TaskEvent: turns transient external reality into persisted truth;
- an unavailable assessment object: conceals observer failure as a classification;
- generic details maps or prose-only guidance: cannot drive deterministic host behavior;
- reusing result-envelope `recovery`: that object remains error-only retry guidance.

## Decision 22: Ordered five-class table and baseline evidence boundary

**Decision**: The sole ordered decision table is in `contracts/state-machine.md`. Exact latest
LastOperation proof wins first. If the latest LastOperation shares the probe operation ID or action
ID but any other kind/action/revision/Core-derived-digest/commit requirement differs, its relation
is contradictory and the class is conflicting; it is not treated as missing proof. Otherwise a
superseded source is conflicting; an action-forbidden binding relation or payload/observation
contradiction is conflicting, including worktree-only change for a non-implementation action;
worktree-only `IMPLEMENT_CHANGE` with null payload is partial; a valid complete payload
consistent with the action's closed repository effect is completed-but-unrecorded; and null payload
plus exact current binding is not-started. Invalid input or observation is an error before
classification.

**Rationale**: These facts exist now and can be proven without event replay or model judgment. For
non-implementation actions, the validated closed payload is the complete result evidence. For
implementation, changed-paths versus no-file-change must agree with the fresh binding relation.

**Alternatives rejected**:

- similarity, path authorship, or model inference: not objectively provable from the bounded
  observer;
- partially accepting an invalid payload: makes payload closure meaningless;
- general expected-evidence contracts or adoption policy: deferred to Feature 005 after real-host
  evidence;
- checking TaskEvent at runtime: LastOperation is deliberately the latest public proof.

## Decision 23: One blocker condition and closed resolution payload

**Decision**: Only explicit recovery apply from an exact current normal source may create a blocker,
and only for partial/conflicting. Core retains the issuance Task.Repository and generates a
`TASK_BLOCKED` Blocker whose cause is the class, whose observed digest is non-authoritative, and
whose sole machine condition is `restore_issuance_binding(expected_binding_digest)`. Human
`RequiredResolution` is never parsed. `ResolveBlockerPayload` contains only result, exact blocker ID,
bounded summary, and nested resolution evidence echoing the exact condition and observed digest.
Success uses ApplyAction/OperationApplyAction, ClaimRetain, one revision/event, one Core-generated
`blocker_resolution` host-observed evidence record, and a new normal action at the stored phase.
For an operation/evidence-only conflict the binding condition may already be true; this never
auto-resolves the blocker, because the exact closed resolution action and a new observation remain
mandatory.

**Rationale**: Exact restoration is the smallest condition the Core can prove with its current
observer. It preserves the issuance binding as authority while retaining enough facts to explain
and resolve the stop.

**Alternatives rejected**:

- accepting a new worktree binding while blocked: requires an adoption policy and is Feature 005;
- arbitrary field matching, callbacks, policy language, or DSL: violates proven simplicity;
- caller-provided blocker/class/resume phase/binding: creates another workflow authority;
- separate ResolveBlocker Application/MCP method: unnecessary seventh surface;
- parsing human resolution text: not machine-safe.

## Decision 24: Recovery owns comparison; Repository owns digest algorithms

**Decision**: `internal/recovery` is the sole structural binding/reconciliation authority used by
normal apply, recovery apply, reads, and resolution. The Repository package exposes the one pure
digest self-consistency verifier beside its existing digest constructors. It recomputes repository
identity from canonical root plus common-directory digest and final binding digest from structured
fields excluding observation time. Application invokes it on loaded persisted bindings and fresh
observer results, maps their source-specific errors, removes its comparison helpers, and passes only
verified facts to Recovery. A persisted failure maps to `STORAGE_UNAVAILABLE`; a fresh observer
failure maps to `INTERNAL_ERROR`. Both precede classification and mutation; verifier invocation is
integrity validation, not an acceptance decision.

**Rationale**: Decision rules and digest construction have different responsibilities. Keeping one
of each prevents the current Application comparison and future Recovery comparison from drifting,
without copying the private common-directory or binding digest algorithms.

**Alternatives rejected**:

- trusting well-formed SHA-256 strings: permits internally inconsistent persisted bindings;
- recomputing digests independently in Application or Recovery: duplicates algorithms;
- persisting the raw Git common-directory path: expands sensitive state without need;
- moving repository decisions into adapters: violates Core authority.

## Decision 25: Deterministic two-handle concurrency boundary

**Decision**: T057 uses two independently opened SQLite handles against one database under
`t.TempDir()`, with separate claim and revision-CAS cases. Both contenders reach a bounded channel
gate before release; there is no sleep, stress loop, race/fuzz/benchmark, production CLI change, or
process framework. Each case has exactly one committed winner. Claim loser is
`ACTIVE_TASK_CONFLICT`; stale-revision loser is `REVISION_CONFLICT`; loser contributes no task/event,
revision, evidence, or claim change.

**Rationale**: Independent handles exercise SQLite's cross-connection boundary and the existing
busy timeout while remaining deterministic and smaller than a subprocess protocol.

**Alternative rejected**: real subprocess helpers are valid but add orchestration with no extra
acceptance value at this baseline; a single shared handle does not exercise the intended boundary.

## Decision 26: Feature 002 baseline versus Feature 005 hardening

**Decision**: Feature 002 stops at deterministic Core-local OperationProbe assessment, explicit
record/block behavior, exact-binding resolution, shared future fixtures, and bounded two-handle
concurrency. Feature 005 remains gated by real Feature 003/004 host evidence and owns transport loss
and truncation matrices, crash-point/failure injection, generic expected-evidence adoption,
host-specific rules and parity journeys, automatic repair, complex new-binding adoption, takeover,
and install/upgrade recovery.

**Rationale**: Baseline recovery must be implementable from current facts; hardening should respond
to observed host failures rather than speculative matrices.

## Decision 27: Raw SDK tools preserve the strict wire boundary

**Decision**: Register all six tools with the official SDK's raw `Server.AddTool` surface. The SDK
owns MCP negotiation, sessions, Tool listing, calls, and STDIO shutdown. Dev Flow receives each
`arguments` value as `json.RawMessage`, performs a token preflight that rejects duplicate object
members at every nesting level, then uses `DisallowUnknownFields` and explicit phase/action switches
to construct the one concrete Application input and `workflow.ActionPayload`.

**Rationale**: The SDK's typed AddTool path unmarshals before the handler and therefore cannot expose
duplicate member names for the Feature 002 proof. Raw handlers preserve that proof without
reimplementing JSON-RPC or adding a JSON Schema runtime. The committed JSON Schemas remain public
specification fixtures and tool metadata, not workflow or validation authority.

`PREPARE_HANDOFF` is the one action kind shared by REVIEW and HANDOFF, and both phases allow
`rework_implementation`/`replan`. For those structurally identical wire results the adapter performs
one no-probe `Application.GetTask` read to obtain the authoritative current source phase before
constructing the sealed Go payload. That read neither observes Git nor writes state; the following
`ApplyAction` still owns revision, action, binding, workflow, recovery, and terminal validation, so a
concurrent change fails through the existing CAS/identity contract.

**Alternatives rejected**:

- typed SDK argument decoding: loses the duplicate-member evidence before Dev Flow validation;
- adding `source_phase` to normal ApplyAction: changes the approved public contract;
- choosing REVIEW or HANDOFF from ambiguous result text: rejects one valid rework path;
- moving JSON decoding into Domain/Workflow: couples business authority to a transport format;
- custom JSON-RPC: duplicates the official SDK lifecycle.

## Decision 28: Conservative annotations and fixed local data location

**Decision**: `server_info`, `get_task`, and `get_next_action` are explicitly read-only,
idempotent, non-destructive, and closed-world. `open_task` and `apply_action` are explicitly not
read-only, not idempotent, non-destructive, and closed-world. `cancel_task` is not read-only or
idempotent, is destructive to active task state, and is closed-world. These are descriptive hints
only. They grant no filesystem, process, Git, database, or network authority.

`dev-flow mcp --stdio` requires `DEV_FLOW_DATA_DIR` to identify an existing usable directory and
uses the fixed internal filename `dev-flow.db`. Neither tools nor CLI flags accept a database path.
The path is absent from results and diagnostics; stdin/client disconnect ends the SDK session and
the CLI closes SQLite.

**Rationale**: Explicit conservative hints avoid claiming retry or OS powers that the protocol does
not enforce. One environment-selected directory plus one internal filename meets restart persistence
without introducing a configuration framework or exposing storage internals.
