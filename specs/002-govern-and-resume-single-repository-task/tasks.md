---
description: "Task list for the host-independent single-repository Dev Flow Core"
---

# Tasks: Govern and Resume a Single-Repository Task

**Input**: Design documents from
`/specs/002-govern-and-resume-single-repository-task/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`

**Tests**: Only domain invariants, SQLite transactions, bounded Git observation, MCP contracts, and
one restart/recovery journey required by the specification are included. No real Codex/DeepSeek,
platform matrix, performance suite, fuzzing, or release test belongs to this feature.

**Organization**: Tasks are grouped by independently testable user stories. Implement one phase or
one user story at a time and stop at every checkpoint.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it touches different files and has no unmet dependency.
- **[Story]**: Maps the task to one user story from `spec.md`.
- Every task names the exact path to change.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add only the permitted Core dependency and feature-owned directory skeleton.

- [x] T001 Update root `go.mod` with only the latest stable compatible v1 release of
  `modernc.org/sqlite`; let `go.mod`/`go.sum` record the resolved version without adding
  equality-based compatibility checks. Add `github.com/modelcontextprotocol/go-sdk` only in Phase 7
  when MCP is actually implemented; do not pin it with a blank import, `tools.go`, or placeholder.
- [x] T002 Generate and commit `go.sum` without adding indirect dependencies manually.
- [x] T003 Create source ownership packages under `internal/domain/`, `internal/workflow/`,
  `internal/recovery/`, `internal/repository/`, `internal/store/`, `internal/application/`, and
  `internal/mcp/` with package documentation only.
- [x] T004 Create `protocol/fixtures/` and `tests/journeys/` ownership README files that state the
  shared-contract and process-restart boundaries.
- [x] T005 Select `specs/002-govern-and-resume-single-repository-task` through
  `SPECIFY_FEATURE_DIRECTORY` for the implementation session; do not handcraft Spec Kit-managed
  feature state.
- [x] T006 Confirm `packages/codex/` and `packages/deepseek/` remain untouched and private during
  this feature.

**Checkpoint**: Dependencies and package ownership exist; no workflow behavior has been added.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish the closed domain vocabulary, infrastructure ports, database schema, and
read-only repository observation needed by every user story.

### Foundational Tests

- [x] T007 [P] Add domain validation and invariant cases to
  `internal/domain/validation_test.go` for Core Limits 0.1, bounded strings, contracts, phases,
  actions, evidence, outcomes, and verification budgets; tests must use the exported limit constants
  instead of copying numbers.
- [x] T008 [P] Add transition-table cases to `internal/workflow/transitions_test.go` covering every
  legal normal, rework, and `RESOLVE_BLOCKER` edge plus representative forbidden edges.
- [x] T009 [P] Add migration, stable-digest/idempotence, unsupported-schema, strict-codec
  unknown/trailing JSON, bounded snapshot, SQLite busy-timeout, exact CAS, and transaction rollback
  cases to `internal/store/sqlite_test.go` using temporary databases only.
- [x] T010 [P] Add read-only Git observation cases to `internal/repository/git_observer_test.go`
  covering clean, dirty tracked/untracked, detached, unborn branch/null-HEAD, symlinked, spaced, and
  Unicode repository paths plus bounded-output and timeout failures.

### Foundational Implementation

- [x] T011 [P] Implement closed identifiers, hosts, phases, action kinds, action results, evidence
  sources, verification levels, and terminal statuses in `internal/domain/types.go`, and put every
  Core Limits 0.1 Go constant in the single source `internal/domain/limits.go`.
- [x] T012 [P] Implement immutable task contract and verification budget models in
  `internal/domain/contract.go`.
- [x] T013 [P] Implement repository identity, Git common-directory identity, branch/detached,
  HEAD/unborn, worktree fingerprint, final binding, and observation-time models in
  `internal/domain/repository.go`; observation time is excluded from both digests.
