# Implementation Plan: Refactor to a Development Process Graph

**Branch**: `008-refactor-to-development-process-graph` | **Date**: 2026-08-18 |
**Spec**: [`spec.md`](spec.md)

**Change Type**: Product Feature

**Input**: Feature specification from
`specs/008-refactor-to-development-process-graph/spec.md`

## Summary

Retain the existing Go Core, SQLite snapshot/event/claim architecture, six MCP tools, repository
observer, revision CAS, and five-class recovery. Replace the Core Contract 0.1 workflow model with a built-in `standard-development@1` process
definition for every task supported by Core Contract 0.2; its nodes,
node contracts, and legal transitions are visible in every current action.

Phase 5D first closed the audited Phase 2–5 contract/runtime gaps with a temporary
`RECOVERY_UNAVAILABLE` boundary. Phase 7A supersedes it with graph-native operation identity,
five-class reconciliation, repository-effect proof, explicit recovery apply, and graph-native
BLOCKED/resolution; omitted/null fields retain ordinary behavior.

The implementation introduces one snapshot-version-2 task aggregate with an immutable `TaskIntent`,
versioned semantic baselines, a process cursor, current test/comprehension authorities, and
transition-aware actions. SQLite Schema 2 is created directly as a fresh storage generation. Schema 1
and historical task snapshots are rejected with zero writes; no legacy process, v1 codec, migration,
or dual task projection is retained. Codex remains a thin adapter that renders Core semantic method
steps for `plain`, `spec-kit`, or `openspec`; it does not own graph state.

This is not a release plan. No version, npm, Tag, GitHub Release, or public support identity changes.

## Current System Baseline

Baseline source is `main` commit `29885cd4d0b97ad03bbe09876168e48db371a048`.

| Surface | Current Authority | Current Behavior | Feature Impact |
| --- | --- | --- | --- |
| Phase/action enums | `internal/domain/types.go` | Ten released linear phases and seven action kinds | Replace with the closed graph node/action/transition/method vocabulary; no legacy runtime branch |
| Task aggregate | `internal/domain/task.go` | Immutable `Contract`, one `Phase`, current action, blocker, evidence, outcome | Replace with the single graph TaskIntent/baseline/process aggregate |
| Action | `internal/domain/action.go` | Kind, identity, allowed effects, required evidence, phase payload, guidance | Add process/node identity, complete node contract, transitions, and method steps for v2 |
| Workflow table | `internal/workflow/transitions.go` | One static mostly linear transition table | Replace with the single static `standard-development@1` definition |
| Action blueprint | `internal/workflow/engine.go` | Switch by phase with embedded English guidance | Derive all current actions from graph node definitions |
| Payloads | `internal/workflow/payloads.go` | Sealed phase-specific payload types and result vocabulary | Replace with sealed node-specific payloads using `transition_id` |
| Application | `internal/application/*.go` | Open/read/next/apply/cancel around one Task type | Operate only on the graph Task while keeping the public tool catalog |
| Recovery | `internal/recovery/` | Five-class read-before-retry using action/binding/payload identity | Generalize source cursor/payload validation; preserve classifications and advice |
| Store schema | `internal/store/migrations.go` | SQLite Schema 1; phase columns plus strict snapshot blob | Replace with a direct fresh Schema 2 bootstrap and Schema 1 zero-write rejection |
| Store codec | `internal/store/codec.go` | One strict released DTO; unknown fields rejected | Replace with one strict graph snapshot-version-2 codec |
| MCP | `internal/mcp/{schemas,results,tools,server}.go` | Core Contract 0.1 and exactly six tools | Upgrade schemas/projections to Contract 0.2; tool names/count unchanged |
| Shared fixtures | `protocol/fixtures/`, `tests/contract/` | Frozen Core Contract 0.1 fixtures | Keep historical fixtures as source evidence but validate only new Contract 0.2 runtime fixtures |
| Codex Skill | `packages/codex/plugin/skills/dev-flow/SKILL.md` | Long explicit loop for one next action and Core Contract 0.1 | Read/render node contract and method steps; remove adapter-owned process sequencing |
| Package allowlist | `packages/codex/package.json` | Closed package file list | Add one packaged method-profile reference if needed |
| Product docs | `README.md`, `docs/{PRODUCT,ARCHITECTURE,ROADMAP}.md` | Describe linear Core and published Codex product | Update only after implementation behavior exists; no release claims |

