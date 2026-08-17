# Feature Specification: Govern and Resume a Single-Repository Task

**Feature Branch**: `002-govern-and-resume-single-repository-task`

**Created**: 2026-08-14

**Status**: Ready for Review

**Input**: Build the host-independent Dev Flow Core that governs one existing Git repository through
one workflow and safely resumes the task after interruption.

## Clarifications

### Session 2026-08-14

- Q: Which phase/action/result vocabulary is authoritative? → A: The closed mapping and result
  values in `contracts/state-machine.md`, including `PREPARE_HANDOFF` in both `REVIEW` and
  `HANDOFF`, are authoritative.
- Q: How may repository binding change during apply and read operations? → A: Only
  `IMPLEMENT_CHANGE` may accept a changed worktree fingerprint; reads never persist observations,
  and every other action requires the issuance binding to remain exact.
- Q: Are unborn repositories supported and what makes bounded input measurable? → A: Unborn Git
  repositories are supported, and every Core bound is defined by the single Core Limits 0.1 table.
- Q: Where are JSON closure and dependency timing enforced? → A: Store codecs and the MCP
  inputs reject unknown fields; the MCP SDK is added only with the Phase 7 MCP implementation.
- Q: What is the Phase 1–2 and final validation boundary? → A: Phase 2 includes SQLite and the
  read-only Git observer; local work uses targeted checks, while final validation runs
  `pnpm run validate` once.

### Session 2026-08-15

- Q: How is one uncertain apply identified without trusting a caller-supplied digest or
  classification? → A: A closed `OperationProbe` carries the original logical operation/action/source
  revision/source phase/issuance binding plus the original nullable payload; Core canonicalizes the
  payload and computes the operation digest itself.
- Q: Where is recovery assessment reported, and how is it distinguished from error retry guidance?
  → A: Only `GetTaskResult` and `NextActionResult` carry the transient typed
  `RecoveryAssessment`; ApplyAction returns its ordinary Task result, while the result-envelope
  `recovery` member remains error-only retry guidance and never carries a five-class assessment.
- Q: Which call may block an uncertain task, and what can later unblock it? → A: Only an explicit
  `recovery_apply` on the existing `ApplyAction` may create `BLOCKED`, and only for a current-source
  `partially_completed` or `conflicting` assessment; Feature 002 supports only the closed
  `restore_issuance_binding` condition and resolves it with the closed `ResolveBlockerPayload`.
- Q: Which component owns binding decisions and committed-operation proof? → A:
  `internal/recovery` is the sole structural comparison/reconciliation authority; Application
  invokes the Repository package's one digest self-consistency verifier before passing facts to it.
  Runtime proof uses latest LastOperation only, while TaskEvent remains same-transaction audit
  evidence verified by tests.
- Q: Where does Feature 002 baseline recovery stop? → A: It stops at deterministic Core-local
  probes, typed assessments, explicit recovery recording/blocking, exact-binding restoration, and
  bounded concurrency; real transport/crash matrices, expected-evidence adoption frameworks,
  host-specific/parity journeys, complex rebinding, takeover, and install/upgrade recovery remain
  Feature 005 work gated by Features 003 and 004 evidence.

### Session 2026-08-16

- Q: How does a host select the exact closed ApplyAction payload without copying the Core payload
  catalog? → A: The public ApplyAction schema discriminates one closed wire payload branch from
  `action_kind`. `PREPARE_HANDOFF` has one merged wire branch while the existing authoritative
  source-Phase read selects its sealed Go payload type. Required-evidence names are not payload
  field aliases, and host adapters retain no phase catalog.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Open a governed task and receive the next action (Priority: P1)

As an AI coding host, I can open a new task for the current Git repository and receive a closed,
stage-level action describing what the host may do and what evidence is required.

**Why this priority**: Without an authoritative task contract and next action, Dev Flow cannot
govern development.

**Independent Test**: In a temporary Git repository, call `dev_flow_open_task`, then
`dev_flow_get_next_action`, and verify the task contract, repository binding, revision, action ID,
allowed effects, required evidence, and verification budget.

**Acceptance Scenarios**:

1. **Given** a valid existing Git repository with no active Dev Flow task, **When** a host opens a
   substantive task, **Then** the Core creates one `INTAKE` task and returns its first
   `ASSESS_TASK` action.
2. **Given** a request with empty goal, invalid repository, unknown host, or malformed verification
   budget, **When** open is called, **Then** no task or repository claim is created.
3. **Given** a canonical repository already claimed by an active task, **When** another new task is
   requested, **Then** the Core returns a stable conflict and does not merge the requests.
