# Feature Specification: Recover Uncertain Actions and Repository Drift

**Feature Branch**: `005-recover-uncertain-actions-and-drift`

**Created**: 2026-08-14

**Status**: Planned — blocked by completed real-host evidence from `003` and `004`

**Input**: Harden the shared Core's recovery behavior using failures observed through both host
products, without adding another workflow or blindly replaying mutations.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Prove a committed action after its response is lost (Priority: P1)

As a host adapter, I can determine that an action already committed even when STDIO closed before
the response reached me, so I do not replay the mutation.

**Why this priority**: Duplicate state transitions and duplicate host side effects are the most
serious resumability failure.

**Independent Test**: Inject a deterministic failure after database commit and before response
write, reconnect, read task/next action, and prove the prior action's operation ID, payload digest,
from/to revisions, and resulting action.

**Acceptance Scenarios**:

1. **Given** a mutation committed and the response was lost, **When** the host reconnects and reads
   authority, **Then** recovery classifies it `completed_and_recorded` and forbids replay.
2. **Given** no commit occurred, **When** authority is reread, **Then** recovery classifies it
   `not_started` and permits retry only with the still-current exact action.
3. **Given** the action was submitted twice after one commit, **When** the duplicate arrives,
   **Then** it returns stable already-completed/stale evidence without a second event or revision.

---

### User Story 2 - Reconcile completed-but-unrecorded and partial host work (Priority: P2)

As a developer, I receive a precise recovery decision when repository work exists but the Core did
not commit the expected action result.

**Why this priority**: Repository edits are performed outside Core authority and may survive host
or process interruption.

**Independent Test**: Create exact expected repository evidence without applying the action, then
create partial and conflicting variants; verify the five recovery classes and blocker behavior.

**Acceptance Scenarios**:

1. **Given** the repository exactly matches bounded expected evidence for the current action but no
   event committed, **When** recovery runs, **Then** it reports `completed_but_unrecorded` and
   offers only a proof-bound record/adopt path.
2. **Given** only part of the expected evidence exists, **When** recovery runs, **Then** it reports
   `partially_completed`, enters or retains `BLOCKED`, and names a concrete resolution.
3. **Given** repository reality contradicts task identity or expected effects, **When** recovery
   runs, **Then** it reports `conflicting`, makes no state/repository change, and requires user
   direction.
4. **Given** evidence is insufficient to distinguish classes, **When** recovery runs, **Then** it
   chooses the more conservative class and does not infer success.

---

### User Story 3 - Stop and resume safely after repository drift (Priority: P3)

As a developer, I am protected when branch, HEAD, worktree state, canonical path, or repository
identity changes between action issue and apply/resume.

**Why this priority**: Persistent task state is not valid if it silently binds to different code.

**Independent Test**: Change each observed binding component between issue and apply, verify the
mutation is rejected, then restore or explicitly resolve the documented condition and resume the
same phase.

**Acceptance Scenarios**:

1. **Given** a current action bound to fingerprint A, **When** branch, HEAD, tracked status, or
   untracked status changes, **Then** apply fails before task mutation.
2. **Given** path aliases resolve to the same supported worktree, **When** recovery canonicalizes
   them, **Then** it does not create a second repository claim.
3. **Given** the repository was replaced, became unborn, disappeared, or points to another Git
   common directory, **When** recovery runs, **Then** it reports conflict and does not rebind the
   existing task.
4. **Given** an exact blocker resolution is observed, **When** the current `RESOLVE_BLOCKER` action
   is applied, **Then** the task returns only to its recorded resume phase with a new binding.

---

### User Story 4 - Preserve one recovery contract across both hosts (Priority: P4)

As the maintainer, I can verify that Codex and DeepSeek respond to identical Core recovery fixtures
without host-specific retry rules.

**Why this priority**: Parallel products must not fork recovery semantics.

**Independent Test**: Run every shared recovery fixture through both adapter contract suites and
verify equivalent Core calls and terminal/blocker handling.

**Acceptance Scenarios**:

1. **Given** the same uncertain mutation fixture, **When** each adapter handles it, **Then** both
   reread authority before retry and preserve the stable error/recovery code.
2. **Given** a blocked task, **When** each Skill reports it, **Then** neither invents a bypass or
   edits task data.
3. **Given** a public recovery contract changes, **When** CI runs, **Then** both adapter contract
   suites must be updated and pass before merge.

## Edge Cases

- Commit succeeds but event append appears to fail inside one transaction.
- SQLite returns busy/locked during reconnect.
- STDIO closes after result serialization starts.
- Host cancellation races with a committed mutation.
- The process dies before, during, or after each database transaction boundary.
- The repository changes and returns to the same visible HEAD but different worktree state.
- A case-insensitive path alias collides with an existing claim.
- An untracked file is renamed between observations.
- Manual evidence claims a command ran but has no accepted source classification.
- Two adapters reconnect to the same host-owned task simultaneously.
- A blocker resolution is submitted with a stale observation.
- Recovery diagnostics exceed result limits.

## Scope Boundaries

### In Scope

