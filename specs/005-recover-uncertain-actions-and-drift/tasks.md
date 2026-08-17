# Tasks: Recover Uncertain Actions and Repository Drift

**Input**: [spec.md](./spec.md), [plan.md](./plan.md), [research.md](./research.md),
[data-model.md](./data-model.md), [quickstart.md](./quickstart.md), and `contracts/`.

**Entry gate**: Feature 003 is merged to `main`; Feature 004 is deferred and is not a dependency.

**Status**: `FEATURE_005_COMPLETE`

## Phase 1 — Setup and baseline

- [x] T001 Record the exact Feature 003 merge commit, root version, Core fixture digest, and baseline targeted results in `specs/005-recover-uncertain-actions-and-drift/research.md`.
- [x] T002 Confirm the writable scope excludes `packages/deepseek/` and record the implementation path inventory in `specs/005-recover-uncertain-actions-and-drift/plan.md`.
- [x] T003 Run the existing recovery, Store, repository, MCP, journey, contract, and Codex Skill baselines and record only command/result summaries in `specs/005-recover-uncertain-actions-and-drift/README.md`.
- [x] T004 [P] Add a Feature 005 public-surface guard covering six tools, existing schemas, state vocabulary, recovery classes, and SQLite schema in `tests/contract/mcp_contract_test.go` and `tests/contract/fixture_contract_test.go`.

## Phase 2 — Foundational test support

- [x] T005 Add test-local operation/repository assertion helpers in `tests/journeys/recovery_test_helpers_test.go` without exporting production fault controls.
- [x] T006 [P] Add a test-local pre-commit Store wrapper in `internal/application/recovery_test_support_test.go` that cannot be referenced by non-test builds.
- [x] T007 [P] Add a bounded failing response writer in `internal/mcp/recovery_test_support_test.go` that accepts a configured prefix and returns a deterministic error.
- [x] T008 [P] Extend test cleanup and no-Git-mutation assertions in `tests/journeys/README.md` and the new Feature 005 journey helpers.

## Phase 3 — User Story 1: Prove committed work after result loss

**Independent checkpoint**: A real SQLite mutation commits once, its result is discarded, all
objects reopen, and the exact probe reports `completed_and_recorded`; pre-commit failure reports
`not_started`, partial output is not success, and duplicate recovery writes nothing.

- [x] T009 [US1] Add the post-commit discarded-result close/reopen journey in `tests/journeys/recovery_uncertainty_test.go` and assert one revision, event, claim outcome, and matching LastOperation.
- [x] T010 [P] [US1] Add exact OperationProbe read-back assertions after reopen in `internal/application/get_task_test.go` and `internal/application/next_action_test.go`.
- [x] T011 [P] [US1] Add a pre-commit failure case with zero persistent writes and `not_started` read-back in `internal/application/apply_action_test.go`.
- [x] T012 [P] [US1] Add a pre-serialization committed-result discard case in `internal/mcp/server_test.go` without introducing a production hook.
- [x] T013 [US1] Add partial-response writer failure coverage proving no complete caller result and mandatory read-back in `internal/mcp/server_test.go`.
- [x] T014 [US1] Add duplicate committed recovery submission assertions for revision, event, evidence, claim, and binding cardinality in `internal/application/apply_action_test.go` and `internal/store/sqlite_test.go`.
- [x] T015 [P] [US1] Add SQLite busy/locked reconnect coverage that remains a read failure and never authorizes replay in `internal/store/concurrency_test.go`.
- [x] T016 [US1] Verify and minimally correct only test-proven operation sequencing/idempotency gaps in `internal/application/apply_action.go`, `internal/application/get_task.go`, and `internal/store/sqlite.go`; leave production files unchanged when all new cases already pass. New deterministic cases pass without production changes.
- [x] T017 [US1] Run the User Story 1 targeted packages and record the checkpoint result in `specs/005-recover-uncertain-actions-and-drift/tasks.md`.

### User Story 1 Checkpoint Evidence — 2026-08-17

- Targeted commands: `go test ./internal/application`, `go test ./internal/store`,
  `go test ./internal/mcp`, `go test ./tests/journeys`, and `go test ./tests/contract`.
- Result: PASS, 5/5 targeted packages.
- Production code: unchanged; all deterministic User Story 1 tests pass against the existing
  operation sequencing and idempotency implementation.
- `post_commit_discard`: one real SQLite apply advanced the task by one revision, appended one
  matching action event, retained one claim, and reopened as `completed_and_recorded`.
- `pre_commit`: the test-local Store boundary attempted one commit without delegating it; revision,
  event count, snapshot, claim, and binding stayed unchanged and exact read-back was `not_started`.
