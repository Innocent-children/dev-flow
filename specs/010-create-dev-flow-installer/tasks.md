# Tasks: Unified Adapter Lifecycle Manager

**Feature**: `specs/010-create-dev-flow-installer`
**Status**: Complete
**Verification budget**: four targeted automatic commands; no full suite or real Host journey

## Phase 1 - Package and Codex observation foundation

- [x] **T001 [Foundation] Create the publishable manager package boundary**
  **Requirements**: FR-001, FR-004, FR-019, FR-022; SC-001, SC-009, SC-010
  **Paths**: `packages/create-dev-flow/package.json`, `packages/create-dev-flow/bin/create-dev-flow.mjs`,
  `packages/create-dev-flow/lib/cli.mjs`, `packages/create-dev-flow/lib/presentation.mjs`,
  `packages/create-dev-flow/tests/package-contract.test.mjs`, `packages/create-dev-flow/tests/cli.test.mjs`
  **Result**: one `create-dev-flow` bin accepts the closed operation/options contract, selects rich/plain/JSON
  output, rejects invalid non-TTY requests before mutation and has no third-party runtime dependency.
  **Verification**: covered by V1.

- [x] **T002 [Codex] Add read-only Codex lifecycle status**
  **Requirements**: FR-005, FR-008, FR-017, FR-018; SC-003, SC-005, SC-010
  **Paths**: `packages/codex/bin/dev-flow-codex.mjs`, `packages/codex/lib/lifecycle.mjs`,
  `packages/codex/tests/launcher.test.mjs`, `packages/codex/tests/lifecycle.test.mjs`,
  `packages/codex/tests/package-contract.test.mjs`
  **Result**: `dev-flow-codex status [--json]` projects package/Core/receipt/registration state through existing
  validators and performs zero setup/remove/config writes.
  **Dependencies**: none
  **Verification**: V2.

## Phase 2 - Lifecycle observation, plan and non-destructive execution

- [x] **T003 [US1] Implement canonical manager paths, records and state observation**
  **Requirements**: FR-002, FR-004, FR-007, FR-014, FR-016, FR-017, FR-020
  **Paths**: `packages/create-dev-flow/lib/ownership.mjs`, `packages/create-dev-flow/lib/journal.mjs`,
  `packages/create-dev-flow/tests/ownership.test.mjs`, `packages/create-dev-flow/tests/journal.test.mjs`
  **Result**: fixed roots, explicit data, manager receipts and runs use canonical non-symlink paths, atomic closed
  JSON and restrictive modes; invalid/unknown ownership safe-stops.
  **Dependencies**: T001
  **Verification**: V1.

- [x] **T004 [US1] Implement exact Codex and DeepSeek Host drivers**
  **Requirements**: FR-005, FR-006, FR-007, FR-018, FR-020; SC-002, SC-003, SC-005
  **Paths**: `packages/create-dev-flow/lib/hosts/codex.mjs`,
  `packages/create-dev-flow/lib/hosts/deepseek.mjs`,
  `packages/create-dev-flow/tests/codex-driver.test.mjs`,
  `packages/create-dev-flow/tests/deepseek-driver.test.mjs`
  **Result**: Codex uses npm plus status/setup/remove; DeepSeek uses explicit Profile DSH lifecycle and a verified
  temp artifact. Every child uses an argument array and produces a normalized closed observation/effect result.
  **Dependencies**: T002, T003
  **Verification**: V1.

- [x] **T005 [US1] Implement status, doctor and install planning/execution**
  **Requirements**: FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, FR-007, FR-008, FR-009,
  FR-016, FR-017, FR-018, FR-019, FR-020; SC-001, SC-002, SC-003, SC-004, SC-005, SC-009
  **Paths**: `packages/create-dev-flow/lib/plan.mjs`, `packages/create-dev-flow/lib/lifecycle.mjs`,
  `packages/create-dev-flow/tests/plan.test.mjs`, `packages/create-dev-flow/tests/lifecycle-install.test.mjs`
  **Result**: normalized requests flow through observe→plan→confirm→execute→verify; status/doctor are read-only,
  install supports Codex/DeepSeek/all, refusal is zero-write and repeat execution is idempotent.
  **Dependencies**: T001, T003, T004
  **Verification**: V1.

