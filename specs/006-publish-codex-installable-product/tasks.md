# Tasks: Publish the Codex Installable Product

**Input**: [spec.md](./spec.md), [plan.md](./plan.md), [research.md](./research.md),
[data-model.md](./data-model.md), [quickstart.md](./quickstart.md), and `contracts/`.

**Entry gate**: Features 003 and 005 are merged; Feature 004 remains deferred.

## Phase 1 — Setup and release baseline

- [x] T001 Record the exact merged Feature 003/005 commits, Core fixture digest, Codex compatibility range, and intended release version in `specs/006-publish-codex-installable-product/research.md`.
- [x] T002 Verify authenticated npm permission for `dev-flow-codex` and GitHub release/tag permission; record bounded pass/fail evidence without credentials in `specs/006-publish-codex-installable-product/README.md`.
- [x] T003 Audit the Feature 003 packed layout and release writable scope, including an explicit unchanged `packages/deepseek/` baseline, in `specs/006-publish-codex-installable-product/plan.md`.
- [x] T004 Copy the approved JSON Schemas into implementation-owned paths `release/schemas/release-manifest.schema.json` and `release/schemas/publication-record.schema.json`.

## Phase 2 — Foundational release contracts

- [x] T005 [P] Add release schema and cross-identity contract tests in `tests/contract/release_contract_test.go`.
- [x] T006 [P] Create release operator documentation and generated-output boundary in `release/README.md` and `release/codex/README.md`.
- [x] T007 [P] Add root scripts `release:codex:prepare`, `release:codex:verify`, and `release:codex:publish` to `package.json` without adding an install lifecycle hook.
- [x] T008 [P] Add secret/path/raw-output fixture negatives and valid manifest/publication fixtures under `release/testdata/`.
- [x] T009 Extend `scripts/validate-repository.sh` and `.github/workflows/ci.yml` with preparation-safe release contract checks only; prohibit credentials, tags, releases, and npm publication.

## Phase 3 — User Story 1: Install and run from npm

**Independent checkpoint**: A source-free isolated installation contains one macOS arm64 runtime,
requires explicit setup/remove, rejects unsupported platforms, and preserves task data after
uninstall.

- [x] T010 [US1] Convert `packages/codex/package.json` to the fixed public package identity with `darwin`/`arm64`, public publishConfig, repository/license metadata, and no install lifecycle hooks.
- [x] T011 [US1] Add `LICENSE` to the closed package files and update the exact allowlist in `packages/codex/package.json` and `packages/codex/tests/package-contract.test.mjs`.
- [x] T012 [P] [US1] Extend Go package-manifest/layout guards for the public Codex package and absence of DeepSeek resources in `tests/contract/package_manifest_test.go` and `tests/contract/repository_layout_test.go`.
- [x] T013 [P] [US1] Update `packages/codex/README.md` with public install, explicit setup/remove, platform, compatibility, data-retention, and unsupported-platform behavior.
- [x] T014 [US1] Add unsupported OS/CPU metadata and setup precondition tests in `packages/codex/tests/package-contract.test.mjs` and `packages/codex/tests/launcher.test.mjs`.
- [x] T015 [US1] Add source-free global-install/setup/remove/uninstall test harness support in `packages/codex/tests/release-package.test.mjs` using an isolated npm prefix and data directory.
- [x] T016 [US1] Add retained task reopen and unknown-adjacent-file preservation after package uninstall in `packages/codex/tests/release-package.test.mjs` and `packages/codex/tests/removal-retention.test.mjs`.
- [x] T017 [US1] Verify and minimally correct the stale private-package assertion in `scripts/build-codex-local.sh` and public-package path/version/lifecycle behavior in `packages/codex/bin/dev-flow-codex.mjs`, `packages/codex/lib/paths.mjs`, and `packages/codex/lib/lifecycle.mjs` only where release-package tests expose a gap. The builder amendment is limited to the fixed public manifest preflight and leaves its build/final-artifact behavior unchanged.
- [x] T018 [US1] Run the User Story 1 package/lifecycle/source-free install checkpoint and record results in `specs/006-publish-codex-installable-product/tasks.md`.

### User Story 1 Checkpoint Evidence — 2026-08-17

- Baseline: implementation started from `main` commit
  `850dd4a4ee07bf50af5d9a36b24373c6b09fdd28`; Feature 003 merge
  `a2ba8bd5de9c87aaf758bff51a02ae120f60c7f7` and Feature 005 merge
  `850dd4a4ee07bf50af5d9a36b24373c6b09fdd28` were present.