- `pre_serialization`: the application committed before any MCP result encoding, and the existing
  MCP read tool proved the operation without a second mutation.
- `partial_write`: the writer accepted exactly 37 bytes, returned its deterministic error, and the
  invalid JSON prefix was rejected before authoritative read-back.
- Duplicate submission: revision, event, evidence, claim, and repository binding cardinality stayed
  identical to the first committed result.
- SQLite locked reconnect: the bounded locked read returned `STORAGE_UNAVAILABLE`, not
  `not_started` or `TASK_NOT_FOUND`; the same task read succeeded after the lock was released.
- At this User Story 1 checkpoint, T018–T040 remained unstarted and unchecked.

## Phase 4 — User Story 2: Reconcile exact, partial, and conflicting work

**Independent checkpoint**: All five existing classes are deterministic; exact unrecorded work is
recorded only by explicit recovery apply; partial/conflicting reads write nothing; stale sources
cannot mutate.

- [x] T018 [P] [US2] Complete independent five-class table coverage in `internal/recovery/classify_test.go`, including insufficient-evidence conservative ordering.
- [x] T019 [US2] Add exact completed-but-unrecorded adoption with one explicit recovery apply and one event in `internal/recovery/reconcile_test.go` and `internal/application/apply_action_test.go`.
- [x] T020 [P] [US2] Add partial and conflicting read-only cardinality assertions in `internal/recovery/reconcile_test.go` and `internal/store/sqlite_test.go`.
- [x] T021 [P] [US2] Add stale/superseded recovery-source zero-write cases in `internal/application/apply_action_test.go`.
- [x] T022 [US2] Add exact blocker entry, retention, and restore-issuance-binding resolution cases in `internal/recovery/reconcile_test.go` and `internal/application/apply_action_test.go`.
- [x] T023 [US2] Add a repository-change-between-read-and-recovery-apply case proving fresh observation before write in `internal/application/apply_action_test.go`.
- [x] T024 [US2] Verify and minimally correct only test-proven classification/reconciliation gaps in `internal/recovery/classify.go` and `internal/recovery/reconcile.go` without adding a class or public field. All new deterministic tests pass without production changes.
- [x] T025 [US2] Run the User Story 2 targeted packages and record the checkpoint result in `specs/005-recover-uncertain-actions-and-drift/tasks.md`.

### User Story 2 Checkpoint Evidence — 2026-08-17

- Current baseline: `go test ./internal/recovery`, `go test ./internal/application`, and
  `go test ./internal/store` passed before User Story 2 edits.
- Final checkpoint: `go test ./internal/recovery`, `go test ./internal/application`,
  `go test ./internal/store`, and `go test ./tests/contract` passed, 4/4 packages.
- Five-class proof: the ordered classifier independently covers `completed_and_recorded`,
  `conflicting`, `partially_completed`, `completed_but_unrecorded`, and `not_started`, including
  exact identity/digest projection, directives, advice, retry safety, proof, and conditions.
- Conservative precedence: exact committed proof wins first; contradictory LastOperation,
  contradictory evidence, forbidden repository facts, and stale sources cannot fall through to a
  completion or retry classification; worktree change without retained evidence remains partial.
- Exact adoption: a real SQLite-backed recovery read returned `completed_but_unrecorded`; one
  explicit `recovery_apply` advanced one phase and revision with one matching event, LastOperation,
  retained claim, one evidence addition, and the observed binding. Repeating it wrote nothing.
- Read-only proof: partial and conflicting reads left the complete Task aggregate, raw SQLite
  snapshot, revision, phase/action, blocker, LastOperation, events, evidence, claim, and binding
  byte-for-byte unchanged.
- Superseded sources: stale revision, stale action, advanced phase, superseded issuance binding,
  and an old normal source against a blocked task produced existing conflict/read-back behavior
  with zero commits.
- Blocker lifecycle: a read remained zero-write; one explicit current-source recovery apply created
  one blocker/event; repeating it retained the same ID, condition, and resume phase; exact
  `restore_issuance_binding` plus `RESOLVE_BLOCKER` returned only to the recorded phase. Worktree,
  observed-digest, blocker-ID, and revision mismatches were zero-write failures.
- Fresh observation: the first read saw complete worktree evidence, then the apply-time observer
  returned a newer conflicting binding; Core used the second digest, entered `BLOCKED`, retained the
  issuance binding, and did not adopt the stale completed observation.
- Production code: unchanged; `internal/recovery/classify.go` and
  `internal/recovery/reconcile.go` required no correction.
- At this User Story 2 checkpoint, T026–T040 remained unstarted and unchecked; User Story 3 and
  final Feature gates had not run.

