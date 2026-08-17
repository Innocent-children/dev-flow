# Tasks: Recover Uncertain Actions and Repository Drift

**Input**: [spec.md](./spec.md), [plan.md](./plan.md), [research.md](./research.md),
[data-model.md](./data-model.md), [quickstart.md](./quickstart.md), and `contracts/`.

**Entry gate**: Feature 003 is merged to `main`; Feature 004 is deferred and is not a dependency.

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
- T018–T040 remain unstarted and unchecked.

## Phase 4 — User Story 2: Reconcile exact, partial, and conflicting work

**Independent checkpoint**: All five existing classes are deterministic; exact unrecorded work is
recorded only by explicit recovery apply; partial/conflicting reads write nothing; stale sources
cannot mutate.

- [ ] T018 [P] [US2] Complete independent five-class table coverage in `internal/recovery/classify_test.go`, including insufficient-evidence conservative ordering.
- [ ] T019 [US2] Add exact completed-but-unrecorded adoption with one explicit recovery apply and one event in `internal/recovery/reconcile_test.go` and `internal/application/apply_action_test.go`.
- [ ] T020 [P] [US2] Add partial and conflicting read-only cardinality assertions in `internal/recovery/reconcile_test.go` and `internal/store/sqlite_test.go`.
- [ ] T021 [P] [US2] Add stale/superseded recovery-source zero-write cases in `internal/application/apply_action_test.go`.
- [ ] T022 [US2] Add exact blocker entry, retention, and restore-issuance-binding resolution cases in `internal/recovery/reconcile_test.go` and `internal/application/apply_action_test.go`.
- [ ] T023 [US2] Add a repository-change-between-read-and-recovery-apply case proving fresh observation before write in `internal/application/apply_action_test.go`.
- [ ] T024 [US2] Verify and minimally correct only test-proven classification/reconciliation gaps in `internal/recovery/classify.go` and `internal/recovery/reconcile.go` without adding a class or public field.
- [ ] T025 [US2] Run the User Story 2 targeted packages and record the checkpoint result in `specs/005-recover-uncertain-actions-and-drift/tasks.md`.

## Phase 5 — User Story 3: Drift and concurrent reconnects

**Independent checkpoint**: Every complete binding component safe-stops where required, aliases
share one claim, replacement never rebinds, and two handles commit at most one action.

- [ ] T026 [P] [US3] Add independent branch, detached, HEAD, unborn, tracked, and untracked binding cases in `internal/repository/git_observer_test.go` and `internal/repository/binding_test.go`.
- [ ] T027 [P] [US3] Add canonical alias and case-variant path cases that retain one repository claim in `internal/repository/binding_test.go` and `internal/store/repository_claim_test.go`.
- [ ] T028 [US3] Add repository disappearance and same-path replacement cases that refuse rebinding in `internal/repository/git_observer_test.go` and `tests/journeys/recovery_uncertainty_test.go`.
- [ ] T029 [P] [US3] Add same-visible-HEAD but different tracked/untracked binding cases covering fingerprint behavior in `internal/repository/git_observer_test.go`.
- [ ] T030 [US3] Add a two-handle same-action race proving one committed revision/event and one stale loser in `internal/store/concurrency_test.go` and `tests/journeys/recovery_uncertainty_test.go`.
- [ ] T031 [US3] Add restart-after-blocker and exact resolution binding assertions in `internal/store/restart_test.go` and `tests/journeys/recovery_uncertainty_test.go`.
- [ ] T032 [US3] Verify and minimally correct only test-proven canonicalization or binding-comparison gaps in `internal/repository/paths.go`, `internal/repository/fingerprint.go`, and `internal/repository/git_observer.go`.
- [ ] T033 [US3] Run the User Story 3 targeted packages and record the checkpoint result in `specs/005-recover-uncertain-actions-and-drift/tasks.md`.

## Phase 6 — Codex contract, documentation, and final gate

- [ ] T034 Extend `packages/codex/tests/skill-contract.test.mjs` to prove exact probe retention and read-before-retry for missing, malformed, cancelled, truncated, and transport-failed apply results without encoding recovery classes.
- [ ] T035 Update `packages/codex/plugin/skills/dev-flow/SKILL.md` only if the new contract test exposes an ambiguity; preserve Core authority and the exact six-tool workflow.
- [ ] T036 Confirm `git diff -- packages/deepseek` is empty and add the result to the Feature 005 checkpoint in `specs/005-recover-uncertain-actions-and-drift/tasks.md`.
- [ ] T037 Reconcile delivered behavior and evidence labels in `specs/005-recover-uncertain-actions-and-drift/{README.md,spec.md,plan.md,research.md,data-model.md,quickstart.md}` and `contracts/*.md`.
- [ ] T038 Run `gofmt` on changed Go files, targeted affected tests, and `git diff --check`; fix only Feature 005 regressions.
- [ ] T039 Run `pnpm run validate` exactly once after targeted checks and documentation reconciliation.
- [ ] T040 Run one final `$speckit-analyze` and `$speckit-converge`; append only concrete uncovered work to `specs/005-recover-uncertain-actions-and-drift/tasks.md`.

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
