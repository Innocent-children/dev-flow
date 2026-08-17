# Feature Specification: Recover Uncertain Actions and Repository Drift

**Feature Branch**: `005-recover-uncertain-actions-and-drift`  
**Created**: 2026-08-14  
**Revised**: 2026-08-17  
**Status**: Complete — T001–T040 and all final validation gates passed on 2026-08-17.
**Input**: Harden the existing Core recovery contract against lost mutation results, bounded
repository drift, and concurrent reconnects without waiting for Feature 004 or creating another
workflow.

## Route Decision

Feature 004 is deferred. Feature 005 therefore uses the completed Codex product as its only
host-product evidence source. This is allowed because Feature 005 MUST NOT change public Core
semantics. Existing DeepSeek-facing fixtures remain unchanged; no DeepSeek package, Harness profile,
Skill, or native journey is required.

A discovered need to change a public MCP input/result, stable error code, state transition,
repository claim rule, or persisted schema is outside this approved scope and requires an explicit
specification amendment before implementation continues.

## Boundary with Earlier Features

Feature 002 already owns:

- `OperationProbe` and Core-derived payload identity;
- `LastOperation` committed read-back;
- the ordered five-class `RecoveryAssessment`;
- explicit `recovery_apply` on the existing `dev_flow_apply_action`;
- read-only recovery reads;
- exact blocker creation and `restore_issuance_binding`;
- revision CAS and repository claims;
- the complete repository binding;
- restart persistence.

Feature 003 owns the Codex package, explicit Skill behavior, read-before-retry guidance, restart and
resume journey, and distinction between Core-domain and transport failures.

Feature 005 owns only the missing proof and bounded hardening around transaction/result-loss
boundaries, repository drift combinations, and concurrent reconnect behavior. Existing baseline
behavior that already passes the new tests remains unchanged.

## Implementation Reconciliation — 2026-08-17

T001–T033 passed as three independent checkpoints. User Story 1 covers lost results and
read-before-retry; User Story 2 covers all five existing classes, exact adoption, read-only
observations, stale sources, and blockers; User Story 3 covers binding components, aliases,
replacement, concurrent reconnects, and restart. The focused Codex static contract additionally
closes the exact retained apply identity and existing seven-member `operation_probe` for missing,
malformed, cancelled, truncated, and transport-failed results.

The implementation did not require a Core, Application, Recovery, Repository, Store, or MCP Go
production change. Requirements FR-001–FR-026 and SC-001–SC-009 remain unchanged: no implementation
finding required a public contract, stable-error, state-machine, recovery-class, repository-claim,
or persistence amendment. `packages/deepseek/` has zero diff.

The accepted evidence is deterministic and boundary-specific: test-local pre-commit failure,
post-commit discarded result, pre-serialization discard, bounded partial writer, SQLite
close/reopen, two-handle deterministic race, temporary Git fixture mutation, and Codex Skill static
contract. Root repository validation is a separate final gate. These labels do not claim a real
Codex crash, operating-system power loss, network interruption, DeepSeek execution, or release
artifact.

## User Scenarios & Testing

### User Story 1 — Prove a committed action after its response is lost (Priority: P1)

As a Codex adapter or any future thin host adapter, I can discard or lose an apply result, reconnect,
and determine from authoritative Core reads whether the action committed before deciding to retry.

**Why this priority**: Blindly replaying a committed mutation is the highest recovery risk.

**Independent Test**: Commit one real `ApplyAction` against a temporary SQLite database, discard the
returned result before the caller observes it, close all Core objects, reopen the database, and read
with the exact pre-dispatch `OperationProbe`. Assert one revision, one matching task event, one
`LastOperation`, and `completed_and_recorded`.

**Acceptance Scenarios**:

1. **Given** the action committed and the response was discarded or the response writer failed,
   **When** the caller reconnects and supplies the exact probe, **Then** Core reports
   `completed_and_recorded` and the caller does not replay the mutation.
2. **Given** failure occurred before the transaction committed, **When** the same current probe is
   read, **Then** Core reports `not_started`; retry is permitted only for the still-current action
   and expected revision.
3. **Given** an exact recovery apply repeats an already committed operation, **When** Core handles
   it, **Then** it returns stable committed read-back without a second revision, event, evidence
   record, claim write, or binding write.
4. **Given** a response is truncated after serialization begins, **When** the host lacks a complete
   valid result envelope, **Then** the Codex contract requires authoritative read-back rather than
   inferring success from partial bytes.

---

### User Story 2 — Reconcile exact, partial, and conflicting repository work (Priority: P2)

As a developer, I receive one conservative recovery decision when repository work exists but the
normal action result was not recorded by Core.

**Why this priority**: Host file edits can survive process failure even when Core has not advanced.

**Independent Test**: Starting from one current issued action, create exact expected evidence,
partial evidence, conflicting evidence, and insufficient evidence in isolated temporary
repositories. Read recovery, then use only the existing explicit recovery-apply path where allowed.

**Acceptance Scenarios**:

1. **Given** repository reality exactly satisfies the current action's closed expected-evidence
   contract and no action event committed, **When** recovery reads, **Then** it reports
   `completed_but_unrecorded`; an explicit proof-bound recovery apply records the result exactly
   once.
2. **Given** only part of the expected evidence exists, **When** recovery reads, **Then** it reports
   `partially_completed` without writing task, event, blocker, claim, or binding state.
3. **Given** repository identity or effects contradict the issued action, **When** recovery reads,
   **Then** it reports `conflicting`, performs no write, and never rebinds the task.
4. **Given** the available evidence cannot distinguish two classes, **When** Core classifies it,
   **Then** Core chooses the more conservative existing class and does not infer completion.
5. **Given** an exact current normal source is explicitly recovery-applied for a partial or
   conflicting observation, **When** Core accepts the request, **Then** it enters or retains the
   existing `BLOCKED` state with one closed resolution condition; a superseded source remains a
   zero-write conflict.

---

### User Story 3 — Stop safely on repository drift and concurrent reconnects (Priority: P3)

As a developer, the active task remains bound to the same repository reality while two callers,
process restarts, path aliases, or worktree changes occur.

**Why this priority**: A durable task must not silently attach to different code or accept two
competing actions.

**Independent Test**: Change each binding component independently, exercise canonical path aliases,
replace the repository at the same path, and submit the same operation through two Core handles.
Verify deterministic safe-stop, one winner where a commit is legal, and no Git mutation.

**Acceptance Scenarios**:

1. **Given** an action issued from binding A, **When** branch, detached state, HEAD/unborn state,
   tracked digest, untracked digest, canonical root, or Git common-directory identity violates the
   action's closed relation, **Then** apply fails before task mutation.
2. **Given** two supported path spellings resolve to the same worktree and Git common directory,
   **When** the task is reopened, **Then** Core reuses the same repository claim rather than
   creating a second claim.
3. **Given** the repository disappears, is replaced, becomes unsupported, or points at another Git
   common directory, **When** recovery reads, **Then** Core reports conflict and does not rebind the
   task.
4. **Given** two callers race the same action and expected revision, **When** both attempt apply,
   **Then** at most one commits; the other receives the existing stale/revision result and
   authoritative read-back proves the single committed operation.
5. **Given** the exact blocker restoration condition is later observed, **When** the current
   `RESOLVE_BLOCKER` action is applied, **Then** the task resumes only at its recorded phase with
   the structurally identical issuance binding.

## Edge Cases

- SQLite returns busy or locked while the caller reconnects.
- The process exits after commit but before result serialization.
- The response writer accepts only a prefix of the result.
- Host cancellation races with a committed mutation.
- A stale probe has the correct operation ID but wrong task, action, revision, or payload.
- Repository HEAD returns to the same commit while tracked or untracked state differs.
- A symlink or case-variant path resolves to the same supported worktree.
- The directory at the original path is replaced by another repository.
- Two Core handles share one SQLite database.
- A recovery read sees partial evidence, then repository reality changes before recovery apply.
- Recovery diagnostics approach existing result limits.
- A deterministic test helper accidentally becomes reachable from production code.

## Scope Boundaries

### In Scope

- deterministic lost-result tests at pre-commit, post-commit, pre-serialization, and partial-write
  boundaries;
- exact `OperationProbe` read-back after process/object restart;
- duplicate-write prevention for committed operations;
- bounded proof of all five existing recovery classes;
- exact completed-but-unrecorded adoption through the existing apply tool;
- partial/conflicting blocker behavior through the existing apply tool;
- repository binding component, path-alias, replacement, and concurrent-handle tests;
- focused Codex Skill/adapter contract proof that uncertain mutation output triggers read-back;
- minimal production corrections only when a new deterministic test exposes a real gap;
- documentation and shared fixture consistency.

### Out of Scope

- Feature 004 or any DeepSeek Harness implementation;
- a native DeepSeek journey or two-host publication;
- public MCP additions or schema changes;
- new stable error codes unless separately approved;
- a database migration;
- production fault-injection flags, environment variables, commands, or endpoints;
- automatic mutation replay;
- automatic repository repair, rollback, reset, clean, stash, commit, merge, rebase, or checkout;
- cross-host takeover or owner transfer;
- binding adoption to a different repository;
- stress, load, fuzz, or exhaustive crash testing;
- release provenance, signing, publication, or artifact distribution.
- Feature 006 implementation;
- npm publication, tags, or GitHub releases.

## Requirements

### Contract Preservation

- **FR-001**: Feature 005 MUST preserve Core Contract 0.1, exactly six public MCP tools, the existing
  result envelope, normal states, recovery classes, stable error vocabulary, and SQLite schema.
- **FR-002**: Feature 005 MUST NOT modify `packages/deepseek/` or require a DeepSeek Harness
  executable, profile, package, or journey.
- **FR-003**: Any discovered requirement for a public semantic or persisted-schema change MUST stop
  implementation until this specification and the Constitution parity impact are explicitly
  reviewed.
- **FR-004**: Test-only failure simulation MUST NOT be selectable through production CLI, MCP input,
  environment, persisted state, or package configuration.