## Technical Context

**Language/Version**: Go `>=1.26`; Node.js `>=24`; pnpm `>=11 <12`

**Primary Dependencies**: Existing Go standard library, `modernc.org/sqlite`, and official MCP Go SDK.
No new production dependency.

**Storage**: Local SQLite; fresh Schema 2 bootstrap; one strict snapshot version 2; Schema 1 rejected

**Transport/Public Surface**: Local STDIO MCP, exactly six tools, result contract schema 2

**Testing**: Targeted Go package tests, shared contract fixtures, Codex package/Skill contract tests,
one final repository validation and one local-artifact real Codex journey; no old-binary or legacy-task journey

**Target Platform**: Implementation and deterministic tests remain repository-portable; the one
real Codex journey uses the currently supported native macOS arm64 environment

**Performance Goals**:

- one task read derives node/transition guidance without event replay;
- process lookup and transition validation are bounded static operations;
- persisted snapshot remains within existing or deliberately revised Core limits;
- no network call or method-tool process launch occurs inside Core.

**Constraints**:

- one repository and one active task;
- one current node;
- no caller-selected destination;
- no user-configurable graph;
- six MCP tools;
- read-only Git in Core;
- exact action/revision/binding identity;
- at-most-once mutation;
- bounded baseline/artifact/evidence history;
- no release side effects.

**Scale/Scope**: One built-in standard graph with nine normal nodes, two exceptional nodes, 29 normal
transition definitions, and no alternate/legacy process definition.

## Constitution Check

### Pre-Research Gate

| Principle / Constraint | Status | Evidence / Design Response |
| --- | --- | --- |
| Developer-visible navigation | PASS | Every v2 action carries the full current node contract and complete edge set |
| Single Core authority | PASS | Process definitions and destination derivation stay in `internal/workflow` |
| Bounded standard graph | PASS | One static graph; no parser/DSL/configuration |
| Comprehensibility gate | PASS | Mandatory node and explicit user evidence before delivery |
| Method tools are guidance | PASS | Core returns semantic steps; adapter renders capabilities/fallback |
| Recovery before retry | PASS | Existing operation probe and five classifications are retained |
| Read-only Git | PASS | Effects authorize Host work only; Core observer remains read-only |
| Evidence-bounded testing | PASS | Targeted checkpoint checks, one final validate, one real journey |
| Proven simplicity | PASS | Reuse current aggregate/store/MCP/application boundaries; no new dependency |
| Release separation | PASS | Feature does not touch version or remote publication |
| Host fixture parity | PASS | Shared v2 fixtures cover both host identities; no DeepSeek product claim |

### Post-Design Gate

PASS. The selected design has one current process definition and one strict snapshot shape. It
explicitly rejects pre-graph storage instead of adding a second runtime, decoder, projection, or
migration branch. It does not add a generic process interface, runtime registry, or external graph
format.

## Design

### 1. Static Process Definitions

Add one static code-owned definition:

```text
standard-development@1
```

`standard-development@1` contains the exact nodes and transitions from
`contracts/process-graph.md`. Definitions are validated at process startup/test time for:

- unique node IDs;
- unique transition IDs;
- known sources/destinations;
- one entry node;
- terminal nodes with no outgoing edge;
- complete action blueprint per nonterminal node;
- deterministic declaration order;
- bounded text/list sizes;
- no caller-supplied predicate or executable guard;
- stable canonical definition digest.