4. **Given** a new task, **When** its next action is read repeatedly without mutation, **Then** the
   persisted action identity and issuance binding remain stable even if a fresh observation adds
   read-only recovery guidance.

---

### User Story 2 - Advance through one shared workflow (Priority: P2)

As an AI coding host, I can submit the result of the current action and receive the next legal
action until the task reaches a terminal outcome.

**Why this priority**: Governance must be enforceable rather than advisory.

**Independent Test**: Drive a task through `ASSESS`, `PLAN`, `IMPLEMENT`, `VERIFY`, `REVIEW`,
`HANDOFF`, and `DONE` using closed payloads and verify every illegal skip or stale submission is
rejected.

**Acceptance Scenarios**:

1. **Given** the current action and matching revision, **When** the host submits all required
   evidence, **Then** the Core atomically advances exactly one legal transition.
2. **Given** a payload with an unknown field, missing required evidence, stale action ID,
   unauthorized repository drift under FR-020, or stale revision, **When** it is submitted, **Then**
   the task remains unchanged.
3. **Given** `VERIFY_CHANGE`, `REVIEW_CHANGE`, or `PREPARE_HANDOFF` returns its defined `failed`,
   `rework_implementation`, or `replan` result, **When** the exact action is submitted, **Then** the
   Core returns to the state-machine contract's permitted phase and records a non-empty reason.
4. **Given** a task at `DONE` or `CANCELLED`, **When** any mutation other than an idempotent read is
   attempted, **Then** it is rejected as terminal.
5. **Given** a fresh nonterminal action, **When** a host prepares its apply request, **Then** the
   public tool schema exposes exactly one payload branch for that `action_kind`; a payload outside
   that closed branch is rejected without changing the task.

---

### User Story 3 - Resume after process or host restart (Priority: P3)

As a developer, I can close the host or Core process at any nonterminal phase, start it again, and
continue from the same authoritative task without recreating or guessing state.

**Why this priority**: Task recovery is a defining product responsibility.

**Independent Test**: Create and advance a task, terminate the process, reopen the same database,
call `dev_flow_open_task` from the same host and repository, and verify that it resumes the exact
task, revision, phase, current action, contract, and verification budget.

**Acceptance Scenarios**:

1. **Given** a compatible active task owned by the requesting host, **When** the same repository is
   opened after restart without a conflicting new goal, **Then** the existing task is resumed.
2. **Given** an active task owned by another host, **When** a host opens the repository, **Then** it
   receives an ownership conflict and cannot take over.
3. **Given** a corrupted or unsupported database schema, **When** the Core starts, **Then** it
   refuses mutation and reports a bounded diagnostic without deleting data.
4. **Given** a committed mutation, **When** the process restarts, **Then** the current task and event
   record agree on the committed revision.

---

### User Story 4 - Stop on repository drift or uncertain completion (Priority: P4)

As a developer, I am protected from silently continuing a task when the repository has changed or
the last mutation result is uncertain.

**Why this priority**: Resume is unsafe if persistent state is trusted without checking external
reality.

**Independent Test**: Change HEAD, branch, or worktree state after an action is issued; also simulate
a mutation commit whose response is lost. Verify read-before-retry behavior, drift errors, and
recovery classification.

**Acceptance Scenarios**:

1. **Given** an issued action bound to repository fingerprint A, **When** the repository changes in
   a way not permitted for that action by FR-020, **Then** apply is rejected without changing task
   state; an `IMPLEMENT_CHANGE`-only worktree change is instead accepted as the next binding.
2. **Given** a mutation commits but the caller loses the response, **When** the caller supplies the
   exact OperationProbe to either typed read, **Then** it can prove whether the action is already
   recorded; an ordinary read without a probe makes no such claim.
3. **Given** an externally completed action with sufficient exact evidence but no recorded
   transition, **When** a recovery read is requested, **Then** the Core classifies it as
   `completed_but_unrecorded` rather than replaying it, and only a following explicit recovery apply
   may record the already-complete payload.
4. **Given** partial or conflicting evidence, **When** an exact explicit recovery apply is
   submitted, **Then** one apply-action transaction blocks the task with a concrete unblock
   condition; a read reporting the same classification does not mutate it.

## Edge Cases

- Repository path contains symlinks, spaces, Unicode, or case aliases.
- The repository is valid but has no commit yet.
- The repository is on a detached HEAD.
- The worktree is dirty before the task starts.
- The worktree changes only in untracked files.
- A tracked or untracked path changes content again while its Git status and path stay unchanged.
- A submodule is dirty even though its recorded gitlink has not changed.
- Two Core processes open the same database.
- Two hosts race to open the same repository.
- An action result is submitted twice.
- The database transaction commits but STDIO closes before the response is delivered.
- The Core process exits between repository observation and database transaction.
- An active task is opened with a different goal.
- Evidence text exceeds configured size limits.
- A task is cancelled while another process holds a stale revision.
- The verification budget reaches its automatic command limit.
- A host reports a manual check as though it were automated evidence.
- A newer unsupported schema version is encountered.