- deterministic failure injection at named Core boundaries;
- operation identity and committed read-back;
- the five recovery classifications;
- bounded expected-evidence adoption when provable;
- conservative blocking and concrete unblock conditions;
- repository binding drift matrix;
- concurrent reconnect/revision behavior;
- shared recovery fixtures;
- Codex and DeepSeek adapter parity tests;
- one real uncertain-response or closest controllable host journey per host when technically
  feasible, accurately labeled.

### Out of Scope

- automatic replay of mutations;
- automatic repository repair or rollback;
- Git mutation;
- state-file editing;
- cross-host takeover;
- a second recovery workflow;
- arbitrary history rollback;
- generic transaction journal exposed as public API;
- new MCP tools unless a separate Constitution amendment proves necessity;
- stress, load, fuzz, or exhaustive crash testing;
- platform expansion;
- installation/update recovery.

## Requirements *(mandatory)*

### Functional Requirements

#### Operation Identity and Read-Back

- **FR-001**: Every accepted mutation MUST retain a stable request/operation identity, action ID,
  payload digest, from revision, to revision, and committed event identity sufficient for read-back.
- **FR-002**: Failure injection MUST distinguish pre-transaction, pre-commit, post-commit,
  pre-serialization, and mid-response boundaries without changing production behavior when disabled.
- **FR-003**: A post-commit lost response MUST be provable through normal read tools; no private
  database inspection may be required by adapters.
- **FR-004**: A duplicate submission for an already committed action MUST NOT create another event,
  evidence record, revision, or repository observation.
- **FR-005**: A retry may be declared safe only when task, action, revision, payload identity, and
  repository binding still match the original request.

#### Five-Class Reconciliation

- **FR-006**: Recovery outputs MUST use exactly `not_started`, `completed_and_recorded`,
  `completed_but_unrecorded`, `partially_completed`, or `conflicting`.
- **FR-007**: Classification MUST be deterministic for the same task snapshot and repository
  observation.
- **FR-008**: `completed_but_unrecorded` MUST require exact bounded evidence defined by the current
  action; similarity or model judgment is insufficient.
- **FR-009**: Recording/adopting completed-but-unrecorded work MUST use the existing current action,
  expected revision, exact evidence digest, and fresh binding.
- **FR-010**: `partially_completed` and `conflicting` MUST produce or retain a blocker and MUST NOT
  advance the normal workflow.
- **FR-011**: Every blocker MUST include code, resume phase, observed binding, and one concrete
  required resolution.
- **FR-012**: `RESOLVE_BLOCKER` MUST return only to the blocker’s recorded resume phase after fresh
  observation proves the condition.

#### Repository Drift

- **FR-013**: Recovery MUST compare canonical root identity, Git common-directory identity, branch
  or detached state, HEAD/unborn state, tracked status digest, and bounded untracked status digest.
- **FR-014**: The Core MUST NOT bind an existing task to a replaced, different, or unsupported
  repository even when the filesystem path is unchanged.
- **FR-015**: An action apply MUST observe the repository after host work and before database
  mutation; a mismatch must fail atomically.
- **FR-016**: Returning to a previous visible HEAD MUST NOT erase intervening worktree drift unless
  the complete current binding equals the issued binding where equality is required.
- **FR-017**: Core recovery MUST remain read-only with respect to repository and filesystem content.

#### Adapter Parity and Evidence

- **FR-018**: Shared recovery fixtures MUST be the single contract source consumed by Codex and
  DeepSeek adapter tests.
- **FR-019**: Both Skills MUST reread task and next action on uncertain mutation and MUST NOT encode
  class-specific retry decisions beyond the Core result.
- **FR-020**: Public recovery error codes or fields may change only with fixture updates and both
  adapter suites passing.
- **FR-021**: Simulated failure injection MUST be labeled simulated and MUST NOT count as real-host
  transport evidence.
- **FR-022**: Real-host evidence MUST record what failure was actually induced, what was only
  approximated, and which boundary remains unverified.

### Key Entities

- **Operation Record**: Stable mutation identity visible through authoritative reads.
- **Recovery Assessment**: One of five classes plus supporting task/repository digests.
- **Expected Evidence Contract**: Closed proof required to adopt unrecorded host work.
- **Recovery Blocker**: Durable safe-stop with exact resume phase and unblock condition.
- **Failure Injection Point**: Test-only named boundary used to prove recovery semantics.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Every named failure boundary has one deterministic bounded test and no production
  behavior branch when injection is disabled.
- **SC-002**: A post-commit lost response produces exactly one revision and one task event.
- **SC-003**: All five recovery classes have independent end-to-end Core tests.
- **SC-004**: Every repository binding component can independently cause an apply safe-stop.
- **SC-005**: No recovery test executes a Git mutation or edits persistent state outside Core APIs.
- **SC-006**: Codex and DeepSeek contract suites produce equivalent Core interaction decisions for
  every shared fixture.
- **SC-007**: No new normal workflow phase, alternate state machine, or public tool is introduced.
- **SC-008**: The final evidence clearly separates simulated, fake-adapter, and real-host results.

## Assumptions

- Features `003` and `004` have produced actual host evidence and identified the failure boundaries
  worth hardening.
- Feature `002` already provides baseline restart, revision, drift, and read-before-retry behavior;
  this feature strengthens and proves it rather than replacing the workflow.
- The Core remains a local single-process-per-request STDIO application over one SQLite database.