- [x] T014 [P] Implement action, evidence summary, blocker, outcome, last-operation, and task models
  in `internal/domain/action.go`, `internal/domain/evidence.go`, `internal/domain/blocker.go`,
  `internal/domain/outcome.go`, and `internal/domain/task.go`.
- [x] T015 Implement typed Domain invariant validation and the explicitly documented trimming,
  canonicalization, and duplicate rejection in `internal/domain/validation.go`; reject undocumented
  enum/result aliases without making Domain parse arbitrary JSON.
- [x] T016 Implement stable domain error codes and typed errors in `internal/domain/errors.go`.
- [x] T017 Implement the one transition table and derived phase-to-action mapping with the exact
  canonical action results from `contracts/state-machine.md` in
  `internal/workflow/transitions.go`.
- [x] T018 Implement pure next-action construction and transition evaluation in
  `internal/workflow/engine.go`; do not import SQLite, MCP, `os/exec`, or host packages.
- [x] T019 Define the minimal `Store` transaction port in `internal/store/store.go` and the minimal
  `RepositoryObserver` port in `internal/repository/observer.go`.
- [x] T020 Implement transactional, idempotent schema migration 1 with a stable digest for `tasks`,
  `task_events`, `repository_claims`, and `schema_migrations` in
  `internal/store/migrations.go`; reject unsupported future schema without downgrade or rebuild.
- [x] T021 Implement bounded Domain JSON encoding and strict decoding in `internal/store/codec.go`;
  reject unknown fields and trailing JSON at this Store boundary, then re-run the single Task
  invariant entry point.
- [x] T022 Implement SQLite open with foreign keys and the Core Limits 0.1 busy timeout, migration
  verification, read transactions, exact-revision compare-and-swap mutations, event append, and
  repository-claim updates in `internal/store/sqlite.go`; failed transactions must leave task,
  event, and claim data unchanged.
- [x] T023 Implement canonical repository-root resolution and allowlisted read-only Git command
  execution in `internal/repository/paths.go` and `internal/repository/git_observer.go` using
  `exec.CommandContext` plus the Core Limits 0.1 timeout and combined stdout/stderr bound.
- [x] T024 Implement SHA-256 repository binding calculation from branch/detached state, HEAD/unborn
  state, and bounded status observations in `internal/repository/fingerprint.go`.
- [x] T025 Run only the Phase 2 targeted checks: `go test ./internal/domain ./internal/workflow`,
  `CGO_ENABLED=0 go test ./internal/store ./internal/repository`, targeted `go vet` on those four
  packages, and the repository layout/Markdown contract tests; fix failures before starting a user
  story.

**Checkpoint**: Pure workflow logic, SQLite authority, and read-only repository observation are
independently testable; no MCP server or task use case is implemented.

---

## Phase 3: User Story 1 - Open a governed task and receive the next action (Priority: P1) 🎯 MVP

**Goal**: Create or resume one host-owned task and return a stable `ASSESS_TASK` action.

**Independent Test**: In one temporary Git repository, open a new task, read it, read the next action
repeatedly, and prove that task creation and repository claim are atomic.

### Tests for User Story 1

- [ ] T026 [P] [US1] Add create/resume/conflict use-case tests to
  `internal/application/open_task_test.go`.
- [ ] T027 [P] [US1] Add unique-claim race and rollback cases to
  `internal/store/repository_claim_test.go`.
- [ ] T028 [P] [US1] Add stable repeated-read cases to
  `internal/application/next_action_test.go`, proving reads do not change revision, event, phase,
  action, blocker, or persisted repository binding.

### Implementation for User Story 1

- [ ] T029 [US1] Implement Core service construction and dependency validation in
  `internal/application/service.go`.
- [ ] T030 [US1] Implement new-task normalization, repository observation, atomic task/claim/event
  creation, and same-host resume in `internal/application/open_task.go`.