## Scope Boundaries

### In Scope

- one local database;
- one existing Git repository per task;
- one active task per canonical repository;
- one normal state machine;
- six STDIO MCP tools;
- current task snapshots plus compact event history;
- revision and action binding;
- verification budget;
- read-only Git observation;
- restart resume;
- baseline recovery classification;
- origin-host ownership;
- terminal handoff summary.

### Out of Scope

- Codex or DeepSeek package files;
- user installation;
- task data import/export;
- multiple repositories;
- branch/worktree creation or switching;
- Git mutation;
- returning, persisting, or logging source content, or reading/storing Git diffs;
- OpenSpec/Spec Kit runtime use;
- arbitrary workflow configuration;
- cross-host handoff;
- HTTP/SSE/remote MCP;
- authentication;
- Web UI;
- background daemon;
- telemetry;
- automatic test execution;
- generic shell MCP;
- real Codex/DeepSeek transport loss, truncation, cancellation, or process-exit evidence;
- crash-point or transport-truncation matrices and failure-injection frameworks;
- generic expected-evidence adoption or host-specific recovery rules;
- recovery adapter-parity or real-host journeys;
- automatic repository repair or complex adoption of a new worktree binding;
- cross-host recovery takeover and installation/upgrade recovery;
- release publishing.

## Requirements *(mandatory)*

### Core Limits 0.1

This is the single authoritative numeric limit table for Core Contract 0.1. Limits are fixed Go
constants, are not user-configurable, and count UTF-8 bytes unless a row explicitly states an item
count or duration.

| Limit | Value |
|---|---:|
| Repository path | 4,096 bytes |
| Goal | 8,192 bytes |
| Scope | 64 items; 1,024 bytes per item |
| Out-of-scope | 64 items; 1,024 bytes per item |
| Acceptance criteria | 64 items; 2,048 bytes per item |
| Contract aggregate | 262,144 JSON-encoded bytes |
| Evidence submitted by one action | 32 items |
| Evidence name | 256 bytes |
| Evidence summary | 2,048 bytes per item |
| Evidence retained by one task | 256 items |
| Generic bounded string lists | 64 items |
| Blocker message, reason, guidance, outcome summary, or resolution text | 4,096 bytes per field |
| Outcome narrative aggregate | 131,072 JSON-encoded bytes |
| Identifier | 128 bytes |
| Action payload | 131,072 bytes total |
| Task aggregate | 786,432 JSON-encoded bytes |
| Result envelope bounded overhead | 131,072 JSON-encoded bytes |
| Result envelope | 1,048,576 bytes total |
| Persisted task snapshot | 1,048,576 bytes total |
| Worktree fingerprint paths | 1,024 paths per observation |
| Git command stdout and stderr | 1,048,576 bytes combined per command |
| Git command timeout | 10 seconds per command |
| SQLite busy timeout | 5 seconds |
| Automatic verification commands | 20 per task |

Text contract fields, evidence names and summaries, reasons, guidance, and outcome text are
normalized only with Unicode-preserving leading/trailing whitespace trimming. Lists preserve order;
an empty normalized required value or a normalized duplicate is rejected rather than corrected.
Identifiers, enum values, digests, action results, and JSON field names accept only their canonical
forms and are never trimmed or aliased. Repository paths are canonicalized only by the Repository
Observer rules in FR-007.

Every aggregate byte limit is measured on compact `encoding/json` output after normalization, with
HTML escaping disabled and the encoder's trailing newline excluded. JSON syntax and required string
escaping still count. Contract and Outcome aggregate checks run when those values are constructed;
the complete Task aggregate check is part of the final Task invariant. The 786,432-byte maximum
valid Task projection plus the 131,072-byte maximum result-envelope overhead is strictly below the
1,048,576-byte result limit. The Store's 1,048,576-byte snapshot check remains a defensive boundary,
not a way to reject a Domain-valid Task.

### Functional Requirements

#### Task Contract

- **FR-001**: The Core MUST accept a task goal, scope, out-of-scope statements, acceptance criteria,
  verification budget, host identity, and repository path.
- **FR-002**: Goal and acceptance criteria MUST be non-empty and remain within Core Limits 0.1.
- **FR-003**: Scope and out-of-scope collections MUST be closed arrays within Core Limits 0.1.
- **FR-004**: The verification budget MUST include level, maximum automatic command count,
  full-suite permission, and manual-handoff permission.