## Phase 5 — User Story 3: Drift and concurrent reconnects

**Independent checkpoint**: Every complete binding component safe-stops where required, aliases
share one claim, replacement never rebinds, and two handles commit at most one action.

- [x] T026 [P] [US3] Add independent branch, detached, HEAD, unborn, tracked, and untracked binding cases in `internal/repository/git_observer_test.go` and `internal/repository/binding_test.go`.
- [x] T027 [P] [US3] Add canonical alias and case-variant path cases that retain one repository claim in `internal/repository/binding_test.go` and `internal/store/repository_claim_test.go`.
- [x] T028 [US3] Add repository disappearance and same-path replacement cases that refuse rebinding in `internal/repository/git_observer_test.go` and `tests/journeys/recovery_uncertainty_test.go`.
- [x] T029 [P] [US3] Add same-visible-HEAD but different tracked/untracked binding cases covering fingerprint behavior in `internal/repository/git_observer_test.go`.
- [x] T030 [US3] Add a two-handle same-action race proving one committed revision/event and one stale loser in `internal/store/concurrency_test.go` and `tests/journeys/recovery_uncertainty_test.go`.
- [x] T031 [US3] Add restart-after-blocker and exact resolution binding assertions in `internal/store/restart_test.go` and `tests/journeys/recovery_uncertainty_test.go`.
- [x] T032 [US3] Verify and minimally correct only test-proven canonicalization or binding-comparison gaps in `internal/repository/paths.go`, `internal/repository/fingerprint.go`, and `internal/repository/git_observer.go`. All new deterministic tests pass without production changes.
- [x] T033 [US3] Run the User Story 3 targeted packages and record the checkpoint result in `specs/005-recover-uncertain-actions-and-drift/tasks.md`.

### User Story 3 Checkpoint Evidence — 2026-08-17

- Current baseline: `go test ./internal/repository`, `go test ./internal/store`, and
  `go test ./tests/journeys` passed before User Story 3 edits.
- Final checkpoint: `go test ./internal/repository`, `go test ./internal/store`,
  `go test ./tests/journeys`, and `go test ./tests/contract` passed, 4/4 packages.
- Binding components: branch-at-same-commit, detached-at-same-commit, clean HEAD advance,
  unborn-to-born, tracked worktree, and untracked worktree each have one focused deterministic
  proof. Identity/location fields remain stable where required; forbidden identity/HEAD changes
  and existing worktree-only relations are asserted explicitly.
- Canonical aliases: real path, repository subdirectory, symlink alias, and a real case-variant
  symlink name converge on the same canonical root, Git common-directory digest, repository
  identity, branch/HEAD, fingerprint, and binding digest. Store retains one Task, event, and claim.
- Disappearance/replacement: a missing path returns observation failure without recreating it or
  writing Task state. Repository B uses its own separate Git common directory at the original
  worktree path; recovery reports conflict while the original Task, claim, and binding remain
  unchanged.
- Same visible HEAD: representative tracked and untracked changes preserve branch, HEAD,
  repository identity, and common-directory identity while changing worktree fingerprint and
  binding digest; restoring/removing the fixture change returns to the original binding digest.
- Two-handle race: two Store/database/Application/Observer handles share one source action and a
  channel barrier. Exactly one operation commits; the loser receives an existing conflict. A third
  Core read proves one revision/event/evidence/claim/binding, winner `completed_and_recorded`, and
  loser `conflicting` without retry permission.
- Restart/blocker: one representative partial read is zero-write, explicit recovery enters
  `BLOCKED`, and a full Store/Observer/Application recreation retains blocker ID, condition,
  resume phase, issuance binding, claim, action, and LastOperation. Non-exact resolution is
  zero-write; exact `RESOLVE_BLOCKER` restores only the recorded phase with one revision/event.
- T028 initially failed because repository A and B fixtures reused the same common-directory path;
  changing only B's fixture to a separate Git common directory satisfied the frozen Feature 002
  identity algorithm. No production correction was required.
- Production code: unchanged; canonicalization, fingerprint, Git observer, Store CAS, and restart
  persistence satisfy User Story 3.
- Bounded User Story 3 `speckit-converge` found no concrete acceptance gap and appended no task.
- At this User Story 3 checkpoint, T034–T040 remained unstarted and unchecked; the final Feature
  gate had not run.

## Phase 6 — Codex contract, documentation, and final gate

