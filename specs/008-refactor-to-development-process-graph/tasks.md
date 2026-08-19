# Tasks: Refactor to a Development Process Graph

**Input**: Complete Feature 008 package in
`specs/008-refactor-to-development-process-graph/`

**Status**: Planned — do not begin production tasks until Phase 1 completes and Feature status is
changed to `Ready`.

**Release Boundary**: Every task in this file is source/local-evidence work. No task may modify
`VERSION`, publish npm, create/move a Tag, mutate a GitHub Release, or claim final registry support.

## Task Format

```text
- [ ] T### [P?] [US#?] Exact result in exact/path per requirement/contract.
```

## Phase 1: Clarification, Checklist, and Contract Freeze

**Goal**: Make the prepared package implementation-ready without touching production code.

- [x] T001 Review this complete package under
  `.specify/memory/constitution.md` and `docs/SPEC-KIT-WORKFLOW.md`; record only material
  clarification changes in `specs/008-refactor-to-development-process-graph/` per the Feature
  workflow gate.
- [x] T002 Run `$speckit-clarify` with
  `SPECIFY_FEATURE_DIRECTORY=specs/008-refactor-to-development-process-graph`; resolve every
  acceptance-impacting answer in `spec.md`, `plan.md`, `data-model.md`, and contracts without
  regenerating the package.
- [x] T003 Re-review
  `specs/008-refactor-to-development-process-graph/checklists/requirements.md`; leave no unchecked
  or waived item without an exact written reason.
- [x] T004 Add `tests/contract/spec_008_document_test.go` to verify the Feature's required files,
  relative Markdown links, unique FR/SC/CHK/T identifiers, 29 transition IDs, and absence of
  unresolved template markers per `docs/SPEC-KIT-WORKFLOW.md`.
- [x] T005 Run `$speckit-analyze`; resolve every CRITICAL/HIGH and every acceptance-impacting MEDIUM
  finding across the Feature artifacts.
- [x] T006 Update `specs/008-refactor-to-development-process-graph/README.md` and `spec.md` status
  from `Planned` to `Ready`, recording the analyze result and no release authority.

**Checkpoint**: Feature contracts are frozen and reviewable; production source has zero diff.

---

## Phase 2: Process and Domain Foundations

**Goal**: Represent the single standard process definition and graph Task model without changing MCP behavior yet.

- [x] T007 [P] Add closed `ProcessID`, `ProcessReference`, `NodeID`, `TransitionID`,
  `TransitionDefinition`, `NodeDefinition`, and definition-validation types in
  `internal/domain/process.go` per FR-001–FR-012 and
  `contracts/process-graph.md`.
- [x] T008 [P] Add `MethodProfile`, `MethodStepID`, `SemanticMethodStep`, `MethodEvidence`, and their
  closed validation in `internal/domain/method.go` per FR-027–FR-031 and
  `contracts/method-profiles.md`.
- [x] T009 [P] Add requirements/design/task-plan baseline, compact history, work-item,
  ArtifactReference, ImplementationRecord, TestRecord, and ComprehensionAssessment types in
  `internal/domain/baselines.go` per FR-019–FR-026 and `data-model.md`.
- [x] T010 Add `ProcessTask`, `ProcessOutcome`, v2 aggregate validation, invalidation helpers, and
  terminal/blocker invariants in `internal/domain/task_v2.go` per FR-014–FR-018 and
  `data-model.md`.
- [x] T011 Extend `internal/domain/limits.go` to Core Limits 0.2 with only the eight new bounded
  graph/baseline/method limits from `data-model.md`; retain existing byte/command limits per FR-041.
- [x] T012 [P] Add deterministic canonical process-definition encoding/digest and structural
  validation in `internal/workflow/definitions.go` per the definition-digest contract.
- [x] T013 Remove the released linear runtime vocabulary from current workflow dispatch and add
  negative source checks proving no `legacy-linear`, old action result, or v1 payload is registered in
  `internal/workflow/` per FR-S003.
- [x] T014 Add the exact `standard-development@1` node/transition declaration in
  `internal/workflow/standard_process.go` with canonical order, 29 edges, guard IDs, and action
  mappings per FR-001–FR-018.
- [x] T015 Refactor `internal/workflow/engine.go` to resolve a supported code-owned definition and
  issue the exact graph action while rejecting alternate process/digest mismatch per FR-005–FR-010 and
  FR-S002–FR-S003.