### Lost Result and Operation Identity

- **FR-005**: A committed mutation MUST retain task ID, operation ID, action ID, Core-derived payload
  digest, from revision, to revision, commit time, and resulting task state in the existing
  `LastOperation` authority.
- **FR-006**: A caller MAY claim completion after an uncertain result only when an authoritative read
  with the exact probe reports `completed_and_recorded`.
- **FR-007**: A pre-commit failure MAY be retried only when a fresh read reports `not_started` and the
  original action and expected revision remain current.
- **FR-008**: A duplicate recovery submission for an already committed operation MUST produce zero
  additional revisions, events, evidence records, claim writes, or binding writes.
- **FR-009**: A missing, malformed, cancelled, truncated, or transport-failed mutation result MUST
  not be interpreted as success by the Codex adapter.
- **FR-010**: Busy/locked or temporary read failure MUST remain a read failure; it MUST NOT authorize
  replay.

### Five-Class Reconciliation

- **FR-011**: Recovery output MUST continue to use exactly `not_started`,
  `completed_and_recorded`, `completed_but_unrecorded`, `partially_completed`, or `conflicting`.
- **FR-012**: Classification MUST be deterministic for the same retained task and repository
  observation and MUST choose the more conservative class when evidence is insufficient.
- **FR-013**: `completed_but_unrecorded` MUST require exact bounded expected evidence owned by the
  current action; similarity, prose, or model judgment is insufficient.
- **FR-014**: Recovery reads for partial or conflicting observations MUST be read-only.
- **FR-015**: Only the existing explicit recovery apply MAY record completed-but-unrecorded work or
  create/retain the existing blocker, and it MUST re-observe the repository before writing.
- **FR-016**: Blocker resolution MUST restore only the recorded resume phase and exact issuance
  binding; adopting another repository or binding is prohibited.

### Drift and Concurrency

- **FR-017**: Recovery and apply MUST account for canonical root, Git common-directory identity,
  branch or detached state, HEAD or unborn state, tracked digest, and bounded untracked digest.
- **FR-018**: Returning to the same visible HEAD MUST NOT hide a different complete binding.
- **FR-019**: Canonical aliases of the same supported worktree MUST resolve to one repository claim.
- **FR-020**: Repository disappearance, replacement, or identity change MUST NOT rebind an existing
  task.
- **FR-021**: Concurrent apply attempts for one action/revision MUST result in at most one committed
  transition and one matching event.
- **FR-022**: Core recovery and all new tests MUST remain read-only with respect to Git operations;
  tests may create temporary repositories as fixtures but Core code may not mutate them.

### Evidence and Test Budget

- **FR-023**: Deterministic Core/Store/MCP/repository tests are sufficient evidence for this feature;
  no additional real-host run is required.
- **FR-024**: Fake, discarded-response, failing-writer, and subprocess evidence MUST be labeled by
  the boundary it actually proves and MUST NOT be called a real host crash.
- **FR-025**: The focused Codex contract test MUST prove read-before-retry without introducing
  adapter-owned recovery decisions.
- **FR-026**: Final validation MUST run targeted packages first and the root repository validation
  once at the feature checkpoint; exhaustive crash matrices, stress tests, and unrelated platform
  matrices are prohibited.

## Key Entities

- **Operation Probe**: Existing closed identity supplied by a caller to prove one uncertain
  mutation.
- **Last Operation**: Existing persisted latest-operation authority used for committed read-back.
- **Recovery Assessment**: Existing five-class read-only classification.
- **Repository Binding**: Existing complete identity and worktree observation attached to a task and
  action.
- **Recovery Blocker**: Existing durable safe-stop with one machine condition and resume phase.
- **Failure Scenario**: Test-only description of where a result is discarded or a dependency fails;
  it is never persisted or exposed publicly.

## Success Criteria

- **SC-001**: Post-commit result loss followed by restart produces exactly one task revision and one
  matching task event.
- **SC-002**: Pre-commit failure followed by authoritative read reports `not_started` without a
  committed event.
- **SC-003**: Repeating a committed recovery operation produces zero additional persistent writes.
- **SC-004**: All five existing recovery classes have deterministic independent tests.
- **SC-005**: Every repository binding component has at least one focused safe-stop test.
- **SC-006**: A two-handle race commits at most one transition.
- **SC-007**: No production fault switch, new public tool, new state, new recovery class, or database
  migration is introduced.
- **SC-008**: Codex uncertain-result contract tests require authoritative read-back, while
  `packages/deepseek/` remains unchanged.
- **SC-009**: The final root validation passes once after targeted checks and documentation
  reconciliation.

## Assumptions

- Feature 003 is merged before implementation and supplies the current Codex package and Skill.
- Core Contract 0.1 already contains the required public recovery model; Feature 005 is expected to
  be primarily test and boundary hardening.
- Local STDIO, process termination, cancellation, and partial writes form an accepted threat model
  even when the final Codex acceptance did not deliberately crash at every boundary.
- Initial implementation and evidence run on the repository's supported development environment;
  this feature makes no new platform-support claim.
