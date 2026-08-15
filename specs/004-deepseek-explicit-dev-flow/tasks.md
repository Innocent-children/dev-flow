---
description: "Dependency-ordered implementation tasks for the DeepSeek Harness product"
---

# Tasks: DeepSeek Explicit Dev Flow

**Prerequisites**: Feature 003 is implemented and merged to `main`; its exact merge commit and
delivered shared capabilities are recorded; both Feature 004 review checklists are approved.

**Evidence budget**: User-story checkpoints are deterministic/fake/integration only. One optional
release-candidate direct-result spike is allowed when no stable Harness exists. One complete gate on
the exact final stable Harness and one final stable journey are required. No per-story real Harness
journey is allowed.

## Phase 1 — Merged baseline and failing contracts

- [ ] T001 Record the Feature 003 merge commit, `internal/version` identity, Codex-aware shared
  contracts, root validator, root `VERSION`, Core source identity, and fixture aggregate in
  `specs/004-deepseek-explicit-dev-flow/evidence/direct-consumption.md` (FR-003).
- [ ] T002 Revalidate official Harness registry/repository evidence, stable/pre-release artifacts,
  package integrity/source, bundle/profile, Skill, MCP-result, add/remove/restart, and compatible
  range in `specs/004-deepseek-explicit-dev-flow/evidence/direct-consumption.md` (FR-004, FR-007–FR-010).
- [ ] T003 [P] Add failing package/tarball tests for one bundle, one Skill provider, one native STDIO
  MCP integration, six raw tools, approved dependencies, exact allowlist, no hooks/network/proxy,
  and preserved Codex rules in `packages/deepseek/tests/bundle.test.mjs` (FR-001–FR-006).
- [ ] T004 [P] Add failing runtime/launcher tests for package-relative Core, data roots, permissions,
  closed environment, shell-free raw STDIO, redaction, EOF/signals/cancellation, child reaping, no
  listener, and no network in `packages/deepseek/tests/launch-core.test.mjs` (FR-002, FR-011–FR-013).
- [ ] T005 [P] Add failing Skill tests for one explicit user-only `/dev-flow` Skill, zero implicit
  calls, invalid-scope rejection, server-info first, complete authority, and read-before-retry in
  `packages/deepseek/tests/skill.test.mjs` (FR-014–FR-020, FR-025–FR-026).
- [ ] T006 [P] Add failing fake-Core/direct-result tests for six-tool discovery, success/domain
  error, inline/near-spill/spilled/pruned/near-limit results, markers, retrieval method, byte/digest
  equality, cancellation, lost mutation, budget, `DONE`, and no-proxy-on-failure in
  `packages/deepseek/tests/fake-core.test.mjs` and
  `packages/deepseek/tests/direct-consumption.test.mjs` (FR-021–FR-026).

## Phase 2 — Foundation and direct-result gate

- [ ] T007 Verify the merged Feature 003 version seam/tests without editing `internal/version/` and
  record their identities in `specs/004-deepseek-explicit-dev-flow/evidence/direct-consumption.md`
  (FR-002–FR-003).
- [ ] T008 [P] Implement the test-only six-tool STDIO Core and deterministic result/failure vectors
  in `packages/deepseek/tests/fixtures/fake-core.mjs` (FR-017–FR-026).
- [ ] T009 [P] Implement package/platform/runtime/data-root resolution in
  `packages/deepseek/src/runtime.mjs` (FR-002, FR-005–FR-006, FR-011).
- [ ] T010 Implement the closed, shell-free, raw-STDIO Core launcher in
  `packages/deepseek/src/launch-core.mjs` (FR-011–FR-013).
- [ ] T011 [P] Implement the minimal official Skill provider entry in
  `packages/deepseek/src/index.mjs` with no task/result/retry state (FR-004, FR-014–FR-015, FR-020).
- [ ] T012 [P] Replace the package skeleton with private metadata, explicit files/exports, reviewed
  dependencies, and zero install/build/download/publication hooks in
  `packages/deepseek/package.json` (FR-001–FR-005).
- [ ] T013 Resolve only reviewed Harness dependencies without lifecycle scripts in `pnpm-lock.yaml`
  and record their integrity graph in `specs/004-deepseek-explicit-dev-flow/evidence/direct-consumption.md`
  (FR-004–FR-005, FR-008).
