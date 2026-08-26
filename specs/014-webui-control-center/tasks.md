# Tasks: Dev Flow WebUI Control Center

**Input**: `specs/014-webui-control-center/` design documents

**Prerequisites**: `spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`

**Verification budget**: Automated verification is closed to `V01`–`V08` in `plan.md`. A validation task may add rows to
one assigned table-driven suite, but MUST NOT introduce another group, command, UI test, screenshot matrix or per-Host
duplicate journey.

**Organization**: Implementation follows the four mandatory checkpoints in user-story order. Every task names its authority
and exact paths. Product-owner UI acceptance is manual and is not an automated test task.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: May run in parallel because it owns different files and does not depend on an incomplete task.
- **[US1]–[US4]**: Map to the four user stories in `spec.md`.
- Every implementation checkpoint stops after its assigned validation group passes.

## Phase 1: Setup

**Purpose**: Establish the private frontend source project and deterministic embedded-asset build.

- [X] T001 Create the private React/TypeScript/Vite workspace with exact dependency and engine bounds in `packages/webui/package.json`, `packages/webui/tsconfig.json`, `packages/webui/vite.config.ts`, `packages/webui/index.html`, `packages/webui/src/main.tsx`, `pnpm-workspace.yaml`, and `pnpm-lock.yaml` (FR-031, plan Frontend build)
- [X] T002 Add the deterministic frontend build/embed entry and generated-asset boundary in `scripts/build-webui.sh`, `package.json`, `internal/webui/assets.go`, and `internal/webui/assets/README.md` (FR-031, FR-036, V06)

**Checkpoint**: The private frontend builds into the Core embed input without creating a standalone runtime product.

---

## Phase 2: Foundational Core/Web Boundary

**Purpose**: Create the shared closed HTTP boundary required by all four user stories.

- [X] T003 Define closed request, response, error, readiness, Task summary/detail, graph, Action, Recovery and operation-probe models matching `contracts/web-api.openapi.yaml` in `internal/webui/types.go` and `internal/webui/response.go` (FR-001–FR-003, FR-023–FR-030)
- [X] T004 Implement the loopback server, embedded static assets, exact Origin check and process-local session value in `internal/webui/server.go`, `internal/webui/session.go`, and `internal/webui/static.go` without adding authentication, accounts or a remote listen option (FR-030, FR-031, V04)
- [X] T005 Add the bounded Control Center facade and interfaces without a second workflow cursor in `internal/application/control_center.go`, `internal/application/types.go`, and `internal/store/store.go` (FR-001–FR-005)

**Checkpoint**: Core owns all workflow facts; the Web adapter can expose closed local responses but no Task behavior yet.

---

## Phase 3: User Story 1 — Find and understand Tasks (Priority: P1 / CP1)

**Goal**: Deliver dashboard, complete filtering, Task detail, committed history, graph projection and polling.

**Independent acceptance**: Follow CP1 in `quickstart.md`; UI presentation is accepted manually by the product owner.

- [X] T006 [P] [US1] Implement bounded Task listing, deterministic filters/pages and ordered TaskEvent reads in `internal/store/store.go`, `internal/store/sqlite.go`, and `internal/store/control_center_read.go` (FR-006–FR-011, FR-014, V02)
- [X] T007 [P] [US1] Implement read-time process graph projection with repeated traversals, current legal edges, cycle-safe future reachability and safe-stop in `internal/workflow/control_center_projection.go` (FR-012–FR-017, V01)
- [X] T008 [US1] Compose dashboard, Task list and one-revision Task detail views through Core-owned behavior in `internal/application/control_center_read.go` using T006 and T007 (FR-006–FR-017, SC-001–SC-003)
- [X] T009 [US1] Add dashboard, Task-list, Task-detail and system-status GET handlers in `internal/webui/read_handlers.go` and register only the corresponding OpenAPI routes in `internal/webui/server.go` (FR-006–FR-017, V03/V04)
- [X] T010 [P] [US1] Implement the approved visual foundations and application shell in `packages/webui/src/styles/tokens.css`, `packages/webui/src/styles/layout.css`, `packages/webui/src/app/App.tsx`, `packages/webui/src/app/router.tsx`, and `packages/webui/src/components/AppShell.tsx` without creating unused generic component families (FR-039–FR-045)
- [X] T011 [US1] Implement dashboard, filtered list, detail, timeline, graph, alternate transition list and polling invalidation in `packages/webui/src/pages/DashboardPage.tsx`, `packages/webui/src/pages/TaskListPage.tsx`, `packages/webui/src/pages/TaskDetailPage.tsx`, `packages/webui/src/components/ProcessGraph.tsx`, `packages/webui/src/components/TaskTimeline.tsx`, and `packages/webui/src/lib/api.ts` (FR-006–FR-017, SC-001–SC-003)
- [X] T012 [US1] Implement the CP1 rows of the closed V01, V02 and V04 tables in `internal/workflow/control_center_projection_test.go`, `internal/store/control_center_test.go`, and `internal/webui/boundary_test.go`; cover the CP1 success, repeated-path, cycle, stale-poll and safe-stop cases without UI tests or a Journey (V01, V02, V04)