- [x] T034 Extend `packages/codex/tests/skill-contract.test.mjs` to prove exact probe retention and read-before-retry for missing, malformed, cancelled, truncated, and transport-failed apply results without encoding recovery classes.
- [x] T035 Update `packages/codex/plugin/skills/dev-flow/SKILL.md` only if the new contract test exposes an ambiguity; preserve Core authority and the exact six-tool workflow.
- [x] T036 Confirm `git diff -- packages/deepseek` is empty and add the result to the Feature 005 checkpoint in `specs/005-recover-uncertain-actions-and-drift/tasks.md`.
- [x] T037 Reconcile delivered behavior and evidence labels in `specs/005-recover-uncertain-actions-and-drift/{README.md,spec.md,plan.md,research.md,data-model.md,quickstart.md}` and `contracts/*.md`.
- [x] T038 Run `gofmt` on changed Go files, targeted affected tests, and `git diff --check`; fix only Feature 005 regressions.
- [x] T039 Run `pnpm run validate` exactly once after targeted checks and documentation reconciliation.
- [x] T040 Run one final `$speckit-analyze` and `$speckit-converge`; append only concrete uncovered work to `specs/005-recover-uncertain-actions-and-drift/tasks.md`.

### Final-phase pre-gate evidence — 2026-08-17

- Codex baseline: `node --test packages/codex/tests/skill-contract.test.mjs` passed 10/10 tests.
- T034 red/green proof: the new focused test first failed because the existing recovery section did
  not name `transport-failed` or close the retained/probe semantics; after T035 it passed as part of
  11/11 tests.
- Codex contract: missing, malformed, cancelled, truncated, and transport-failed results retain the
  original `request_id`, `task_id`, `source_phase`, revision, action ID/kind, issuance binding, and
  exact closed payload from one fresh action/apply dispatch. The existing probe has only
  `operation_id`, `source_phase`, `expected_revision`, `action_id`, `action_kind`,
  `repository_binding_digest`, and exact `payload` or JSON `null`.
- Read-before-retry: the original task/probe drives `dev_flow_get_task`, optional
  `dev_flow_get_next_action` uses the same probe, stale snapshots are not read-back, incomplete
  identity stops without a half probe or retry, and complete `ok=false` domain errors stay distinct.
  The Skill obeys the complete Core assessment and contains no recovery-class decision table.
- T035 scope: only `Recovery-before-retry contract` changed; selector, Skill name, six-tool
  handshake, task discovery, verification budget, terminal semantics, package metadata, and MCP
  configuration are unchanged.
- DeepSeek zero diff: `git diff --exit-code origin/main...HEAD -- packages/deepseek` exited 0 with
  no output. The committed PR file list contains no Feature 004 implementation, DeepSeek test or
  package metadata, Harness evidence, or native journey.
- Documentation: all nine Feature 005 reconciliation targets now distinguish the delivered
  user-story proof, Codex static contract, deterministic evidence labels, production zero-change,
  and explicit non-goals. Final root validation and final Spec Kit gates remain pending.
- T038: `node --test packages/codex/tests/skill-contract.test.mjs` passed 11/11;
  `go test ./tests/contract` passed; and `git diff --check` passed after removing one trailing-space
  regression from the new spec status line. No Go file changed in T034–T037, so no `gofmt` target
  existed.
- T039: the single authorized `pnpm run validate` invocation passed. The unchanged authoritative
  script completed toolchain, whitespace, Go formatting/source allowlists, package inventory, vet,
  repository-wide Go tests/contracts, frozen pnpm install, workspace inventory, and both package
  dry-packs. No standalone duplicate `go test ./...` was run.

## Dependencies

```text
Phase 1
  ↓
Phase 2
  ↓
US1 lost-result proof
  ├──────────────┐
  ↓              ↓
US2 reconciliation   US3 drift/concurrency
  └───────┬──────┘
          ↓
Codex contract and final gate
```

- User Story 1 establishes operation/result-loss helpers used by later journey assertions.
- User Stories 2 and 3 may proceed in parallel after Phase 2 and the shared journey helper are
  stable.
- Production changes are conditional on a failing deterministic test and must remain within the
  named existing files.
- No task depends on Feature 004 or modifies `packages/deepseek/`.

## Parallel Examples

### User Story 1

```text
T010/T011/T012 may run in parallel after T005–T007.
T014 and T015 may run after their respective application/store fixtures exist.
```

### User Story 2

```text
T018, T020, and T021 touch separate focused cases and may run in parallel.
T023 waits for the read and apply fixtures.
```

### User Story 3

```text
T026 and T027 may run in parallel.
T028/T030/T031 converge in the journey file and must be sequenced there.
```

## Implementation Strategy