- [ ] T014 Configure one Skill provider and one official native STDIO MCP client with bounded startup
  and reconnect disabled in `packages/deepseek/cordis.patch.yml` (FR-004, FR-013, FR-017, FR-021).
- [ ] T015 [P] Add minimal explicit-only Skill metadata/body in
  `packages/deepseek/skills/dev-flow/SKILL.md` without an action/state/recovery catalog
  (FR-014–FR-015, FR-020–FR-024).
- [ ] T016 Run the foundation package, launcher, fake-Core, direct-result, and merged-baseline tests;
  resolve only T008–T015 failures (FR-011–FR-026).
- [ ] T017 Implement isolated direct-consumption orchestration, exact artifact selection, restart,
  byte/marker capture, and provisional/stable classification in
  `scripts/run-deepseek-real-journey.sh` (FR-004–FR-010, FR-021–FR-024).
- [ ] T018 When no stable Harness exists, optionally run one RC spike and label all six observations
  `pre-release-native`; when stable exists, run the full stable gate instead. Record results in
  `specs/004-deepseek-explicit-dev-flow/evidence/direct-consumption.md`; stop with no proxy on any
  failure (FR-007–FR-009, FR-021–FR-024).
- [ ] T019 Validate the T018 evidence and audit `packages/deepseek/` for zero proxy/task/recovery
  implementation before marking Foundation ready in
  `specs/004-deepseek-explicit-dev-flow/evidence/direct-consumption.md` (FR-020–FR-026).

## Phase 3 — User Story 1: install and explicit invocation

- [ ] T020 [P] [US1] Extend package/tarball tests for embedded executable mode, version/source/
  fixture identity, one Skill/MCP composition, exact allowlist, and preserved Codex rules in
  `packages/deepseek/tests/bundle.test.mjs` (FR-001–FR-006, FR-014, FR-017).
- [ ] T021 [P] [US1] Extend launcher tests for moved binary, Unicode/spaces/symlinks, unsupported
  platform, missing/incompatible Core, early exit, redaction, and stdout purity in
  `packages/deepseek/tests/launch-core.test.mjs` (FR-002, FR-011–FR-013).
- [ ] T022 [P] [US1] Extend Skill tests for explicit invocation, substantive/resume intent,
  zero-call ordinary/invalid inputs, one worktree, compatibility, and six-tool admission in
  `packages/deepseek/tests/skill.test.mjs` (FR-014–FR-019).
- [ ] T023 [P] [US1] Extend the merged Codex manifest contract for the reviewed DeepSeek manifest
  while preserving all Codex assertions in `tests/contract/package_manifest_test.go`
  (FR-001–FR-005).
- [ ] T024 [P] [US1] Extend the merged Codex layout contract for the reviewed DeepSeek tree while
  preserving all Codex assertions in `tests/contract/repository_layout_test.go`
  (FR-001–FR-005, FR-024).
- [ ] T025 [US1] Complete explicit `/dev-flow` admission, one-worktree checks, server-info-first
  handshake, catalog validation, and bounded diagnostics in
  `packages/deepseek/skills/dev-flow/SKILL.md` (FR-014–FR-019).
- [ ] T026 [US1] Finalize one provider and one native MCP composition in
  `packages/deepseek/src/index.mjs` and `packages/deepseek/cordis.patch.yml` using only T002 evidence
  (FR-004, FR-013–FR-017, FR-021).
- [ ] T027 [US1] Complete runtime selection, data-root handling, closed environment, transport
  lifecycle, and bounded failures in `packages/deepseek/src/runtime.mjs` and
  `packages/deepseek/src/launch-core.mjs` (FR-002, FR-011–FR-013).
- [ ] T028 [US1] Build a non-final deterministic-test tarball with the merged version seam and moved
  Core identity checks in `scripts/build-deepseek-package.sh` (FR-001–FR-005).
- [ ] T029 [US1] Extend the merged root validator with bounded DeepSeek source/dry-pack/dependency
  checks while preserving all Codex gates in `scripts/validate-repository.sh` (FR-003–FR-005).
- [ ] T030 [US1] Replace package skeleton guidance with merged-baseline, host gates, deterministic
  checkpoints, data/startup/repository boundaries, and no-publication guidance in
  `packages/deepseek/README.md` (FR-001–FR-019).