- [ ] T031 [US1] Implement authoritative task projection with host ownership checks in
  `internal/application/get_task.go`; fresh observation/recovery guidance is read-only.
- [ ] T032 [US1] Implement stable current-action or terminal projection in
  `internal/application/next_action.go` without persisting any read-time reconciliation.
- [ ] T033 [US1] Add representative shared fixtures for server info, open-task success, active-task
  conflict, host-ownership conflict, task read, and next action under `protocol/fixtures/`.
- [ ] T034 [US1] Run the US1 application/store tests and manually inspect that no fixture contains a
  database path, source content, diff, environment value, or raw command output.

**Checkpoint**: User Story 1 is independently usable through the application service, without MCP.

---

## Phase 4: User Story 2 - Advance through one shared workflow (Priority: P2)

**Goal**: Apply one exact action at a time, enforce obligations and verification budget, support
bounded rework, and reach `DONE` or `CANCELLED` atomically.

**Independent Test**: Drive a task through every normal phase using closed payloads; reject skipped,
duplicate, stale, malformed, drifted, and over-budget submissions.

### Tests for User Story 2

- [ ] T035 [P] [US2] Add phase-specific closed-payload cases to
  `internal/workflow/payloads_test.go`.
- [ ] T036 [P] [US2] Add legal forward, implementation rework, replanning, and terminal cases to
  `internal/application/apply_action_test.go`.
- [ ] T037 [P] [US2] Add exact task ID/revision/action ID/action kind/issuance-binding mismatch,
  action-specific repository-drift, and duplicate-submission cases to
  `internal/application/apply_action_test.go`.
- [ ] T038 [P] [US2] Add verification command-count, full-suite, evidence-source, and manual-handoff
  budget cases to `internal/workflow/verification_budget_test.go`.
- [ ] T039 [P] [US2] Add cancellation/claim-release transaction cases to
  `internal/application/cancel_task_test.go`.

### Implementation for User Story 2

- [ ] T040 [US2] Implement closed payload types and phase-specific validation in
  `internal/workflow/payloads.go`.
- [ ] T041 [US2] Implement verification-budget evaluation and evidence normalization in
  `internal/workflow/verification_budget.go`.
- [ ] T042 [US2] Implement exact task ID/revision/action ID/action kind/issuance-binding checks,
  fresh repository observation, action-specific binding rules, transition evaluation, evidence
  summaries, event append, and next-action creation in `internal/application/apply_action.go`.
- [ ] T043 [US2] Implement `DONE` outcome creation and same-transaction repository-claim release in
  `internal/application/apply_action.go`.
- [ ] T044 [US2] Implement explicit cancellation, retained task data, terminal event, and
  same-transaction claim release in `internal/application/cancel_task.go`.
- [ ] T045 [US2] Extend shared fixtures with apply success, rework, verification-budget failure,
  revision conflict, stale action, repository drift, completed outcome, and cancelled outcome under
  `protocol/fixtures/`.
- [ ] T046 [US2] Run only workflow and application tests for US2; do not add a full repository or
  real-host journey.

**Checkpoint**: User Stories 1 and 2 form a complete in-process governed task journey.

---

## Phase 5: User Story 3 - Resume after process or host restart (Priority: P3)

**Goal**: Reopen one database and resume the exact task/action without reconstructing workflow
state from prompts or host memory.

**Independent Test**: Persist a mid-workflow task, close all Core/database objects, create a new
process or service instance, reopen the same database, and resume the same revision and action.

### Tests for User Story 3

- [ ] T047 [P] [US3] Add close/reopen snapshot and latest-event consistency cases to
  `internal/store/restart_test.go`.
- [ ] T048 [P] [US3] Add unsupported-newer-schema and malformed-row safe-stop cases to
  `internal/store/schema_compatibility_test.go`.
- [ ] T049 [US3] Add one subprocess restart journey to `tests/journeys/core_restart_test.go` that
  opens, advances, exits, restarts, resumes, and completes a temporary-repository task.