Use direct structs and `switch`/lookup tables. Do not introduce a generic plugin interface or load
definitions from disk.

### 2. Domain Model

Replace the released linear task vocabulary with focused graph types:

```text
internal/domain/
├── process.go
├── baselines.go
├── method.go
└── task_v2.go
```

Core v2 authority consists of:

- immutable `TaskIntent`;
- `ProcessReference`;
- `ProcessCursor`;
- current and bounded historical baseline references;
- current repository binding;
- current action;
- evidence;
- blocker/resume cursor;
- current test and comprehension records;
- outcome;
- revision/timestamps.

Use one application-level graph Task projection and one strict snapshot-version-2 codec. Schema 1
rows are rejected before task decoding; no union projection is required.

The initial request is immutable. Requirements are intentionally versioned: completing
`REQUIREMENTS` creates a new requirements baseline. Design/task-plan authorities bind to the exact
upstream revisions. Backward transitions invalidate dependent current authorities but retain bounded
history references.

### 3. Node Actions and Transition Application

A standard action includes:

```text
task_id / revision / action_id
process ID / version / definition digest
current_node / node_purpose
entry_conditions / completion_conditions
allowed_effects / required_evidence
method_steps / available_transitions
payload_contract / guidance
repository_binding_digest
method_profile
```

The caller submits the exact current action identity and one `transition_id`. It never submits a
destination. The workflow engine:

1. loads the current process definition;
2. resolves the transition by source node and transition ID;
3. validates the sealed source-node payload;
4. validates the transition guard from typed payload/repository/task facts;
5. invalidates dependent authorities;
6. derives the destination;
7. constructs the next action or terminal outcome;
8. commits snapshot, event, evidence, and claim in one CAS transaction.

Backward/remediation transitions require `reason`. Normal forward transitions do not.

### 4. Baselines and Invalidation

Use full bounded current baselines and compact prior references:

```text
current requirements/design/task-plan
prior baseline reference: kind, revision, digest, summary, created_at
```

Do not store full external Spec Kit/OpenSpec documents in SQLite. Store semantic fields required for
Core decisions and bounded artifact references.

Invalidation rules:

| Mutation | Invalidates |
| --- | --- |
| New requirements revision | design, task plan, test, comprehension, delivery readiness |
| New design revision | task plan, test, comprehension, delivery readiness |
| New task-plan revision | implementation readiness, test, comprehension, delivery readiness |
| Repository-changing implementation | test, comprehension, delivery readiness |
| Repository-changing refactor | test, comprehension, delivery readiness |
| Test pass | creates current test record only |
| Comprehension pass | creates current comprehension record only |
| Delivery complete | requires all current authorities and creates Outcome |

Historical evidence remains retained but cannot satisfy a current gate after invalidation.

### 5. Comprehension Gate

`COMPREHENSION_REVIEW` is not an automated code-review alias. Its pass payload must include:

- components/behavior the developer can explain;
- no unresolved comprehension question;
- no unresolved unnecessary abstraction;
- bounded maintenance risks;
- explicit user-confirmation evidence;
- repository and baseline identities matching the current task.

Static or host-only AI review can support a rework decision but cannot produce
`comprehension_passed` without user evidence.

### 6. Allowed Effects

Replace the overly broad v2 edit effect with semantic effects:

```text
read_repository
edit_process_artifacts
edit_product_files
run_verification_commands
request_user_decision
prepare_delivery_summary
resolve_blocker
```

These are Host-effect bounds, not Core OS capabilities. Core continues to execute only bounded
read-only Git observation. No historical action-effect vocabulary is retained.

### 7. MCP Contract 0.2

Keep exact tool names:

```text
dev_flow_server_info
dev_flow_open_task
dev_flow_get_task
dev_flow_get_next_action
dev_flow_apply_action
dev_flow_cancel_task
```

`open_task.new_task` changes from a final immutable contract to:

```text
request
initial_scope
initial_out_of_scope
known_acceptance_criteria
verification_budget
method_profile
```

Only `request`, `verification_budget`, and `method_profile` are required; known lists may be empty.
The complete closed schemas and projections are in `contracts/mcp-tools-0.2.md`.

`get_task` and `get_next_action` remain read-only. `apply_action` retains the original top-level
identity fields and operation-probe behavior while selecting one sealed current-node payload branch.

Add stable errors:

```text
TRANSITION_NOT_ALLOWED
PROCESS_UNSUPPORTED
```

Do not add a tool, destination input, graph mutation API, method-execution API, or raw artifact body.

### 8. Fresh SQLite Schema 2 and Single Codec

Replace Schema 1 bootstrap/migration code with one final Schema 2 baseline:

- create graph-native `tasks`, `task_events`, `repository_claims`, indexes, and schema history directly
  in one serializable transaction;
- record the exact version-2 bootstrap digest;
- store `process_id`, process version/digest, snapshot version 2, and `current_node` directly;
- use graph-native `source_node`, `destination_node`, `transition_id`, and `transition_reason` event
  columns;
- use one strict v2 DTO/codec.

Do not execute Schema 1 first, issue `ALTER TABLE`, retain the old `phase` column for compatibility,
or include a v1 decoder. If an existing database has Schema 1 or any non-exact history, return
`SCHEMA_UNSUPPORTED` before task decoding and perform zero writes. The user must explicitly select a
fresh data directory or manually archive/rename/delete old data outside Core. No lifecycle command
does so automatically.

### 9. Recovery and Repository Reconciliation

The final Phase 7 design retains the existing five classifications and operation-probe semantics for
current graph tasks, replacing `source_phase` with exact `source_cursor`/process identity in Contract
0.2; there is no mixed or legacy shape.

Recovery continues to derive the payload digest inside Core and never trusts caller classification,
destination, blocker, or binding. Repository-changing `IMPLEMENT` and `REFACTOR` actions use the
existing worktree-only effect relation. Non-editing nodes require an exact binding. A partial or
conflicting mutation enters `BLOCKED` with its original source node as resume cursor.

Phase 7A implements this route through the existing read and apply tools. Recovery reads observe once
and remain zero-write; recovery apply re-observes and commits only the Core-derived directive. No
runtime event replay is introduced.

### 10. Method Profiles

Core persists one immutable profile and returns semantic step IDs. The Codex package owns only
rendering information:

```text
plain
spec-kit
openspec
```

Add a packaged reference such as:

```text
packages/codex/plugin/skills/dev-flow/references/method-profiles.md
```

The Skill reads the Core-returned semantic steps, checks which named capability is actually
available to the Host, and presents:

- the exact installed capability/command when known;
- expected artifacts/evidence;
- plain-equivalent work when the capability is absent;
- an honest method-evidence status.

Core does not import Spec Kit/OpenSpec, invoke commands, parse their checkboxes, or infer their phase.
The detailed mapping is in `contracts/method-profiles.md`.

### 11. Incompatible Upgrade Boundary

Do not implement a legacy adapter. The graph Core and Codex Skill:

- support only Schema 2 snapshot-version-2 tasks and `standard-development@1`;
- reject Schema 1/pre-graph data before task projection;
- contain no `legacy-linear` branch, v1 payload, dual action projection, or task conversion;
- report the fresh-data requirement without deleting or renaming data;
- resume/recover only tasks created by the graph contract.

The released `0.3.0` source, packages, and historical Feature evidence remain unchanged. Existing
Schema 1 task data is outside the new product contract. Feature 008 provides no bridge between the
two storage generations.

### 12. Documentation

After code and contracts pass:

- update root README to describe process navigation and current release boundary;
- update `docs/PRODUCT.md` and `docs/ARCHITECTURE.md`;
- update `docs/ROADMAP.md` only with delivered behavior and next release decision;
- update Codex package README for local-artifact behavior;
- preserve historical Feature and release evidence.