1. Deliver User Story 1 first; it is the minimum valuable recovery-hardening increment.
2. Keep every story independently green before continuing.
3. Prefer adding proof over changing production code.
4. Stop immediately if a public contract or schema change appears necessary.
5. Run the full root validation only at T039.

## Requirement Coverage

| Requirements | Tasks |
|---|---|
| FR-001–FR-004 contract/fault boundary | T001–T008, T036 |
| FR-005–FR-010 lost result | T009–T017, T034–T035 |
| FR-011–FR-016 reconciliation | T018–T025 |
| FR-017–FR-022 drift/concurrency | T026–T033 |
| FR-023–FR-026 evidence budget | T003, T008, T034–T040 |
| SC-001–SC-003 | T009–T016 |
| SC-004 | T018–T024 |
| SC-005–SC-006 | T026–T032 |
| SC-007–SC-009 | T004, T034–T040 |

## Scope Guard

Do not add a production failpoint, public tool/field/error/state/class, migration, Git mutation,
DeepSeek implementation, host matrix, release ledger, or publication behavior. Such work is not an
“implementation detail”; it requires a separate approved specification.

## Final Feature 005 Checkpoint Evidence — 2026-08-17

### Status

```text
FEATURE_005_COMPLETE
```

### Completed scope

`T001–T040 complete`.

### User stories

- User Story 1: post-commit lost result plus SQLite close/reopen produced exact-probe
  `completed_and_recorded`; pre-commit failure was zero-write; pre-serialization discard and the
  bounded partial writer did not manufacture success; duplicate submission wrote nothing.
- User Story 2: all five existing classes are deterministic; exact evidence is adopted only through
  explicit recovery apply; partial/conflicting reads are read-only; stale sources are zero-write;
  blocker creation, retention, fresh re-observation, and exact resolution preserve issuance.
- User Story 3: every complete binding component, canonical aliases, same-path replacement,
  two-handle deterministic race, and restart/blocker restoration have focused proof. At most one
  concurrent action committed, and no repository replacement rebound the task.

### Codex exact probe contract

- The static contract covers missing, malformed, cancelled, truncated, and transport-failed apply
  results with one read-before-retry procedure.
- Before dispatch, the Skill retains the original `request_id`, `task_id`, `source_phase`, action
  revision, `action_id`, `action_kind`, issuance `repository_binding_digest`, and exact closed
  payload from the same fresh action/apply dispatch.
- The existing closed probe contains only `operation_id`, `source_phase`, `expected_revision`,
  `action_id`, `action_kind`, `repository_binding_digest`, and `payload`. The operation ID is the
  original apply request ID; payload is exact or JSON `null`, never reconstructed or caller-digested.
- The original task/probe drives `dev_flow_get_task`; optional `dev_flow_get_next_action` uses the
  same probe. Incomplete identity stops without a half probe, a `not_started` assumption, or retry.
- A complete structured `ok=false` remains a domain error. The Skill obeys the complete fresh Core
  recovery assessment/advice and does not encode a recovery decision table.
- T035 did modify only `packages/codex/plugin/skills/dev-flow/SKILL.md`'s
  `Recovery-before-retry contract` to close these caller semantics; it added no Core authority,
  state machine, tool, field, or retry policy.

### Final tests and gates

- `node --test packages/codex/tests/skill-contract.test.mjs`: PASS, 11/11.
- `go test ./tests/contract`: PASS.
- `git diff --check`: PASS at T038 and again after the final Markdown record.
- `pnpm run validate`: PASS in its single authorized invocation. The validator internally ran its
  repository-wide Go tests; no standalone duplicate `go test ./...` was run.
- `$speckit-analyze`: PASS in one final read-only run; 26/26 FRs and 9/9 SCs are task-covered, with
  zero unresolved CRITICAL, HIGH, or acceptance-affecting MEDIUM findings.
- `$speckit-converge`: PASS in one final run; all 14 User Story acceptance scenarios and the final
  constraints are satisfied, with zero concrete acceptance gap and zero appended task.

### Scope conclusion

- Feature 005 changed no Core, Application, Recovery, Repository, Store, or MCP Go production file;
  the existing implementation passed all new deterministic proof.
- `packages/deepseek/` has zero diff. No DeepSeek Harness or native journey ran; the root
  validator's package dry-pack is not host evidence.
- Core Contract 0.1, exactly six MCP tools, existing schemas/result envelope, normal states, five
  recovery classes, stable errors, repository claims, blockers, and SQLite schema version 1 remain
  unchanged.
- No additional real Codex Host Journey, production failpoint, dependency, migration, automatic
  replay, Git repair/mutation by Core, cross-host takeover, Feature 006 implementation, npm
  publication, tag, GitHub release, or merge was performed.