- [x] T016 Add sealed standard node payload structs, common transition envelope, canonical encoding,
  and source-node dispatch in `internal/workflow/payloads_v2.go` per FR-035–FR-036 and
  `contracts/mcp-tools-0.2.md`.
- [x] T017 [P] Add `internal/workflow/definitions_test.go` proving stable definition digests,
  declaration order, unique/known nodes and edges, terminal closure, and no runtime definition input
  per SC-001–SC-002.
- [x] T018 Add targeted domain/workflow tests in
  `internal/domain/task_v2_test.go` and `internal/workflow/payloads_v2_test.go` for baseline
  monotonicity, strict payload branches, reason rules, forbidden destinations, limits, and aggregate
  invariants per FR-009–FR-026.

**Verification**

- [x] T019 Run only `go test ./internal/domain ./internal/workflow`; record the Foundation
  checkpoint and do not run repository-wide validation.
- [x] T020 Run `$speckit-converge` for the foundation slice; append only concrete contract/acceptance
  gaps and stop.

**Checkpoint**: The single static process definition and graph aggregate/payload model pass targeted
tests; no public MCP behavior is claimed.

---

## Phase 3: Fresh SQLite Schema 2 and Explicit Old-Data Rejection

**Goal**: Persist only graph tasks and enforce the intentional pre-1.0 storage break without silent
data deletion.

- [x] T021 Replace the Schema 1 migration list in `internal/store/migrations.go` with the exact direct
  Schema 2 bootstrap statements, version-2 digest, required table/column/index verification, and
  `SchemaVersion=2` per FR-S001–FR-S002 and `contracts/storage-generation-2.md`.
- [x] T022 Replace Store row selection/insertion/update metadata in `internal/store/sqlite.go` with
  immutable process ID/version/digest, snapshot version 2, and `current_node` per FR-S002.
- [x] T023 Replace the existing task DTO/encode/decode path in `internal/store/codec.go` with the single
  strict graph snapshot-version-2 codec; remove any v1 or metadata-selected dual-codec branch per
  FR-S002–FR-S003.
- [x] T024 Add Store-open schema/history/process/snapshot preflight in `internal/store/sqlite.go`,
  rejecting Schema 1 and every unsupported generation before task decoding or write exposure per
  FR-S004 and FR-S007.
- [x] T025 Add a bounded public storage error reason/advice path in the existing domain/MCP error
  mapping that explains the fresh-directory requirement without returning private database paths or
  deleting data per FR-S004–FR-S006.
- [x] T026 Replace TaskEvent persistence/readback columns in `internal/store/sqlite.go` with
  graph-native `source_node`, `destination_node`, `transition_id`, and `transition_reason` per the
  storage contract.
- [x] T027 [P] Add fresh Schema 2 bootstrap and representative Schema 1 copied-database builders in
  focused Store test helpers; fixtures contain active/terminal rows only to prove rejection, not
  decode/continuation, per SC-011–SC-012.
- [x] T028 Add `internal/store/schema2_bootstrap_test.go` proving direct one-transaction bootstrap,
  exact statement/digest order, no Schema 1 intermediate history, complete verification, rollback on
  failure, and no partial schema acceptance per SC-011 and SC-013.
- [x] T029 Add `internal/store/schema1_rejection_test.go` proving `SCHEMA_UNSUPPORTED` before task
  decode and unchanged database/file/logical manifests with no event/claim/schema mutation per
  FR-S004–FR-S006 and SC-012.
- [x] T030 Add strict codec/restart tests in `internal/store/codec_test.go` for standard
  create/close/reopen, unknown/duplicate fields, metadata/snapshot agreement, current action
  stability, aggregate limits, and current baselines per FR-S002 and SC-011.
- [x] T031 Add future schema/snapshot/process/digest, bootstrap mismatch, malformed row, and partial
  Schema 2 safe-stop cases with row/file manifests proving zero writes per FR-S007 and SC-013.
- [x] T032 Update Store/application ports only as required for the single graph Task; do not add a
  generic process plugin, legacy adapter, import/export, automatic reset, or migration interface per
  FR-S003–FR-S006.

**Verification**

- [x] T033 Run only `go test ./internal/store`; Application still depends on the public graph
  navigation work scheduled in T035–T037 and is verified with that slice in T044. Do not run MCP,
  contract, package, or repository-wide tests.
- [x] T034 Run `$speckit-converge` for the Schema 2/storage-boundary foundation and stop.

