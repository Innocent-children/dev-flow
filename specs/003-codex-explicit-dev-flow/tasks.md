---

description: "Dependency-ordered implementation tasks for the local Codex product"

---

# Tasks: Codex Explicit Dev Flow

**Input**: Design documents from `specs/003-codex-explicit-dev-flow/`  
**Prerequisites**: `spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/`,
`quickstart.md`, and reviewer approval of both checklists  
**Tests**: Add each named targeted assertion before its corresponding behavior and demonstrate the
new assertion fails for the missing behavior.

**Native-evidence budget**: Feature 003 permits exactly one real Codex host journey. T030, T043, and
T051 are deterministic/fake checkpoints and MUST NOT start Codex. Only T058 may execute the real
host.

## Format

`[ID] [P?] [Story?] Description`

- `[P]` means different files and no unmet dependency within the ready phase.
- `[Story]` maps work to one independently reviewable user story.
- Every task names its permitted paths.
- A task that changes compatibility assumptions must update all compatibility-bearing artifacts
  named by T052.

## Phase 1: Setup

**Purpose**: Establish the private Codex package boundary and deterministic test fixtures.

- [X] T001 Define private `dev-flow-codex` metadata, Node engine, one executable, explicit `files`
  allowlist, and zero install/publication lifecycle hooks in `packages/codex/package.json`
  (FR-001, FR-003).
- [X] T002 Add only targeted test, dry-pack, local-build, evidence-validation, and journey-harness
  scripts in `packages/codex/package.json`; add no publication command or runtime dependency
  (FR-001, FR-008).
- [X] T003 [P] Replace skeleton guidance with source layout, dynamic implementation-time Codex
  compatibility selection, macOS arm64 evidence boundary, deterministic checkpoint commands, the
  one-native-journey rule, and non-publication rules in `packages/codex/README.md`
  (FR-001, FR-008, FR-027).
- [X] T004 [P] Create a test-only Codex plugin/marketplace CLI double with JSON readback, failure
  injection, call tracing, isolated state, and no real user writes in
  `packages/codex/tests/fixtures/fake-codex.mjs` (FR-004, FR-005).

---

## Phase 2: Foundation

**Purpose**: Deliver the shared detached-binary version seam, safe path/receipt primitives, shared
contract gates, and the Codex-aware root validator.

**Critical**: Complete this phase before story implementation.

- [X] T005 [P] Add failing source-fallback, injected-version, empty/invalid injection, moved-binary,
  and unchanged public-output tests in `internal/version/version_test.go` (FR-002, FR-005).
- [X] T006 Implement one link-time `buildVersion` preference with the existing source-tree
  `VERSION` fallback in `internal/version/version.go`, changing no Core Contract 0.1 public behavior
  (FR-002, FR-005).
- [X] T007 [P] Extend `tests/contract/package_manifest_test.go` for the reviewed Codex manifest:
  private identity, version parity, one bin, explicit files allowlist, allowed non-lifecycle test
  scripts, forbidden publication/install hooks, and zero production npm dependencies
  (FR-001–FR-003, FR-025).
- [X] T008 [P] Extend `tests/contract/repository_layout_test.go` to allow only the reviewed Codex
  source/test tree, retain the DeepSeek skeleton boundary, and forbid committed binaries, tarballs,
  task data, receipts, fake-runtime imports, and copied fixtures outside exact test paths
  (FR-001, FR-002, FR-025).
- [X] T009 [P] Extend `scripts/validate-repository.sh` from skeleton dry-pack validation to an exact
  Codex source/dry-pack allowlist while preserving all root Go/pnpm gates and the DeepSeek skeleton
  rule; run no native host, publication, or user-state mutation (FR-001–FR-003, FR-025).
- [X] T010 [P] Add exact six-tool, no-host-fixture-copy, fixture-count, fixture-level parity, and
  canonical aggregate-digest assertions in `tests/contract/fixture_contract_test.go`
  (FR-014, FR-025).
- [X] T011 [P] Add failing package-relative runtime, explicit/default data path, Unicode/spaces,
  symlink containment, unsupported platform, and no-current-repository fallback tests in
  `packages/codex/tests/paths.test.mjs` (FR-002, FR-006, FR-007, FR-012).
- [X] T012 Implement canonical runtime/data/receipt path resolution and exact default-directory
  ownership in `packages/codex/lib/paths.mjs` (FR-002, FR-006, FR-007, FR-012).
