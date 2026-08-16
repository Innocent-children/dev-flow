---

description: "Dependency-ordered implementation tasks for the local Codex product"

---

# Tasks: Codex Explicit Dev Flow

**Input**: Design documents from `specs/003-codex-explicit-dev-flow/`  
**Prerequisites**: `spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/`,
`quickstart.md`, and reviewer approval of both checklists  
**Tests**: Add each named targeted assertion before its corresponding behavior and demonstrate the
new assertion fails for the missing behavior.

**Native-evidence budget**: Feature 003 permits exactly one passing real Codex host journey. T030,
T043, and T051 are deterministic/fake checkpoints and MUST NOT start Codex. Only T058 may launch the
real host. Each frozen-source/validation/final-artifact chain permits at most one launch; a
failed/blocked attempt consumes and invalidates that chain, and another attempt requires a source
fix plus a new T055–T057 chain. Same-chain and debug reruns are prohibited.

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
  one-passing-journey/one-launch-per-chain rule, and non-publication rules in
  `packages/codex/README.md`
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
- [X] T018 [P] [US1] Add failing Skill contracts for one `dev-flow` resource, an exact current-turn
  explicit-selector guard, zero implicit Dev Flow calls, substantive/resume intent, Git/single-repository
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
- [X] T034 [P] [US2] Add structural-schema and semantic-validator unit cases for canonical pass,
  external failed/blocked diagnostics, version equality, range membership, source/artifact identity, revisions,
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

- [X] T044 [P] [US3] Extend lifecycle tests for matching removal, absence/no-op, interrupted resume,
  receipt/readback conflict, marketplace-root mismatch, adjacent files, exact receipt cleanup, and
  prohibition of package/data/repository/cache deletion in
  `packages/codex/tests/lifecycle.test.mjs` (FR-007).
- [X] T045 [P] [US3] Add packaged-Core retention integration that creates/pauses a task in a
  temporary data root, stops Core, simulates deregistration/uninstall, compares canonical data
  manifests and repository fingerprints, directly reopens the task, and exercises compatible
  reinstall without starting Codex in `packages/codex/tests/removal-retention.test.mjs`
  (FR-007, SC-007).

### Implementation

- [X] T046 [US3] Implement receipt-first/current-state reconciliation, exact plugin removal and
  readback, matching marketplace removal/readback, receipt-only cleanup, adjacent preservation,
  idempotent absence, and fail-closed conflict behavior in
  `packages/codex/lib/lifecycle.mjs` (FR-007).
- [X] T047 [US3] Wire `remove [--json]` with explicit npm-uninstall handoff, stderr diagnostics,
  stable nonzero failure, and no recursive cleanup in
  `packages/codex/bin/dev-flow-codex.mjs` (FR-007).
- [X] T048 [US3] Extend fake-host journey stages with process-stop markers, complete data manifests,
  plugin/marketplace/receipt absence, adjacent-file and repository comparisons, direct Core reopen,
  separate npm uninstall, repeated removal, and compatible reinstall (FR-007, FR-027, FR-028).
- [X] T049 [US3] Document deregistration before npm uninstall, interrupted/conflicting recovery,
  adjacent preservation, task-data reopen, idempotent repeat, and compatible reinstall in
  `packages/codex/README.md` (FR-007).
- [X] T050 [US3] Run lifecycle, packaged-Core retention, package, launcher, and fake-host removal
  checks, resolving only US3 failures (FR-007, FR-025).
- [X] T051 [US3] Execute
  `scripts/run-codex-real-journey.sh --fake-host --through remove`; prove retained data/repository
  safety and compatible reinstall, assert no real Codex process starts, and create no native
  evidence (SC-007).

**Checkpoint**: US3 lifecycle safety is deterministic. No real Codex host has run.

---

## Phase 6: Compatibility, Final Artifact, and the Passing Native Journey

**Purpose**: Revalidate the volatile host contract, finish all deterministic checks, freeze source,
build one artifact per immutable chain, execute at most one native launch per chain until exactly
one attempt passes, and validate evidence without post-validation writes.