**Checkpoint**: A fresh directory creates exact Schema 2 and graph tasks restart exactly; every
Schema 1/pre-graph database safe-stops with zero writes; public tool schemas are still not changed.

---

## Phase 4: User Story 1 — Current Node and Legal Transition Navigation

**Goal**: Create/read/apply one standard task through the existing six MCP tools.

**Independent Test**: Quickstart Journey A.

- [ ] T035 [US1] Replace standard new-task construction in
  `internal/application/open_task.go` with immutable TaskIntent and
  `standard-development@1/REQUIREMENTS` creation and current-generation resume/conflict selection
  per FR-002, FR-019–FR-020, and FR-S002.
- [ ] T036 [US1] Add the graph application projection for task reads in
  `internal/application/get_task.go` and `internal/application/next_action.go`, including process,
  cursor, baselines, method profile, node contract, and complete transitions per FR-005–FR-008 and
  FR-034.
- [ ] T037 [US1] Implement standard transition lookup, sealed-payload validation, guard dispatch,
  destination derivation, authority invalidation, next-action issuance, and CAS request assembly in
  `internal/application/apply_action.go` and `internal/workflow/engine.go` per FR-009–FR-012.
- [ ] T038 [US1] Add `TRANSITION_NOT_ALLOWED` and `PROCESS_UNSUPPORTED` domain/application mappings in
  `internal/domain/errors.go` and current error adapters per FR-037.
- [ ] T039 [US1] Upgrade server/open/read/next/apply schemas in `internal/mcp/schemas.go` to the exact
  Core Contract 0.2 closed shapes while keeping six tool names/order per FR-032–FR-036.
- [ ] T040 [US1] Upgrade result projections in `internal/mcp/results.go` and tool dispatch in
  `internal/mcp/tools.go` for graph tasks without exposing private paths/raw artifacts
  per FR-033–FR-036.
- [ ] T041 [P] [US1] Add canonical standard handshake/open/requirements/design/invalid-edge fixtures
  under `protocol/fixtures/graph-*.json` and document version separation in
  `protocol/fixtures/README.md` per SC-001–SC-003 and SC-010.
- [ ] T042 [US1] Extend `tests/contract/mcp_contract_test.go`,
  `tests/contract/fixture_contract_test.go`, and
  `tests/contract/result_envelope_test.go` for schema 2, exact tool catalog, closed inputs, action
  projection, transition order, and zero-write invalid edge per FR-032–FR-037.
- [ ] T043 [US1] Add `tests/journeys/process_graph_navigation_test.go` implementing Quickstart
  Journey A, including requirements baseline creation, DESIGN edge list, repeated-read identity, and
  invalid `delivery_complete` from DESIGN per SC-001–SC-003.

**Verification**

- [ ] T044 [US1] Run only `go test ./internal/application ./internal/mcp ./tests/contract
  ./tests/journeys -run 'ProcessGraphNavigation|GraphContract|MCPContract|FixtureContract'` (or the
  exact equivalent focused patterns created by the tests); do not run the full repository suite.
- [ ] T045 [US1] Run `$speckit-converge`; record `USER_STORY_1_CHECKPOINT_COMPLETE` only when the
  independent journey passes and stop.

**Checkpoint**: A developer can read current node obligations and all legal next nodes through the
existing tool surface.

---

## Phase 5: User Story 2 — Testing, Comprehension, Refactor, and Backward Loops

**Goal**: Enforce the real iterative development graph and current-evidence gates.

**Independent Test**: Quickstart Journeys B and C.

- [ ] T046 [P] [US2] Implement requirements-baseline creation/revision and destination
  `REQUIREMENTS` invalidation in `internal/workflow/payloads_v2.go`,
  `internal/workflow/engine.go`, and `internal/domain/task_v2.go` per FR-021–FR-022.
- [ ] T047 [P] [US2] Implement design/task-plan baseline validation, upstream revision binding,
  work-item dependency/acceptance coverage, and downstream invalidation in the same workflow/domain
  files per FR-023–FR-024.
- [ ] T048 [US2] Implement standard IMPLEMENT repository-effect validation, implementation record,
  problem-class transitions, and current-evidence invalidation in `internal/workflow/engine.go` and
  `internal/recovery/` integration points per FR-016 and the graph contract.
- [ ] T049 [US2] Implement TEST payload validation, budget accounting, failure classification,
  Core-owned evidence IDs, and current TestRecord creation in
  `internal/workflow/payloads_v2.go` and `internal/application/apply_action.go` per FR-013,
  FR-025, and FR-041.