**Checkpoint**: CP1 acceptance and its assigned V01/V02/V04 rows pass; stop before CP2.

---

## Phase 4: User Story 2 — Manage the Task lifecycle (Priority: P1 / CP2)

**Goal**: Deliver create/resume, cancel, archive/restore and eligible permanent purge.

**Independent acceptance**: Follow CP2 in `quickstart.md`; stale and ineligible operations produce zero writes.

- [X] T013 [P] [US2] Add `tasks.archived_at` to the exact current schema, bootstrap and preflight rules in `internal/store/migrations.go`, `internal/store/codec.go`, and `internal/store/control_center_write.go` without a projection table, ledger or tombstone (FR-005, FR-020, persistence contract)
- [X] T014 [US2] Implement create/resume reuse, cancellation, idempotent archive/restore and transactional purge through `internal/application/control_center_lifecycle.go`, `internal/store/store.go`, and `internal/store/control_center_write.go` with revision CAS and eligibility recheck (FR-018–FR-022, SC-004–SC-006)
- [X] T015 [US2] Add open/resume, cancel, archive and purge POST handlers in `internal/webui/lifecycle_handlers.go` and register only the matching OpenAPI routes in `internal/webui/server.go` (FR-018–FR-022, V03)
- [X] T016 [P] [US2] Implement Task creation, cancellation, archive/restore and purge confirmation UI in `packages/webui/src/pages/OpenTaskPage.tsx`, `packages/webui/src/components/LifecycleActions.tsx`, and `packages/webui/src/components/PurgeDialog.tsx` without a reset dialog or page (FR-018–FR-022, FR-039–FR-045)
- [X] T017 [US2] Add the CP2 rows to the closed V02 and V03 tables in `internal/store/control_center_test.go`, `internal/application/control_center_test.go`, and `internal/webui/handlers_test.go`; use one table for accepted, stale, concurrent, ineligible, idempotent and rollback outcomes (SC-008, V02, V03)

**Checkpoint**: CP2 acceptance and its assigned V02/V03 rows pass; stop before CP3.

---

## Phase 5: User Story 3 — Execute Action and Recovery (Priority: P1 / CP3)

**Goal**: Deliver Workflow-owned Action schemas, closed submission, correction, Recovery advice and Blocker resolution.

**Independent acceptance**: Follow CP3 in `quickstart.md`; WebUI advances only from Core-returned Task and Action facts.

- [X] T018 [P] [US3] Add one Workflow-owned closed Action payload-schema provider covering every current Action kind in `internal/workflow/action_schema.go`, project the same source from `internal/mcp/schemas.go`, and expose the current exact schema through `internal/webui/read_handlers.go` (FR-023, FR-024, FR-028, V01)
- [X] T019 [US3] Add current Action submission, operation-probe Recovery assessment/application and Blocker resolution mappings in `internal/application/control_center_action.go` without retaining or resending an obsolete browser-session value (FR-023–FR-027)
- [X] T020 [US3] Add Action submit and Recovery assess/apply POST handlers in `internal/webui/action_handlers.go` and register the closed OpenAPI routes in `internal/webui/server.go` (FR-023–FR-028, V03)
- [X] T021 [P] [US3] Implement schema-driven Action fields, Evidence, transition choices, Core correction messages, Recovery advice and Blocker resolution in `packages/webui/src/components/ActionPanel.tsx`, `packages/webui/src/components/SchemaField.tsx`, `packages/webui/src/components/RecoveryPanel.tsx`, `packages/webui/src/components/BlockerPanel.tsx`, `packages/webui/src/lib/api.ts`, `packages/webui/src/pages/TaskDetailPage.tsx`, `packages/webui/src/styles/layout.css`, and the deterministic `internal/webui/assets/generated/` output (FR-023–FR-027, FR-039–FR-045)
- [X] T022 [US3] Complete the V01 and V03 tables in `internal/workflow/action_schema_test.go`, `internal/mcp/host_projection_test.go`, `internal/application/control_center_test.go`, and `internal/webui/handlers_test.go`; cover every Action kind once plus representative field, Guard, Recovery and Blocker envelopes without UI rendering tests (V01, V03)