- [X] T052 Revalidate the exact latest stable compatible Codex CLI and official plugin, Skill, MCP,
  marketplace, setup/readback, and removal contracts. Select the supported range and exact test
  version; for the 2026-08-15 review these are `>=0.147.0 <0.148.0` and exact `0.147.0`. Update
  together—when needed—the named Feature documents under
  `specs/003-codex-explicit-dev-flow/{README.md,spec.md,plan.md,tasks.md,research.md,data-model.md,quickstart.md}`;
  `specs/003-codex-explicit-dev-flow/contracts/{codex-plugin.md,dev-flow-skill.md,registration-receipt.schema.json,validation-report.schema.json,artifact-report.schema.json,native-attempt-diagnostic.schema.json,native-attempt-ledger.schema.json,journey-evidence.schema.json}`;
  `packages/codex/{README.md,package.json,lib/lifecycle.mjs,plugin/.mcp.json}`;
  `packages/codex/plugin/skills/dev-flow/{SKILL.md,agents/openai.yaml}`;
  `packages/codex/tests/{fixtures/fake-codex.mjs,lifecycle.test.mjs,package-contract.test.mjs,skill-contract.test.mjs}`;
  `scripts/{build-codex-local.sh,run-codex-real-journey.sh,validate-repository.sh}`; and
  `tests/contract/{package_manifest_test.go,repository_layout_test.go}`. The selected contract uses
  `agents/openai.yaml` for explicit-only policy, the MCP shape accepted by both 0.147 parsers, and
  official top-level-object/camelCase lifecycle JSON. This task is serialized and runs before
  final hardening (FR-008, SC-008).
- [X] T053 Reconcile the delivered package commands and the specified T054 final-runner contract,
  fields, paths, range, setup/readback, action loop, removal, data retention, evidence fields, and
  one-passing-journey/one-launch-per-chain procedure across
  `quickstart.md`, `packages/codex/README.md`, contracts, and data model without adding
  publication or unsupported-platform claims (FR-008, FR-027, FR-028).