- [X] T013 [P] Add failing closed receipt-schema, dynamic compatibility range, resource digest,
  atomic-write, symlink-escape, malformed/missing receipt, and adjacent-file cases in
  `packages/codex/tests/lifecycle.test.mjs` using
  `contracts/registration-receipt.schema.json` (FR-005, FR-007, FR-008).
- [X] T014 Implement direct Codex JSON-command invocation, closed receipt parsing, atomic receipt
  writes, and exact ownership comparison in `packages/codex/lib/lifecycle.mjs`, then run targeted
  checks for T005–T013 only (FR-005, FR-007, FR-025).

**Checkpoint**: Core detached-version identity, safe path/receipt primitives, shared contracts, and
the Codex root-validator boundary are deterministic and contain no registration behavior yet.

---

## Phase 3: User Story 1 — Install and Explicitly Invoke

**Goal**: Build one local artifact shape, explicitly register one plugin/Skill/MCP server through
the fake lifecycle contract, reject implicit/invalid invocation, and leave repositories untouched.

### Tests

- [X] T015 [P] [US1] Add failing source/staged-tarball contracts for one plugin, one Skill, one
  MCP server, package/plugin/Core version parity, packaged runtime, exact content allowlist, no
  lifecycle mutation, no copied Core source/fixtures/fakes, and no workflow authority in
  `packages/codex/tests/package-contract.test.mjs` (FR-001–FR-003, FR-009, FR-014, FR-025).
- [X] T016 [P] [US1] Add failing launcher tests for package-local executable selection,
  default/override data roots, inherited protocol stdio, zero launcher stdout contamination,
  platform/executable failure, and exit/signal forwarding in
  `packages/codex/tests/launcher.test.mjs` (FR-002, FR-005).
- [X] T017 [P] [US1] Extend fake-Codex lifecycle tests for compatibility/resource/PATH preflight,
  zero-write failure, marketplace/plugin JSON commands, exact readback, matching repeat, ownership
  conflict, bounded rollback, and working-directory fingerprints in
  `packages/codex/tests/lifecycle.test.mjs` (FR-004–FR-006, SC-001).
- [X] T018 [P] [US1] Add failing Skill contracts for one `dev-flow` resource, exact current-turn
  `$dev-flow` guard, zero implicit Dev Flow calls, substantive/resume intent, Git/single-repository
  preconditions, server-info-first behavior, and exact six-tool admission in
  `packages/codex/tests/skill-contract.test.mjs` (FR-009–FR-014, SC-002).

### Implementation

- [X] T019 [P] [US1] Define one in-package local marketplace containing only the reviewed plugin in
  `packages/codex/.agents/plugins/marketplace.json` (FR-004, FR-009).
- [X] T020 [P] [US1] Define the implementation-time official plugin identity, version, Skill, and
  MCP resources in `packages/codex/plugin/.codex-plugin/plugin.json` (FR-004, FR-008, FR-009).
- [X] T021 [P] [US1] Configure one local STDIO server invoking exactly `dev-flow-codex mcp` in
  `packages/codex/plugin/.mcp.json` (FR-002, FR-014, FR-017).
- [X] T022 [P] [US1] Implement exact explicit-selector, substantive/resume, one-worktree,
  server-info compatibility, and fail-closed admission guidance in
  `packages/codex/plugin/skills/dev-flow/SKILL.md` (FR-010–FR-014, FR-018).
- [X] T023 [US1] Implement `mcp` and `--version` dispatch, package-local Core resolution,
  platform/executable checks, default/override data handling, and inherited stdio/exit/signal
  behavior in `packages/codex/bin/dev-flow-codex.mjs` (FR-002, FR-005).
- [X] T024 [US1] Implement setup preflight, read-before-write reconciliation, supported
  marketplace/plugin calls, bounded rollback, exact readback, and receipt creation in
  `packages/codex/lib/lifecycle.mjs` (FR-004–FR-006).
- [X] T025 [US1] Wire `setup [--json]` with stderr diagnostics, stable nonzero failure, and no
  success-before-readback behavior in `packages/codex/bin/dev-flow-codex.mjs`
  (FR-004, FR-005).
- [X] T026 [US1] Build reproducible temporary `darwin-arm64` staging, inject repository `VERSION`,
  verify identity/allowlist invariants, and emit one non-final private `.tgz` for deterministic
  package tests in `scripts/build-codex-local.sh` (FR-001–FR-003, FR-008).
- [X] T027 [US1] Implement journey-harness setup stages with artifact install in isolated paths,
  fake-Codex readback, repository fingerprints, fresh-session markers, and implicit/invalid call
  tracing in `scripts/run-codex-real-journey.sh`; add a mandatory `--fake-host` mode that never
  starts Codex (FR-004–FR-006, FR-010–FR-014).
