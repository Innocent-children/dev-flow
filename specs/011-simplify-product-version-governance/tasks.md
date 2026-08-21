# Tasks: Simplify Product Version Governance

## Phase 1: Contract Freeze

- [x] T001 Freeze the three-version scope and zero-write/current-only boundaries in `specs/011-simplify-product-version-governance/`, `.specify/memory/constitution.md`, and reviewed checklists per FR-001–FR-058.

## Phase 2: Direct Implementation

- [x] T002 [US1] Rename `VERSION` to `CORE_VERSION`, remove root `package.json.version`, add `scripts/check-versions.mjs` plus `tests/version-governance.test.mjs`, and update Core version consumers/fixtures per FR-001–FR-014 and FR-047–FR-048.
- [x] T003 [US5] Remove every non-product Dev Flow version field and identifier from `internal/`, current `protocol/fixtures/`, current host fixtures/Skills, build reports, lifecycle receipts, and related tests while preserving behavior and frozen history per FR-026–FR-034 and FR-054–FR-057.
- [x] T004 [US2] Remove Codex/Core and DeepSeek/Core equality assumptions in `packages/codex/`, `packages/deepseek/`, `scripts/build-codex-local.sh`, `scripts/build-codex-release.sh`, and `scripts/build-deepseek-runtime.sh`; validate actual Core identity/capabilities per FR-015–FR-025.
- [x] T005 [US3] Split Codex/Core artifact names and build evidence in `scripts/build-codex-local.sh`, `scripts/build-codex-release.sh`, `scripts/verify-codex-release.mjs`, and affected package tests per FR-012–FR-020.
- [x] T006 [US4] Remove internal versions from `release/schemas/` and current record generation, then update `scripts/release-codex.mjs`, `scripts/verify-codex-release.mjs`, `scripts/publish-codex-release.mjs`, Journey evidence validators, and release tests for Codex-only commits, product Tags/baselines, quick ownership, and frozen dual-version resume per FR-032–FR-046.
- [x] T007 [US5] Add `docs/VERSIONING.md` and update `README.md`, `AGENTS.md`, `MANIFEST.md`, `.specify/templates/`, `docs/`, `release/`, and current package READMEs without changing `specs/001-*` through `specs/010-*` or frozen evidence per FR-049–FR-050 and FR-057.

## Phase 3: Verification and Delivery

- [x] T008 Run targeted Core/storage/contract tests and prove incompatible pre-change data fails with zero writes per FR-S001–FR-S003 and SC-014–SC-015.
- [x] T009 Run `pnpm run versions:check` plus targeted Codex, DeepSeek, build, release, recovery, and differing-version fixture tests without native journeys or real release effects per SC-001–SC-017.
- [x] T010 Run `$speckit-converge`; complete only concrete acceptance gaps appended to this file per SC-017.
- [x] T011 Run `pnpm run validate` exactly once per FR-052–FR-053 and SC-017.
- [x] T012 Verify all three product values remain `0.5.0`, frozen evidence is unchanged, and Tag/npm/GitHub Release state has no mutation per SC-016 and SC-018.
- [x] T013 Update Feature 011 status/evidence in `README.md`, `spec.md`, and this file, then review the complete scoped diff per FR-058.
- [ ] T014 Commit and push `codex/011-simplify-product-version-governance`, create one unmerged Draft PR, and read back its remote HEAD/state per FR-058 and SC-019.

## Test Budget

- Targeted checks: one bounded run per affected surface; rerun only failed subsets after fixes.
- Repository validation: exactly one final run.
- Native host journeys, real release command, Tag/npm/GitHub mutations, platform matrix, and stress
  tests: zero.