- [X] T054 Add failing deterministic native-runner/writer contracts for exact final-mode arguments
  (`--artifact-report`, `--validation-report`, `--codex-executable`, and `--attempt-ledger`), frozen
  source/artifact/validation identity, pre-host rejection, official Codex `exec --json` event
  parsing, complete MCP results, distinct session IDs, bounded calls, exclusive atomic evidence
  creation, and no native relabelling. The RED cases MUST cover missing and extra fields in every
  closed report, report/artifact/ledger digest mismatch, same-path and different-path report
  substitution, `validation.completed_at > artifact.built_at`,
  a command completion after `validation.completed_at`,
  `artifact.built_at >= evidence.recorded_at`, duplicate-chain launch, same-source retry with fresh
  report bytes, a pre-existing passing attempt, attempt-number/count drift, crash after the
  create-no-replace evidence publish but before ledger finalize, exit after ledger finalize, valid
  passing-evidence admission lock, pre-evidence crash/no-rerun behavior, switched/empty ledger
  identity, concurrent reservation, canonical-path failure-record rejection, and
  omitted/added/duplicated/reordered targeted commands. The reopened RED set MUST additionally
  cover, before the mapped production edit: (1) concurrent setup returning `alreadyAdded=true`
  without rollback ownership; (2) the bound `validate:evidence` command rejecting each schema
  violation and incomplete pass semantics; (3) complete Core-derived verification budget,
  official completed `command_execution` facts, submitted/retained automated-evidence parity,
  ordered restart `get_task`/`get_next_action` reads before a later mutation, and authoritative
  task `phase=DONE`; (4) ledger semantic rejection before admission and again inside the
  reservation lock; (5) a non-secret retained-data descriptor with no absolute-path leakage;
  (6) four unique thread IDs plus raw revision non-regression before adjacent deduplication;
  (7) failed/blocked output conforming to the independent closed diagnostic schema and never
  claiming the pass-only journey-evidence contract; (8) locked CAS finalization, mutation-window
  rejection, and safe
  live/dead/malformed stale-lock handling; (9) the production default helper chain through
  deterministic fake npm/Codex/Core child processes using official 0.147 JSONL shapes; (10) extra
  marketplace/installed/available entries rejected during setup and reinstall readback; and (11)
  direct Core reopen rejecting non-JSON stdout, unknown/duplicate IDs, and bounded-output breaches.
  After native attempt 1 exposed role-blind command classification, reopen T054 again and establish
  RED before production edits for: (12) an ordinary-session successful ambient command retained as
  non-verification while Dev Flow calls/tasks remain zero; (13) an invalid-session nonzero read-only
  Git probe retained as non-verification while Dev Flow calls/tasks remain zero; (14) a
  substantive/resume non-verification repository command plus exactly one Core-bound proof;
  (15) the exact Codex 0.147 macOS rendered proof separated from its logical proof name; (16)
  unbound or duplicate proof rejection; (17) exact known test/full-suite command/rendering,
  including the repository-wide `pnpm run validate` root gate,
  rejection; (18) the production default fake subprocess chain passing the real candidate validator
  with all role-scoped command facts; and (19) schema-version-2 failed/blocked diagnostics carrying
  a required command/non-command discriminator, typed safe command context only when required, and
  closed phase/reason/detail-digest observations while the immutable consumed-attempt version-1
  diagnostic remains valid and byte-unchanged. RED MUST reject a command-event v2 diagnostic with
  missing context and any raw command/output/path field. The fake Codex MUST no longer return empty ordinary/invalid sessions.
  Classification MUST be session-aware: all official completed command events are safe-hashed and
  retained; only the Core-bound proof subset counts against the verification budget.
  After native attempt 2 exposed the installed Skill-name mismatch and loss of failure-session
  observations, reopen T054 again. Before production edits, add RED for: (20) substantive and resume
  prompts plus plugin user-facing description/default prompt selecting exact
  `$dev-flow-codex:dev-flow`; (21) the default fake deriving full name
  `dev-flow-codex:dev-flow` from plugin `dev-flow-codex` plus Skill base `dev-flow`, with bare
  `$dev-flow`, wrong namespace, wrong base, and missing selector producing zero synthetic Dev Flow
  MCP calls/tasks even when role text otherwise matches; (22) four ordered safe session records
  initialized before spawn and advanced for completed, spawn/capture/process/parse, and missing-stop
  stages; (23) the real default orchestration's exit-0/no-apply failure persisting the then-current version-3
  diagnostic and failure-observed-facts before cleanup; (24) each role's nullable exit/signal, thread
  presence, independently 64-MiB-bounded stdout/stderr byte counts and digests, and exact closed
  event/item/MCP status counts; (25) exact diagnostic/facts observation equality, ledger facts-digest
  binding, count-sum/thread/unstarted semantics, and rejection of raw JSONL, stderr, prompt, command,
  output, environment, secret, thread ID, or path fields; and (26) read-only validation that the
  consumed attempt-1 v1 and attempt-2 v2 diagnostic/facts bytes and hashes remain unchanged while the
  then-current new record requires v3/`external-failure-record-v3`; (27) install/setup/readback or final-preflight
  failure occurring before reservation leaves the ledger unchanged, emits no consumed-attempt
  diagnostic, and starts no session, while the four observations are initialized immediately before
  a successful reservation; (28) structural and semantic rejection of synthetic attempt 3 v1/v2
  downgrade despite otherwise valid legacy shapes, with exact ledger-entry/facts-digest binding;
  (29) malformed empty-ID and duplicate valid `thread.started` events produce unambiguous counts and
  `parse_failed`; and (30) command context is required only when the failure is attributable to the
  completed command event, not merely because an earlier unrelated command occurred. Use the default fake subprocess and actual
  `executeNativeJourney` failure path; a parser-only unit fixture is insufficient.
  After native attempt 3 exposed conflation of official failed MCP terminal items with malformed
  successful results, reopen T054 again. Before production edits, add RED for: (31) Codex 0.147
  `status=failed`, complete text/`structured_content` parity carrying Core `ok=false`, and `error=null` parsing as a
  `tool_error_result` whose Core envelope remains authoritative; (32) a recoverable complete Core
  error continuing only through the existing Core-directed recovery/read-before-retry path, with
  passing evidence and durable facts carrying the same ordered safe failed-apply request
  task/expected-revision/Core-recovery fact and exact digest-bound task/revision-bearing `get_task`,
  `get_next_action`, and next-`apply_action` references against a closed per-session
  `mcp_call_facts` projection;
  (33) `status=failed`, `result=null`, and typed `error` stopping fail-closed as a
  `transport_error`; (34) a malformed or truncated `status=completed` item, a mixed failed shape, or
  a failed item whose complete Core envelope claims `ok=true` remaining a distinct protocol parse
  failure; (35) the default fake subprocess, not only parser fixtures, emitting both
  official failed variants and exercising the production `executeNativeJourney` boundary plus the
  real passing candidate validator's failed-item/recovery ordering, transport exclusion, and
  missing/duplicate/unbound/failed-reference/intervening-mutation/read-count rejection. The
  candidate API and package-bound full validator RED MUST reject a wrong request/reference task ID,
  a failed expected revision outside raw lineage, unequal read revisions, a non-increasing or
  uncommitted apply revision, and a 65th fact while allowing the schema's 64-call bound; (36)
  version-4 `mcp_event` diagnostics/facts carrying exactly role, zero-based event order, one of the
  six tools, failed status, result kind, and mutually exclusive canonical result/error digests with
  no raw arguments/result/error/JSONL/thread/path/environment/secret, with semantic RED for wrong
  role/stage, absent failed/Dev Flow/MCP/item-completed counts, out-of-range event index, wrong
  phase/reason, facts mismatch, and an earlier recovered failed item misattributed to an unrelated
  later failure; and (37) exact immutable
  attempt-1/v1, attempt-2/v2, and attempt-3/v3 bytes remaining valid while synthetic attempt 4+
  v1/v2/v3 downgrades are structurally and semantically rejected. The official result and error
  variants MUST be deterministic recorded data and MUST NOT start Codex.
  T054 may modify only these exact paths:
  `packages/codex/README.md`;
  `packages/codex/package.json`;
  `packages/codex/lib/lifecycle.mjs`;
  `packages/codex/plugin/.codex-plugin/plugin.json`;
  `packages/codex/plugin/skills/dev-flow/SKILL.md`;
  `packages/codex/tests/fixtures/fake-native-tool.mjs`;
  `packages/codex/tests/package-contract.test.mjs`;
  `packages/codex/tests/skill-contract.test.mjs`;
  `packages/codex/tests/journey-harness.test.mjs`;
  `packages/codex/tests/journey-evidence.test.mjs`;
  `packages/codex/tests/lifecycle.test.mjs`;
  `scripts/run-codex-real-journey.sh`;
  `scripts/write-codex-journey-evidence.mjs`;
  `scripts/build-codex-local.sh`;
  `scripts/validate-codex-journey-evidence.mjs`;
  `scripts/validate-repository.sh`;
  `specs/003-codex-explicit-dev-flow/contracts/validation-report.schema.json`;
  `specs/003-codex-explicit-dev-flow/contracts/artifact-report.schema.json`;
  `specs/003-codex-explicit-dev-flow/contracts/native-attempt-diagnostic.schema.json`;
  `specs/003-codex-explicit-dev-flow/contracts/native-attempt-ledger.schema.json`;
  `specs/003-codex-explicit-dev-flow/contracts/journey-evidence.schema.json`;
  `tests/contract/package_manifest_test.go`;
  `tests/contract/repository_layout_test.go`; and
  `tests/contract/fixture_contract_test.go`.
  Create each mapped failure before changing its production path: concurrent setup/readback
  ownership in `lifecycle.test.mjs` before `lifecycle.mjs`; native arguments, permanent
  reservation, launch/event/session behavior, pass-lock admission, and all four crash/recovery
  boundaries plus default fake-subprocess helper coverage in `journey-harness.test.mjs` before the
  runner/fake tool; closed report/diagnostic, Core budget/command/terminal/revision/retention
  projections, durable-facts/exact-byte
  preparation, create-no-replace evidence-first commit, idempotent exact-ledger finalize, and
  lock-owned CAS/stale recovery behavior in `journey-evidence.test.mjs` before the writer or five schemas;
  report/ledger identity, substitution, digest, time, and semantic behavior in
  `journey-evidence.test.mjs` before the semantic validator, including the package-bound full
  validator; final-report output and tarball
  identity in `package-contract.test.mjs` before the builder; package command wiring in
  `package-contract.test.mjs` and `package_manifest_test.go` before `package.json`; zero adapter
  workflow authority in `skill-contract.test.mjs` before any adapter-facing script; and source,
  tarball, copied-fixture, and root allowlists in the three named Go contract tests before the root
  validator. Harden only those mapped gates. T054 MUST use deterministic recorded/fake process data
  and MUST NOT replace the default process boundary with wholly injected helpers;
  T058 remains the only native-host execution
  (FR-014–FR-016, FR-023, FR-025, FR-027–FR-028, SC-002, SC-005, SC-006, SC-008).