- Permission preflight: official registry `https://registry.npmjs.org/`, authenticated npm account
  `imotong`, fixed package `dev-flow-codex` absent by explicit E404, exact version `0.1.0` absent by
  explicit E404, GitHub push/maintain/admin permission true, and `v0.1.0` Tag/Release absent. No
  credential or raw authentication output was recorded.
- Public package: `dev-flow-codex@0.1.0`, `private: false`, Apache-2.0, Node `>=24`, exact
  `os=[darwin]`, `cpu=[arm64]`, public access at the official npm registry, one repository identity,
  zero production dependencies, and no install/removal lifecycle hook.
- Packed allowlist: exactly `package.json`, `README.md`, `LICENSE`, marketplace metadata, launcher,
  two lifecycle/path helpers, plugin manifest, one MCP definition, one `dev-flow` Skill and policy,
  and `runtime/darwin-arm64/dev-flow`. Package `LICENSE` is byte-identical to the root license; no
  Core source, test/fixture, task data, receipt, credential, DeepSeek resource, or second runtime is
  packed.
- Unsupported platform: npm's installed platform checker rejects Linux/x64 with `EBADPLATFORM` from
  the package metadata. The setup injection test rejects `linux-x64` before reading package/Core
  identity, spawning Core, calling setup, creating task data/receipt, or modifying the repository;
  its diagnostic contains no private fixture path.
- T015 red/green: the first source-free test failed at the Feature 003 `private: true` assertion in
  `scripts/build-codex-local.sh`. After the explicitly authorized public-manifest-only correction,
  it reached setup and failed at the same stale assertion in `packages/codex/lib/lifecycle.mjs`.
  The lifecycle correction then passed the complete source-free test. Build inputs, Go flags,
  runtime layout, normalized tar format, digests, final-artifact behavior, and remote behavior are
  unchanged.
- Source-free install: one local deterministic `.tgz` was built with the real Go Core, then installed
  globally with `--ignore-scripts --offline` into isolated prefix/cache A. HOME, Codex state, Dev
  Flow data, repository, artifact output, process temp, and logs all remained under one test temp
  root. The product ran only through `<prefix-A>/bin/dev-flow-codex`; its resolved JS and Core paths
  were inside the installed prefix, `NODE_PATH` was absent, the source repository was absent from
  product PATH, and `go` was unavailable to the product process.
- Install/lifecycle: npm install changed only the isolated prefix/cache; it created no Codex
  registration, receipt, database, repository change, or shell profile. Explicit setup and repeated
  idempotent setup passed using deterministic fake Codex evidence. An npm uninstall performed before
  remove deleted package files while leaving registration and receipt intact, proving uninstall did
  not invoke remove. Reinstalling the same tarball allowed explicit remove, followed by separate npm
  uninstall.
- Retained data: the installed real packaged Core created task
  `task-9a1011138eb6c3fd026f1cab98700e6d`. After explicit removal and uninstall, prefix B installed the
  same exact tarball without Codex setup and its packaged Core/MCP directly reopened revision 1 in
  phase `INTAKE`, action `ASSESS_TASK`, outcome `null`. A repeated product read kept the same complete
  task identity and left the data-directory byte manifest unchanged. The SQLite task data,
  data-adjacent unknown file, Codex-adjacent unknown file, and repository manifest were preserved.
- Production impact: `scripts/build-codex-local.sh` and `packages/codex/lib/lifecycle.mjs` changed
  only their fixed public package preflight. `packages/codex/bin/dev-flow-codex.mjs` and
  `packages/codex/lib/paths.mjs` required no change.
- Final commands passed: the five required Node files (5/5, 10/10, 20/20, 1/1, 1/1),
  `go test ./tests/contract`, both required shell syntax checks, `git diff --check`, and both DeepSeek
  zero-diff checks. Workflow YAML, byte-identical Schema copies, and byte-identical LICENSE were also
  checked.
- No `go test ./...`, `pnpm run validate`, npm publication/dry-run, Git Tag, GitHub Release,
  registry read-back, real Codex Host journey, or DeepSeek Harness was run. T019–T050 remain
  unstarted and unchecked.

## Phase 4 — User Story 2: Publish one immutable release

**Independent checkpoint**: Two clean preparations match; local verification is complete; fixture
publication proves exact tag/draft/npm/assets read-back and resumable conflict-safe records without
real remote side effects.