**Checkpoint**: CP3 acceptance and the complete V01/V03 groups pass; stop before CP4.

---

## Phase 6: User Story 4 — Run and share the local WebUI (Priority: P1 / CP4)

**Goal**: Deliver Core CLI lifecycle, CLI-only reset, Host-neutral process reuse, package closure and maintained documentation.

**Independent acceptance**: Follow CP4 in `quickstart.md`; V07 proves only Host A start and Host B reuse.

- [X] T023 [US4] Implement `dev-flow webui start|open|status|stop` plus the internal `serve` entrypoint and mode-0600 runtime receipt in `cmd/dev-flow/main.go`, `internal/webui/runtime.go`, and `internal/webui/receipt.go` (FR-029, FR-032, FR-035, V05)
- [X] T024 [US4] Implement CLI-only reset plan/confirm with exact target binding, database-exclusive access and zero-delete failure in `cmd/dev-flow/main.go`, `internal/store/reset.go`, and `internal/webui/runtime.go`; expose no reset HTTP mutation (FR-033, FR-034, V04/V05)
- [X] T025 [P] [US4] Implement ready/read-only/reset-required/incompatible/unavailable UI states and exact CLI reset guidance in `packages/webui/src/pages/SystemStatePage.tsx` and `packages/webui/src/components/RuntimeStatus.tsx` without reset confirmation UI (FR-010, FR-034, FR-035)
- [X] T026 [US4] Integrate the WebUI build into Core and both maintained Host package build paths in `scripts/build-webui.sh`, `scripts/build-codex-local.sh`, `scripts/build-codex-release.sh`, `scripts/build-deepseek-runtime.sh`, `scripts/build-deepseek-release.sh`, `packages/codex/package.json`, and `packages/deepseek/package.json` (FR-031, FR-036, V06)
- [X] T027 [US4] Complete the closed V04 and V05 tables in `internal/webui/boundary_test.go`, `internal/webui/runtime_test.go`, `internal/store/reset_test.go`, and `cmd/dev-flow/main_test.go`; cover listener/session protection, no reset route, receipt reuse, full Core CLI lifecycle and reset failures once (SC-007, V04, V05)
- [X] T028 [US4] Implement V06 package-closure checks for embedded entry HTML, JavaScript, CSS, SVG and manifest plus compatible Core commands in `tests/contract/package_manifest_test.go`, `packages/codex/tests/package-contract.test.mjs`, and `packages/deepseek/tests/package-contract.test.mjs` (V06)
- [X] T029 [US4] Implement the single Host A start / Host B status-and-open reuse journey in `tests/journeys/webui_host_parity_test.go` without Task operations, reset, per-Host duplication or another real-Host journey (SC-009, V07)
- [X] T030 [P] [US4] Synchronize commands, local boundary, reset semantics, package support, bilingual UI behavior and user guidance in `README.md`, `README_en.md`, `README_de.md`, `README_es.md`, `README_fr.md`, `README_ja.md`, `README_ko.md`, `README_pt-BR.md`, `README_zh-TW.md`, `docs/PRODUCT.md`, `docs/PRODUCT_en.md`, `docs/ARCHITECTURE.md`, `docs/ARCHITECTURE_en.md`, `docs/COMMANDS.md`, `docs/COMMANDS_en.md`, `docs/SUPPORT-MATRIX.md`, `docs/SUPPORT-MATRIX_en.md`, `docs/THREAT-MODEL.md`, `docs/THREAT-MODEL_en.md`, `docs/ROADMAP.md`, `docs/ROADMAP_en.md`, `docs/WEBUI.md`, `docs/WEBUI_en.md`, `internal/README.md`, `internal/README_en.md`, `packages/codex/README.md`, and `packages/deepseek/README.md` (FR-037, FR-046–FR-048)
- [X] T033 [US4] Replace the rejected concept-style presentation with the approved restrained production-tool system and implement typed, natural Simplified Chinese/English copy, system-language default, browser-local manual switching and consistent form/select/filter controls across `packages/webui/src/lib/i18n.tsx`, `packages/webui/src/app/`, `packages/webui/src/components/`, `packages/webui/src/pages/`, `packages/webui/src/styles/`, and `internal/webui/assets/generated/` (FR-039–FR-048, SC-014, SC-015)
- [X] T034 [US4] Expose the ordered current process-node filter choices from Workflow-owned authority through `internal/webui/types.go`, `internal/webui/read_handlers.go`, `internal/webui/server.go`, `internal/webui/handlers_test.go`, and `packages/webui/src/lib/api.ts` without a frontend node registry (FR-001, FR-007, V03)
- [X] T035 [US4] Rename the combined entry to Start Task, hide repository keys behind deterministic defaults, and replace every native select with one keyboard-accessible WebUI combobox/listbox in `packages/webui/src/components/SelectField.tsx`, `packages/webui/src/components/SchemaField.tsx`, `packages/webui/src/pages/TaskListPage.tsx`, `packages/webui/src/pages/OpenTaskPage.tsx`, `packages/webui/src/components/AppShell.tsx`, `packages/webui/src/lib/i18n.tsx`, `packages/webui/src/styles/layout.css`, and `internal/webui/assets/generated/` (FR-018, FR-039–FR-048, SC-014, SC-015)
- [X] T031 [US4] Present the surfaces in `specs/014-webui-control-center/contracts/visual-design.md` for product-owner manual UI acceptance and record the accepted checkpoint in `specs/014-webui-control-center/README.md`; do not create automated UI or screenshot evidence (SC-011, SC-012)
- [X] T032 [US4] Run the V08 repository gate exactly once through `package.json` and `scripts/validate-repository.sh` after V01–V07 pass; record unavailable or failed checks in the pull-request validation summary and do not explicitly rerun V01–V06 immediately beforehand (FR-038, SC-010, SC-013, V08)