- [ ] T055 Run the complete targeted Go/Node/package/fake/retention set and then run root
  `pnpm run validate`. Immediately before this final deterministic chain, query the official
  `@openai/codex` `latest` npm dist-tag again, require it still resolve to `0.147.0` within the
  selected range, and record the writer-observed exact UTC query time; if it changed, return to T052
  and rerun checklist/analyze before continuing. The writer itself performs this query. Fix only
  Feature 003 defects; any source modification discards every prior observation/report and requires
  the entire exact ordered targeted set plus root gate again from the new clean commit. Retain
  every exact command/pass result, completion time, and current source commit in one temporary,
  closed, machine-generated validation report produced by
  `scripts/write-codex-journey-evidence.mjs` for later evidence. Initialize the one durable external
  attempt-ledger path/ID before the first chain, bind it into the report, and reuse that same path/ID
  across every failed/recovery/new chain. Derive the ID from the domain-separated canonical absolute
  ledger path and reject symlinked/switched/empty paths. The exact ordered targeted observations are
  `go test ./internal/version ./tests/contract` and
  `node --test packages/codex/tests/*.test.mjs`, followed separately by exact
  `pnpm run validate`. Retain the report's exact bytes; do not build
  the final artifact or start Codex in this task
  (FR-023, FR-025, FR-026, FR-028).