- [X] T028 [US1] Document install, explicit setup/readback, session refresh, compatibility
  selection, invalid invocation, repository boundary, and deterministic checkpoint procedure in
  `packages/codex/README.md` (FR-004–FR-008, FR-010–FR-012).
- [X] T029 [US1] Run US1 package, launcher, lifecycle, Skill, shared contract, and Codex dry-pack
  checks, resolving only US1 failures (FR-025).
- [X] T030 [US1] Execute the US1 checkpoint only with fake Codex and deterministic package
  contracts through `scripts/run-codex-real-journey.sh --fake-host --through setup`; assert the
  script rejects a real-host attempt at this phase and creates no native evidence
  (SC-001, SC-002, SC-008).

**Checkpoint**: US1 is installable and explicitly discoverable under deterministic evidence. No real
Codex host has run.

---

## Phase 4: User Story 2 — Govern and Resume

**Goal**: Follow only fresh Core authority, recover by reads, respect verification budgets, model a
host restart boundary, and reach Core `DONE` under fake/deterministic evidence.

### Tests

- [X] T031 [P] [US2] Create a test-only STDIO Core serving the exact six shared schemas/results and
  injecting success, domain error, conflict, blocker, loss, truncation, budget, cancellation, and
  terminal cases in `packages/codex/tests/fixtures/fake-core.mjs` (FR-013–FR-026).
- [X] T032 [US2] Add transcript-driver tests for exact tool mapping, new/resume/conflict, closed
  identity/payload forwarding, complete results, success continuation, lost/truncated read-before-
  retry, budget accounting, blocker, and terminal reporting in
  `packages/codex/tests/fake-core-contract.test.mjs` (FR-010, FR-013–FR-026).
- [X] T033 [P] [US2] Extend authority scans to reject task persistence, state/action catalogs,
  transition/error/completion logic, generic shell MCP, copied fixtures, and production fake imports
  in `packages/codex/tests/skill-contract.test.mjs` (FR-015–FR-018, SC-006).
- [X] T034 [P] [US2] Add structural-schema and semantic-validator unit cases for pass, failed,
  blocked, version equality, range membership, source/artifact identity, strict revisions,
  task-ID equality, action count, call budget, `DONE`, data/repository digest equality, lifecycle
  booleans, root validation, failures, and skips in
  `packages/codex/tests/journey-evidence.test.mjs` and
  `scripts/validate-codex-journey-evidence.mjs` (FR-027, FR-028).
- [X] T035 [P] [US2] Add fake-host journey-harness contracts for bounded stages, source/artifact
  digest propagation, repository/data fingerprints, session restart markers, task lineage, and no
  simulated/native relabelling in `packages/codex/tests/journey-harness.test.mjs`
  (FR-023, FR-027, FR-028).

### Implementation

- [X] T036 [US2] Add Core-authoritative `host=codex` create, omitted-contract resume,
  exact-compatible resume, and conflict-stop guidance to the Skill (FR-019, FR-020, SC-003).
- [X] T037 [US2] Add the fresh-action loop, inseparable action/revision identity, allowed-effects
  gate, closed payload construction, retained request ID, one mutation, and complete success
  continuation to the Skill (FR-015–FR-018, FR-021).
- [X] T038 [US2] Add missing/cancelled/malformed/truncated/uncertain mutation handling with task and
  next-action reads, exact optional operation probe, Core retry advice, and no fabricated recovery
  to the Skill (FR-021, FR-022).
- [X] T039 [US2] Add verification-command accounting, evidence labels, manual handoff,
  repository-instruction preservation, blocker/conflict/cancel/`DONE` stops, and complete-result
  presentation to the Skill (FR-017, FR-018, FR-023, FR-024).
- [X] T040 [US2] Extend the fake-host journey harness with two confirmed Core action commits,
  deliberate session close/restart markers, same task/revision checks, call-budget accounting,
  uncertain-response readback, and Core `DONE` capture (FR-019–FR-024, FR-027).
- [X] T041 [US2] Document create/resume, fresh authority, read-before-retry, budget/evidence labels,
  restart boundary, blocker/conflict, and Core terminal outcomes in `packages/codex/README.md`
  (FR-015–FR-024).
- [X] T042 [US2] Run fake-Core, Skill authority, evidence-validator, and journey-harness tests,
  resolving only US2 failures (FR-025, FR-026).
- [X] T043 [US2] Execute
  `scripts/run-codex-real-journey.sh --fake-host --through done`; prove same fake task lineage,
  budgeted terminal behavior, and zero native evidence, and assert no Codex process is started
  (SC-003–SC-005).