- **FR-005**: The Core MUST persist the normalized contract exactly and return it on every task read.
- **FR-006**: The contract MUST be immutable in this feature; changed requirements require
  cancellation and a new task.

#### Repository Identity and Claim

- **FR-007**: The Core MUST canonicalize the repository to one existing Git worktree root.
- **FR-008**: The Core MUST record current branch or detached status, HEAD or unborn status, and a
  content-sensitive SHA-256 worktree fingerprint derived from bounded read-only Git observations.
  It MUST parse porcelain-v2 `-z` records, reject observations above the fingerprint path limit,
  normalize record order, and include each affected path's status kind, path, available mode/index
  object identity, and current content digest or an explicit deleted/missing sentinel. A valid unborn
  repository is supported with `head = null`, `unborn = true`, and the branch recorded when Git
  reports one. `observed_at` is freshness metadata and is excluded from worktree and final binding
  digests.
- **FR-009**: Only paths identified as modified or untracked by the bounded Git status observation
  MAY be content-hashed, using a fixed read-only command equivalent to
  `git hash-object --no-filters -- <path>`, invoked with direct arguments through the bounded
  command context and never through a shell. The Core MUST NOT use `-w`, read Git diffs, retain raw
  status bytes or file bytes, or persist, return, log, or include source content in errors.
  `MaxFingerprintPaths` bounds the complete observation's affected-path set; every fixed Git
  subprocess in that observation uses the same per-command timeout and combined stdout/stderr limit
  from Core Limits 0.1. A disappearing or inconsistent path safely fails without unbounded retry.
- **FR-010**: One canonical repository root MUST have at most one active task.
- **FR-011**: Repository claim creation and task creation MUST occur in one transaction.
- **FR-012**: A terminal task MUST release its active repository claim in the same transaction as
  the terminal transition.
- **FR-013**: The Core MUST NOT execute a Git mutation command.

#### Workflow

- **FR-014**: The normal phases MUST be exactly `INTAKE`, `ASSESS`, `PLAN`, `IMPLEMENT`, `VERIFY`,
  `REVIEW`, `HANDOFF`, and `DONE`.
- **FR-015**: Exceptional phases MUST be exactly `BLOCKED` and `CANCELLED`.
- **FR-016**: A newly created task MUST start at `INTAKE`.
- **FR-017**: `dev_flow_get_next_action` MUST return one stable current action or a terminal result.
- **FR-018**: Normal forward transitions MUST follow the order defined in
  `contracts/state-machine.md`.
- **FR-019**: Rework transitions MUST be limited to the explicit paths defined in the state-machine
  contract and MUST record a non-empty reason.
- **FR-020**: Every action apply MUST carry the current action's exact task ID, revision, action ID,
  action kind, and issuance repository-binding digest. Before commit, the Core MUST freshly observe
  the repository. `ASSESS_TASK`, `PLAN_CHANGE`, `VERIFY_CHANGE`, `REVIEW_CHANGE`, and
  `PREPARE_HANDOFF` require an exact fresh binding match. `IMPLEMENT_CHANGE` may change only the
  worktree fingerprint; repository identity, Git common-directory identity, branch/detached state,
  and HEAD/unborn state MUST remain exact. An accepted implementation observation becomes the next
  revision's binding. Normal and recovery ApplyAction MUST use one comparison authority in
  `internal/recovery`; Application MUST NOT retain a second rule set. Before comparison, the one
  Repository digest verifier MUST recompute `repository_identity` from canonical root plus
  `git_common_dir_digest` and recompute `binding_digest` from all structured fields except
  `observed_at`. Application MUST invoke that verifier for every loaded persisted binding before a
  public result or decision, and for every fresh observer result before comparison. This validation
  is not a second acceptance rule. A syntactically valid SHA-256 string alone is insufficient. The
  raw common-directory path remains private and its digest is independently recalculated only by a
  fresh observation.
- **FR-021**: The Store codec boundary and MCP input boundary MUST reject unknown JSON fields;
  the typed Domain model MUST reject unknown action kinds and missing evidence without parsing
  arbitrary JSON or accepting undocumented aliases.
- **FR-022**: Each ApplyAction that commits a task mutation MUST advance, block, resolve, or
  terminate the task in one database transaction and increment revision exactly once. A recovery
  read-back for `completed_and_recorded` or no-write `not_started` assessment is not a committed
  mutation and MUST NOT increment revision.
- **FR-023**: `get_task` and `get_next_action` are read-only. Repeated reads MUST NOT increment
  revision, write events, change phase, create a blocker, or persist a repository binding. A read
  with an OperationProbe MUST freshly observe the repository and may return a recovery
  classification, drift/conflict guidance, or proof that a mutation committed; a read without a
  probe does not observe and returns a null assessment.