- [ ] T050 [US2] Implement COMPREHENSION_REVIEW payload/transition validation and explicit
  `source=user,status=passed` evidence requirement in the workflow/application layers per
  FR-014–FR-015.
- [ ] T051 [US2] Implement REFACTOR payload, repository-change handling, simplification guard, and
  mandatory `refactor_ready_for_test → TEST` behavior per FR-016–FR-017.
- [ ] T052 [US2] Implement DELIVERY current-authority validation and ProcessOutcome construction from
  the latest requirements/test/comprehension/evidence/repository state per FR-018 and
  `data-model.md`.
- [ ] T053 [US2] Implement every backward/remediation guard and normalized reason rule for the 29
  transitions in `internal/workflow/standard_process.go` and
  `internal/workflow/payloads_v2.go` per FR-011–FR-012.
- [ ] T054 [P] [US2] Add table-driven `internal/workflow/standard_process_test.go` coverage proving
  all 29 legal transitions, declaration order, guard acceptance/rejection, and every undeclared
  source/transition zero-write outcome per SC-002.
- [ ] T055 [P] [US2] Add `internal/domain/task_v2_invalidation_test.go` for the complete invalidation
  matrix, monotonic baseline revisions, compact history limits, and stale record rejection per
  SC-005–SC-007.
- [ ] T056 [US2] Add `tests/journeys/process_graph_iteration_test.go` implementing test failure →
  implementation, test pass → comprehension, code-too-complex → refactor, refactor → test, fresh
  comprehension, and DONE per SC-004–SC-007.
- [ ] T057 [US2] Add negative comprehension/delivery tests in the same journey file for absent user
  evidence, stale test, stale comprehension, old baseline revisions, wrong evidence source, and
  direct refactor/delivery skips per SC-006–SC-007.
- [ ] T058 [US2] Add requirement/design rework journeys from TEST/COMPREHENSION/DELIVERY and prove
  exact authority invalidation/revision rebinding per Quickstart Journey C.

**Verification**

- [ ] T059 [US2] Run only `go test ./internal/domain ./internal/workflow ./internal/application
  ./tests/journeys -run 'StandardProcess|Invalidation|ProcessGraphIteration|ProcessGraphRework'`.
- [ ] T060 [US2] Run `$speckit-converge`; record `USER_STORY_2_CHECKPOINT_COMPLETE` and stop.

**Checkpoint**: The development loop distinguishes implementation, design, requirement, complexity,
verification, and comprehension failures; stale evidence cannot reach delivery.

---

## Phase 6: User Story 3 — Plain, Spec Kit, and OpenSpec Profiles

**Goal**: Render method-specific next operations without adapter-owned workflow state.

**Independent Test**: Quickstart Journey D.

- [ ] T061 [P] [US3] Add all semantic method-step definitions and per-node required ordering to
  `internal/workflow/standard_process.go` and validate them in
  `internal/workflow/definitions_test.go` per FR-027–FR-030.
- [ ] T062 [US3] Include immutable method profile and semantic steps in standard Task/Action/MCP
  projections and validate submitted MethodEvidence against the current node in
  `internal/domain/method.go` and `internal/workflow/payloads_v2.go` per FR-027–FR-031.
- [ ] T063 [P] [US3] Add
  `packages/codex/plugin/skills/dev-flow/references/method-profiles.md` containing the exact
  Host-rendering/capability/fallback contract from
  `specs/008-refactor-to-development-process-graph/contracts/method-profiles.md`.
- [ ] T064 [US3] Add the method-profile reference to the closed files allowlist in
  `packages/codex/package.json` and package-contract expectations in
  `packages/codex/tests/package-contract.test.mjs` without adding a production dependency.
- [ ] T065 [US3] Refactor `packages/codex/plugin/skills/dev-flow/SKILL.md` handshake/admission/action
  loop to require schema 2, read the complete Core node/transition/method result, render only
  available profile capabilities, and submit only Core-returned transitions per FR-029,
  FR-039, and the method-profile contract.
- [ ] T066 [US3] Add Codex Skill handling for `SCHEMA_UNSUPPORTED` pre-graph data that reports the
  fresh-directory/user-controlled archive-rename-delete boundary, reveals no private database path,
  and performs no automatic reset per FR-S004–FR-S006.