**Checkpoint**: US2 is governed by Core under deterministic evidence. No real Codex host has run.

---

## Phase 5: User Story 3 — Remove Without Deleting Task Data

**Goal**: Remove only owned registration, preserve task/repository/adjacent data, and support
compatible reinstall under deterministic evidence.

### Tests

- [ ] T044 [P] [US3] Extend lifecycle tests for matching removal, absence/no-op, interrupted resume,
  receipt/readback conflict, marketplace-root mismatch, adjacent files, exact receipt cleanup, and
  prohibition of package/data/repository/cache deletion in
  `packages/codex/tests/lifecycle.test.mjs` (FR-007).
- [ ] T045 [P] [US3] Add packaged-Core retention integration that creates/pauses a task in a
  temporary data root, stops Core, simulates deregistration/uninstall, compares canonical data
  manifests and repository fingerprints, directly reopens the task, and exercises compatible
  reinstall without starting Codex in `packages/codex/tests/removal-retention.test.mjs`
  (FR-007, SC-007).

### Implementation

- [ ] T046 [US3] Implement receipt-first/current-state reconciliation, exact plugin removal and
  readback, matching marketplace removal/readback, receipt-only cleanup, adjacent preservation,
  idempotent absence, and fail-closed conflict behavior in
  `packages/codex/lib/lifecycle.mjs` (FR-007).
- [ ] T047 [US3] Wire `remove [--json]` with explicit npm-uninstall handoff, stderr diagnostics,
  stable nonzero failure, and no recursive cleanup in
  `packages/codex/bin/dev-flow-codex.mjs` (FR-007).
- [ ] T048 [US3] Extend fake-host journey stages with process-stop markers, complete data manifests,
  plugin/marketplace/receipt absence, adjacent-file and repository comparisons, direct Core reopen,
  separate npm uninstall, repeated removal, and compatible reinstall (FR-007, FR-027, FR-028).
- [ ] T049 [US3] Document deregistration before npm uninstall, interrupted/conflicting recovery,
  adjacent preservation, task-data reopen, idempotent repeat, and compatible reinstall in
  `packages/codex/README.md` (FR-007).
- [ ] T050 [US3] Run lifecycle, packaged-Core retention, package, launcher, and fake-host removal
  checks, resolving only US3 failures (FR-007, FR-025).
- [ ] T051 [US3] Execute
  `scripts/run-codex-real-journey.sh --fake-host --through remove`; prove retained data/repository
  safety and compatible reinstall, assert no real Codex process starts, and create no native
  evidence (SC-007).

**Checkpoint**: US3 lifecycle safety is deterministic. No real Codex host has run.

---

## Phase 6: Compatibility, Final Artifact, and the Sole Native Journey

**Purpose**: Revalidate the volatile host contract, finish all deterministic checks, freeze source,
build one artifact, execute one real journey, and validate evidence without post-validation writes.

- [ ] T052 Revalidate the exact latest stable compatible Codex CLI and official plugin, Skill, MCP,
  marketplace, setup/readback, and removal contracts. Select the supported range and exact test
  version, then update together—when needed—`research.md`, `plan.md`,
  `contracts/codex-plugin.md`, both JSON Schemas, `data-model.md`, `quickstart.md`, `tasks.md`,
  package/Skill/lifecycle tests, and compatibility assertions. This task is serialized and runs
  before final hardening (FR-008, SC-008).
- [ ] T053 Reconcile implemented commands, fields, paths, range, setup/readback, action loop,
  removal, data retention, evidence fields, and one-native-journey procedure across
  `quickstart.md`, `packages/codex/README.md`, contracts, and data model without adding
  publication or unsupported-platform claims (FR-008, FR-027, FR-028).
- [ ] T054 Harden final source/tarball authority scans, root Codex allowlist, structural evidence
  schema, and semantic evidence validator for zero adapter workflow authority, zero copied fixtures,
  honest partial failed/blocked records, and all passing semantic invariants
  (FR-014–FR-016, FR-025, FR-028, SC-006, SC-008).
- [ ] T055 Run the complete targeted Go/Node/package/fake/retention set and then run root
  `pnpm run validate`. Fix only Feature 003 defects, rerun affected deterministic checks, and retain
  the exact command/result plus current source commit for later evidence. Do not build the final
  artifact or start Codex in this task (FR-023, FR-025, FR-026).