- **FR-024**: Terminal tasks MUST not produce a nonterminal next action.

#### Evidence and Verification Budget

- **FR-025**: Action contracts MUST specify required evidence fields and allowed effects. The
  `HANDOFF` phase's `PREPARE_HANDOFF` action MUST allow both `read_repository` and
  `prepare_delivery_summary`, because its required result includes a repository observation.
- **FR-026**: Evidence MUST distinguish automated, user-performed, static, and host-observed
  sources.
- **FR-027**: `Task.Evidence` MUST be the sole retained evidence authority. Verification command
  count and permissions MUST be evaluated once over that collection, never over copied outcome
  evidence.
- **FR-028**: A full-suite result MUST be rejected when `allow_full_suite` is false.
- **FR-029**: A manual verification result MUST be rejected when manual handoff is not allowed.
- **FR-030**: Evidence values MUST have fixed per-field and total byte limits.
- **FR-031**: The Core MUST store evidence summaries and stable digests, not arbitrary command output
  or source content.
- **FR-032**: The final outcome MUST list completed acceptance criteria, automated evidence IDs,
  manual evidence IDs, unverified items, retained risks, and repository fingerprint. Evidence IDs
  MUST be canonical, unique within and across both lists, exist in `Task.Evidence`, and reference
  `automated` and `user` sources respectively. The Outcome MUST NOT copy or create EvidenceSummary
  values and its narrative MUST stay within its encoded aggregate limit.

#### Persistence and Concurrency

- **FR-033**: The Core MUST use one SQLite database.
- **FR-034**: SQLite access MUST use a CGo-free driver.
- **FR-035**: The database MUST contain `tasks`, `task_events`, `repository_claims`, and
  `schema_migrations`.
- **FR-036**: `tasks` MUST be the current-state authority; events MUST not be replayed to construct
  ordinary reads.
- **FR-037**: Every task mutation MUST use optimistic revision comparison.
- **FR-038**: A stale revision MUST return `REVISION_CONFLICT` without partial writes.
- **FR-039**: A stale action identity MUST return `ACTION_STALE` without partial writes.
- **FR-040**: Database initialization and migration MUST be transactional and idempotent.
- **FR-041**: An unsupported future schema MUST be opened read-only or rejected; it MUST never be
  downgraded automatically.
- **FR-042**: Two processes racing on the same task or repository MUST produce one committed winner
  and one stable conflict.

#### Recovery

- **FR-043**: The Core MUST persist a bounded LastOperation record sufficient to prove only the
  latest committed mutation. Mutation kinds are closed to `open_task`, `apply_action`, and
  `cancel_task`; LastOperation and TaskEvent MUST be two projections of one committed fact:
  `operation_id == request_id`, kinds and optional action IDs are equal,
  `from_revision == expected_revision`, `to_revision == task.revision == event.revision`, payload
  digests are equal, and `committed_at == event.created_at`. Runtime recovery MUST use Task,
  CurrentAction, LastOperation, a caller-supplied `OperationProbe`, and a fresh RepositoryBinding;
  it MUST NOT read or replay TaskEvent. `OperationProbe` is closed to the original apply-action
  `operation_id` (the original ApplyAction request ID), `source_phase`, `expected_revision`, `action_id`, `action_kind`,
  `repository_binding_digest`, and nullable original `payload`; host and task ID come from the
  enclosing read/apply request. The caller MUST choose and retain the original normal
  `ApplyAction.request_id` before dispatch, so the probe identity does not depend on receiving the
  lost response. It accepts no payload digest, classification, blocker, resume/next
  phase, or replacement binding. Core MUST validate a non-null payload against the exact source
  phase/action and compute the operation payload digest itself with the normal apply
  canonicalization; JSON `null` is the canonical no-evidence payload for assessment and explicit
  recovery-apply classification only.
- **FR-044**: Recovery classification MUST follow the ordered decision table in
  `contracts/state-machine.md` and use exactly `not_started`, `completed_and_recorded`,
  `completed_but_unrecorded`, `partially_completed`, or `conflicting`. Exact LastOperation proof has
  first priority. A latest LastOperation that shares the probe operation ID or action ID but differs
  in any remaining kind/action/revision/Core-derived-digest/commit tuple field is a contradictory
  committed relation and therefore `conflicting`. Otherwise, a superseded source revision/action
  is `conflicting`; an action-forbidden binding relation (including worktree-only change outside
  `IMPLEMENT_CHANGE`) or payload/observation contradiction is `conflicting`; an
  `IMPLEMENT_CHANGE` worktree-only effect with no payload is `partially_completed`; a complete
  valid payload whose repository facts match its closed effect contract is
  `completed_but_unrecorded`; and a still-current exact action with null payload and exact binding
  is `not_started`. Invalid probe/payload syntax, observer failure, or digest self-inconsistency is
  an error before classification, never a caller-selected class. A self-inconsistent persisted
  binding is corrupt stored state and returns `STORAGE_UNAVAILABLE`; a self-inconsistent fresh
  observer result is a Core defect and returns `INTERNAL_ERROR`; neither returns an assessment or
  writes state.
