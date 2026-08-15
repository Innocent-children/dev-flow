---

description: "Dependency-ordered implementation tasks for the local DeepSeek Harness product"
---

# Tasks: DeepSeek Explicit Dev Flow

**Input**: Design documents from `specs/004-deepseek-explicit-dev-flow/`
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`
**Tests**: Required by FR-026–FR-028 and every user story's independent-test criterion. Add each
named targeted assertion before its corresponding behavior and demonstrate that the assertion fails
for the missing behavior.

**Organization**: Tasks are grouped into Setup, Foundation, User Story 1, User Story 2, User Story
3, and final cross-cutting validation. Direct native MCP completeness is an early stop gate. Feature
003 T005/T006 exclusively own the shared packaged-Core version tests/seam; Feature 004 consumes it
without editing or duplicating `internal/version/`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel with other marked work in the same ready phase because it owns
  different files and has no unmet intra-phase dependency.
- **[Story]**: Maps implementation and tests to one independently reviewable user story.
- Every task names the exact repository path or paths it may change or validate.

## Phase 1: Setup (Host Contract and Failing Tests)

**Purpose**: Freeze reproducible first-party host evidence and establish failing package-local tests
before production bundle behavior is added.

- [ ] T001 Revalidate the official npm artifact and DeepSeek source for stable availability, compatible range, integrity, bundle/profile fields, Skill provider API, native MCP config/result behavior, and add/remove commands, recording direct links, access time, exact artifact identity, and all evidence gaps in `specs/004-deepseek-explicit-dev-flow/evidence/direct-consumption.md` (FR-003, FR-018, SC-008)
- [ ] T002 [P] Add failing source/staged-tarball contracts for private `dev-flow-deepseek` identity, one bundle patch, one Skill provider, one native STDIO MCP instance, exact six raw tools, first-party-only runtime dependencies, content allowlists, bounded reconnect/startup settings, and no lifecycle/publication/network/proxy surface in `packages/deepseek/tests/bundle.test.mjs` (FR-001–FR-006, FR-014, FR-018–FR-021, SC-001, SC-003, SC-005)
- [ ] T003 [P] Add failing tests for package-relative runtime resolution, macOS arm64 selection, explicit and default data roots, default-root creation permissions, six-key child environment, shell-free raw STDIO, startup redaction, EOF/signal/cancellation forwarding, and child reaping in `packages/deepseek/tests/launch-core.test.mjs` (FR-002, FR-007–FR-008, FR-020–FR-021)
- [ ] T004 [P] Add failing requirements tests for one `dev-flow` Skill, `userInvocable=true`, `modelInvocable=false`, explicit token admission, zero implicit Core calls, empty/conversational and non-Git/multi-repository rejection, server-info-first behavior, Core-only authority, complete-result handling, and read-before-retry in `packages/deepseek/tests/skill.test.mjs` (FR-009–FR-017, FR-023–FR-025, SC-002)
- [ ] T005 [P] Add failing fake-Core tests for exact six-tool discovery, complete success and `isError` envelopes, inline/near-spill/spilled/pruned/near-limit vectors, delayed startup, child crash, cancellation, lost mutation response, operation probe, budget error, and terminal outcome in `packages/deepseek/tests/fake-core.test.mjs` (FR-014, FR-022–FR-026)
- [ ] T006 [P] Add failing validation for every `DirectResultObservation` field, expected/recovered byte and SHA-256 equality, incomplete marker detection, official retrieval-method recording, evidence-strength labels, and a hard no-proxy decision on failed cases in `packages/deepseek/tests/direct-consumption.test.mjs` (FR-018–FR-023, FR-026, SC-005, SC-008)

---

## Phase 2: Foundation (Direct-Consumption Gate)

**Purpose**: Build only the minimum native bundle/lifecycle surface needed to prove that direct
Harness consumption preserves complete Core authority. This phase blocks all story implementation.

**Critical**: Host-specific work T008–T018 may proceed while Feature 003 finishes its shared
version seam. T007 records that dependency; Feature 004's final packaged-Core build later waits for
Feature 003 T006. If T018 cannot prove every required direct-result case, stop and amend the plan—do
not add a projection proxy or begin US1.

- [ ] T007 Verify Feature 003 T005 injected/source-fallback tests and T006 sole link-time `buildVersion` seam without modifying `internal/version/version_test.go` or `internal/version/version.go`, and record the exact test/source identity in `specs/004-deepseek-explicit-dev-flow/evidence/direct-consumption.md` (FR-002, FR-028)
- [ ] T008 [P] Implement the test-only STDIO MCP process with exact six live schemas, deterministic complete envelopes at all size thresholds, `isError`, crash/delay/cancellation, request transcript, lost-apply, operation-probe, budget, and terminal fixtures in `packages/deepseek/tests/fixtures/fake-core.mjs` (FR-014, FR-022–FR-026)
- [ ] T009 [P] Implement package/platform/runtime and data-directory resolution with explicit `DEV_FLOW_DATA_DIR` precedence, existing-override validation, first-launch default creation at user-only permissions, and no target-repository path fallback in `packages/deepseek/src/runtime.mjs` (FR-002, FR-005–FR-007)
- [ ] T010 Implement the shell-free package-relative Core launcher with a newly constructed six-key environment, raw stdin/stdout forwarding, bounded redacted stderr, EOF/signal/cancellation propagation, and deterministic child wait/reap in `packages/deepseek/src/launch-core.mjs` (FR-002, FR-007–FR-008, FR-020–FR-021)
- [ ] T011 [P] Implement the smallest official Cordis provider entry that registers one package-owned Skill definition through the T001-verified `ctx.skills` contract and holds no task/result/retry state in `packages/deepseek/src/index.mjs` (FR-004, FR-009–FR-010, FR-016)
- [ ] T012 [P] Replace the engineering skeleton with private bundle metadata, repository `0.x` version identity, Node engine, explicit files/exports, T001-verified official Harness dependencies/ranges, and zero install/build/download/publication hooks in `packages/deepseek/package.json` (FR-001–FR-005)
- [ ] T013 Resolve only the T001-verified direct Harness package dependencies for `packages/deepseek/package.json` and record their exact integrity graph without running lifecycle scripts in `pnpm-lock.yaml` (FR-003–FR-005)
- [ ] T014 Configure the T001-verified bundle patch to mount the package Skill provider and one `@deepseek-ai/dsh-mcp-client` STDIO instance with stable server name, package launcher command, `failOnStartupError=false`, `reconnect.enabled=false`, and no HTTP/generic forwarding in `packages/deepseek/cordis.patch.yml` (FR-003–FR-004, FR-008, FR-014, FR-020–FR-021)
- [ ] T015 [P] Add the minimal explicit-only `dev-flow` metadata/body needed for real-profile discovery without adding an action catalog, state table, or unverified result-retrieval instruction in `packages/deepseek/skills/dev-flow/SKILL.md` (FR-009–FR-010, FR-016, FR-018)
- [ ] T016 Run the failing-first foundation checks in `packages/deepseek/tests/bundle.test.mjs`, `packages/deepseek/tests/launch-core.test.mjs`, `packages/deepseek/tests/fake-core.test.mjs`, and `packages/deepseek/tests/direct-consumption.test.mjs`, resolving only T008–T015 behavior and leaving story assertions failing in `packages/deepseek/tests/skill.test.mjs` (FR-007–FR-008, FR-014, FR-018–FR-023, FR-026)
- [ ] T017 Implement an isolated `--through direct-consumption` journey stage that locally packs a test-only fake-Core bundle, uses only T001-verified profile add/remove and host invocation mechanisms, restarts the profile, captures canonical bytes/markers without secrets, and never publishes or touches the target repository in `scripts/run-deepseek-real-journey.sh` (FR-003–FR-005, FR-018–FR-023)
- [ ] T018 Execute `scripts/run-deepseek-real-journey.sh --through direct-consumption` on the selected official engineering artifact, record all six complete digest-matching result cases and actual native tool names in `specs/004-deepseek-explicit-dev-flow/evidence/direct-consumption.md`, and stop for amendment with the direct gate failed and no proxy authorized if any case fails rather than creating proxy files (FR-018–FR-023, SC-003, SC-005, SC-008)
- [ ] T019 Re-run `packages/deepseek/tests/direct-consumption.test.mjs` against the recorded Gate B evidence and audit `packages/deepseek/` for zero projection/state/recovery implementation before marking the foundation ready in `specs/004-deepseek-explicit-dev-flow/evidence/direct-consumption.md` (FR-016, FR-018–FR-023, FR-026, SC-005)

**Checkpoint**: The real Harness artifact exposes the six direct tools and yields complete canonical
results across inline/spill/prune/error limits; no projection proxy is present or authorized.

---

## Phase 3: User Story 1 — Install and Explicitly Invoke Dev Flow (Priority: P1) MVP

**Goal**: Build one self-contained local artifact, add it to an isolated Harness profile, expose one
explicit-only Skill plus six direct tools, produce bounded startup failure, and leave the current
repository untouched.

**Independent Test**: Build a fresh artifact after Feature 003 T006, add it to a clean isolated
profile, restart Harness, prove exactly one Skill/six tools and zero tasks from an ordinary prompt,
invoke `/dev-flow` in a temporary Git repository, exercise invalid-runtime diagnostics separately,
and compare repository fingerprints.

### Tests for User Story 1

- [ ] T020 [P] [US1] Extend source/tarball package tests for embedded executable presence and mode, repository/package/Core version parity, canonical fixture digest, one Skill/one MCP composition, exact content allowlist, no source/fixture/test-fake copy, and no install/profile/data/repository mutation hook in `packages/deepseek/tests/bundle.test.mjs` (FR-001–FR-006, FR-009, FR-014, SC-001, SC-003)
- [ ] T021 [P] [US1] Extend launcher tests for moved-artifact execution without source `VERSION`, explicit/default data paths, Unicode/spaces/symlinks, unsupported platform, absent/non-executable/incompatible Core, early child exit, nonfatal startup, redaction, and zero stdout contamination in `packages/deepseek/tests/launch-core.test.mjs` (FR-002, FR-007–FR-008)
- [ ] T022 [P] [US1] Extend Skill tests for exact official explicit-invocation metadata/token semantics, substantive versus resume intent, ordinary/empty/conversational zero-call behavior, one current worktree, non-Git/multi-repository rejection, server-info compatibility, and exact six-tool admission in `packages/deepseek/tests/skill.test.mjs` (FR-009–FR-014, SC-002–SC-003)
- [ ] T023 [P] [US1] Extend the shared manifest contract after preserving Feature 003 rules to allow only the reviewed private DeepSeek bundle fields, official runtime dependencies, explicit pack allowlist, and non-lifecycle test commands in `tests/contract/package_manifest_test.go` (FR-001–FR-005, FR-026)
- [ ] T024 [P] [US1] Extend the shared layout contract after preserving Feature 003 paths to allow only the reviewed DeepSeek source/test tree and forbid committed runtime binaries, tarballs, data, profile files, copied fixtures, and any proxy source path in `tests/contract/repository_layout_test.go` (FR-001–FR-002, FR-005, FR-018, FR-026)

### Implementation for User Story 1

- [ ] T025 [US1] Complete explicit `/dev-flow` admission, substantive/resume distinction, single read-only worktree resolution, non-Git/multi-repository stops, server-info-first Contract 0.1 handshake, exact tool-catalog check, and bounded user diagnostics in `packages/deepseek/skills/dev-flow/SKILL.md` (FR-010–FR-014)
- [ ] T026 [US1] Finalize one Skill-provider and one nonfatal/no-reconnect local STDIO MCP composition using only the exact artifact APIs verified by T001 in `packages/deepseek/src/index.mjs` and `packages/deepseek/cordis.patch.yml` (FR-003–FR-004, FR-008–FR-010, FR-014)
- [ ] T027 [US1] Complete package-relative Core selection, default data-root creation, closed environment, startup compatibility/executable checks, raw transport lifecycle, and bounded non-secret failure behavior in `packages/deepseek/src/runtime.mjs` and `packages/deepseek/src/launch-core.mjs` (FR-002, FR-007–FR-008, FR-020–FR-021)
- [ ] T028 [US1] After Feature 003 T006, build a reproducible temporary `CGO_ENABLED=0 GOOS=darwin GOARCH=arm64` Core with link-time repository `VERSION`, prove moved-binary CLI/server-info identity, stage the exact bundle allowlist, and emit one private local tarball without committing or publishing in `scripts/build-deepseek-package.sh` (FR-001–FR-005)
- [ ] T029 [US1] Preserve all Codex validation behavior while adding bounded DeepSeek source dry-pack and package-local Node test entry points, with no real-host/network/publication step, in `scripts/validate-repository.sh` (FR-005, FR-026)
- [ ] T030 [US1] Replace skeleton guidance with supported engineering/stable gate, local build, isolated profile add/restart, explicit invocation, data-directory, startup diagnostics, repository cleanliness, and no-publication instructions in `packages/deepseek/README.md` (FR-001–FR-014, SC-001–SC-003, SC-008)
- [ ] T031 [US1] Extend the setup checkpoint in `scripts/run-deepseek-real-journey.sh` to build the final-form package, capture Core/package/fixture digests, add by local artifact, restart, read profile/Skill/tool state, trace an ordinary zero-task prompt and explicit/invalid invocations, inject bounded startup failures, and compare repository fingerprints (FR-002–FR-014, FR-028, SC-001–SC-003)
- [ ] T032 [US1] Run the targeted US1 tests, build through `scripts/build-deepseek-package.sh`, and execute `scripts/run-deepseek-real-journey.sh --through explicit-invocation` on the selected engineering-spike Harness/macOS arm64 artifact, recording only observed pre-release/story-checkpoint facts and no support claim in `specs/004-deepseek-explicit-dev-flow/evidence/real-journey.md` (FR-026–FR-028, SC-001–SC-003, SC-008)

**Checkpoint**: User Story 1 is independently packable, profile-scoped, explicit-only, and
repository-clean. A pre-release checkpoint is not final stable support evidence.

---

## Phase 4: User Story 2 — Govern and Resume a Real DeepSeek Task (Priority: P2)

**Goal**: Let the explicit Skill create or resume one Core-owned task, follow only complete fresh
Core results, recover by authoritative reads, honor evidence budget, restart Harness, and report
only the Core terminal outcome.

**Independent Test**: Run the fake-Core suite and a bounded real Harness journey using the current
artifact; cross at least two Core-committed actions, close/restart the host, resume the same task
lineage, stay within the verification budget, and reach Core `DONE`.

### Tests for User Story 2

- [ ] T033 [P] [US2] Extend fake-Core tests for `host=deepseek` create, omitted-contract and exact-contract resume, same-host/cross-host conflicts, fresh action identity, closed payload forwarding, success/domain errors, lost mutation operation probe, blocker, budget failure, cancellation, and `DONE` in `packages/deepseek/tests/fake-core.test.mjs` (FR-013–FR-017, FR-022–FR-026, SC-004, SC-006)
- [ ] T034 [P] [US2] Extend direct-result tests so every fresh action, mutation, domain error, recovery assessment, blocker, and outcome is rejected as authority when only previewed/truncated and accepted only after the T018-proven complete retrieval path matches canonical bytes in `packages/deepseek/tests/direct-consumption.test.mjs` (FR-019, FR-022–FR-024)
- [ ] T035 [P] [US2] Extend Skill authority tests to reject local task persistence, phase/action catalogs, transition/error/completion logic, blind mutation replay, fabricated operation probes, over-budget verification, generic shell use, and simulated/native evidence promotion in `packages/deepseek/tests/skill.test.mjs` (FR-015–FR-017, FR-023–FR-026, SC-005–SC-006)

### Implementation for User Story 2

- [ ] T036 [US2] Extend the test-only Core transcript and result vectors for create/resume/conflict, two committed actions, uncertain apply/read-back classifications, budget evidence, blockers, cancellation, and terminal outcome in `packages/deepseek/tests/fixtures/fake-core.mjs` (FR-017, FR-022–FR-026)
- [ ] T037 [US2] Add `host=deepseek` task creation, omitted-contract resume, exact-compatible resume, and Core-owned active/host conflict handling to `packages/deepseek/skills/dev-flow/SKILL.md` (FR-013, FR-015–FR-017)
- [ ] T038 [US2] Add the fresh-authority loop with complete revision/action/binding, live allowed effects, evidence requirements, payload schema, user/repository authority, retained request ID, one mutation dispatch, and complete success continuation to `packages/deepseek/skills/dev-flow/SKILL.md` (FR-015–FR-017, FR-023, FR-025)
- [ ] T039 [US2] Encode only the exact direct spill/prune/full-content retrieval mechanism proven at T018, including marker detection and complete-envelope validation before authority use, in `packages/deepseek/skills/dev-flow/SKILL.md` (FR-018–FR-019, FR-022–FR-023)
- [ ] T040 [US2] Add missing/cancelled/spilled/pruned/truncated/malformed/uncertain mutation handling with the original request values, task/next-action operation probe, complete Core recovery assessment, and no retry before Core advice to `packages/deepseek/skills/dev-flow/SKILL.md` (FR-015–FR-016, FR-022–FR-024)
- [ ] T041 [US2] Add exact automatic-command budget accounting, automated/manual/simulated/unverified evidence labels, blocker/conflict/cancel stops, and completion only from a complete Core outcome to `packages/deepseek/skills/dev-flow/SKILL.md` (FR-015–FR-016, FR-025, SC-004, SC-006)
- [ ] T042 [US2] Extend `scripts/run-deepseek-real-journey.sh` with one bounded real source change, complete Core-call capture, two committed actions, deliberate Harness close/restart, omitted-contract resume, same task/revision checks, verification-budget accounting, uncertain-response read-back when safe, and Core-owned `DONE` capture (FR-017, FR-023–FR-028, SC-004, SC-006)
- [ ] T043 [US2] Run `packages/deepseek/tests/fake-core.test.mjs`, `packages/deepseek/tests/direct-consumption.test.mjs`, and `packages/deepseek/tests/skill.test.mjs`, then execute `scripts/run-deepseek-real-journey.sh --through done` on the engineering-spike Harness/macOS arm64 artifact and append accurately labeled pre-release story evidence with no support claim to `specs/004-deepseek-explicit-dev-flow/evidence/real-journey.md` (FR-026–FR-028, SC-004, SC-006, SC-008)

**Checkpoint**: User Story 2 follows only complete Core authority through fake and real-host
restart/resume evidence; the adapter still contains no workflow or result-projection implementation.

---

## Phase 5: User Story 3 — Remove Without Deleting Task Data (Priority: P3)

**Goal**: Remove only the profile dependency/product bundle layer, preserve shared Core data and the
target repository, leave Codex untouched, and permit a compatible reinstall/resume.

**Independent Test**: With an existing task and packed artifact, remove by product identity,
restart Harness, prove package/Skill/tools absent, compare task-data and repository fingerprints,
reinstall compatibly, resume the retained task, and compare Codex state when Codex is installed.

### Tests for User Story 3

- [ ] T044 [P] [US3] Extend bundle tests for product-identity removal, absence of uninstall/data/cache cleanup hooks, separation of profile dependency from task data, and final-package exclusion of Codex-owned paths/resources in `packages/deepseek/tests/bundle.test.mjs` (FR-005–FR-006, SC-007)
- [ ] T045 [P] [US3] Extend lifecycle tests for explicit/default data persistence across launcher shutdown, no recursive cleanup, compatible restart/reinstall, and exact Codex/environment non-interference in `packages/deepseek/tests/launch-core.test.mjs` (FR-006–FR-008, SC-007)

### Implementation for User Story 3

- [ ] T046 [US3] Extend `scripts/run-deepseek-real-journey.sh` with official product-identity remove, host restart, profile dependency/Skill/tool absence readback, shared-data and repository digests, compatible reinstall/resume, repeated removal, stale-metadata stop, and optional Codex before/after comparison in `scripts/run-deepseek-real-journey.sh` (FR-006, FR-027–FR-028, SC-007)
- [ ] T047 [US3] Document official profile removal, required restart/readback, absence of an invented cache purge, retained data, compatible reinstall/resume, repeated removal, and Codex isolation in `packages/deepseek/README.md` (FR-006, SC-007)
- [ ] T048 [US3] Run `packages/deepseek/tests/bundle.test.mjs` and `packages/deepseek/tests/launch-core.test.mjs` against the removal/data-retention boundary, resolving only User Story 3 failures (FR-005–FR-008, FR-026, SC-007)
- [ ] T049 [US3] Execute the removal checkpoint with `scripts/run-deepseek-real-journey.sh --through remove`, prove restart-time package/Skill/tool absence plus byte-retained Core data and unchanged repository, and append observed facts to `specs/004-deepseek-explicit-dev-flow/evidence/real-journey.md` (FR-006, FR-027–FR-028, SC-007)
- [ ] T050 [US3] Execute compatible reinstall/resume and the Codex co-installation comparison when available, recording the same task identity or an explicit Codex skip without simulated proof in `specs/004-deepseek-explicit-dev-flow/evidence/real-journey.md` (FR-006, FR-017, FR-028, SC-007)

**Checkpoint**: User Story 3 removes only the DeepSeek profile product layer and preserves Core,
repository, and other-host state.

---

## Phase 6: Polish and Cross-Cutting Validation

**Purpose**: Revalidate the volatile official contract, build exactly one final artifact, run the
only stable real-host support journey, and bound every final claim.

- [ ] T051 [P] Recheck the official DeepSeek repository and npm metadata for the latest stable compatible Harness, source/package identity, bundle/profile, Skill, MCP result, add/remove, and cache contracts; update dated evidence and compatible-range conclusions in `specs/004-deepseek-explicit-dev-flow/research.md`, `specs/004-deepseek-explicit-dev-flow/plan.md`, and `specs/004-deepseek-explicit-dev-flow/evidence/direct-consumption.md`, stopping the final journey if no stable exists (FR-003, FR-018, SC-008)
- [ ] T052 [P] Reconcile the implemented commands, paths, default/override data behavior, Gate B retrieval method, build, install/restart, task journey, remove/reinstall, evidence labels, and stable gate with `specs/004-deepseek-explicit-dev-flow/quickstart.md` and `packages/deepseek/README.md` without adding publication or unsupported platforms (FR-003, FR-006–FR-008, FR-023, FR-027–FR-028, SC-008)
- [ ] T053 [P] Harden final source/tarball authority scans for exactly one Skill/six tools, no proxy/task-state/action-table/recovery/completion logic, no copied fixtures, no secrets/data/profile/repository artifacts, no lifecycle/network/publication hooks, and only the reviewed official dependency graph in `packages/deepseek/tests/bundle.test.mjs`, `packages/deepseek/tests/skill.test.mjs`, `tests/contract/package_manifest_test.go`, and `tests/contract/repository_layout_test.go` (FR-001–FR-007, FR-014–FR-022, FR-026, SC-003, SC-005, SC-008)
- [ ] T054 After Feature 003 T006 and T051's stable gate pass, build exactly one final private artifact with `scripts/build-deepseek-package.sh`, prove moved Core CLI/server-info version identity and the complete package allowlist, and write artifact/Core/source/fixture SHA-256 values to `specs/004-deepseek-explicit-dev-flow/evidence/real-journey.md` without publishing or committing the binary (FR-001–FR-005, FR-028)
- [ ] T055 Run the complete targeted DeepSeek Node tests under `packages/deepseek/tests/` plus the affected Go contracts in `tests/contract/`, recording exact failures and skips in `specs/004-deepseek-explicit-dev-flow/evidence/real-journey.md` and fixing only Feature 004-caused defects before native evidence (FR-026–FR-028)
- [ ] T056 Run the final artifact from add/restart through ordinary zero-task prompt, explicit task, two Core-committed actions, Harness restart/resume, budgeted Core `DONE`, product-identity removal/restart, retained-data reopen, compatible reinstall, repository comparison, and Codex comparison on the latest stable compatible Harness/macOS arm64 surface via `scripts/run-deepseek-real-journey.sh`, writing only observed facts to `specs/004-deepseek-explicit-dev-flow/evidence/real-journey.md` (FR-003, FR-027–FR-028, SC-001–SC-004, SC-006–SC-008)
- [ ] T057 Audit `specs/004-deepseek-explicit-dev-flow/evidence/real-journey.md` for exact Harness package/build/profile, OS/architecture, artifact/Core/source/fixture digests, `proxy_presence`, native tool/Skill observations, task/action lineage, budget, terminal outcome, removal/data/Codex facts, failures/skips, and support claims no broader than the recorded range/platform (FR-028, SC-004, SC-006–SC-008)
- [ ] T058 Run the root `package.json` gate exactly once as `pnpm run validate`, recording its result once in `specs/004-deepseek-explicit-dev-flow/evidence/real-journey.md` without relabeling failed, skipped, manual, simulated, pre-release, or unsupported evidence (FR-025–FR-028)
- [ ] T059 Audit the final diff under `packages/deepseek/`, `scripts/build-deepseek-package.sh`, `scripts/run-deepseek-real-journey.sh`, `scripts/validate-repository.sh`, `pnpm-lock.yaml`, `tests/contract/`, and `specs/004-deepseek-explicit-dev-flow/evidence/` for no Core Contract/state change, duplicated shared seam, proxy, target-repository/Git mutation, runtime network, release/publication, future abstraction, or unsupported Windows/Linux claim (FR-005, FR-016, FR-018–FR-020, SC-005, SC-008)

---

## Dependencies and Execution Order

### Phase dependencies

- **Phase 1 — Setup**: starts immediately; T002–T006 can follow T001's recorded contract and run in
  parallel.
- **Phase 2 — Foundation**: depends on Setup. T008–T015 are host-specific and can proceed while
  Feature 003 T005/T006 finish; T018–T019 block every story and authorize only direct consumption.
- **Phase 3 — US1**: depends on Gate B. Host Skill/bundle work may start after T019; T028 and any
  final-form packed artifact additionally depend on Feature 003 T006.
- **Phase 4 — US2**: depends on US1's installed Skill/MCP shell and Gate B retrieval evidence.
- **Phase 5 — US3**: depends on US1 installation identity but not on US2's action loop, so it may be
  implemented in parallel with US2 after US1.
- **Phase 6 — Polish**: depends on all three stories. T051 is a hard stable-version gate; T054–T058
  cannot complete while the official registry has no stable compatible Harness.

### Shared-foundation ownership

- Feature 003 T005 owns `internal/version/version_test.go`; Feature 003 T006 owns
  `internal/version/version.go`. Feature 004 T007 verifies them and T028/T054 consume them but never
  edits either file.
- T023–T024 and T029 preserve Feature 003's already-delivered Codex rules while adding only the
  DeepSeek package boundary. They must not revert concurrent changes.
- All remaining production work is confined to `packages/deepseek/` and its two bounded repository
  scripts; evidence remains under this feature directory.

### User-story dependencies

- **US1 (P1)**: no other story dependency; it is the MVP after Gate B.
- **US2 (P2)**: consumes US1's Skill/provider/MCP/launcher and direct-result evidence; adds no
  adapter persistence.
- **US3 (P3)**: consumes US1's profile/package identity and may proceed independently of US2.
- Only T056 after T051 establishes final stable native support evidence; story checkpoints using a
  release candidate remain explicitly pre-release evidence.

### Within each story

- Add or extend the named failing tests before changing the corresponding production resource.
- Resolve package/provider configuration only from T001/T051 official evidence; never guess a field.
- Retrieve and validate complete Core results before action or retry decisions.
- Build only after Feature 003 T006; run story-local checks before checkpoints and root validation
  only once at T058.

## Parallel Opportunities

### Setup and Foundation

```text
T002 bundle tests || T003 launcher tests || T004 Skill tests || T005 fake-Core tests || T006 result-evidence tests
T008 fake Core    || T009 runtime paths  || T011 Skill provider || T012 package manifest || T015 Skill resource
```

T010 follows T009, T013 follows T012, T014 follows T011/T012, and T016 joins the deterministic
foundation before T017–T019 execute Gate B. T007 waits only for Feature 003 T005/T006 and does not
block the other host-specific files.

### User Story 1

```text
T020 bundle/tarball tests || T021 launcher tests || T022 Skill tests
T023 manifest contract    || T024 layout contract
```

T025–T032 then integrate and validate the story; T028 waits for Feature 003 T006.

### User Story 2

```text
T033 fake workflow cases || T034 complete-result cases || T035 Skill authority cases
```

T036–T043 serialize updates to the shared fake fixture, one production Skill, and journey path.

### User Story 3

```text
T044 removal bundle cases || T045 retained-data launcher cases
```

T046–T050 then implement and observe official profile removal/reinstall in order.

### Cross-story and Polish

After US1, one developer may execute T033–T043 while another executes T044–T050. In Polish,
T051–T053 can proceed in parallel before the single final artifact/evidence chain T054–T059.

## Requirements Coverage

| Requirement | Primary tasks |
|---|---|
| FR-001 | T002, T012, T020, T023–T024, T028, T053–T054 |
| FR-002 | T003, T007, T009–T010, T021, T027–T028, T054 |
| FR-003 | T001–T002, T012–T014, T017–T018, T026, T030–T032, T051–T056 |
| FR-004 | T002, T011–T014, T020, T026, T031–T032 |
| FR-005 | T002, T009, T012–T014, T020, T023–T024, T028–T029, T044, T053, T059 |
| FR-006 | T009, T020, T030–T032, T044–T050, T052, T056 |
| FR-007 | T003, T009–T010, T021, T027, T045, T053, T059 |
| FR-008 | T003, T010, T014, T021, T026–T027, T030–T032, T045, T052–T053 |
| FR-009 | T002, T004, T011, T015, T020, T022, T025–T026, T031 |
| FR-010 | T004, T011, T015, T022, T025–T026, T031–T032 |
| FR-011 | T004, T022, T025, T031–T032 |
| FR-012 | T004, T009, T022, T025, T031–T032 |
| FR-013 | T004, T022, T025, T033, T037 |
| FR-014 | T002, T005, T008, T014, T018, T020, T022, T026, T031–T033, T053 |
| FR-015 | T004, T035, T037–T041, T053, T059 |
| FR-016 | T004, T011, T015, T019, T035, T037–T041, T053, T059 |
| FR-017 | T033, T036–T038, T042–T043, T050 |
| FR-018 | T001–T002, T006, T015, T017–T019, T024, T034, T039, T051, T053, T059 |
| FR-019 | T002, T005–T006, T008, T017–T019, T034, T039, T053 |
| FR-020 | T002–T003, T010, T014, T017–T019, T053, T059 |
| FR-021 | T002–T003, T010, T014, T017–T019, T027, T053 |
| FR-022 | T005–T006, T008, T018–T019, T033–T034, T036, T040 |
| FR-023 | T004–T006, T008, T018–T019, T034–T035, T038–T043, T052 |
| FR-024 | T004–T006, T008, T033–T036, T040, T042–T043 |
| FR-025 | T004–T005, T033, T035–T036, T038, T041–T043, T058 |
| FR-026 | T002–T006, T008, T016, T019–T024, T029, T033–T036, T043–T045, T048, T053, T055 |
| FR-027 | T031–T032, T042–T043, T046, T049, T051, T054–T056 |
| FR-028 | T001, T007, T031–T032, T042–T043, T046, T049–T057 |

| Success criterion | Buildable/verification tasks |
|---|---|
| SC-001 | T002, T020, T028, T031–T032, T054, T056 |
| SC-002 | T004, T022, T025, T031–T032, T056 |
| SC-003 | T002, T005, T008, T014, T018, T020, T022, T026, T031–T032, T053, T056 |
| SC-004 | T033–T043, T056–T057 |
| SC-005 | T002, T006, T018–T019, T024, T035, T053, T059 |
| SC-006 | T033, T035–T036, T038, T041–T043, T056–T057 |
| SC-007 | T044–T050, T053, T056–T057 |
| SC-008 | T001–T002, T006–T007, T018, T030–T032, T043, T050–T057, T059 |

## Implementation Strategy

### MVP first

1. Complete Setup and the host-specific Foundation work.
2. Wait for Gate B at T018–T019; stop for amendment if direct complete results are unavailable.
3. Complete US1 through T032, with its build tasks waiting for Feature 003 T006.
4. Stop and review the independently packed installation/explicit-invocation slice before adding
   the governed action loop.

### Incremental delivery

1. Foundation: official contract → direct MCP spike → no-proxy decision.
2. US1: final-form artifact → profile add/restart → explicit-only Skill and six tools.
3. US2: Core create/resume/action/recovery → host restart and terminal checkpoint.
4. US3: product-identity removal → retained data/reinstall/Codex-isolation checkpoint.
5. Polish: stable gate → one rebuilt artifact → only final stable native journey → root validation.

### Scope guard

Stop if implementation requires a seventh MCP tool, a Core public schema/state/transition/recovery
change, a result projection proxy, adapter task persistence, target-repository setup, cache deletion,
runtime HTTP/network behavior, public publication, Git mutation, another host framework, or an
unsupported-platform claim. A failed direct result or missing stable Harness requires an explicit
planning/specification decision, not speculative implementation.

## Notes

- `[P]` tasks touch different ready files; same-file follow-ups are intentionally serialized.
- Story checkpoints may prove their story but do not establish the final stable support claim.
- Tests and evidence retain their actual static, simulated, pre-release native, stable native,
  manual, failed, or skipped classification.
- Do not commit, push, open a PR, tag, release, or publish as part of Feature 004 implementation.
- `$speckit-implement` reads checklist state but must not modify reviewer-owned markers.
