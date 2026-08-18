# Tasks: Close the Open-Task Contract

**Input**: Design documents from `specs/007-close-open-task-contract/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/open-task-input.md`

**Tests**: Regression tests are required by FR-010 and the user stories.

**Organization**: Tasks are grouped by user story and stop at independently testable checkpoints.

## Phase 1: Foundational Contract Tests

**Purpose**: Lock the public shape and packaged guidance before production changes.

- [x] T001 [P] Add exact inline `new_task` type, closed-member, limit, nullable-resume, and verification-enum assertions in `tests/contract/mcp_contract_test.go` per FR-001–FR-007 and FR-009.
- [x] T002 [P] Add packaged Skill assertions for array-valued members, exact verification levels, and one valid JSON example in `packages/codex/tests/package-contract.test.mjs` per FR-008.

**Checkpoint**: The new contract/guidance tests fail against the incomplete projected contract or guidance.

---

## Phase 2: User Story 1 - Construct a valid new task on the first attempt (Priority: P1) 🎯 MVP

**Goal**: Make the complete new-task shape directly consumable and keep Codex guidance aligned.

**Independent Test**: Inspect the open-task schema and packaged Skill, construct the contract example, and validate it for both supported host values.

- [x] T003 [US1] Inline the closed `new_task` and nested verification-budget definitions in `internal/mcp/schemas.go`, retain structurally equal shared `$defs` compatibility copies so unrelated tool schemas remain byte-stable, and preserve all existing limits and accepted values per FR-001–FR-007.
- [x] T004 [US1] Document list member types, exact `minimal|targeted|full` vocabulary, and one valid new-task example in `packages/codex/plugin/skills/dev-flow/SKILL.md` per FR-008.
- [x] T005 [US1] Run the focused shared schema and Codex package contract tests from `specs/007-close-open-task-contract/quickstart.md` and record the User Story 1 checkpoint in `specs/007-close-open-task-contract/tasks.md`.

**Checkpoint**: User Story 1 independently exposes enough information to construct a valid request without repository-source lookup.

### User Story 1 Checkpoint Evidence — 2026-08-18

- The open-task schema now publishes the complete closed `new_task` object and nested verification budget inline, including the exact list types, limits, booleans, and `minimal|targeted|full` enum.
- Shared `$defs` compatibility copies remain structurally equal, so schema digests for the other five tools are unchanged; only the reviewed open-task digest changed.
- The packaged Codex Skill names the three array-valued fields, prohibits prose-string collapse and invented levels such as `focused`, and provides a machine-parsed valid JSON example.
- Focused shared MCP contract tests and the named Codex Skill package-contract test passed.

---

## Phase 3: User Story 2 - Reject malformed task contracts before workflow mutation (Priority: P2)

**Goal**: Retain strict rejection and prove the two observed malformed shapes cannot mutate task state.

**Independent Test**: Validate `focused` and string-valued list variants, observe `INVALID_ARGUMENT`, and prove the valid equivalent succeeds without changing the public error contract.

- [x] T006 [US2] Add the observed `focused` and string-valued `scope`, `out_of_scope`, and `acceptance_criteria` regressions plus valid equivalents in `internal/mcp/tools_test.go` per FR-010.
- [x] T007 [US2] Extend invalid-open dispatch coverage to prove rejection occurs before repository observation or task persistence in `internal/mcp/server_test.go` per FR-011.
- [x] T008 [US2] Run focused Core MCP tests and shared contract tests from `specs/007-close-open-task-contract/quickstart.md` and record the User Story 2 checkpoint in `specs/007-close-open-task-contract/tasks.md`.

**Checkpoint**: Both real failure shapes are deterministically rejected with zero mutation while valid requests remain accepted.

### User Story 2 Checkpoint Evidence — 2026-08-18

- `go test ./internal/mcp` passed, covering `focused`, each string-valued list field, both supported host values, closed `INVALID_ARGUMENT`, zero repository observation, zero store call, and path redaction.
- Focused `tests/contract` MCP/schema tests passed with the exact six-tool catalog and the reviewed open-task schema digest.
- Full `tests/contract` remains blocked by pre-existing `0.1.0`/`0.2.0` release and manifest version mismatches outside Feature 007; the full package-contract file likewise has one pre-existing builder expectation of `0.1.0` while the runtime reports `0.2.0`. Feature 007's named contract tests pass.

---

## Phase 4: Polish & Cross-Cutting Validation

**Purpose**: Confirm bounded scope, parity, and repository hygiene.