- [ ] T019 [US2] Implement two-clean-worktree Core/package preparation with documented Go flags and no remote effects in `scripts/build-codex-release.sh`.
- [ ] T020 [US2] Implement normalized tarball tree, mode, version, runtime digest, and forbidden-content verification in `scripts/verify-codex-release.mjs`.
- [ ] T021 [US2] Generate provisional `SHA256SUMS`, `release-manifest.json`, and the initial local `publication-record.json` in `scripts/build-codex-release.sh` and `scripts/verify-codex-release.mjs`.
- [ ] T022 [P] [US2] Add two-build runtime-byte and normalized-package-tree regressions in `packages/codex/tests/release-package.test.mjs`.
- [ ] T023 [P] [US2] Add manifest/publication schema, sorted collection, safe-relative-path, and cross-artifact digest tests in `tests/contract/release_contract_test.go`.
- [ ] T024 [P] [US2] Add forbidden credentials, auth files, absolute paths, environment values, prompts, and unbounded output tests in `packages/codex/tests/release-package.test.mjs` and `tests/contract/release_contract_test.go`.
- [ ] T025 [US2] Implement read-only npm/GitHub/source/version/ownership/conflict preflight in `scripts/publish-codex-release.mjs`.
- [ ] T026 [US2] Implement exact-confirmation gating plus exact Git tag and draft GitHub Release create/reuse logic in `scripts/publish-codex-release.mjs`.
- [ ] T027 [US2] Implement publish-once npm tarball upload and public registry metadata/tarball read-back in `scripts/publish-codex-release.mjs`.
- [ ] T028 [US2] Implement post-journey final manifest/checksum generation, GitHub asset upload, official asset redownload, and draft retention in `scripts/publish-codex-release.mjs`.
- [ ] T029 [US2] Implement stepwise publication-record writes, remote reread-before-mutation, exact resume, and conflict-safe blocking in `scripts/publish-codex-release.mjs`.
- [ ] T030 [US2] Add fake npm/gh command fixtures for absent, exact-resume, delayed-readback, and conflicting remote states in `packages/codex/tests/fixtures/` and `packages/codex/tests/release-publication.test.mjs`.
- [ ] T031 [US2] Add tests proving no publish/tag/release mutation without exact confirmation and no npm republish on resume in `packages/codex/tests/release-publication.test.mjs`.
- [ ] T032 [US2] Add tests for npm-success/later-failure, upload-success/record-loss, asset mismatch, tag mismatch, draft mismatch, and finalization failure in `packages/codex/tests/release-publication.test.mjs`.
- [ ] T033 [US2] Run the User Story 2 preparation/publication-fixture checkpoint and record results in `specs/006-publish-codex-installable-product/tasks.md`.

## Phase 5 — User Story 3: Upgrade, remove, and recover partial publication

**Independent checkpoint**: Compatible upgrade and active-task resume pass, unsupported schema is
safe, removal/uninstall retain data, and finalization cannot occur without every remote and journey
gate.

- [ ] T034 [US3] Add release A to compatible release B explicit setup/read-back and active-task resume coverage in `packages/codex/tests/release-package.test.mjs`.
- [ ] T035 [P] [US3] Add unsupported newer SQLite schema launch refusal and unchanged-data proof using the released package path in `packages/codex/tests/release-package.test.mjs`.
- [ ] T036 [P] [US3] Extend removal/uninstall tests to prove task database, unknown adjacent files, and any unrelated host state remain unchanged in `packages/codex/tests/removal-retention.test.mjs`.
- [ ] T037 [US3] Add exact partial-publication resume and manual-block output assertions in `packages/codex/tests/release-publication.test.mjs`.
- [ ] T038 [US3] Add bounded final registry-package journey mode and no-local-substitution checks in `scripts/run-codex-real-journey.sh`, `scripts/write-codex-journey-evidence.mjs`, and `packages/codex/tests/journey-harness.test.mjs`.
- [ ] T039 [US3] Add release finalization gating on npm read-back, asset read-back, final journey, removal, and retained reopen in `scripts/publish-codex-release.mjs` and `packages/codex/tests/release-publication.test.mjs`.
- [ ] T040 [US3] Update support-matrix generation to emit only macOS arm64, actual Codex version, merged compatible range, package/Core digests, and journey result in `scripts/verify-codex-release.mjs`.
- [ ] T041 [US3] Run the User Story 3 lifecycle/resume/finalization-fixture checkpoint and record results in `specs/006-publish-codex-installable-product/tasks.md`.