### 13. Phase 5D Contract and Runtime Hardening

Phase 5D is a bounded corrective slice over completed Phase 2–5 work:

- add source-node `problem_class` enums and bind all 29 transitions to exactly one class/fact/reason
  combination in `internal/workflow/payloads_v2.go` and `internal/workflow/engine.go`;
- separate comprehension user confirmation from TEST manual-handoff budget enforcement in
  `internal/application/apply_action.go`;
- close optional MCP fields and introduce explicit ServerInfo/process public DTOs in
  `internal/mcp/{schemas,results,tools,server}.go` and current fixtures;
- project definition identity from stable identifiers only and compare persisted human text by
  validation rather than identity in `internal/workflow/definitions.go`;
- enforce the current-node authority matrix and cross-record references in
  `internal/domain/task_v2.go` and the strict Store decode/load path;
- inspect both tasks and repository claims before Store write exposure in
  `internal/store/sqlite.go`;
- stabilize terminal cancellation and Application reason validation in
  `internal/application/cancel_task.go` and error mapping;
- require exact current delivery evidence sets in workflow/application/domain outcome validation;
- update only Feature 008 contracts, model, quickstart, fixtures, and focused tests needed by these
  corrections.

No Phase 6 adapter/profile work, Phase 7 Recovery classification/observation/mutation work, Phase 8
final artifact work, node, edge, tool, compatibility route, or release operation is included.

## Project Structure

### Feature Documentation

```text
specs/008-refactor-to-development-process-graph/
├── README.md
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── process-graph.md
│   ├── mcp-tools-0.2.md
│   ├── storage-generation-2.md
│   └── method-profiles.md
├── checklists/
│   └── requirements.md
└── tasks.md
```

### Planned Source Changes

```text
internal/domain/
├── action.go                     # graph action and node/transition projection
├── baselines.go                  # semantic baselines and bounded history references
├── limits.go                     # bounded graph/baseline/method limits
├── method.go                     # method profile/evidence types
├── process.go                    # process/node/transition identifiers and definitions
├── task.go                       # single graph task aggregate
└── types.go                      # current closed vocabulary only

internal/workflow/
├── definitions.go                # static lookup/digest/definition validation
├── standard_process.go           # exact standard-development@1 graph
├── engine.go                     # build/validate/transition the single process
├── payloads.go                   # sealed node-specific transition payloads
└── transitions.go                # removed or reduced to standard definition helpers

internal/application/
├── open_task.go
├── get_task.go
├── next_action.go
├── apply_action.go
├── cancel_task.go
└── service.go

internal/recovery/
└── [existing files updated only where source cursor/payload process identity requires]

internal/store/
├── migrations.go                 # direct Schema 2 bootstrap + unsupported-schema rejection
├── codec.go                      # one strict snapshot-version-2 codec
├── sqlite.go
└── [targeted bootstrap/rejection/restart tests]

internal/mcp/
├── schemas.go
├── results.go
├── tools.go
└── server.go

protocol/fixtures/
├── [historical v1 files remain untouched as repository evidence]
└── graph-*.json                  # current runtime fixtures

tests/contract/
├── fixture_contract_test.go
├── mcp_contract_test.go
├── process_graph_contract_test.go
├── storage_generation_2_test.go
└── result_envelope_test.go

packages/codex/
├── package.json
├── plugin/skills/dev-flow/SKILL.md
├── plugin/skills/dev-flow/references/method-profiles.md
└── tests/
```

**Structure Decision**: Preserve the current domain/workflow/application/store/MCP layering. Add
focused files while replacing the old runtime model rather than wrapping it. Use static definitions
and direct dispatch because only one process implementation exists.

## Test Strategy and Budget

