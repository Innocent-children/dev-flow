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
- Q: Where are JSON closure and dependency timing enforced? → A: Store codecs and future MCP
  inputs reject unknown fields; the MCP SDK is added only with the Phase 7 MCP implementation.
- Q: What is the Phase 1–2 and final validation boundary? → A: Phase 2 includes SQLite and the
  read-only Git observer; local work uses targeted checks, while final validation runs
  `pnpm run validate` once.

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
2. **Given** a mutation commits but the caller loses the response, **When** the caller reads the
   task and next action, **Then** it can prove whether the action is already recorded.
3. **Given** an externally completed action with sufficient exact evidence but no recorded
   transition, **When** recovery is requested, **Then** the Core classifies it as
   `completed_but_unrecorded` rather than replaying it.
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
  revision's binding.
- **FR-021**: The Store codec boundary and future MCP input boundary MUST reject unknown JSON fields;
  the typed Domain model MUST reject unknown action kinds and missing evidence without parsing
  arbitrary JSON or accepting undocumented aliases.
- **FR-022**: Each successful action apply MUST advance or terminate the task in one database
  transaction and increment revision exactly once.
- **FR-023**: `get_task` and `get_next_action` are read-only. Repeated reads MUST NOT increment
  revision, write events, change phase, create a blocker, or persist a repository binding. A read
  MAY freshly observe the repository and return a recovery classification, drift/conflict guidance,
  or proof that a mutation committed.
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

- **FR-043**: The Core MUST persist a bounded last-operation record sufficient to reconcile an
  uncertain response. Mutation kinds are closed to `open_task`, `apply_action`, and `cancel_task`;
  LastOperation and TaskEvent MUST be two projections of one committed fact:
  `operation_id == request_id`, kinds and optional action IDs are equal,
  `from_revision == expected_revision`, `to_revision == task.revision == event.revision`, payload
  digests are equal, and `committed_at == event.created_at`.
- **FR-044**: Recovery classification MUST use these observable definitions:
  `not_started` means neither the exact action nor its required external effects are recorded;
  `completed_and_recorded` means the exact action identity and payload digest are committed in the
  task/event revision; `completed_but_unrecorded` means current observation and exact evidence prove
  all required external effects but no corresponding task/event revision committed;
  `partially_completed` means only a proper subset of required effects/evidence is present; and
  `conflicting` means observed identity, effects, ownership, or evidence contradicts the issued
  action.
- **FR-045**: A caller MUST be able to determine from `get_task` and `get_next_action` whether a
  submitted action already committed.
- **FR-046**: The Core MUST NOT automatically replay an uncertain mutation.
- **FR-047**: Branch, HEAD, canonical repository identity, Git common-directory identity, an
  unauthorized phase's worktree change, or any non-worktree change during `IMPLEMENT_CHANGE` MUST
  return `REPOSITORY_DRIFT` without changing task state. The Core binds and reviews the fresh
  observation but does not claim process-level attribution for external edits.
- **FR-048**: Partial or conflicting recovery evidence MAY move or retain the task in `BLOCKED`
  only through an explicit apply-action transaction, with a concrete blocker. Ordinary reads MUST
  never create or persist `BLOCKED`.
- **FR-049**: A blocker resolution MUST use a fresh repository observation, the exact blocker ID,
  and the blocker's concrete acceptance condition; success may return only to the stored
  `resume_phase` and may accept a new binding only as that condition specifies.
- **FR-050**: Recovery reads MUST not mutate the repository.

#### MCP and Results

- **FR-051**: The Core MUST expose exactly the six tools listed in
  `contracts/mcp-tools.md`.
- **FR-052**: The server MUST use local STDIO only and MUST not open a listening socket.
- **FR-053**: Tool input schemas MUST reject additional properties.
- **FR-054**: Every tool result MUST conform to one closed result envelope. Any maximum valid Task
  projection, encoded with the same escaping rules, plus bounded envelope overhead MUST remain
  strictly below the result-envelope limit.
- **FR-055**: Domain failures MUST return stable error codes and bounded recovery guidance.
- **FR-056**: Unexpected failures MUST not expose stack traces, environment values, task contents,
  repository paths, or database paths.
- **FR-057**: Every request MUST have a request ID returned in success and error envelopes.
- **FR-058**: `dev_flow_server_info` MUST report product version, schema version, transport,
  supported hosts, database readiness, and tool list.
- **FR-059**: The Core MUST negotiate MCP wire compatibility through the official Go SDK rather
  than defining a custom transport protocol.
- **FR-060**: The Core MUST not execute user commands or tests.

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
- **RepositoryClaim**: Active uniqueness claim binding one canonical repository to one task.
- **Blocker**: Stable reason, observed conflict, resume phase, and unblock condition.
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
- **SC-006**: A lost response can be reconciled without replaying the mutation.
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