## Phase 6 — Documentation and deterministic final gate

- [ ] T042 Update `docs/PRODUCT.md`, `docs/ARCHITECTURE.md`, `docs/RELEASE-STRATEGY.md`, root `README.md`, and `release/README.md` to describe the delivered Codex-only release without claiming DeepSeek or extra platforms.
- [ ] T043 Reconcile all Feature 006 docs and implementation schemas in `specs/006-publish-codex-installable-product/` and `release/schemas/`; remove no safety gate.
- [ ] T044 Run targeted Node release/package tests, Go contract tests, shell syntax checks, JSON Schema validation, and `git diff --check`; fix only Feature 006 regressions.
- [ ] T045 Run `pnpm run validate` once after all deterministic release work and documentation are complete.
- [ ] T046 Run one final `$speckit-analyze` and `$speckit-converge`; append only concrete uncovered implementation work to `specs/006-publish-codex-installable-product/tasks.md`.

## Phase 7 — Irreversible final release

These tasks are operator checkpoints. They run only after Phase 6 is committed, reviewed, and clean.

- [ ] T047 Freeze one reviewed clean source commit, prepare the final release directory once, and record artifact/source/toolchain identities in the generated `release-manifest.json` and `publication-record.json`.
- [ ] T048 Execute the explicit publication command once for the frozen version, preserving every intermediate remote observation in `publication-record.json`; stop truthfully on failure.
- [ ] T049 Install the public registry package in a clean macOS arm64 environment and complete the final Codex create/restart/resume/DONE/remove/uninstall/retained-reopen journey through `scripts/run-codex-real-journey.sh`.
- [ ] T050 Finalize and read back the GitHub Release only after npm/assets/journey checks pass, then record `complete` in `publication-record.json` and verify the repository worktree contains no generated release output or credential material.

## Dependencies

```text
Phase 1
  ↓
Phase 2
  ↓
US1 public package
  ↓
US2 preparation/publication machinery
  ↓
US3 lifecycle and finalization gates
  ↓
Deterministic final gate
  ↓
Frozen final release
```

- User Story 1 establishes the exact public package consumed by later phases.
- User Story 2 may parallelize schema, verifier, and fake-remote tests after the package contract is
  stable, but remote-step implementation converges in one publisher file.
- User Story 3 depends on the package and publication record contracts.
- Phase 7 is never run by PR CI or before final review.
- No task depends on or modifies Feature 004 implementation.

## Parallel Examples

### User Story 1

```text
T012 and T013 may run in parallel after T010–T011.
T014 and T015 use separate test surfaces and may run in parallel.
```

### User Story 2

```text
T022–T024 may run in parallel after T019–T021 establish prepared output.
T030 fixture construction may proceed while T025–T029 publisher steps are implemented.
```

### User Story 3

```text
T035 and T036 may run in parallel.
T037 may proceed with T038 after the publication record contract is stable.
```

## Implementation Strategy

1. Finish the public package and source-free install before release automation.
2. Make preparation and all fake-remote publication tests repeatable and side-effect free.
3. Keep real publication as the last four tasks.
4. Never “fix” a remote conflict by moving, deleting, overwriting, or republishing.
5. Stop if npm package ownership cannot be proven.
6. Keep `packages/deepseek/` and shared Core semantics unchanged.

## Requirement Coverage

| Requirements | Tasks |
|---|---|
| FR-001–FR-005 release identity | T001–T009, T019–T024, T047 |
| FR-006–FR-013 package composition | T002, T010–T018 |
| FR-014–FR-020 build/verification | T019–T024, T042–T047 |
| FR-021–FR-029 publication/read-back | T025–T033, T037–T040, T047–T050 |
| FR-030–FR-036 lifecycle/final evidence | T034–T041, T048–T050 |
| SC-001–SC-002 | T010–T018 |
| SC-003–SC-005 | T019–T033, T047–T050 |
| SC-006–SC-008 | T034–T041, T048–T050 |
| SC-009–SC-010 | T003, T009, T042–T046, T050 |

## Scope Guard

Do not add DeepSeek publication, another platform, platform-runtime packages, postinstall downloads,
automatic updates, signing/notarization, PR publication credentials, shared Core semantic changes,
or remote overwrite/rollback behavior. Those are separate features, not cleanup.
