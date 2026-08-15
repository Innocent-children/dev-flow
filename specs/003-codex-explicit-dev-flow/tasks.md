---

description: "Dependency-ordered implementation tasks for the local Codex product"
---

# Tasks: Codex Explicit Dev Flow

**Input**: Design documents from `specs/003-codex-explicit-dev-flow/`
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`
**Tests**: Required by FR-025–FR-028 and the independent-test criteria for all three user stories. Write each new targeted test before its implementation and demonstrate that the new assertion fails for the missing behavior.

**Organization**: Tasks are grouped by Setup, shared Foundation, User Story 1, User Story 2, User Story 3, and final cross-cutting validation. Feature 003 owns the shared detached-binary version seam; other host products consume it but must not implement a duplicate.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel with other marked work in the same ready phase because it owns different files and has no unmet intra-phase dependency.
- **[Story]**: Maps implementation and tests to the independently reviewable user story.
- Every task names the exact repository path or paths it may change or validate.

## Phase 1: Setup (Shared Product Structure)

**Purpose**: Turn the reserved Codex skeleton into an explicit private product boundary without adding runtime dependencies or installation mutation.

- [ ] T001 Define `dev-flow-codex` private-product metadata, Node engine, explicit `bin`/`files` allowlists, and zero install lifecycle hooks or runtime dependencies in `packages/codex/package.json` (FR-001, FR-003)
- [ ] T002 Add targeted Codex test, local-pack, and journey command entry points without publication commands or new dependencies in `packages/codex/package.json` (FR-001, FR-008)
- [ ] T003 [P] Replace skeleton-only guidance with source layout, supported macOS arm64/Codex CLI 0.147.x boundary, local developer commands, and non-publication rules in `packages/codex/README.md` (FR-001, FR-008)
- [ ] T004 [P] Create an isolated test-only Codex plugin/marketplace CLI double with JSON readback, failure injection, and no real user-state writes in `packages/codex/tests/fixtures/fake-codex.mjs` (FR-004, FR-005)

---

## Phase 2: Foundation (Blocking Prerequisites)

**Purpose**: Supply the one shared packaging seam, path/receipt ownership primitives, and repository contract gates required by every story.

**Critical**: Complete this phase before story work. T005–T006 are Feature 003-owned shared Core packaging work; no host-specific state, transition, recovery, or public Core contract may enter those files.

- [ ] T005 [P] Add failing source-fallback, injected-version, invalid/empty injection, and unchanged public-output tests for the detached Core build seam in `internal/version/version_test.go` (FR-002, FR-005)
- [ ] T006 Implement one link-time `buildVersion` preference with the existing source-tree `VERSION` lookup as fallback in `internal/version/version.go`, changing no Core Contract 0.1 tool/schema/state behavior (FR-002, FR-005)
- [ ] T007 [P] Extend Codex manifest contracts for private identity, version parity, one bin, explicit pack allowlist, forbidden lifecycle hooks, and zero production npm dependencies in `tests/contract/package_manifest_test.go` (FR-001–FR-003, FR-025)
- [ ] T008 [P] Extend repository layout contracts to allow the planned Codex product tree while retaining the DeepSeek skeleton boundary and forbidding committed runtime binaries/test fakes outside their exact paths in `tests/contract/repository_layout_test.go` (FR-001, FR-002, FR-025)
- [ ] T009 [P] Add exact six-tool, no-host-fixture-copy, 22-file parity, and canonical manifest digest `8c27bcf6be0e4e5a4bf294c67cbda8cdf281b1b2b2c53fff16206db2828dede7` assertions in `tests/contract/fixture_contract_test.go` (FR-014, FR-025)
- [ ] T010 [P] Add failing tests for package-relative runtime resolution, absolute existing `DEV_FLOW_DATA_DIR` and relative/missing override rejection, macOS default data/receipt paths, Unicode/spaces/symlinks, platform rejection, and non-recursive ownership in `packages/codex/tests/paths.test.mjs` (FR-002, FR-006, FR-007, FR-012)
- [ ] T011 Implement canonical package/runtime/user-data path resolution with explicit environment override precedence and no current-repository writes in `packages/codex/lib/paths.mjs` (FR-002, FR-006, FR-007, FR-012)
- [ ] T012 [P] Add failing closed receipt validation, digest/version identity, atomic-write, symlink-escape, missing/malformed receipt, and adjacent-file preservation cases in `packages/codex/tests/lifecycle.test.mjs` using `specs/003-codex-explicit-dev-flow/contracts/registration-receipt.schema.json` (FR-005, FR-007)
- [ ] T013 Implement direct Codex JSON-command invocation, closed receipt parsing/validation, atomic receipt writes, and exact ownership comparisons in `packages/codex/lib/lifecycle.mjs` without parsing MCP/task payloads (FR-005, FR-007)
- [ ] T014 Run the foundational targeted checks for `internal/version/`, `tests/contract/`, `packages/codex/tests/paths.test.mjs`, and the receipt cases in `packages/codex/tests/lifecycle.test.mjs`, resolving only failures caused by T001–T013 (FR-002, FR-025)

**Checkpoint**: The detached Core reports the package version, shared contract/fixture gates are authoritative, and product lifecycle code has safe path/receipt primitives but no registration behavior yet.

---

## Phase 3: User Story 1 — Install and Explicitly Invoke Dev Flow (Priority: P1) MVP

**Goal**: Build one local artifact, register exactly one plugin/Skill/STDIO server through explicit setup, reject implicit or invalid invocation, and leave the target repository untouched.

**Independent Test**: Install a newly packed artifact with scripts disabled in an isolated prefix, run setup twice against supported Codex CLI 0.147.x, start a fresh session, prove ordinary/invalid prompts create no task, explicitly select `$dev-flow` with a substantive single-repository request, observe the exact six tools, and compare target-repository fingerprints.

### Tests for User Story 1

- [ ] T015 [P] [US1] Add failing source-and-tarball contracts for one plugin/Skill/MCP server, package/Core/plugin version parity, prebuilt runtime inclusion, allowlisted contents, no fixture/source/test-fake copies, no install mutation, and no embedded workflow implementation in `packages/codex/tests/package-contract.test.mjs` (FR-001–FR-003, FR-009, FR-014, FR-025)
- [ ] T016 [P] [US1] Add failing inherited-stdio launcher tests for restrictive exact-default data-directory creation, existing explicit override enforcement, argv fidelity, package-local executable selection, unsupported platform, missing/non-executable runtime, exit/signal forwarding, and zero launcher stdout contamination in `packages/codex/tests/launcher.test.mjs` (FR-002, FR-005)
- [ ] T017 [P] [US1] Extend setup tests with platform/version/resource/PATH preflight, zero-write failure, marketplace/plugin JSON calls, exact readback, atomic receipt, matching repeat, conflicting ownership, bounded rollback, and current-directory fingerprint cases in `packages/codex/tests/lifecycle.test.mjs` (FR-004–FR-006, SC-001)
- [ ] T018 [P] [US1] Add failing Skill requirements tests for one `dev-flow` resource, exact current-turn `$dev-flow` guard, zero implicit calls to the six Dev Flow tools, substantive/resume intent, Git/single-repository preconditions, server-info-first handshake, and the six-tool catalog in `packages/codex/tests/skill-contract.test.mjs` (FR-009–FR-014, SC-002)

### Implementation for User Story 1

- [ ] T019 [P] [US1] Define one `dev-flow-local` in-package marketplace whose only source is the in-root `./plugin` directory in `packages/codex/.agents/plugins/marketplace.json` (FR-004, FR-009)
- [ ] T020 [P] [US1] Define the current official single-plugin identity, version, Skill path, and MCP resource path in `packages/codex/plugin/.codex-plugin/plugin.json` (FR-004, FR-008, FR-009)
- [ ] T021 [P] [US1] Configure one local STDIO server with argv exactly `dev-flow-codex mcp` and no extra server/tool/environment authority in `packages/codex/plugin/.mcp.json` (FR-002, FR-014, FR-017)
- [ ] T022 [P] [US1] Implement the exact explicit-selector guard, substantive/resume and one-worktree preconditions, read-only canonical repository discovery, server-info compatibility handshake, and fail-closed diagnostics in `packages/codex/plugin/skills/dev-flow/SKILL.md` (FR-010–FR-014, FR-018)
- [ ] T023 [US1] Implement `mcp` and `--version` command dispatch, package-local Core resolution, platform/executable checks, restrictive exact-default data-directory creation or existing explicit override enforcement, and inherited stdio/exit/signal behavior in `packages/codex/bin/dev-flow-codex.mjs` (FR-002, FR-005)
- [ ] T024 [US1] Implement setup preflight, read-before-write reconciliation, supported marketplace/plugin JSON commands, bounded rollback, exact readback, and receipt creation in `packages/codex/lib/lifecycle.mjs` (FR-004–FR-006)
- [ ] T025 [US1] Wire `setup [--json]` to the lifecycle operation with stderr diagnostics, stable nonzero failure, and no success-before-readback behavior in `packages/codex/bin/dev-flow-codex.mjs` (FR-004, FR-005)
- [ ] T026 [US1] Build a reproducible temporary `darwin-arm64` staging tree, inject root `VERSION`, assert every identity/digest/allowlist invariant, and emit one private `.tgz` without committing a binary or publishing in `scripts/build-codex-local.sh` (FR-001–FR-003, FR-008)
- [ ] T027 [US1] Implement the journey harness stages for prerequisite capture, exact artifact installation with `--ignore-scripts`, before/after repository fingerprints, setup/repeat/readback, fresh-session boundary, and implicit/invalid invocation call tracing in `scripts/run-codex-real-journey.sh` (FR-004–FR-006, FR-010–FR-014, SC-001–SC-002)
- [ ] T028 [US1] Document final-artifact installation, PATH setup, explicit registration/readback, new-session refresh, supported version/platform, invalid invocation, and no-target-repository-write checks in `packages/codex/README.md` (FR-004–FR-008, FR-010–FR-012)
- [ ] T029 [US1] Run the targeted US1 checks in `packages/codex/tests/package-contract.test.mjs`, `packages/codex/tests/launcher.test.mjs`, `packages/codex/tests/lifecycle.test.mjs`, `packages/codex/tests/skill-contract.test.mjs`, and affected `tests/contract/` packages (FR-025)
- [ ] T030 [US1] Build through `scripts/build-codex-local.sh` and run `scripts/run-codex-real-journey.sh --through setup` on Codex CLI 0.147.x/macOS arm64, proving exact plugin discovery, zero implicit task creation, idempotent readback, and no target-repository mutation without treating this checkpoint as final feature evidence (SC-001–SC-002, SC-008)

**Checkpoint**: User Story 1 is independently installable and explicitly discoverable; ordinary or invalid prompts do not create Dev Flow tasks.

---

## Phase 4: User Story 2 — Govern and Resume a Real Codex Task (Priority: P2)

**Goal**: Let the explicitly selected Skill create/resume one Core-owned task, follow only fresh actions, recover through reads, honor evidence budget, restart Codex, and reach Core's terminal outcome.

**Independent Test**: Against the current packed artifact, run the deterministic fake-Core contract suite and a bounded supported Codex CLI session that crosses two Core-confirmed action commits, closes/reopens the host, resumes the same task/revision lineage, respects its automatic command budget, and reaches `DONE`.

### Tests for User Story 2

- [ ] T031 [P] [US2] Create a test-only STDIO Core double that serves the exact six tools from shared `protocol/fixtures/`, records complete requests/results, and injects loss/truncation/conflict/blocker/terminal cases in `packages/codex/tests/fixtures/fake-core.mjs` (FR-013–FR-016, FR-019–FR-024, FR-026)
- [ ] T032 [US2] Add a test-only transcript driver and failing cases for exact tool mapping, explicit-versus-implicit calls, new/resume/conflict, closed identity/payload forwarding, full result retention, success continuation, lost/truncated response reads before retry, verification budget, blocker, and terminal reporting in `packages/codex/tests/fake-core-contract.test.mjs`; assert the driver is excluded from the packed artifact (FR-010, FR-013–FR-026, SC-002–SC-005)
- [ ] T033 [P] [US2] Extend static Skill/package authority tests to reject task-state persistence, transition/action catalogs, error reinterpretation, completion heuristics, generic shell MCP, fixture copies, and production test-driver imports in `packages/codex/tests/skill-contract.test.mjs` (FR-015–FR-018, FR-021–FR-024, SC-006)
- [ ] T034 [P] [US2] Add pass/failed/blocked record, version/digest, revision/action lineage, call-budget, lifecycle, repository, retained-data, failure, and skip validation cases for `specs/003-codex-explicit-dev-flow/contracts/journey-evidence.schema.json` in `packages/codex/tests/journey-evidence.test.mjs` (FR-027, FR-028)
- [ ] T035 [P] [US2] Add a fake-host journey harness contract for bounded commands, artifact digest propagation, repository fingerprints, session restart, exact task lineage, and no simulated/native evidence relabelling in `packages/codex/tests/journey-harness.test.mjs` (FR-023, FR-027, FR-028)

### Implementation for User Story 2

- [ ] T036 [US2] Add Core-authoritative `host=codex` task creation, omitted-contract resume, exact-compatible resume, and conflict-stop guidance to `packages/codex/plugin/skills/dev-flow/SKILL.md` (FR-019, FR-020, SC-003)
- [ ] T037 [US2] Add the fresh-action loop, inseparable action identity, allowed-effects/user-authority gate, closed payload construction, retained request ID, mutation submission, and success continuation to `packages/codex/plugin/skills/dev-flow/SKILL.md` (FR-015–FR-018, FR-021)
- [ ] T038 [US2] Add missing/cancelled/malformed/truncated/uncertain mutation handling with task and next-action reads, exact optional operation probe, Core-owned retry advice, and no fabricated recovery to `packages/codex/plugin/skills/dev-flow/SKILL.md` (FR-021, FR-022)
- [ ] T039 [US2] Add exact automatic verification counting, evidence-source labels, manual handoff, repository-instruction preservation, blocker/conflict/cancel/`DONE` stops, and complete-result presentation to `packages/codex/plugin/skills/dev-flow/SKILL.md` (FR-017, FR-018, FR-023, FR-024)
- [ ] T040 [US2] Extend `scripts/run-codex-real-journey.sh` with one bounded substantive fixture, Core-call capture, two confirmed action commits, deliberate host close/restart, omitted-contract resume, same task/revision checks, command-budget accounting, and Core-owned `DONE` capture (FR-019–FR-024, FR-027, SC-003–SC-005)
- [ ] T041 [US2] Document task create/resume semantics, fresh-action authority, read-before-retry, verification-budget/evidence labels, session restart, blocker/conflict, and Core terminal outcomes in `packages/codex/README.md` (FR-015–FR-024)
- [ ] T042 [US2] Run `packages/codex/tests/fake-core-contract.test.mjs`, `packages/codex/tests/skill-contract.test.mjs`, `packages/codex/tests/journey-evidence.test.mjs`, and `packages/codex/tests/journey-harness.test.mjs`, resolving only US2 contract failures (FR-025, FR-026)
- [ ] T043 [US2] Repack with `scripts/build-codex-local.sh` and run `scripts/run-codex-real-journey.sh --through done` on supported Codex CLI/macOS arm64 to verify real create/restart/resume/budget/terminal behavior, retaining the output as a story checkpoint rather than final support evidence (FR-027, SC-003–SC-005)

**Checkpoint**: User Story 2 is independently governed by Core under fake-contract and native-host restart/resume checks; the adapter contains no workflow authority.

---

## Phase 5: User Story 3 — Remove the Codex Product Without Deleting Task Data (Priority: P3)

**Goal**: Explicitly remove only the recorded Codex registration, uninstall the package separately, preserve shared task bytes and repositories, and permit compatible reinstall/discovery.

**Independent Test**: Using a packed artifact and an existing Core task, remove registration, verify plugin/marketplace/receipt absence, preserve an unknown adjacent file and byte-identical task data, reopen the task through Core, compare repository fingerprints, repeat removal, and reinstall compatibly.

### Tests for User Story 3

- [ ] T044 [P] [US3] Extend lifecycle tests for matching removal, missing/no-op state, interrupted resume, receipt/readback conflict, marketplace-root mismatch, unknown adjacent files, exact receipt cleanup, and explicit prohibition on package/data/repository/cache deletion in `packages/codex/tests/lifecycle.test.mjs` (FR-007)
- [ ] T045 [P] [US3] Add an actual packaged-Core integration test that creates/pauses a task in a temporary data directory, stops Core, deregisters/uninstalls, compares canonical complete data-directory manifests and repository fingerprints, directly reopens the task, and exercises compatible reinstall in `packages/codex/tests/removal-retention.test.mjs` (FR-007, SC-007)

### Implementation for User Story 3

- [ ] T046 [US3] Implement receipt-first/current-state reconciliation, exact plugin removal/readback, matching marketplace removal/readback, receipt-only cleanup, report-but-preserve adjacent entries, idempotent absence, and fail-closed conflict behavior in `packages/codex/lib/lifecycle.mjs` (FR-007)
- [ ] T047 [US3] Wire `remove [--json]` to the bounded lifecycle operation with explicit npm-uninstall handoff, stderr diagnostics, stable nonzero failure, and no recursive cleanup in `packages/codex/bin/dev-flow-codex.mjs` (FR-007)
- [ ] T048 [US3] Extend `scripts/run-codex-real-journey.sh` with a confirmed Codex/Core process stop, canonical complete-data-directory manifests before/after removal, plugin/marketplace absence readback, receipt/adjacent-file checks, repository comparison, subsequent direct Core task reopen, separate npm uninstall, repeated removal, and compatible reinstall discovery in `scripts/run-codex-real-journey.sh` (FR-007, FR-027, FR-028, SC-007)
- [ ] T049 [US3] Document explicit deregistration before npm uninstall, interrupted/conflicting removal recovery, adjacent-file preservation, task-data retention/reopen, idempotent repeat, and compatible reinstall in `packages/codex/README.md` (FR-007)
- [ ] T050 [US3] Run `packages/codex/tests/lifecycle.test.mjs`, `packages/codex/tests/removal-retention.test.mjs`, and affected package/launcher contracts against the newly implemented removal path (FR-007, FR-025)
- [ ] T051 [US3] Repack through `scripts/build-codex-local.sh` and run the removal/reinstall checkpoint in `scripts/run-codex-real-journey.sh` on supported Codex CLI/macOS arm64, proving byte-retained data and repository safety without treating this pre-final artifact as final support evidence (FR-007, SC-007)

**Checkpoint**: User Story 3 removes only Codex-owned registration, preserves task/repository data, and supports bounded compatible reinstall.

---

## Phase 6: Polish and Cross-Cutting Validation

**Purpose**: Revalidate the volatile host contract, harden cross-story claims, build one final artifact, and record the only native support evidence.

- [ ] T052 [P] Recheck the then-current official Codex plugin, Skill, MCP, local marketplace/import/removal documentation and latest stable compatible CLI, updating only dated decisions/links/range evidence when required in `specs/003-codex-explicit-dev-flow/research.md` and `specs/003-codex-explicit-dev-flow/plan.md` (FR-008, SC-008)
- [ ] T053 [P] Reconcile implemented command names, prerequisites, paths, setup/readback, restart/resume, removal, data-retention, and evidence steps with `specs/003-codex-explicit-dev-flow/quickstart.md` without adding publication or unsupported platform claims (FR-008, FR-027, FR-028)
- [ ] T054 [P] Harden final source/tarball authority scans and compatibility-claim checks in `packages/codex/tests/package-contract.test.mjs`, `packages/codex/tests/skill-contract.test.mjs`, and `tests/contract/fixture_contract_test.go` for zero adapter task-state writes/transition decisions and zero shared fixture copies (FR-014–FR-016, FR-025, SC-006, SC-008)
- [ ] T055 Build exactly one final private artifact with `scripts/build-codex-local.sh`, assert package/plugin/Core version equality and the complete allowlist, and pass its absolute path/SHA-256 directly to `scripts/run-codex-real-journey.sh` without publishing or committing the binary (FR-001–FR-003, FR-027, FR-028)
- [ ] T056 Run the complete targeted Go/Node Codex contract set through the commands in `package.json` against `internal/version/`, `tests/contract/`, and `packages/codex/tests/`, recording exact failures/skips and fixing only Feature 003-caused defects before native evidence (FR-025, FR-026)
- [ ] T057 Run the final artifact from setup through explicit invocation, two Core-confirmed actions, host restart/resume, budgeted `DONE`, removal, data reopen, and repository comparison on the selected Codex CLI 0.147.x/macOS arm64 surface, writing only observed native facts to `tests/journeys/evidence/codex-macos-arm64.json` (FR-027, FR-028, SC-001–SC-005, SC-007–SC-008)
- [ ] T058 Validate `tests/journeys/evidence/codex-macos-arm64.json` against `specs/003-codex-explicit-dev-flow/contracts/journey-evidence.schema.json`, including artifact/fixture digests, exact host/package/Core versions, call budget, increasing revisions, same task lineage, empty passing failures/skips, registration absence, equal retained-data digests, task reopen, and no unexpected repository paths (FR-028, SC-004–SC-005, SC-007–SC-008)
- [ ] T059 Run the root `package.json` gate exactly once as `pnpm run validate` after all targeted checks, recording the result once in `tests/journeys/evidence/codex-macos-arm64.json` without relabelling a failed, skipped, manual, or unsupported check (FR-023, FR-027, FR-028)
- [ ] T060 Audit the final diff under `internal/version/`, `packages/codex/`, `scripts/build-codex-local.sh`, `scripts/run-codex-real-journey.sh`, `tests/contract/`, and `tests/journeys/evidence/codex-macos-arm64.json` for no Core Contract 0.1 change, no target-repository/Git mutation, no release/publication, no future host abstraction, and no Windows/Linux/other-surface claim (FR-006–FR-008, FR-016–FR-018, SC-006, SC-008)

---

## Dependencies and Execution Order

### Phase dependencies

- **Phase 1 — Setup**: starts immediately.
- **Phase 2 — Foundation**: depends on Phase 1 and blocks all story phases.
- **Phase 3 — US1**: depends on Foundation and supplies the installed/registered product shell.
- **Phase 4 — US2**: depends on US1's installed plugin/Skill shell; fake-Core tests can be developed alongside late US1 packaging once their referenced resources exist.
- **Phase 5 — US3**: depends on US1 receipt/setup semantics but not on US2's workflow loop, so US2 and US3 implementation can proceed in parallel after US1.
- **Phase 6 — Polish**: depends on US1, US2, and US3; only this phase creates final native support evidence.

### Shared-foundation ownership

- T005–T006 are owned by Feature 003 and are the sole shared `internal/version` seam. Feature 004 may depend on T006 but must not edit or duplicate it.
- T007–T009 update shared repository contract tests only for the delivered Codex boundary and shared fixtures; they do not change Core Contract 0.1.
- The remaining production work is confined to the Codex product, its build/journey scripts, and bounded evidence.

### User-story dependencies

- **US1 (P1)**: no other story dependency; this is the MVP.
- **US2 (P2)**: consumes US1 registration/launcher/Skill resources, but stores no additional adapter state.
- **US3 (P3)**: consumes US1 registration receipt and can be implemented independently of US2 after US1.
- Final evidence composes all three stories against one rebuilt artifact; intermediate story checkpoints are not support evidence.

### Within each story

- Add the named failing tests before the corresponding behavior.
- Implement package resources before building the tarball.
- Read external state before any setup/removal reconciliation mutation.
- Use fresh Core results before every action/retry decision.
- Run story-local checks before the story checkpoint; run the full repository validation only once at T059.

## Parallel Opportunities

### Setup and Foundation

```text
T003 package docs             || T004 fake Codex fixture
T005 Core version tests       || T007 manifest contract  || T008 layout contract
T009 fixture parity contract  || T010 path tests         || T012 receipt tests
```

T006 follows T005, T011 follows T010, and T013 follows T012. T014 joins the completed foundation.

### User Story 1

```text
T015 package contract || T016 launcher contract || T017 setup contract || T018 Skill contract
T019 marketplace      || T020 plugin manifest   || T021 MCP config      || T022 Skill entry
```

T023–T030 then integrate and validate the story in order.

### User Story 2

```text
T031 fake Core fixture || T033 authority scan || T034 evidence-schema tests || T035 harness tests
```

T032 follows T031. T036–T043 serialize edits to the one production Skill and journey path.

### User Story 3

```text
T044 removal lifecycle cases || T045 retained-data integration cases
```

T046–T051 then implement and validate bounded cleanup in order.

### Cross-story work

After US1, one developer may execute T031–T043 while another executes T044–T051. In Polish, T052–T054 can proceed in parallel before the single final artifact/evidence chain T055–T060.

## Requirements Coverage

| Requirement | Primary tasks |
|---|---|
| FR-001 | T001, T007, T015, T026, T055 |
| FR-002 | T005–T006, T010–T011, T015–T016, T023, T026 |
| FR-003 | T001, T007, T015, T026, T055 |
| FR-004 | T004, T017, T019–T020, T024–T027, T030 |
| FR-005 | T005–T006, T013, T016–T017, T023–T025, T030 |
| FR-006 | T010–T011, T017, T024, T027, T030, T060 |
| FR-007 | T010–T013, T044–T051, T057–T058 |
| FR-008 | T002–T003, T020, T026, T028, T030, T052–T055, T057–T060 |
| FR-009 | T015, T018–T020, T022 |
| FR-010 | T018, T022, T027, T030–T033 |
| FR-011 | T018, T022, T027, T032 |
| FR-012 | T010–T011, T018, T022, T032 |
| FR-013 | T018, T022, T031–T032, T036 |
| FR-014 | T009, T015, T018, T021–T022, T031–T032, T054 |
| FR-015 | T031–T033, T037, T054 |
| FR-016 | T015, T033, T037–T039, T054, T060 |
| FR-017 | T021, T033, T037, T039, T060 |
| FR-018 | T022, T033, T037, T039, T060 |
| FR-019 | T031–T032, T036, T040 |
| FR-020 | T031–T032, T036, T040, T043 |
| FR-021 | T031–T032, T037–T038 |
| FR-022 | T031–T032, T038, T042 |
| FR-023 | T032–T035, T039–T043, T056–T059 |
| FR-024 | T031–T033, T039–T043 |
| FR-025 | T007–T009, T014–T018, T029, T033, T042, T050, T054, T056 |
| FR-026 | T031–T033, T042, T056 |
| FR-027 | T026–T027, T034–T035, T040, T043, T048, T051, T055–T059 |
| FR-028 | T034–T035, T040, T048, T052–T059 |

| Success criterion | Buildable/verification tasks |
|---|---|
| SC-001 | T017, T024–T030, T057 |
| SC-002 | T018, T022, T027, T030–T032, T057 |
| SC-003 | T031–T032, T036, T040, T043, T057 |
| SC-004 | T031–T040, T043, T057–T058 |
| SC-005 | T032, T035, T039–T040, T043, T057–T059 |
| SC-006 | T015, T033, T054, T060 |
| SC-007 | T044–T051, T057–T058 |
| SC-008 | T003, T015, T026, T030, T052–T060 |

## Implementation Strategy

### MVP first

1. Complete Setup and Foundation, including the Feature 003-owned version seam.
2. Complete US1 through T030.
3. Stop and review the independently packed setup/explicit-invocation slice before adding the action loop.

### Incremental delivery

1. US1: artifact → explicit setup/readback → explicit-only Skill discovery.
2. US2: Core-governed create/resume/action/recovery → native restart checkpoint.
3. US3: receipt-owned removal → retained-data/reinstall checkpoint.
4. Polish: rebuild once → run the only final native journey → validate evidence → run full validation once.

### Scope guard

Stop if implementation requires a seventh MCP tool, a Core schema/state/transition/recovery change, a Node protocol/projection proxy, target-repository setup files, public publication, Git mutation, another host abstraction, or unsupported-platform behavior. Amend a separate appropriate specification instead of adding that work to these tasks.

## Notes

- `[P]` tasks touch different ready files; same-file follow-ups are intentionally serialized.
- Story checkpoints may prove their story but do not establish the final support claim.
- Tests and evidence must retain their actual static, simulated, native automated, native manual, failed, or skipped classification.
- Do not commit, push, open a PR, tag, release, or publish as part of Feature 003 implementation.
- `$speckit-implement` reads checklist state but must not modify reviewer-owned markers.