- [ ] T067 [US3] Remove any adapter-owned normal phase sequence/destination inference from the Codex
  Skill while retaining exact request identity, closed payload forwarding, evidence budget, and
  recovery-before-retry rules per FR-039 and FR-S010.
- [ ] T068 [P] [US3] Add Codex fixtures for all three profiles, missing Spec Kit clarify, missing
  OpenSpec verify, plain fallback, and equivalent semantic transition in
  `packages/codex/tests/skill-contract.test.mjs` and focused fixture files per SC-008–SC-009.
- [ ] T069 [US3] Extend `packages/codex/tests/journey-harness.test.mjs` to assert node-contract
  presentation, multiple destinations, explicit user comprehension prompt, and no method-tool
  completion claim without actual capability evidence per SC-008–SC-009.
- [ ] T070 [P] [US3] Add shared Core Contract 0.2 fixtures with `host=codex` and `host=deepseek` in
  `protocol/fixtures/` and parity assertions in `tests/contract/fixture_contract_test.go` per
  FR-040 and SC-010; do not modify `packages/deepseek/` product behavior.

**Verification**

- [ ] T071 [US3] Run only `node --test packages/codex/tests/skill-contract.test.mjs
  packages/codex/tests/package-contract.test.mjs packages/codex/tests/journey-harness.test.mjs` and
  the focused shared fixture Go tests.
- [ ] T072 [US3] Run `$speckit-converge`; record `USER_STORY_3_CHECKPOINT_COMPLETE` and stop.

**Checkpoint**: Method profiles reduce tool-step memory burden but cannot change Core semantics.

---

## Phase 7: User Story 4 — Storage Boundary and Current-Task Recovery

**Goal**: Prove fresh storage bootstrap, explicit rejection of historical task data, and at-most-once
recovery for current graph tasks.

**Independent Test**: Quickstart Journeys E–G.

- [ ] T073 [US4] Replace phase-only operation-probe public/internal fields with exact process
  reference plus `source_cursor` in `internal/domain/operation.go`, `internal/application/`,
  `internal/mcp/schemas.go`, and related fixtures per FR-S009–FR-S010 and
  `contracts/mcp-tools-0.2.md`.
- [ ] T074 [US4] Generalize `internal/recovery/` classification/committed-proof logic for the single
  graph process, exact source cursor, sealed transition payload, and source action without changing
  the five classifications per FR-S009–FR-S010.
- [ ] T075 [US4] Add repository-effect derivation for process-artifact-only, product-file, exact
  binding, and blocker restoration in `internal/workflow/payloads.go` and `internal/recovery/` while
  retaining read-only Git per FR-038 and FR-041.
- [ ] T076 [US4] Extend recovery BLOCKED/RESOLVE_BLOCKER storage and projection with exact process
  reference and standard resume node, returning only to that node with a new action identity per the
  process/storage contracts.
- [ ] T077 [P] [US4] Extend `tests/journeys/recovery_uncertainty_test.go` and helpers with all five
  classifications for a repository-changing REFACTOR action and exact process/source operation probe
  per SC-014.
- [ ] T078 [P] [US4] Add a two-handle graph transition CAS race in
  `tests/journeys/process_graph_concurrency_test.go`, proving one revision/event at most and exact
  loser readback per SC-014.
- [ ] T079 [US4] Add `tests/journeys/process_graph_restart_test.go` implementing restart at
  COMPREHENSION_REVIEW and exact task/action/baseline/test/profile/transition equality per Quickstart
  Journey E and SC-011.
- [ ] T080 [US4] Add `tests/journeys/storage_generation_boundary_test.go` implementing Quickstart
  Journey F: direct fresh Schema 2 bootstrap, representative Schema 1 zero-write rejection before
  decode, explicit switch to a fresh data directory, and creation of only a standard task per
  FR-S001–FR-S007 and SC-011–SC-013.
- [ ] T081 [US4] Add static/contract assertions in `tests/contract/storage_generation_2_test.go` that
  production source contains no `legacy-linear`, v1 task codec, dual task projection, `ALTER TABLE`
  compatibility migration, task import/export, or automatic data-reset path per FR-S003.
- [ ] T082 [US4] Add package/Skill contract tests proving setup/update/remove/uninstall and
  `SCHEMA_UNSUPPORTED` guidance never delete/rename/truncate old data and never expose a private data
  path per FR-S004–FR-S006.
