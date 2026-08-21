# Tasks: DeepSeek Explicit Graph Host

**Input**: `specs/010-deepseek-explicit-graph-host/`
**Prerequisites**: clarify, requirements checklist, analyze, Ready status
**Release authority**: none

## Execution Rules

- Complete one phase or user-story checkpoint at a time.
- Do not modify Core unless an approved Feature amendment identifies a verified Contract 0.2 defect.
- Do not run the final native journey or repository validation early.
- Do not add a proxy, generic adapter framework, public release step, or extra platform.
- A test passes once; do not repeat it only to gain confidence.
- Mark a task complete only with recorded command/result or reviewed file identity.

## Phase 1 — Freeze Current Authorities

- [x] **T001** Record the actual implementation baseline commit and compare it with the planned baseline. — Files: `README.md`, `spec.md`, `plan.md`, `research.md`; Refs: FR-008, SC-012.
- [x] **T002** Revalidate exact `@deepseek-ai/dsh` version, integrity, and upstream source commit. — Files: `README.md`, `research.md`; Refs: FR-008, SC-012.
- [x] **T003** Run `$speckit-clarify`; resolve every acceptance-impacting question without expanding scope. — Files: `spec.md`, `checklists/requirements.md`; Refs: FR-001–FR-059, SC-001–SC-015.
- [x] **T004** Complete `checklists/requirements.md`. — Files: `checklists/requirements.md`; Refs: FR-001–FR-059, SC-001–SC-015.
- [x] **T005** Run `$speckit-analyze`; resolve CRITICAL/HIGH and acceptance-impacting MEDIUM findings. — Files: `spec.md`, `plan.md`, `tasks.md`; Refs: FR-001–FR-059, SC-001–SC-015.
- [x] **T006** Mark Feature 010 `Ready` and freeze contracts before production changes. — Files: `README.md`, `spec.md`, `contracts/`, `tasks.md`; Refs: FR-001–FR-059, SC-001–SC-015.
- [x] **T007** Add a bounded Feature 004 README note that Feature 010 supersedes implementation planning. — Files: `specs/004-deepseek-explicit-dev-flow/README.md`; Refs: Feature 010 README Workflow Gate.
- [x] **T008** Add Feature 010 to `MANIFEST.md` and update current dependency/support authority docs. — Files: `MANIFEST.md`, `docs/FEATURE-DEPENDENCIES.md`, `docs/SUPPORT-MATRIX.md`; Refs: FR-059, SC-012, SC-015.
- [x] **T009** Correct current README/ROADMAP version and support statements without rewriting historical Features. — Files: `README.md`, `docs/ROADMAP.md`; Refs: FR-005, FR-059, SC-015.
- [x] **T010** Document independent Codex/DeepSeek release authority; make no product version change. — Files: `README.md`, `MANIFEST.md`, `docs/SUPPORT-MATRIX.md`; Refs: FR-005, FR-059, SC-012, SC-015.

**Checkpoint**: current authority and scope are unambiguous.

## Phase 2 — Replace the DeepSeek Placeholder with Package Contracts

- [x] **T011 [US1]** Replace the placeholder package manifest with an ESM, packable, unpublished DSH bundle manifest and synchronize the workspace dependency policy and lockfile. — Files: `packages/deepseek/package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`; Refs: FR-001, FR-002, FR-005, FR-008.
- [x] **T012 [US1]** Add `cordis.patch.yml` with exactly one integration plugin row. — Files: `packages/deepseek/cordis.patch.yml`; Refs: FR-002, FR-003.
- [x] **T013 [US1]** Define the closed package file allowlist and exclude tests/evidence/profile/data files. — Files: `packages/deepseek/package.json`; Refs: FR-006, FR-007.
- [x] **T014 [US1]** Add package-contract tests for identity, engines, DSH bundle declaration, no lifecycle hooks, and no Codex dependency. — Files: `packages/deepseek/tests/package-contract.test.mjs`; Refs: FR-001, FR-002, FR-005–FR-008, FR-050.
- [x] **T015 [US1]** Add bundle-contract tests for the exact single-row patch. — Files: `packages/deepseek/tests/bundle-contract.test.mjs`; Refs: FR-002, FR-003, FR-050.
- [x] **T016 [US1]** Replace the root validator's “DeepSeek must remain unchanged” rule with the new package contract. — Files: `scripts/validate-repository.sh`; Refs: FR-050, SC-001.
- [x] **T017 [US1]** Keep Codex validation unchanged and prove the validator does not weaken Codex gates. — Files: `scripts/validate-repository.sh`, `packages/codex/tests/`; Refs: FR-048, SC-009.
- [x] **T018 [US1]** Add the package lifecycle/support documentation and record the completed Phase 2 checkpoint. — Files: `packages/deepseek/README.md`, `specs/010-deepseek-explicit-graph-host/README.md`; Refs: FR-004, FR-008, FR-039, FR-047–FR-049, FR-059.

