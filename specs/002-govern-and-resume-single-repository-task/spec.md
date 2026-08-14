# Feature Specification: Govern and Resume a Single-Repository Task

**Feature Branch**: `002-govern-and-resume-single-repository-task`

**Created**: 2026-08-14

**Status**: Ready for Review

**Input**: Build the host-independent Dev Flow Core that governs one existing Git repository through
one workflow and safely resumes the task after interruption.

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
   action identity and binding remain stable.

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
2. **Given** a payload with an unknown field, missing required evidence, stale action ID, changed
   repository binding, or stale revision, **When** it is submitted, **Then** the task remains
   unchanged.
3. **Given** verification or review identifies an accepted failure, **When** the corresponding
   action result is submitted, **Then** the Core returns to the permitted rework phase and records
   the reason.
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

1. **Given** an issued action bound to repository fingerprint A, **When** the repository changes to
   fingerprint B before apply, **Then** apply is rejected without changing task state.
2. **Given** a mutation commits but the caller loses the response, **When** the caller reads the
   task and next action, **Then** it can prove whether the action is already recorded.
3. **Given** an externally completed action with sufficient exact evidence but no recorded
   transition, **When** recovery is requested, **Then** the Core classifies it as
   `completed_but_unrecorded` rather than replaying it.
4. **Given** partial or conflicting evidence, **When** recovery is requested, **Then** the task is
   blocked with a concrete unblock condition.

## Edge Cases

- Repository path contains symlinks, spaces, Unicode, or case aliases.
- The repository is valid but has no commit yet.
- The repository is on a detached HEAD.
- The worktree is dirty before the task starts.
- The worktree changes only in untracked files.
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
- source code reading or diff storage;
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

### Functional Requirements

#### Task Contract

- **FR-001**: The Core MUST accept a task goal, scope, out-of-scope statements, acceptance criteria,
  verification budget, host identity, and repository path.
- **FR-002**: Goal and acceptance criteria MUST be non-empty and bounded.
- **FR-003**: Scope and out-of-scope collections MUST be closed arrays of bounded strings.
- **FR-004**: The verification budget MUST include level, maximum automatic command count,
  full-suite permission, and manual-handoff permission.
- **FR-005**: The Core MUST persist the normalized contract exactly and return it on every task read.
- **FR-006**: The contract MUST be immutable in this feature; changed requirements require
  cancellation and a new task.

#### Repository Identity and Claim

- **FR-007**: The Core MUST canonicalize the repository to one existing Git worktree root.
- **FR-008**: The Core MUST record current branch or detached status, HEAD or unborn status, and a
  SHA-256 worktree fingerprint derived from bounded read-only Git observations.
- **FR-009**: The Core MUST NOT read or persist source file contents or Git diffs.
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
- **FR-020**: Every mutation MUST require exact task ID, revision, action ID, action kind, and
  repository binding.
- **FR-021**: The Core MUST reject unknown action kinds, unknown payload fields, and missing
  evidence.
- **FR-022**: Each successful action apply MUST advance or terminate the task in one database
  transaction and increment revision exactly once.
- **FR-023**: Repeated reads MUST NOT increment revision or write events.
- **FR-024**: Terminal tasks MUST not produce a nonterminal next action.

#### Evidence and Verification Budget

- **FR-025**: Action contracts MUST specify required evidence fields and allowed effects.
- **FR-026**: Evidence MUST distinguish automated, user-performed, static, and host-observed
  sources.
- **FR-027**: The Core MUST validate the number of declared automatic verification commands against
  the task budget.
- **FR-028**: A full-suite result MUST be rejected when `allow_full_suite` is false.
- **FR-029**: A manual verification result MUST be rejected when manual handoff is not allowed.
- **FR-030**: Evidence values MUST have fixed per-field and total byte limits.
- **FR-031**: The Core MUST store evidence summaries and stable digests, not arbitrary command output
  or source content.
- **FR-032**: The final outcome MUST list completed acceptance criteria, automated checks, manual
  checks, unverified items, retained risks, and repository fingerprint.

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
  uncertain response.
- **FR-044**: Recovery classification MUST use the five values defined by the Constitution.
- **FR-045**: A caller MUST be able to determine from `get_task` and `get_next_action` whether a
  submitted action already committed.
- **FR-046**: The Core MUST NOT automatically replay an uncertain mutation.
- **FR-047**: Repository drift between action issuance and apply MUST return `REPOSITORY_DRIFT`.
- **FR-048**: Partial or conflicting recovery evidence MUST move or retain the task in `BLOCKED`
  with a concrete blocker.
- **FR-049**: A blocker resolution MUST use a fresh repository observation and exact blocker ID.
- **FR-050**: Recovery reads MUST not mutate the repository.

#### MCP and Results

- **FR-051**: The Core MUST expose exactly the six tools listed in
  `contracts/mcp-tools.md`.
- **FR-052**: The server MUST use local STDIO only and MUST not open a listening socket.
- **FR-053**: Tool input schemas MUST reject additional properties.
- **FR-054**: Every tool result MUST conform to one closed result envelope.
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
- **SC-007**: HEAD, branch, or worktree drift prevents action apply before state changes.
- **SC-008**: The Core exposes exactly six tools over STDIO and no network listener.
- **SC-009**: No Core command mutates Git or executes user-provided shell commands.
- **SC-010**: Contract tests validate the same public schemas that future Codex and DeepSeek
  adapters consume.
- **SC-011**: Typical local reads complete without writing an event or incrementing revision.
- **SC-012**: The implementation contains one authoritative task model, one result envelope, and
  one transition table, with no duplicate definitions in infrastructure packages.

## Assumptions

- Feature `001` has established the repository and toolchain.
- The feature reads the current root `VERSION`; changing that valid SemVer does not alter the Core contract or invalidate this feature.
- The first release evidence target is macOS arm64, but Core tests may run on Linux CI.
- The host passes an absolute or resolvable repository path.
- Git is installed for target development tasks.
- A dirty worktree is allowed if its exact fingerprint remains stable; Dev Flow does not clean it.
- Automated verification commands are executed by the host, not the Core.
- Task contract revision is intentionally deferred.
- Cross-host handoff is intentionally deferred.