- [ ] T056 Perform a read-only pre-final audit of the entire allowed Feature 003 scope:
  `internal/version/`, `packages/codex/`, all three Codex scripts including
  `scripts/validate-repository.sh`, affected `tests/contract/`,
  `tests/journeys/evidence/`, and all `specs/003-codex-explicit-dev-flow/**`. Confirm no Core
  Contract change, Git mutation, publication, future-host abstraction, unsupported claim, or
  unreviewed file. Freeze the source commit after this task (FR-006–FR-008, FR-016–FR-018).
- [ ] T057 From the frozen source commit, build exactly one final private artifact with
  `scripts/build-codex-local.sh`; verify package/plugin/Core version equality, selected Codex range,
  complete allowlist, executable mode, source identity, and artifact SHA-256. Any defect discards
  the artifact and returns to T055 (FR-001–FR-003, FR-027, FR-028).
- [ ] T058 Execute the only real Codex host run for Feature 003 using the exact T057 artifact and
  exact selected stable Codex CLI on macOS arm64. Run setup, explicit-only checks, substantive task,
  two Core commits, restart/resume, budgeted `DONE`, removal, data reopen, npm uninstall,
  compatible reinstall, and repository/adjacent comparisons. Write
  `tests/journeys/evidence/codex-macos-arm64.json` once with observed facts, T055 root-validation
  result, frozen source identity, and T057 artifact digest (FR-027, FR-028, SC-001–SC-005,
  SC-007–SC-008).
- [ ] T059 Validate the evidence first against
  `contracts/journey-evidence.schema.json` and then with
  `scripts/validate-codex-journey-evidence.mjs`. Do not modify the evidence. A failure discards the
  native record/artifact and returns to T055 rather than patching JSON manually
  (FR-028, SC-004–SC-005, SC-007–SC-008).
- [ ] T060 Perform a final read-only diff/scope audit over the complete T056 scope and confirm no
  file changed after the frozen source/artifact boundary except the single evidence record. Run no
  additional mutation, build, native journey, publication, commit, or release action
  (FR-006–FR-008, FR-016–FR-018, SC-006, SC-008).

---

## Dependencies and Execution Order

- Phase 1 starts after reviewer-owned checklists are approved.
- Phase 2 depends on Phase 1 and blocks all stories.
- US1 depends on Foundation.
- US2 and US3 depend on the installed/lifecycle shell delivered by US1; their deterministic work may
  proceed in parallel only where marked.
- T030, T043, and T051 are fake/deterministic checkpoints.
- T052–T060 are strictly serialized.
- T058 is the only task authorized to start a real Codex host.
- If source changes after T057, discard the artifact and restart at T055.
- If evidence validation fails at T059, do not edit evidence; restart at T055/T057/T058 as needed.

## Shared Ownership

- Feature 003 solely owns the initial `internal/version` detached-build seam.
- Feature 003 solely owns the first Codex-aware expansion of `scripts/validate-repository.sh`.
- Feature 004 may consume these capabilities only after Feature 003 is merged and must preserve the
  delivered Codex rules.
- Public Core Contract 0.1, shared fixtures, task semantics, and state transitions remain unchanged.

## Requirements Coverage

| Requirement group | Primary tasks |
|---|---|
| FR-001–FR-003 Package/runtime | T001–T003, T005–T010, T015–T016, T023, T026, T057 |
| FR-004–FR-008 Setup/removal/compatibility | T004, T011–T014, T017, T024–T030, T044–T053, T055–T060 |
| FR-009–FR-014 Explicit Skill/six tools | T018–T022, T027–T032, T036, T052–T054, T058 |
| FR-015–FR-024 Core authority/recovery/evidence | T031–T043, T052–T055, T058–T060 |
| FR-025–FR-026 Deterministic verification | T007–T018, T029–T035, T042, T050, T054–T055 |
| FR-027–FR-028 Final native evidence | T034–T035, T040, T048, T052–T060 |

| Success criterion | Primary evidence tasks |
|---|---|
| SC-001 | T017, T024–T030, T058 |
| SC-002 | T018, T022, T027, T030–T032, T058 |
| SC-003 | T031–T040, T043, T058 |
| SC-004 | T031–T040, T043, T058–T059 |
| SC-005 | T032, T035, T039–T043, T055, T058–T059 |
| SC-006 | T015, T033, T054, T056, T060 |
| SC-007 | T044–T051, T058–T059 |
| SC-008 | T003, T052–T060 |

## Scope Guard

Stop and amend the feature before implementation continues if work requires a seventh MCP tool, a
Core public schema/state/transition/recovery change, a Node MCP/result proxy, adapter task
persistence, target-repository setup, direct Codex config/cache editing, public publication,
another platform/host claim, or more than the one authorized real Codex journey.