- **FR-045**: `get_task` MUST return a typed `GetTaskResult`, and `get_next_action` MUST return a
  typed `NextActionResult`. Both accept an optional `OperationProbe` and expose a nullable
  `recovery_assessment`. With no probe they return the persisted projection without repository
  observation and the assessment is null. With a probe they freshly observe the stored canonical
  root and return the one transient `RecoveryAssessment` defined in `data-model.md`; it MUST never
  enter Task, SQLite, TaskEvent, or LastOperation, increment revision, create a blocker, or become a
  second authority. A `BLOCKED` read also returns the persisted Blocker/condition, and a terminal
  task with a probe is still observed so a lost terminal apply can be proved.
- **FR-046**: The existing ApplyAction request MUST have one optional, closed
  `recovery_apply: {operation_id, source_phase}` discriminator. When absent, all current normal-apply
  semantics remain unchanged and payload is required. When present, `operation_id` MUST be the
  original uncertain ApplyAction request ID; it combines with the enclosing host/task/action/
  revision/issuance-binding/payload fields to form the `OperationProbe`, while the recovery call's
  own request ID remains only its response correlation. Payload may be null. The discriminator is
  not a seventh tool, OperationKind, state, workflow, or caller-supplied
  decision. Core MUST assess before stale/CAS handling: `completed_and_recorded` returns committed
  read-back without a write; `not_started` returns the unchanged Task without a write (retry safety
  remains a read-assessment fact); `completed_but_unrecorded` records the already-complete closed payload
  through the normal transition code; and current-source `partially_completed` or `conflicting`
  commits `BLOCKED`. A superseded source that lacks exact LastOperation proof returns the existing
  revision/action conflict with zero writes. Blind replay is prohibited.
- **FR-047**: A normal ApplyAction with no `recovery_apply` MUST return `REPOSITORY_DRIFT` with no
  revision, event, task, evidence, blocker, binding, or claim change when branch, HEAD,
  repository/common-directory identity, an unauthorized phase's worktree, or any other forbidden
  binding component changes. `IMPLEMENT_CHANGE` alone may accept a worktree-only change. A read may
  report `conflicting`, but only explicit recovery apply may turn that uncertainty into a durable
  blocker. The Core makes no process-level attribution for external edits.
- **FR-048**: `BLOCKED` creation has one legal entry: an explicit recovery ApplyAction whose source
  task still has the exact probed revision/action and whose Core-derived class is
  `partially_completed` or `conflicting`. In that one `OperationApplyAction`/`ClaimRetain`
  transaction Core generates the blocker ID and new `RESOLVE_BLOCKER` action ID, stores the source
  phase as `resume_phase`, retains the authoritative issuance RepositoryBinding, records only the
  fresh observed binding digest as a non-authoritative fact, increments revision exactly once, and
  writes one matching LastOperation/TaskEvent. It does not add incomplete incoming evidence.
  Callers cannot submit the blocker, class, resume/next phase, or authoritative binding. Any
  construction or commit failure leaves task/event/claim/evidence unchanged.
- **FR-049**: Feature 002 MUST support exactly one machine-verifiable blocker condition,
  `restore_issuance_binding`, parameterized by the retained issuance binding digest. It requires a
  fresh structured binding to equal the retained Task.Repository in every digest-bearing field;
  canonical root/repository identity, Git common-directory identity, branch/detached, HEAD/unborn,
  and worktree state cannot be rebound. `ObservedBindingDigest` records block-time reality only.
  `RequiredResolution` remains bounded human text and MUST NOT be parsed. The closed
  `ResolveBlockerPayload` in `contracts/state-machine.md` MUST echo the exact blocker and condition,
  bind a caller-observed digest, and provide one bounded summary. Core freshly observes and compares
  it; success uses existing ApplyAction/`OperationApplyAction`, increments once, appends one event
  and one `blocker_resolution` host-observed evidence summary, retains the claim and all historical
  evidence, clears blocker/resume state, returns only to the stored phase with a fresh normal action
  ID, and adopts only the structurally identical fresh observation. No separate Application method
  or MCP tool is permitted. For an operation/evidence-only conflict the restore condition may
  already be true at block time, but Core MUST still require the explicit resolution action and
  MUST NOT auto-clear the blocker on read.