- [x] T009 Verify the six-tool catalog, unchanged workflow/persistence/recovery vocabulary, focused test results, and `git diff --check`; record final evidence in `specs/007-close-open-task-contract/tasks.md` per FR-009 and FR-012.
- [x] T010 Run `$speckit-converge` for Feature 007 and append only concrete remaining work to `specs/007-close-open-task-contract/tasks.md`.

### Final Convergence Evidence — 2026-08-18

- Convergence checked 12 functional requirements, 5 success criteria, both user stories, 4 design decisions, and all 10 Constitution principles.
- No missing, partial, contradictory, or unrequested implementation gap was found; no Convergence phase was appended.
- All 10 Feature 007 tasks are complete. Focused automated evidence passes; the unrelated repository-wide version-baseline failures remain explicitly unclaimed.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational tests (Phase 1)**: No dependencies; T001 and T002 may run in parallel.
- **User Story 1 (Phase 2)**: Depends on T001–T002 and is the MVP.
- **User Story 2 (Phase 3)**: Depends on the schema shape from T003; its tests remain independently runnable.
- **Polish (Phase 4)**: Depends on both user-story checkpoints.

### User Story Dependencies

- **User Story 1 (P1)**: Delivers discoverable valid construction and can ship as the MVP.
- **User Story 2 (P2)**: Uses the same public contract and adds observed failure/non-mutation evidence.

### Within Each User Story

- Write the contract assertions before changing production schema/guidance.
- Preserve Core-decoder semantics; add production logic only where a failing test proves a gap.
- Complete each checkpoint before entering the next phase.

### Parallel Opportunities

```text
T001 shared Go contract assertions || T002 Codex package guidance assertions
```

## Implementation Strategy

1. Lock the intended schema and Skill guidance in tests.
2. Inline only the open-task-only schema branch and update the Skill.
3. Prove the observed invalid inputs remain rejected before mutation.
4. Run only focused checks plus the final convergence gate.

## Scope Guard

Do not add aliases, input coercion, workflow states, MCP tools, persistence migrations, recovery branches, host-owned task logic, release automation, or unrelated documentation.

## Phase 5: Feature Version Alignment

**Goal**: Complete Feature 007 at current product version `0.3.0` without rewriting Feature 006's
frozen `v0.1.0` release history.

- [x] T011 [US3] Align `VERSION`, `package.json`, `packages/codex/package.json`, `packages/codex/plugin/.codex-plugin/plugin.json`, and `packages/deepseek/package.json` to `0.3.0` per FR-013–FR-014.
- [x] T012 [US3] Replace stale current-build version expectations with the root current version in `packages/codex/tests/package-contract.test.mjs` and the ordinary source-free section of `packages/codex/tests/release-package.test.mjs` per FR-015.
- [x] T013 [US3] Make copied release-package fixtures explicitly reset to frozen `0.1.0` before historical upgrade and release-preparation scenarios in `packages/codex/tests/release-package.test.mjs` per FR-016.
- [x] T014 [US3] Decouple frozen release fixture validation from current root/package/plugin version equality while retaining `0.1.0` internal identity checks in `tests/contract/release_contract_test.go` per FR-016–FR-017.
- [x] T015 [US3] Add current `0.3.0` authority and frozen `0.1.0` preservation assertions in `tests/contract/package_manifest_test.go` and `tests/contract/release_contract_test.go` per FR-014 and FR-016.
- [x] T016 [US3] Run focused manifest, package-build, release-fixture, and Feature 007 regression checks; record version-alignment evidence in `specs/007-close-open-task-contract/tasks.md` per SC-006–SC-008.
- [x] T017 Run `$speckit-converge` after the version-alignment amendment and append only concrete remaining work to `specs/007-close-open-task-contract/tasks.md`.

**Checkpoint**: Current product identity is uniformly `0.3.0`; frozen Feature 006 history remains
uniformly `0.1.0`; no remote release operation ran.

### User Story 3 Checkpoint Evidence — 2026-08-18

- `VERSION`, root package, Codex package/plugin, and DeepSeek package now report `0.3.0`.
- Ordinary Codex package tests derive expected launcher/Core identity from root `VERSION`; the
  built package reports `dev-flow 0.3.0`.
- Historical copied fixtures are explicitly reset to `0.1.0` before the compatible-upgrade and
  release-preparation scenarios. Feature 006 fixtures validate their own frozen identity rather
  than comparing against current root/package/plugin metadata.
- `go test ./tests/contract` passed; `package-contract.test.mjs` passed 6/6;
  `release-package.test.mjs` passed 3/3, including current install/retention and frozen historical
  upgrade/release preparation.