**Checkpoint**: the repository permits only the intended DeepSeek product shape.

## Phase 3 — Runtime and Data Foundation

- [x] **T019 [US1]** Add package-root resolution from `import.meta.url`. — Files: `packages/deepseek/lib/paths.mjs`; Refs: FR-040.
- [x] **T020 [US1]** Add exact darwin-arm64 runtime selection and fail-closed unsupported-platform behavior. — Files: `packages/deepseek/lib/runtime.mjs`; Refs: FR-030, FR-039, FR-040.
- [x] **T021 [US1]** Add explicit/default data-directory resolution matching the contract. — Files: `packages/deepseek/lib/paths.mjs`; Refs: FR-041, FR-042.
- [x] **T022 [US1]** Add restrictive default-directory creation and invalid path/symlink/non-directory rejection. — Files: `packages/deepseek/lib/paths.mjs`; Refs: FR-042, FR-043.
- [x] **T023 [US1]** Add package-relative Core preflight for regular file, executable mode, and reported version. — Files: `packages/deepseek/lib/runtime.mjs`; Refs: FR-030, FR-040.
- [x] **T024 [US1]** Add targeted path/runtime tests, including moved package outside the checkout. — Files: `packages/deepseek/tests/paths.test.mjs`; Refs: FR-039–FR-043, FR-050.
- [x] **T025 [US1]** Build one CGo-free darwin-arm64 Core through the existing version-injection seam for tests. — Files: `packages/deepseek/runtime/darwin-arm64/dev-flow`, `scripts/`; Refs: FR-030, FR-039, FR-040.
- [x] **T026 [US1]** Verify the detached packaged Core `version` command and STDIO startup preconditions. — Files: `packages/deepseek/tests/package-contract.test.mjs`; Refs: FR-030, FR-040, FR-050.
- [x] **T027 [US1]** Add parity cases against the externally observable Codex data-path contract without importing Codex at runtime. — Files: `packages/deepseek/tests/paths.test.mjs`, `packages/codex/tests/`; Refs: FR-036, FR-041–FR-043.

**Checkpoint**: package runtime and shared data selection are deterministic and product-local.

## Phase 4 — DSH Skill, MCP Composition, and Execution Guard

- [x] **T028 [US1]** Implement the exact six qualified tool constants and namespace prefix. — Files: `packages/deepseek/lib/tool-names.mjs`; Refs: FR-018, FR-019, FR-027–FR-029.
- [x] **T029 [US1]** Implement current-turn derivation from immutable DSH session events. — Files: `packages/deepseek/lib/authorization.mjs`; Refs: FR-012, FR-013, FR-020, FR-022.
- [x] **T030 [US1]** Implement the exact direct-user selector matcher. — Files: `packages/deepseek/lib/authorization.mjs`; Refs: FR-011–FR-014.
- [x] **T031 [US1]** Register a plain-context monotonic guard over the entire `mcp__dev_flow__` namespace. — Files: `packages/deepseek/lib/authorization.mjs`, `packages/deepseek/lib/index.mjs`; Refs: FR-017, FR-018, FR-025.
- [x] **T032 [US1]** Deny unexpected namespace tools, missing Agent, missing/closed/ambiguous turn, and missing selector with stable classes. — Files: `packages/deepseek/lib/authorization.mjs`; Refs: FR-018–FR-025.
- [x] **T033 [US1]** Cover direct calls and nested Code Mode calls without persisting authorization. — Files: `packages/deepseek/lib/authorization.mjs`; Refs: FR-012–FR-014, FR-023.
- [x] **T034 [US1]** Add the runtime `dev-flow` Skill registration with user-only invocation policy. — Files: `packages/deepseek/lib/index.mjs`, `packages/deepseek/skills/dev-flow/SKILL.md`; Refs: FR-009, FR-010.
- [x] **T035 [US1]** Mount the official MCP-client child plugin with `serverName=dev_flow` and direct packaged-Core command. — Files: `packages/deepseek/lib/index.mjs`; Refs: FR-026–FR-030.
- [x] **T036 [US1]** Configure explicit data env, stable cwd, bounded timeout, startup isolation, and official reconnect. — Files: `packages/deepseek/lib/index.mjs`, `packages/deepseek/lib/paths.mjs`; Refs: FR-041–FR-046.
- [x] **T037 [US1]** Verify exactly six connected public names and fail compatibility on missing/extra names. — Files: `packages/deepseek/lib/tool-names.mjs`, `packages/deepseek/lib/index.mjs`; Refs: FR-019, FR-027–FR-029, SC-001.
- [x] **T038 [US1]** Add authorization tests for ordinary, exact, malformed, prior-turn, injected, nested, missing-context, and unexpected-tool cases. — Files: `packages/deepseek/tests/authorization.test.mjs`; Refs: FR-011–FR-025, FR-051, SC-002–SC-004.
- [x] **T039 [US1]** Prove denial occurs before MCP dispatch and produces zero Core writes. — Files: `packages/deepseek/tests/authorization.test.mjs`; Refs: FR-024, FR-051, SC-002.
- [x] **T040 [US1]** Add fake-Cordis/DSH integration tests for Skill, guard, MCP child config, disposal, and reconnect. — Files: `packages/deepseek/tests/integration-plugin.test.mjs`; Refs: FR-009, FR-010, FR-017–FR-029, FR-044–FR-046.
- [x] **T041 [US1]** Prove unrelated DSH tools and ordinary host behavior remain unaffected. — Files: `packages/deepseek/tests/integration-plugin.test.mjs`; Refs: FR-018, FR-024, SC-002.