### Implementation for User Story 3

- [ ] T050 [US3] Add an internal test-only CLI journey surface in `cmd/dev-flow/main.go` or a
  dedicated Go test helper without exposing a second public task API.
- [ ] T051 [US3] Ensure SQLite startup verifies migration digests and rejects unsupported newer
  schemas without mutation in `internal/store/migrations.go` and `internal/store/sqlite.go`.
- [ ] T052 [US3] Ensure same-host `open_task` resume returns the persisted action identity rather
  than generating a new action in `internal/application/open_task.go`.
- [ ] T053 [US3] Run the single restart journey and the two targeted storage tests; retain no test
  database or repository after completion.

**Checkpoint**: Restart resumability is proven independently of Codex and DeepSeek.

---

## Phase 6: User Story 4 - Stop on repository drift or uncertain completion (Priority: P4)

**Goal**: Reconcile persistent task state with external repository reality before retry or apply.

**Independent Test**: Drift the repository after action issue and simulate lost mutation responses;
verify rejection, read-after-write proof, five recovery classes, and safe blocking.

### Tests for User Story 4

- [ ] T054 [P] [US4] Add pure five-class recovery cases to
  `internal/recovery/classify_test.go`.
- [ ] T055 [P] [US4] Add canonical-repository/common-directory, HEAD/unborn, branch/detached,
  tracked, untracked, implementation-only worktree acceptance, and unauthorized-phase drift cases
  to `internal/recovery/reconcile_test.go`.
- [ ] T056 [P] [US4] Add commit-before-response-loss and duplicate-apply read-back cases to
  `internal/application/uncertain_mutation_test.go`.
- [ ] T057 [P] [US4] Add two-process claim/revision race cases to
  `internal/store/concurrency_test.go` without stress looping.

### Implementation for User Story 4

- [ ] T058 [US4] Implement the five closed recovery classifications in
  `internal/recovery/classify.go`.
- [ ] T059 [US4] Implement task/action/event/repository reconciliation and concrete unblock
  conditions in `internal/recovery/reconcile.go`.
- [ ] T060 [US4] Integrate read-only reconciliation reporting into task/next-action reads and
  mutation reconciliation into apply preconditions in `internal/application/get_task.go`,
  `internal/application/next_action.go`, and `internal/application/apply_action.go`; reads may
  observe/classify but must never persist state or create `BLOCKED`.
- [ ] T061 [US4] Implement `BLOCKED` creation and `RESOLVE_BLOCKER` handling through the existing
  apply-action path without adding an MCP tool in `internal/application/apply_action.go`; reads
  cannot create blockers, and resolution accepts a new binding only under the stored condition and
  returns only to the stored `resume_phase`.
- [ ] T062 [US4] Extend shared fixtures with all five recovery classes and blocked/resolved results
  under `protocol/fixtures/`.
- [ ] T063 [US4] Run only recovery, uncertain-mutation, and bounded concurrency cases.

**Checkpoint**: Persistent state cannot silently override drifted or uncertain external reality.

---

## Phase 7: MCP Adapter and Core Command

**Purpose**: Expose the completed application service through exactly six local STDIO tools.

### Contract Tests

- [ ] T064 [P] Add result-envelope JSON Schema validation cases to
  `tests/contract/result_envelope_test.go` using
  `contracts/result-envelope.schema.json` as a specification fixture, not a runtime dependency.
- [ ] T065 [P] Add tool-name, strict unknown-input-field, annotation, Core Limits 0.1 encoded-result
  byte ceiling, and stable-error contract cases to `tests/contract/mcp_contract_test.go`.
- [ ] T066 [P] Add fixture parity checks to `tests/contract/fixture_contract_test.go` so future
  Codex and DeepSeek packages consume one shared surface.

### Implementation