- **FR-050**: Recovery reads and applies MUST remain read-only with respect to Git. A read with a
  probe observes every phase, including `BLOCKED`, `DONE`, and `CANCELLED`; observer failure returns
  an existing bounded error and no fabricated unavailable assessment. For unchanged task/probe and
  structurally unchanged repository, all assessment fields except fresh `observed_at` are stable.
  Reads never persist that timestamp or any observed binding.

#### MCP and Results

- **FR-051**: The Core MUST expose exactly the six tools listed in
  `contracts/mcp-tools.md`.
- **FR-052**: The server MUST use local STDIO only and MUST not open a listening socket.
- **FR-053**: Tool input schemas MUST reject additional properties.
- **FR-054**: Every tool result MUST conform to one closed result envelope. Any maximum valid Task
  projection, encoded with the same escaping rules, plus bounded envelope overhead MUST remain
  strictly below the result-envelope limit. Five-class `recovery_assessment` is a member of typed
  read-success results only; ApplyAction uses its ordinary result shape, and the top-level
  error-only `recovery` object remains retry guidance with
  `retry_safe`, `action`, and `message`. The two names and models MUST NOT be interchanged.
- **FR-055**: Domain failures MUST return stable error codes and bounded recovery guidance.
- **FR-056**: Unexpected failures MUST not expose stack traces, environment values, task contents,
  repository paths, or database paths.
- **FR-057**: Every request MUST have a request ID returned in success and error envelopes.
- **FR-058**: `dev_flow_server_info` MUST report product version, schema version, transport,
  supported hosts, database readiness, and tool list.
- **FR-059**: The Core MUST negotiate MCP wire compatibility through the official Go SDK rather
  than defining a custom transport protocol.
- **FR-060**: The Core MUST not execute user commands or tests.
- **FR-074**: The public `dev_flow_apply_action` input schema MUST use `action_kind` to select
  exactly one closed wire payload branch. `PREPARE_HANDOFF` MUST use one merged wire branch covering
  its existing REVIEW/HANDOFF result vocabulary while the Core's existing source-Phase read remains
  authoritative for the sealed Go type. The schema MUST retain recovery `null` payload support and
  MUST NOT add a state, transition table, persisted schema copy, or host-owned payload catalog.

#### Host Ownership and Cancellation

- **FR-061**: Every task MUST record `origin_host` as `codex` or `deepseek`.
- **FR-062**: A host may resume and mutate only tasks it owns.
- **FR-063**: Another host encountering an active task MUST receive
  `HOST_OWNERSHIP_CONFLICT`.
- **FR-064**: Automatic ownership transfer is prohibited.
- **FR-065**: Cancellation MUST require task ID, current revision, host identity, and a bounded
  reason.
- **FR-066**: Cancellation MUST create a terminal outcome, release the repository claim, and retain
  task history.
- **FR-067**: Cancellation MUST NOT delete the database, evidence, or repository content.

#### Foundational Audit Hardening

- **FR-068**: A normalized Contract MUST satisfy both its per-field limits and the encoded Contract
  aggregate limit before it can be constructed.
- **FR-069**: A dirty submodule MUST fail closed with the stable repository-layer
  `ErrDirtySubmodule` sentinel, which MUST also match the general `ErrGitObservation` category. The
  Core MUST NOT recurse into it, treat its ambiguous dirty flag as a complete content fingerprint,
  or modify it.
- **FR-070**: `DONE` and `CANCELLED` MUST return `TASK_TERMINAL`; an invalid or unknown phase MUST
  return `INVALID_ARGUMENT`. A valid nonterminal phase missing from the closed mapping is an internal
  invariant failure and MUST NOT be presented as terminal.
- **FR-071**: `ACTIVE_TASK_CONFLICT` MUST be returned only for the repository-identity primary-key
  or claimed-task-ID unique constraint. The Store MUST identify those exact keys with fixed
  conflict-target/`RETURNING` SQL plus a fixed repository-key existence confirmation when no row is
  returned, or a fixed task-key existence query after `errors.As` confirms a structured SQLite
  uniqueness code; neither `sql.ErrNoRows` nor the driver code alone is a constraint identity.
  Foreign-key, check, trigger, ignored insert, locked, I/O, schema, and other SQLite execution
  failures MUST return bounded `STORAGE_UNAVAILABLE`. SQL error text MUST NOT be parsed or exposed.