- [ ] T056 Perform a read-only pre-final audit of the entire allowed Feature 003 scope:
  `internal/version/`, `packages/codex/`, `scripts/build-codex-local.sh`,
  `scripts/run-codex-real-journey.sh`, `scripts/write-codex-journey-evidence.mjs`,
  `scripts/validate-codex-journey-evidence.mjs`, `scripts/validate-repository.sh`, affected `tests/contract/`,
  `tests/journeys/evidence/`, and all `specs/003-codex-explicit-dev-flow/**`. Confirm no Core
  Contract change, Git mutation, publication, future-host abstraction, unsupported claim, or
  unreviewed file. Freeze the source commit after this task (FR-006–FR-008, FR-016–FR-018).
- [ ] T057 From the frozen source commit, build exactly one final private artifact with
  `scripts/build-codex-local.sh`; verify package/plugin/Core version equality, selected Codex range,
  complete allowlist, executable mode, source identity, and artifact SHA-256, and retain its
  unmodified closed machine-generated final-artifact report, including `built_at`, outside the
  repository. Any defect discards the artifact/report and returns to T055
  (FR-001–FR-003, FR-027, FR-028).
- [ ] T058 Execute this immutable chain's sole authorized real Codex host launch using the exact
  T057 artifact and exact selected stable Codex CLI on macOS arm64. Invoke the checked-in native
  runner once with the unmodified T055 validation report, T057 artifact report, exact Codex
  executable, and external attempt ledger. Run
  setup, explicit-only checks, substantive task selected exactly as `$dev-flow-codex:dev-flow`, two
  Core commits, restart/resume selected by that same exact full Skill identity, budgeted `DONE`,
  removal, data reopen, npm uninstall, compatible reinstall, and repository/adjacent comparisons.
  Immediately before host spawn the writer atomically reserves the chain/attempt in the ledger; the
  same chain can never launch again. After host success the writer durably persists the immutable
  observed facts and exact evidence/final-ledger candidates, runs the complete structural/semantic
  validators against those candidates plus unchanged reports/artifact/ledger, publishes only after
  that gate passes to `tests/journeys/evidence/codex-macos-arm64.json` with a create-no-replace atomic operation, and only
  then atomically finalizes the ledger from the exact candidate bytes. The evidence records both
  report digests, artifact `built_at`, actual total attempt count, durable-facts/final-ledger
  digests, commit protocol, T055 root-validation result, frozen source identity, and T057 artifact
  digest. A failed/blocked or pre-evidence interrupted attempt does not establish support; retain
  its reserved/final ledger entry and external failure diagnostic, leave the canonical repository
  evidence path absent, discard that chain's artifact, fix source, and complete an entirely new
  T055–T057 chain with the same ledger before re-entering T058. Every failure after reservation MUST,
  before isolated-host cleanup, persist a version-4 diagnostic and ledger-bound
  failure-observed-facts file with the exact same four ordered safe session projections; attempts
  1/v1, 2/v2, and 3/v3 remain byte-unchanged. An MCP-event failure additionally retains only the
  closed safe MCP context defined by FR-027; no failed record may retain raw JSONL, stderr, prompts,
  commands, outputs, MCP arguments/results/errors, environment values, secrets, thread IDs, or paths
  (FR-027, FR-028, SC-001–SC-005, SC-007–SC-008).