**Checkpoint**: CP4, V04–V08, documentation parity and product-owner UI acceptance pass; the Feature may then become `Complete`.

---

## Dependencies & Execution Order

### Phase dependencies

1. Phase 1 Setup has no dependency.
2. Phase 2 Foundation depends on Phase 1 and blocks every user story.
3. CP1/US1 depends on Foundation.
4. CP2/US2 starts only after the CP1 checkpoint because it reuses the delivered Task pages and read models.
5. CP3/US3 starts only after CP2 because it adds mutation panels to the delivered Task lifecycle UI.
6. CP4/US4 starts only after CP3 and owns package closure, documentation, manual UI acceptance and final validation.

### Validation ownership

- V01: T012 and T022.
- V02: T012 and T017.
- V03: T017 and T022.
- V04: T012 and T027.
- V05: T027 only.
- V06: T028 only.
- V07: T029 only.
- V08: T032 only.

No task may add another automated group or command without an approved amendment to `spec.md` and `plan.md`.

### Parallel opportunities

- T003 and T004 may proceed in parallel after T001/T002 when their shared `internal/webui` file boundaries are coordinated.
- In CP1, T006 and T007 are parallel; T010 is parallel with Core read work; T008/T009/T011 integrate afterward.
- In CP2, T013 and T016 may proceed in parallel; T014/T015 then integrate Store/Application/HTTP behavior.
- In CP3, T018 and T021 may proceed in parallel; T019/T020 then integrate the shared schema and Core behavior.
- In CP4, T025 and T030 may proceed in parallel with Core runtime work; T026–T029 follow the completed runtime and assets.

## Implementation Strategy

This Feature is one complete product scope, not a reduced MVP. The four checkpoints are mandatory vertical slices:

1. Complete CP1 and its assigned V rows, then stop.
2. Complete CP2 and its assigned V rows, then stop.
3. Complete CP3 and finish V01/V03, then stop.
4. Complete CP4, V04–V07, documentation and product-owner UI acceptance.
5. Run V08 once and stop before any version or publication work.

## Notes

- Tests are not required to be written first; TDD is optional.
- UI appearance and interaction are not automated-test scope.
- Feature completion does not authorize Git mutation, version changes, tags, npm publication or GitHub Release effects.
- Exact validation commands should be finalized against executable test symbols when each validation task is implemented.