- [ ] T031 [US1] Add mandatory fake-profile setup/restart/readback, zero-task ordinary prompt,
  invalid invocation, startup failure, and repository fingerprints to
  `scripts/run-deepseek-real-journey.sh`; assert no real `dsh` process/native evidence (FR-004–FR-019, FR-027).
- [ ] T032 [US1] Run US1 tests and
  `scripts/run-deepseek-real-journey.sh --fake-host --through explicit-invocation`; resolve only US1
  failures and create no support claim (FR-026–FR-027, SC-001–SC-003).

## Phase 4 — User Story 2: govern and resume

- [ ] T033 [P] [US2] Extend fake-Core tests for create/resume/conflicts, fresh identity, closed
  payloads, errors, operation probe, blockers, budget, cancellation, and `DONE` in
  `packages/deepseek/tests/fake-core.test.mjs` (FR-017–FR-020, FR-025–FR-026).
- [ ] T034 [P] [US2] Reject incomplete action/error/recovery/outcome authority and accept only the
  Gate-B-proven complete retrieval path in `packages/deepseek/tests/direct-consumption.test.mjs`
  (FR-021–FR-025).
- [ ] T035 [P] [US2] Extend Skill authority scans to reject adapter state/catalogs, blind replay,
  fabricated probes, over-budget verification, shell use, and evidence promotion in
  `packages/deepseek/tests/skill.test.mjs` (FR-018–FR-020, FR-025–FR-027).
- [ ] T036 [US2] Extend `packages/deepseek/tests/fixtures/fake-core.mjs` with two action commits,
  uncertain apply/readback, budget evidence, blockers, cancellation, and terminal outcome
  (FR-019, FR-025–FR-026).
- [ ] T037 [US2] Add `host=deepseek` create/resume and Core-owned conflicts to
  `packages/deepseek/skills/dev-flow/SKILL.md` (FR-017–FR-020).
- [ ] T038 [US2] Add the complete fresh-authority action loop, exact identity/payload, one mutation,
  and success continuation to `packages/deepseek/skills/dev-flow/SKILL.md`
  (FR-018–FR-020, FR-023, FR-026).
- [ ] T039 [US2] Encode only the exact Gate-B-proven result retrieval and completeness checks in
  `packages/deepseek/skills/dev-flow/SKILL.md` (FR-021–FR-023).
- [ ] T040 [US2] Add uncertain-mutation handling with retained original values and Core-defined
  readback/operation probe in `packages/deepseek/skills/dev-flow/SKILL.md` (FR-018–FR-020, FR-025).
- [ ] T041 [US2] Add budget accounting, evidence labels, blocker/conflict/cancel stops, and completion
  only from complete Core `DONE` in `packages/deepseek/skills/dev-flow/SKILL.md`
  (FR-018–FR-020, FR-026).
- [ ] T042 [US2] Add fake-host two-action, restart/resume, budget, readback, and `DONE` stages to
  `scripts/run-deepseek-real-journey.sh` (FR-019, FR-025–FR-027).
- [ ] T043 [US2] Run US2 tests and
  `scripts/run-deepseek-real-journey.sh --fake-host --through done`; assert no real Harness/native
  evidence (FR-026–FR-027, SC-004, SC-006).

## Phase 5 — User Story 3: remove and preserve Codex

- [ ] T044 [P] [US3] Extend package tests for product-identity removal, no cleanup hooks, task-data
  separation, and no Codex-owned resources in `packages/deepseek/tests/bundle.test.mjs` (FR-005–FR-006).
- [ ] T045 [P] [US3] Add retained-data, no-recursive-cleanup, reinstall/resume, and Codex-comparison
  fixture tests in `packages/deepseek/tests/launch-core.test.mjs` and
  `packages/deepseek/tests/journey-harness.test.mjs` (FR-006, FR-011–FR-013).
- [ ] T046 [US3] Add fake-host remove/restart/absence, data/repository manifests, reinstall, repeated
  removal, stale-metadata stop, and Codex-comparison capture to
  `scripts/run-deepseek-real-journey.sh` (FR-006, FR-027–FR-028).
- [ ] T047 [US3] Document supported removal/restart/readback, no cache purge, retained data,
  reinstall, and mandatory final Codex comparison in `packages/deepseek/README.md`
  (FR-006, FR-028).