**Checkpoint**: `USER_STORY_1_CHECKPOINT_COMPLETE`.

## Phase 5 — Current Graph Skill Projection

- [x] **T042 [US2]** Adapt the current Contract 0.2 Skill to DSH qualified tool names and `/dev-flow`. — Files: `packages/deepseek/skills/dev-flow/SKILL.md`; Refs: FR-009–FR-016, FR-031–FR-036.
- [x] **T043 [US2]** Require server-info as the first authorized Core call and validate current schema/limits/process/tool/method identities. — Files: `packages/deepseek/skills/dev-flow/SKILL.md`; Refs: FR-029, FR-031, FR-032.
- [x] **T044 [US2]** Implement bounded substantive-request and single-canonical-repository admission guidance. — Files: `packages/deepseek/skills/dev-flow/SKILL.md`; Refs: FR-015, FR-016.
- [x] **T045 [US2]** Open new tasks with `host=deepseek` and resume only compatible active tasks. — Files: `packages/deepseek/skills/dev-flow/SKILL.md`; Refs: FR-033, FR-034, SC-005.
- [x] **T046 [US2]** Render current node purpose, conditions, effects, evidence, method steps, payload contract, and legal transitions. — Files: `packages/deepseek/skills/dev-flow/SKILL.md`; Refs: FR-034–FR-036, SC-006.
- [x] **T047 [US2]** Package host-neutral method-profile and node-payload references. — Files: `packages/deepseek/skills/dev-flow/references/method-profiles.md`, `packages/deepseek/skills/dev-flow/references/node-payloads.md`; Refs: FR-036.
- [x] **T048 [US2]** Add parity/marker/schema tests for DeepSeek and current Codex host-neutral references. — Files: `packages/deepseek/tests/skill-contract.test.mjs`, `packages/codex/plugin/skills/dev-flow/references/`; Refs: FR-036, SC-008.
- [x] **T049 [US2]** Encode read-before-retry after uncertain mutation and prohibit reconnect-driven replay. — Files: `packages/deepseek/skills/dev-flow/SKILL.md`; Refs: FR-034, FR-046, SC-007.
- [x] **T050 [US2]** Encode explicit comprehension verdict, refactor/retest, blocker, cancellation, and terminal behavior. — Files: `packages/deepseek/skills/dev-flow/SKILL.md`; Refs: FR-014, FR-034, FR-035, SC-006, SC-008.
- [x] **T051 [US2]** Add Skill contract tests that reject adapter-owned graph/persistence/completion/recovery instructions. — Files: `packages/deepseek/tests/skill-contract.test.mjs`; Refs: FR-034–FR-036, SC-013.
- [x] **T052 [US2]** Add direct MCP result tests for complete success and Core-domain-error/transport distinction. — Files: `packages/deepseek/tests/mcp-result-gate.test.mjs`; Refs: FR-037, FR-052.
- [x] **T053 [US2]** Run the bounded near-spill/spill/Core-envelope/result-retrieval compatibility gate. — Files: `packages/deepseek/tests/mcp-result-gate.test.mjs`; Refs: FR-037, FR-052, SC-011.
- [x] **T054 [US2]** If the direct-result gate fails, stop and prepare an amendment; do not implement a proxy under the current contract. — Files: `spec.md`, `contracts/skill-and-mcp.md`, `plan.md`, `tasks.md`; Refs: FR-038.