- [ ] T059 Validate the evidence first against
  `contracts/journey-evidence.schema.json` and then with
  `scripts/validate-codex-journey-evidence.mjs`, supplying the unchanged T055 validation report,
  T057 artifact report, and attempt ledger. Verify report/ledger digests and identity plus
  `validation.completed_at <= artifact.built_at < evidence.recorded_at`. These are post-publication
  byte/identity checks because complete structural/semantic candidate validation already passed
  before publication. If valid passing evidence
  exists with a matching reserved ledger after an evidence-publish crash, verify it against the
  durable facts and exact candidates, idempotently install only the precomputed final ledger bytes,
  and validate both files without starting Codex. If the ledger is already `pass`, validate both
  files only. If evidence was never published, never promote the reserved attempt to pass or
  relaunch it; finalize failed/blocked from durable facts or leave it blocked from further launch.
  Do not modify published evidence. A candidate failure before evidence publication consumes that
  attempt as failed/blocked and may return, after a source fix, to a new T055–T057 chain using the
  same ledger. Any post-publication integrity failure is a terminal blocked recovery condition:
  never discard or patch the passing record, switch ledgers, or launch another chain
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
- T058 is the only task authorized to start a real Codex host; one launch maximum per immutable
  source/validation/artifact chain and exactly one passing attempt overall.
- If source changes after T057, discard the artifact and restart at T055.
- If a native attempt or pre-publication candidate validation fails, do not edit its external
  diagnostic or rerun that chain; retain its attempt-ledger entry, fix source, and restart with new
  T055/T056/T057 identities using the same ledger before T058.
- If post-publication T059 byte/identity validation fails, enter terminal blocked recovery: do not
  edit/delete canonical evidence, switch ledgers, rebuild, or launch another chain. Only idempotent
  installation of the already prepared exact final ledger bytes remains permitted.

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
| SC-002 | T018, T022, T027, T030–T032, T054, T058 |
| SC-003 | T031–T040, T043, T058 |
| SC-004 | T031–T040, T043, T058–T059 |
| SC-005 | T032, T035, T039–T043, T054–T055, T058–T059 |
| SC-006 | T015, T033, T054, T056, T060 |
| SC-007 | T044–T051, T058–T059 |
| SC-008 | T003, T052–T060 |

## Scope Guard

Stop and amend the feature before implementation continues if work requires a seventh MCP tool, a
Core public schema/state/transition/recovery change, a Node MCP/result proxy, adapter task
persistence, target-repository setup, direct Codex config/cache editing, public publication,
another platform/host claim, a second launch for the same immutable chain, any native launch outside
T058, or any launch after the unique passing attempt.