- [ ] T067 Implement the common success/error envelope, encoded total-byte enforcement, and bounded
  redacted details in `internal/mcp/results.go`.
- [ ] T068 Implement closed tool schemas and exact six-tool catalog in
  `internal/mcp/schemas.go` and `internal/mcp/tools.go`; reject unknown fields at the MCP boundary
  without a runtime JSON-Schema framework.
- [ ] T069 Resolve and import the then-latest stable compatible v1
  `github.com/modelcontextprotocol/go-sdk`, run `go mod tidy`, and implement MCP request dispatch to
  the application service in `internal/mcp/server.go`; the adapter must not select transitions or
  persist state directly.
- [ ] T070 Implement stderr-only structured diagnostics with request IDs and no task payloads in
  `internal/mcp/logging.go`.
- [ ] T071 Implement `dev-flow mcp --stdio`, `dev-flow version`, and bounded help in
  `cmd/dev-flow/main.go`; remove the bootstrap “not implemented” response only for these surfaces.
- [ ] T072 Add command startup/STDIO shutdown cases to `cmd/dev-flow/main_test.go`.
- [ ] T073 Run the MCP contract tests and one Core restart journey; do not run host package tests.

**Checkpoint**: The shared Core Contract 0.1 is executable and consumable by both future products.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [ ] T074 [P] Update `docs/ARCHITECTURE.md` with the implemented dependency direction and the
  final source tree without documenting unimplemented host behavior.
- [ ] T075 [P] Update `docs/PRODUCT.md` with the proven Core journey, supported evidence boundary,
  and explicit absence of installation/host support.
- [ ] T076 [P] Check all links in `specs/002-govern-and-resume-single-repository-task/` and shared
  fixture references.
- [ ] T077 Confirm `packages/codex/` and `packages/deepseek/` contain no duplicate protocol or state
  logic and still make no functional claim.
- [ ] T078 Run one final `pnpm run validate`, which already includes Go list/vet/test, repository
  contract validation, and package dry-pack; do not run a duplicate full `go test ./...` first.
- [ ] T079 Run `$speckit-converge` and append only concrete acceptance gaps; do not add host,
  release, platform-matrix, data-import, or future-workflow tasks.
- [ ] T080 Record `Core Contract 0.1` source commit, fixture digest, verified platform, skipped
  evidence, and unsupported claims in the completion report.

## Dependencies & Execution Order

- Phase 1 has no implementation dependency beyond feature `001` completion.
- Phase 2 blocks every user story.
- User Story 1 is the first usable vertical slice.
- User Story 2 depends on User Story 1 task creation and next-action behavior.
- User Story 3 depends on persisted behavior from User Stories 1 and 2.
- User Story 4 depends on stable revision/action/binding semantics from User Stories 1–3.
- Phase 7 depends on all four application stories and freezes the public Core Contract.
- Phase 8 depends on the selected complete scope.
- Features `003` and `004` MUST NOT begin until Phase 8 completes and Core Contract 0.1 is recorded.

## Parallel Opportunities

- T007–T010 can run in parallel.
- T011–T014 can run in parallel before T015.
- T026–T028 can run in parallel.
- T035–T039 can run in parallel.
- T047–T048 can run in parallel.
- T054–T057 can run in parallel.
- T064–T066 can run in parallel.
- T074–T076 can run in parallel.

Parallel work must not split ownership of the same domain contract or change public fixtures on two
branches independently.

## Implementation Strategy

1. Complete Setup and Foundational, then stop for Constitution and dependency review.
2. Deliver User Story 1, run only its tests, and stop for task/claim review.
3. Deliver User Story 2, run only workflow/application tests, and stop for state-machine review.
4. Deliver User Story 3, run one restart journey, and stop for persistence review.
5. Deliver User Story 4, run bounded recovery cases, and stop for recovery review.
6. Add the MCP adapter only after the application service is stable.
7. Freeze Core Contract 0.1 and only then branch features `003` and `004` in parallel.