**Checkpoint**: current graph guidance is complete and the direct path is proven or explicitly blocked.

## Phase 6 — Deterministic Graph and Lifecycle Journeys

- [x] **T055 [US2]** Add a deterministic DeepSeek journey using the exact six qualified names and real Core envelopes. — Files: `tests/journeys/deepseek/fake-core.mjs`, `tests/journeys/deepseek/simulated-graph-journey.test.mjs`; Refs: FR-053.
- [x] **T056 [US2]** Prove create/apply/restart/resume with the same task/action/revision lineage. — Files: `tests/journeys/deepseek/simulated-graph-journey.test.mjs`; Refs: FR-053, SC-005, SC-006.
- [x] **T057 [US2]** Prove method-profile guidance, test rework, comprehension, refactor/retest, and Core `DONE`. — Files: `tests/journeys/deepseek/simulated-graph-journey.test.mjs`; Refs: FR-053, SC-006, SC-008.
- [x] **T058 [US2]** Prove uncertain mutation performs task read and next-action read before any repeated mutation. — Files: `tests/journeys/deepseek/simulated-graph-journey.test.mjs`; Refs: FR-046, FR-052, FR-053, SC-007.
- [x] **T059 [US2]** Prove ordinary and non-current-turn prompts cannot dispatch Core during the journey. — Files: `tests/journeys/deepseek/simulated-graph-journey.test.mjs`; Refs: FR-011–FR-025, SC-002–SC-004.
- [x] **T060 [US3]** Build one retained source-local unpublished package artifact and record package/Core identities. — Files: `packages/deepseek/`, `tests/journeys/deepseek/evidence/`; Refs: FR-006, FR-008, FR-057.
- [x] **T061 [US3]** Add the exact artifact through official DSH profile lifecycle in isolated state and restart/read back. — Files: `packages/deepseek/tests/lifecycle.test.mjs`, `tests/journeys/deepseek/evidence/`; Refs: FR-004, FR-054, SC-001.
- [x] **T062 [US3]** Remove through official lifecycle, restart, and prove Skill/guard/namespace absence. — Files: `packages/deepseek/tests/lifecycle.test.mjs`, `tests/journeys/deepseek/evidence/`; Refs: FR-004, FR-047, FR-048, FR-054, SC-009.
- [x] **T063 [US3]** Prove shared task data, repository content, and bounded Codex-owned identities are unchanged. — Files: `packages/deepseek/tests/lifecycle.test.mjs`, `tests/journeys/deepseek/evidence/`; Refs: FR-047, FR-048, FR-054, SC-009.
- [x] **T064 [US3]** Reinstall the exact artifact, restart, and reopen the same compatible task without read-only writes. — Files: `packages/deepseek/tests/lifecycle.test.mjs`, `tests/journeys/deepseek/evidence/`; Refs: FR-049, FR-054, SC-010.

**Checkpoint**: `USER_STORY_2_CHECKPOINT_COMPLETE` and `USER_STORY_3_CHECKPOINT_COMPLETE`.

## Phase 7 — Final Native Acceptance and Closure