- [x] **T006 [US2] Implement upgrade, repair and data-preserving reinstall**
  **Requirements**: FR-008, FR-009, FR-010, FR-011, FR-016, FR-017, FR-018; SC-004, SC-005, SC-006
  **Paths**: `packages/create-dev-flow/lib/plan.mjs`, `packages/create-dev-flow/lib/lifecycle.mjs`,
  `packages/create-dev-flow/tests/lifecycle-maintenance.test.mjs`
  **Result**: latest/explicit compatible target, downgrade confirmation, minimal repair, forced reinstall,
  DeepSeek verified remove→add recovery and partial-effect resume preserve configuration and Task data.
  **Dependencies**: T005
  **Verification**: V1.

- [x] **T007 [US3] Implement Adapter uninstall with data retention**
  **Requirements**: FR-007, FR-008, FR-009, FR-012, FR-016, FR-017, FR-018, FR-019, FR-020;
  SC-004, SC-005, SC-006
  **Paths**: `packages/create-dev-flow/lib/plan.mjs`, `packages/create-dev-flow/lib/lifecycle.mjs`,
  `packages/create-dev-flow/tests/lifecycle-uninstall.test.mjs`
  **Result**: Codex remove→npm uninstall and explicit/manager-owned DeepSeek Profile removal are read back,
  repeat-safe and preserve all user configuration, Task, Host-adjacent, cache and repository state.
  **Dependencies**: T005
  **Verification**: V1.

## Phase 3 - Destructive reset and clean reinstall

- [x] **T008 [US4] Implement token-bound recoverable and permanent cleanup**
  **Requirements**: FR-013, FR-014, FR-016, FR-017, FR-018, FR-019, FR-020;
  SC-005, SC-006, SC-007, SC-008
  **Paths**: `packages/create-dev-flow/lib/ownership.mjs`, `packages/create-dev-flow/lib/journal.mjs`,
  `packages/create-dev-flow/lib/plan.mjs`, `packages/create-dev-flow/lib/lifecycle.mjs`,
  `packages/create-dev-flow/tests/factory-reset.test.mjs`
  **Result**: reset requires all shared users, saved plan, token, unchanged target identities and exact explicit-data
  confirmation; default moves to unique Trash, permanent removal requires a second token and all tests use isolated roots.
  **Dependencies**: T003, T007
  **Verification**: V1.

- [x] **T009 [US4] Implement clean reinstall and interrupted reset recovery**
  **Requirements**: FR-015, FR-016, FR-017, FR-018, FR-019; SC-005, SC-008, SC-009
  **Paths**: `packages/create-dev-flow/lib/lifecycle.mjs`,
  `packages/create-dev-flow/tests/factory-reset.test.mjs`
  **Result**: reset `--reinstall` creates fresh active state only after cleanup readback; interruption retains exact
  completed/remaining actions and never silently restores Trash data.
  **Dependencies**: T005, T008
  **Verification**: V1.

## Phase 4 - Package closure and synchronized user documentation

- [x] **T010 [Package] Close repository manifest and dry-pack inventory**
  **Requirements**: FR-004, FR-018, FR-022; SC-010
  **Paths**: `tests/contract/package_manifest_test.go`, `scripts/validate-repository.sh`, `pnpm-lock.yaml`,
  `packages/create-dev-flow/package.json`, `packages/create-dev-flow/tests/package-contract.test.mjs`
  **Result**: repository contract recognizes the exact publishable manager files, executable mode, OS/CPU/runtime
  boundary and dry-pack excludes source specs, tests, user data and absolute paths.
  **Dependencies**: T001–T009
  **Verification**: V3, V4.

- [x] **T011 [Docs] Make the unified manager the default lifecycle entry in every maintained locale**
  **Requirements**: FR-001, FR-005, FR-006, FR-012, FR-013, FR-014, FR-015, FR-016, FR-017,
  FR-018, FR-019, FR-020, FR-021, FR-022; SC-001, SC-002, SC-006, SC-007, SC-008, SC-009, SC-010
  **Paths**: `README.md`, `README_en.md`, `README_zh-TW.md`, `README_ja.md`, `README_ko.md`,
  `README_es.md`, `README_fr.md`, `README_de.md`, `README_pt-BR.md`, `docs/PRODUCT.md`,
  `docs/PRODUCT_en.md`, `docs/COMMANDS.md`, `docs/COMMANDS_en.md`, `docs/SUPPORT-MATRIX.md`,
  `docs/SUPPORT-MATRIX_en.md`, `docs/ROADMAP.md`, `docs/ROADMAP_en.md`, `packages/codex/README.md`,
  `docs/CODEX_en.md`, `packages/deepseek/README.md`, `docs/DEEPSEEK_en.md`
  **Result**: public default uses `npx @imotong/create-dev-flow@latest`; lifecycle commands and destructive boundaries match
  executable contracts; existing Adapter exact versions remain evidence and unpublished manager availability is not claimed.
  **Dependencies**: T001–T010
  **Verification**: V1 package documentation assertions and direct synchronized-fact review.