- [ ] T083 [US4] Add future/corrupt Schema 2 and unsupported process/digest cases to focused Store and
  contract tests, with unchanged before/after manifests per FR-S007 and SC-013.
- [ ] T084 [US4] Run focused Store/recovery/journey/contract/package tests for bootstrap, old-data
  rejection, current uncertainty, blocker resolution, concurrency, restart, lifecycle non-deletion,
  and future/corrupt safe-stop.
- [ ] T085 [US4] Run `$speckit-converge`; record `USER_STORY_4_CHECKPOINT_COMPLETE` and stop.

**Checkpoint**: The graph Core carries no historical-task runtime, fresh/current tasks restart and
recover exactly, and unsupported old data remains unchanged until the user explicitly chooses a new
or reset data directory.

---

## Phase 8: Documentation and Final Feature Gate

**Goal**: Reconcile delivered behavior and run the one allowed full/local-host gates.

- [ ] T086 Update `README.md` with the delivered graph-based local behavior, exact current release
  boundary, and no statement that an unpublished graph version is available from npm.
- [ ] T087 [P] Update `docs/PRODUCT.md` and `docs/ARCHITECTURE.md` with TaskIntent/baselines,
  single standard process authority, method profiles, comprehension/refactor loop, fresh Schema 2, and
  unchanged six-tool/read-only Git boundaries.
- [ ] T088 [P] Update `docs/ROADMAP.md` and `MANIFEST.md` only with Feature 008 delivered status and a
  separate future Release Change; retain historical 0.3.0 identities.
- [ ] T089 [P] Update `packages/codex/README.md`,
  `protocol/fixtures/README.md`, and `tests/{contract,journeys}/README.md` for the implemented local
  Contract 0.2 evidence classes without public-release claims.
- [ ] T090 Run the complete targeted Go and Codex package sets named by prior checkpoints once after
  documentation reconciliation; fix only concrete failures.
- [ ] T091 Build one source-local Codex package artifact with the existing local builder, verify
  package/Core identity and closed contents, and keep it outside the repository; do not publish.
- [ ] T092 Run exactly one native real Codex journey implementing Quickstart Final Journey, including
  fresh data root, visible multiple destinations, test/complexity/refactor/retest, restart/resume, explicit user
  comprehension, DONE, removal/uninstall, and retained reopen per SC-015.
- [ ] T093 Run `RELEASE_BASE_SHA=<feature-base> pnpm run validate` exactly once; do not separately
  duplicate the repository-wide Go suite that it runs.
- [ ] T094 Run final `$speckit-analyze` and `$speckit-converge`; resolve blocking findings and append
  only concrete remaining acceptance gaps.
- [ ] T095 Reconcile all Feature checkboxes/status/evidence labels; mark Feature 008 `Complete` only
  when SC-001–SC-016 are satisfied, confirm `VERSION`/package versions/Tags/npm/GitHub Releases are
  unchanged, and state that publication requires a separate Release Change.

**Final Checkpoint**: Product source supports the development process graph locally, all storage-boundary
and recovery gates pass, and no release mutation has occurred.

## Dependencies and Execution Order

```text
Phase 1 contract freeze
        ↓
Phase 2 process/domain
        ↓
Phase 3 fresh Schema 2/single codec
        ↓
US1 navigation
        ↓
US2 iterative graph
        ↓
US3 method profiles
        ↓
US4 storage boundary/recovery
        ↓
Final documentation/local acceptance
```

Within a phase, `[P]` tasks may run in parallel only after their inputs exist and only when they
touch different files.

## Test Budget

| Scope | Maximum / Rule |
| --- | --- |
| Targeted checks | Run at named checkpoints; rerun only after a concrete failure/fix |
| Repository-wide validation | Exactly 1 final `pnpm run validate` |
| Real Codex journey | Exactly 1 final local-artifact journey |
| Released 0.3.0 old-binary/legacy-task journey | 0 |
| Real Spec Kit/OpenSpec installation matrix | 0 |
| Linux/Windows/Intel Mac native journey | 0 |
| Real DeepSeek journey | 0 |
| npm/Tag/GitHub Release mutation | 0 |

## Notes

- A checked task means its exact result and evidence are complete.
- Fake/static/simulated/user/native evidence labels remain distinct.
- Do not use a full suite as a substitute for a missing targeted contract.
- Do not create a generic workflow framework while implementing static definitions.
- Stop at every phase/user-story checkpoint unless the user explicitly authorizes the next slice.