| Checkpoint | Required Checks | Explicitly Excluded |
| --- | --- | --- |
| Contract freeze | Markdown link/placeholder/traceability checks; no production tests | Full Go/Node suite, native journey |
| Foundation | Targeted `internal/domain`, `internal/workflow`, `internal/store` tests | Repository-wide validate, Codex |
| User Story 1 | Targeted `internal/application`, `internal/mcp`, graph contract tests | Recovery matrix, native journey |
| User Story 2 | Targeted workflow/application graph-loop and stale-evidence tests | Full repository validate |
| Phase 5D hardening | Focused domain/workflow/application/store/MCP/contract/journey tests, affected-package tests, then one repository validation | Phase 6–8 work, native journey, release |
| User Story 3 | Codex Skill/method-profile static and package-local tests | Real OpenSpec/Spec Kit installation matrix |
| User Story 4 | Fresh bootstrap, Schema 1 zero-write rejection, current recovery/concurrency, shared fixture tests | Old-task continuation, old-binary matrix, public release |
| Final | `pnpm run validate` exactly once; one successful local-artifact real Codex Journey with failed attempt 1 retained and explicitly authorized final attempt 2 | npm publish, Tag/Release, Linux/Windows/Intel/DeepSeek journeys |

Approved maxima after the explicit Phase 5D audit amendment:

- repository-wide validation: **1** Phase 5D invocation and **1** later Phase 8 final invocation;
- a failed Phase 5D invocation may be followed by one final confirming invocation only after a
  concrete defect is fixed and targeted checks pass;
- real Codex journey: **1 successful** final local-artifact Journey. Attempt 1 failed before its first
  mutation because the Harness submitted an invalid Contract 0.2 payload; its evidence is retained.
  The user explicitly authorized one corrected attempt 2 after deterministic preflight. Total
  attempts are capped at **2**, and attempt 3 is forbidden;
- released-0.3.0 old-binary or legacy-task observation: **0**;
- real Spec Kit/OpenSpec command matrix: **0** for this Feature; adapter contracts use capability
  fixtures and one profile example in the final Codex journey;
- unsupported platform/Host matrices: **0**.

A failed targeted check may be rerun after a concrete fix. Do not rerun unrelated successful suites.

## Rollout and Persistence Boundary

1. Merge governance normalization and the complete Feature 008 package without production behavior
   or version changes.
2. Clarify/checklist/analyze and freeze Core Contract 0.2.
3. Implement the single graph process, Task model, direct Schema 2 bootstrap, and strict v2 codec.
4. Deliver user stories in order, stopping at each checkpoint.
5. Run fresh-bootstrap, Schema 1 zero-write rejection, and current-task recovery gates.
6. Complete one final local-artifact Codex journey and repository validation using a fresh data root.
7. Mark Feature 008 complete without publishing.
8. Create a separate Release Change to choose the next version, communicate the breaking storage
   boundary, build the distributed artifact, rerun the final registry-package journey, and publish
   support evidence.

Rollback before using Schema 2 is ordinary. After creating graph tasks, an older binary safe-stops;
there is no downgrade or task conversion. Existing Schema 1 data remains untouched until the user
explicitly archives/renames/deletes it or chooses another directory.

## Complexity Tracking

No Constitution exception is approved or required.

| Potential Complexity | Decision | Reason |
| --- | --- | --- |
| Runtime graph DSL | Rejected | One built-in graph is sufficient and safer |
| Generic process plugin interface | Rejected | Only one code-owned definition exists |
| Event-sourced task reconstruction | Rejected | Current snapshot authority is retained |
| Full historical document storage | Rejected | Current baselines plus compact history references are sufficient |
| New MCP navigation tool | Rejected | Existing next-action/read tools can expose the graph |
| Core execution of Spec Kit/OpenSpec | Rejected | Method tools remain Host guidance |
| Historical-task compatibility runtime | Rejected | It would preserve obsolete semantics and require dual processes/codecs/projections |