- [ ] **T065** Record Product Source commit, Acceptance commit, retained Artifact/Core digests, DSH consumer identity, and platform identity. — Files: `tests/journeys/deepseek/evidence/`; Refs: FR-055, FR-057.
- [ ] **T066** Run one successful non-duplicative real DSH macOS arm64 Native Acceptance after repeatable Preflight passes. — Files: `tests/journeys/deepseek/native-runner.mjs`, `tests/journeys/deepseek/evidence/`; Refs: FR-055, SC-014.
- [ ] **T067** Prove ordinary zero dispatch, explicit selector, six tools, one restart/resume recovery, one targeted test, explicit comprehension acceptance, and Core `DONE`; do not repeat deterministic rejection/refactor/retest branches. — Files: `tests/journeys/deepseek/native-runner.mjs`, `tests/journeys/deepseek/evidence/`; Refs: SC-001–SC-008, SC-014.
- [ ] **T068** Prove one official remove/reinstall with the same Artifact, retained data/repository/Codex identities, and read-only terminal reopen; leave repeated removal to lifecycle tests. — Files: `tests/journeys/deepseek/native-runner.mjs`, `tests/journeys/deepseek/evidence/`; Refs: SC-009, SC-010, SC-014.
- [x] **T069** Write minimal sanitized `native-acceptance.json` or `native-acceptance-failed.json` Evidence. — Files: `tests/journeys/deepseek/native-runner.mjs`, `tests/journeys/deepseek/evidence/`; Refs: FR-057, FR-058.
- [ ] **T070** Use the exact acceptance commit's successful CI Validator result as repository-wide evidence. — Files: `.github/workflows/ci.yml`, `tests/journeys/deepseek/evidence/`; Refs: FR-056, SC-014.
- [x] **T071** Run one `$speckit-analyze` consistency check for the Simplification Revision before implementation and resolve blocking findings. — Files: `spec.md`, `plan.md`, `tasks.md`; Refs: FR-001–FR-059, SC-001–SC-015.
- [ ] **T072** Run the Constitution-required final `$speckit-converge`; append tasks only for a real uncovered Feature gap. — Files: `tasks.md`, `tests/journeys/deepseek/evidence/`; Refs: SC-001–SC-015.
- [x] **T073** Update Feature status/checkpoints and current product support matrix to the exact tested combination. — Files: `README.md`, `docs/SUPPORT-MATRIX.md`; Refs: FR-059, SC-012.
- [x] **T074** Verify no npm publication, version bump, Tag, GitHub Release, or public promotion occurred. — Files: `VERSION`, `package.json`, `packages/deepseek/package.json`, `tests/journeys/deepseek/evidence/`; Refs: FR-005, FR-059, SC-015.
- [ ] **T075** Record `FEATURE_010_COMPLETE` only when every success criterion is supported by retained Evidence. — Files: `README.md`, `tasks.md`, `tests/journeys/deepseek/evidence/`; Refs: SC-001–SC-015.

### Current Native Status — 2026-08-21

- The canonical failure Evidence retains Task `task-300fe8988aaa26a8bd521651defd5757` at
  `REFACTOR` revision 7 with passed process cleanup; Git and PR history retain earlier failures.
- The failure exposed duplicated native coverage and a manufactured refactor that contradicted the
  Task's minimal design. Native acceptance now uses only the smallest successful real-host path.
- T065–T068, T070, T072, and T075 remain open. T069, T071, and T073–T074 remain complete.
- Product Source, Product Surface, Skill, retained Artifact, and embedded Core remain unchanged.

## Phase 8 — Acceptance Responsibility Simplification

- [x] **T076** Align the Feature specification, lifecycle/evidence contract, plan, tasks, and active README status so deterministic tests own negative graph/refactor branches, lifecycle tests own exhaustive removal/retention, and native acceptance owns only the real-host happy path. — Files: `specs/010-deepseek-explicit-graph-host/spec.md`, `specs/010-deepseek-explicit-graph-host/contracts/lifecycle-and-evidence.md`, `specs/010-deepseek-explicit-graph-host/plan.md`, `specs/010-deepseek-explicit-graph-host/tasks.md`, `specs/010-deepseek-explicit-graph-host/README.md`; Refs: FR-053–FR-055, SC-014.
- [x] **T077** Run one read-only `$speckit-analyze` pass over the acceptance-responsibility amendment and resolve every CRITICAL/HIGH or acceptance-impacting MEDIUM inconsistency before Runner changes. — Files: `specs/010-deepseek-explicit-graph-host/spec.md`, `specs/010-deepseek-explicit-graph-host/plan.md`, `specs/010-deepseek-explicit-graph-host/tasks.md`; Refs: FR-053–FR-055, SC-014.
- [x] **T078** Simplify the Native Runner to three graph checkpoints, one targeted test, one remove/reinstall, metadata-only credential validation, and no refactor/retest outcome field; run only Runner self-test, Node syntax, `git diff --check`, and Product Surface zero-diff checks. — Files: `tests/journeys/deepseek/native-runner.mjs`; Refs: FR-055–FR-058, SC-014.

## Deferred Release Work

Not tasks in Feature 010:

- select first public DeepSeek version;
- publish npm artifact;
- registry readback/uninstall;
- GitHub Release promotion;
- official URL re-download;
- supply-chain signing/notarization;
- additional platforms;
- broader DSH compatibility claims.