- **FR-072**: `open_task` requires expected revision 0, claim acquire, and no action ID;
  `apply_action` requires a positive expected revision and an action ID, retaining the claim unless
  it reaches `DONE`; `cancel_task` requires a positive expected revision, no action ID, claim
  release, and `CANCELLED`. Optional action IDs MUST not use an empty string sentinel.
- **FR-073**: Final Task validation MUST enforce the encoded Task aggregate limit before a Store
  transaction begins. Every Domain-valid Task MUST fit the persisted snapshot boundary; the Store
  MUST retain its snapshot limit as a defensive check rather than accept an unencodable aggregate.

### Key Entities *(include if feature involves data)*

- **Task**: Current authoritative snapshot of a governed development request.
- **Contract**: Immutable goal, scope, exclusions, acceptance criteria, and verification budget.
- **RepositoryBinding**: Canonical root, branch/detached state, HEAD/unborn state, and worktree
  fingerprint.
- **Action**: Current stage-level instruction with stable identity, closed payload contract,
  allowed effects, required evidence, and repository binding.
- **EvidenceSummary**: Bounded description, source class, outcome, and digest for an action result.
- **LastOperation**: Identity and commit status used to reconcile uncertain responses.
- **TaskEvent**: Compact append-only audit record for a committed task revision.
- **OperationProbe**: Transient caller echo of one exact uncertain apply; Core derives its digest and
  never persists the probe itself.
- **RecoveryAssessment**: Transient typed five-class read result with operation proof,
  binding/evidence facts, retry safety, next advice, and optional unblock condition.
- **RepositoryClaim**: Active uniqueness claim binding one canonical repository to one task.
- **Blocker**: Stable Core-derived reason, observed conflict, resume phase, and one closed
  `restore_issuance_binding` condition.
- **Outcome**: Terminal Delivery Summary for `DONE` or `CANCELLED`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A temporary-repository journey can create, advance, restart, resume, and complete one
  task without manual database edits.
- **SC-002**: Every legal normal transition and every defined rework transition has a deterministic
  test.
- **SC-003**: All illegal skips, stale revisions, stale actions, unknown fields, and missing
  evidence leave the task byte-for-byte logically unchanged.
- **SC-004**: In a race to claim one repository, exactly one task becomes active.
- **SC-005**: A committed mutation remains visible after immediate process termination and database
  reopen.
- **SC-006**: A lost response can be reconciled through an exact OperationProbe and the canonical
  ordered five-class decision table without replaying the mutation or reading TaskEvent at runtime.
- **SC-007**: HEAD, branch, repository-identity, or unauthorized worktree drift prevents action
  apply before state changes, while an implementation-only worktree change can become the next
  binding without permitting any other binding component to change.
- **SC-008**: The Core exposes exactly six tools over STDIO and no network listener.
- **SC-009**: No Core command mutates Git or executes user-provided shell commands.
- **SC-010**: Contract tests validate the same public schemas that future Codex and DeepSeek
  adapters consume.
- **SC-011**: Typical local reads complete without writing an event or incrementing revision.
- **SC-012**: The implementation contains one authoritative task model, one result envelope, and
  one transition table, with no duplicate definitions in infrastructure packages.
- **SC-013**: Changing the bytes of an already-dirty tracked or untracked path changes the worktree
  fingerprint even when its path and Git status do not; equivalent status records in another order
  produce the same fingerprint, and dirty submodules fail closed.
- **SC-014**: Every Domain-valid maximum Contract and Task can be encoded and persisted, and the
  maximum valid Task projection plus bounded envelope overhead fits the result envelope.
- **SC-015**: Outcome evidence cannot exceed verification policy by copying evidence, and every
  committed Task mutation has exactly matching LastOperation and TaskEvent projections.
- **SC-016**: Normal drift produces a zero-write `REPOSITORY_DRIFT`; only an explicit recovery apply
  can create `BLOCKED`, and exact issuance-binding restoration resolves it through the existing
  ApplyAction with one revision/event and no Git mutation.
- **SC-017**: One public contract test proves that every public `action_kind` maps to exactly one
  closed wire payload schema branch and that `PREPARE_HANDOFF` uses the one merged branch.

## Assumptions

- Feature `001` has established the repository and toolchain.
- The feature reads the current root `VERSION`; changing that valid SemVer does not alter the Core contract or invalidate this feature.
- The first release evidence target is macOS arm64, but Core tests may run on Linux CI.
- The host passes an absolute or resolvable repository path.
- Git is installed for target development tasks.
- A dirty worktree is allowed and initially bound. It must remain exact except for the worktree-only
  change accepted from `IMPLEMENT_CHANGE`; Dev Flow does not clean it.
- Automated verification commands are executed by the host, not the Core.
- Task contract revision is intentionally deferred.
- Cross-host handoff is intentionally deferred.