- [ ] T048 [US3] Run bundle, launcher, retained-data, shared-contract, and fake-host removal tests;
  resolve only US3 failures (FR-005–FR-006, FR-026–FR-027).
- [ ] T049 [US3] Run
  `scripts/run-deepseek-real-journey.sh --fake-host --through remove`; assert no real Harness/native
  evidence (FR-006, FR-027, SC-007).
- [ ] T050 [US3] Implement/test a read-only final evidence validator that requires real Codex
  non-interference for `status=pass` and permits honest blocked/failed records in
  `scripts/validate-deepseek-journey-evidence.mjs` and
  `packages/deepseek/tests/journey-harness.test.mjs` (FR-028, SC-007).

## Phase 6 — Stable gate, final artifact, and final journey

- [ ] T051 Revalidate/select the latest stable compatible Harness and update all affected research,
  plan, contracts, quickstart, package docs, tests, and evidence expectations; stop when no stable
  exists (FR-008, SC-008).
- [ ] T052 Ensure complete six-case Gate B evidence for the exact T051 stable artifact. Execute the
  full gate when T018 used an RC/different artifact; revalidate and reuse T018 only when it used the
  same exact stable artifact and T051 confirms it remains current. Stop with no proxy/final artifact
  on failure (FR-009–FR-010, FR-021–FR-024).
- [ ] T053 Reconcile commands, paths, stable retrieval, package/profile/task/removal/reinstall/Codex
  comparison, evidence labels, and support claims across
  `specs/004-deepseek-explicit-dev-flow/quickstart.md`, contracts, data model, and
  `packages/deepseek/README.md` (FR-004–FR-010, FR-023–FR-028).
- [ ] T054 Run all deterministic DeepSeek tests, affected shared Go contracts, dry-pack/build checks,
  and root `pnpm run validate`; fix only Feature 004 defects and record results/source commit
  (FR-026–FR-028).
- [ ] T055 Perform a read-only pre-final audit of `packages/deepseek/`, DeepSeek scripts, merged root
  validator, affected shared contracts/lockfile, and
  `specs/004-deepseek-explicit-dev-flow/**`; freeze source after confirming no regression/proxy/
  repository mutation/network/publication/unsupported claim (FR-003, FR-005, FR-020–FR-024).
- [ ] T056 From frozen source, build exactly one final artifact in
  `scripts/build-deepseek-package.sh` and verify version/range/allowlist/executable/source/fixture/
  package/Core identities; any defect returns to T054 (FR-001–FR-010, FR-028).
- [ ] T057 Run the sole final stable journey with the exact T052 Harness and T056 product artifact,
  including add/restart, ordinary prompt, explicit task, two Core commits, restart/resume, budgeted
  `DONE`, remove/restart, retained data/task reopen, reinstall, repository equality, and mandatory
  real co-installed Codex before/after comparison; write only observed facts to
  `specs/004-deepseek-explicit-dev-flow/evidence/real-journey.md` (FR-010, FR-028).
- [ ] T058 Validate the final evidence read-only with
  `scripts/validate-deepseek-journey-evidence.mjs`, including merged baseline, stable Gate B/final
  host identity, frozen source/artifact, lineage, budget, `DONE`, data/repository/Codex equality,
  proxy absence, prior validation, failures/skips, and support range (FR-028).
- [ ] T059 Perform the final read-only scope audit; confirm no source changed after freeze and only
  the final evidence record was added after artifact creation. Run no further build/native journey/
  publication/commit/release action (FR-003, FR-005, FR-020, FR-028).

## Execution Rules

- T001 blocks all Feature 004 implementation.
- T018 is optional only for a provisional RC; when it runs on the exact final stable artifact, T052
  may revalidate/reuse it instead of duplicating the native gate.
- T032, T043, and T049 must use `--fake-host` and never start `dsh`.
- T051–T059 are serialized; T057 is the sole final stable journey.
- A source change after T056 invalidates the artifact and returns to T054.
- Evidence validation failure is never repaired by editing evidence.
- Stop for amendment if work requires an unmerged Feature 003 dependency, seventh tool, Core public
  contract change, adapter persistence, proxy, cache deletion, repository setup, shell/listener/
  network behavior, publication, unsupported platform, per-story real journey, or passing evidence
  without real Codex non-interference.