- [x] **T012 [Checkpoint] Reconcile Feature status and targeted evidence**
  **Requirements**: FR-021, FR-022; SC-003, SC-004, SC-005, SC-006, SC-007, SC-008, SC-009, SC-010
  **Paths**: `specs/010-create-dev-flow-installer/README.md`,
  `specs/010-create-dev-flow-installer/quickstart.md`,
  `specs/010-create-dev-flow-installer/tasks.md`
  **Result**: all implemented task boxes and exact check outcomes are current; Feature stops before release work.
  **Dependencies**: T001–T011
  **Verification**: V1–V4 evidence reconciliation only; no fifth automatic command.

## Verification Commands

- **V1**: `node --test packages/create-dev-flow/tests/*.test.mjs`
- **V2**: `node --test packages/codex/tests/launcher.test.mjs packages/codex/tests/lifecycle.test.mjs packages/codex/tests/package-contract.test.mjs`
- **V3**: `go test ./tests/contract -run 'Test(ProjectPackageManifests|PackageManifest)'`
- **V4**: `pnpm --dir packages/create-dev-flow pack --dry-run --json`

These are the complete automatic command budget. Full repository validation, real Host journeys, registry tests and
release checks are prohibited for this Feature.

## Current Verification Evidence

- V1 attempt 1: 19/21 passed; two fixtures used the non-canonical macOS `/var` spelling for explicit data.
- V1+V2 targeted retry: 74/74 passed after canonicalizing only the affected temporary fixture paths.
- V3: passed (`github.com/Innocent-children/dev-flow/tests/contract`).
- V4: passed; dry-pack reported `create-dev-flow@0.1.0`, one executable, nine runtime modules, package metadata,
  README, and npm's automatically included reviewed `LICENSE`.
- After V4, direct review added factory-reset cleanup for manager run records. The immutable automatic budget remained
  at four commands; the developer then ran the exact V1 manual handoff and reported 21/21 passed in 91.392167 ms.

## Installation-first UX Amendment

- [x] T013 [US5] Implement the four-choice installation-first TTY home screen and manage-existing branch for FR-023 in `packages/create-dev-flow/lib/cli.mjs`
- [x] T014 [US5] Add interactive prompt regression coverage while preserving non-TTY flags for FR-023 and FR-024 in `packages/create-dev-flow/tests/cli.test.mjs`
- [x] T015 [Docs] Replace ordinary installation examples with bare `npx @imotong/create-dev-flow@latest` for FR-024 in all maintained root and Host installation documents

Validation: initial amendment run passed 22/23 and exposed only a prematurely closed multi-question test stream;
the PassThrough fixture correction then passed 23/23. No real Host or release validation was run.

## Acceptance Traceability

| Acceptance index | Covered by | Verification |
| --- | --- | --- |
| 0 One stable command | T001, T005, T011 | V1, V4 |
| 1 Host authority delegation | T002, T004–T007 | V1, V2 |
| 2 Idempotent repetition | T005–T009 | V1 |
| 3 Preserve data | T006, T007 | V1 |
| 4 Owned destructive cleanup | T003, T008 | V1 |
| 5 Shared-user reset protection | T008 | V1 |
| 6 Partial failure recovery | T003, T005–T009 | V1 |
| 7 Hide DeepSeek artifact/profile shell mechanics | T004, T011 | V1 |
| 8 Closed machine/noninteractive output | T001, T005, T008 | V1 |
| 9 Synchronized documentation | T010, T011 | V1, V3, V4, direct review |

## Dependency Order

```text
T001 ─┬─ T003 ─ T004 ─ T005 ─┬─ T006
      │                       ├─ T007 ─ T008 ─ T009
T002 ─┘                       └───────────────┘
T001–T009 ─ T010 ─ T011 ─ T012
```