- No npm, Git tag, GitHub Draft/Release, recovery mutation, or other remote release operation ran.

### Version-Alignment Convergence Evidence — 2026-08-18

- Convergence rechecked 18 functional requirements, 8 success criteria, all 3 user stories, the
  five current version authorities, and frozen Feature 006 identity boundaries.
- No missing, partial, contradictory, or unrequested gap was found; no new Convergence phase was
  appended.
- `pnpm run validate` passed once with Go 1.26.6, Node 24.18.0, and pnpm 11.21.0. It included Go
  formatting/vet/all-package tests, repository contracts, Codex package contract 6/6, frozen
  workspace install, both package dry-packs, and workspace inventory showing root, Codex, and
  DeepSeek at `0.3.0`.

## Phase 6: Irreversible `0.3.0` Publication

**Goal**: Publish the completed Feature 007 Codex product once from one clean pushed `main` source
while preserving Feature 006 frozen truth.

- [x] T018 Export version-derived release output names and remove the stale fixed `0.1.0` current-release list in `scripts/verify-codex-release.mjs` per FR-021.
- [x] T019 Add current `0.3.0` release-output-name coverage in `packages/codex/tests/package-contract.test.mjs` and rerun the complete repository validation per FR-021–FR-022.
- [ ] T020 Commit the complete Feature 007 implementation, push the exact clean commit to `origin/main`, and record its commit/tree identity in `specs/007-close-open-task-contract/tasks.md` per FR-020.
- [ ] T021 Prepare exactly once into `/Users/innocent-children/dev-flow-releases/v0.3.0` and verify the five-file set, source identity, package/Core version, digests, and publication preflight per FR-022–FR-023.
- [ ] T022 Execute the explicit production publisher once with confirmation `v0.3.0`; stop without retry on any failure and retain exact remote/publication-record truth per FR-023–FR-025.
- [ ] T023 Verify npm read-back, native registry Codex journey, final support entry, four GitHub asset read-backs, public `v0.3.0` Release identity, complete publication record, and unchanged Feature 006 frozen identities per FR-024–FR-026.

**Checkpoint**: `dev-flow-codex@0.3.0` and GitHub Release `v0.3.0` are public, verified, and bound to
one clean source; no `v0.1.0` identity changed.

### Publication Preparation Evidence — 2026-08-18

- Read-only preflight found `dev-flow-codex@0.3.0`, Tag `v0.3.0`, and GitHub Release `v0.3.0`
  absent. npm account `imotong` and GitHub account `Innocent-children` are authenticated.
- Release output names now derive from strict SemVer input; the stale exported fixed `0.1.0` list
  was removed. Package-contract coverage passed 7/7.
- `pnpm run validate` passed after the publication amendment, including all Go tests/vet,
  repository contracts, workspace inventory at `0.3.0`, and both package dry-packs.
- No remote release mutation occurred during T018–T019.

## Phase 7: Preflight Timeout Correction

**Goal**: Replace the observed 10-second preflight boundary with 60 seconds, preserve the failed
zero-mutation attempt, and prepare a new exact source for the next confirmed publication attempt.

- [x] T024 Export and use a 60,000-millisecond ordinary command timeout in `scripts/publish-codex-release.mjs` per FR-027.
- [x] T025 Add the exact timeout contract assertion and explicitly preserve the isolated Feature 006 `v0.1.0` publication fixture in `packages/codex/tests/release-publication.test.mjs`, then rerun targeted/full validation per SC-013 and FR-026.
- [ ] T026 Commit and push the timeout correction, retain `/Users/innocent-children/dev-flow-releases/v0.3.0` as failed-attempt evidence, and prepare a new clean durable release directory from the corrected source per FR-028.
- [ ] T027 Execute one corrected confirmed publication attempt and verify or truthfully record its exact remote outcome per FR-023–FR-028.

### Timeout Correction Evidence — 2026-08-18

- The first confirmed attempt stopped in preflight with `COMMAND_FAILED` after approximately the
  prior 10-second boundary. Tag, Draft, npm `0.3.0`, assets, and Release remained absent.
- Ordinary publisher commands now expose and use `PUBLICATION_COMMAND_TIMEOUT_MS = 60_000`; the
  native final Journey retains its explicit 30-minute timeout.
- `release-publication.test.mjs` passed 16/16, including the exact 60,000-millisecond assertion and
  the isolated frozen `v0.1.0` publication scenarios.
- `pnpm run validate` passed after the correction.
