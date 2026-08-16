# Tasks: Codex Explicit Dev Flow

**Input**: [spec.md](./spec.md), [plan.md](./plan.md), [data-model.md](./data-model.md),
[research.md](./research.md), and contracts in `contracts/`.

**Current checkpoint**: merge preparation after simplification, four-HIGH closure, and two passing
isolated development-smoke runs. Feature 003 remains NO-GO until T078 passes.

## Completed Product Baseline

- [X] **T001–T014 Foundation** — Package identity, paths, launcher, registration receipt, version
  seam, contract tests, and deterministic fakes. Covers FR-001–FR-008.
- [X] **T015–T030 Install and explicit invocation** — Private packed package, explicit
  setup/readback/removal, exact installed Skill selector, six-tool MCP composition, and isolated
  fake setup. Covers FR-001–FR-014 and SC-001–SC-003.
- [X] **T031–T043 Core governance and resume** — Fake-Core forwarding, create/apply/read-after-
  uncertainty/restart/resume/terminal behavior, Skill authority, and deterministic journey checks.
  Covers FR-015–FR-026 and SC-003–SC-006.
- [X] **T044–T051 Removal retention** — Bounded removal, compatible reinstall, direct Core reopen,
  retained task data, and unchanged-repository checks. Covers FR-007, FR-020, FR-024, and SC-007.
- [X] **T052–T054 Host contract implementation baseline** — Codex 0.147 packaging/selector
  reconciliation and the existing native runner/evidence implementation. The release-grade
  verification parts of this baseline are superseded by this simplification checkpoint; they do
  not establish readiness.

## TEST_SUITE_SIMPLIFICATION_CHECKPOINT

### Documentation and Scope

- [X] **T061** Synchronize `spec.md`, `plan.md`, `tasks.md`, `data-model.md`,
  `research.md`, `quickstart.md`, Feature README, and the two Feature contracts once. Keep the
  ten product validation goals; explicitly defer ledger/provenance/crash/version-matrix scope; and
  preserve HIGH-1 through HIGH-4 until T074–T077 close them. (FR-023, FR-025–FR-028, SC-004–SC-008)
- [X] **T062** Record the temporary KEEP/MERGE/REWRITE/DEFER/DELETE audit in
  `plan.md` and delete only tests/contracts whose sole behavior is explicitly deferred.

### Host Fixtures and Parser

- [X] **T063** Add sanitized Codex 0.147 fixtures
  `tests/contract/testdata/codex-0.147/{success,core-domain-error,transport-error}.jsonl`.
  Retain official item/status/tool/result-presence/text-structured parity/typed-error shapes and
  reject prompt/source/path/environment/token/secret material. (FR-023, FR-026)
- [X] **T064** Rewrite `scripts/validate-codex-journey-evidence.mjs` and
  `packages/codex/tests/journey-evidence.test.mjs` as the three-shape parser layer. Preserve one
  minimum case for each HIGH; T074–T077 later replace the temporary todos with passing regressions.
  (FR-023, FR-026; HIGH-1–4)
- [X] **T065** Extend `tests/contract/fixture_contract_test.go` with fixture presence, shape, and
  sanitization checks; do not add a general fixture framework.

### Repeatable Smoke

- [X] **T066** Rewrite `packages/codex/tests/fixtures/fake-native-tool.mjs` as a thin emitter of
  the three checked-in host fixtures. It MUST NOT synthesize selector or MCP status semantics.
- [X] **T067** Rewrite `scripts/write-codex-journey-evidence.mjs`,
  `scripts/run-codex-real-journey.sh`, and `packages/codex/tests/journey-harness.test.mjs` as a
  repeatable smoke layer with ephemeral output only. Prove two fixture-smoke runs are identical and
  create no ledger, report, artifact, or canonical evidence. Keep the real-host smoke/acceptance
  entry points; the later merge-preparation checkpoint executes development smoke only. (FR-027,
  FR-028)

### Retained Contracts

- [X] **T068** Update `packages/codex/package.json`,
  `packages/codex/tests/package-contract.test.mjs`, and
  `tests/contract/package_manifest_test.go` for parser/native-smoke scripts and remove
  release-report script expectations. Preserve package build/allowlist coverage. (FR-001–FR-008,
  FR-025)
- [X] **T069** Confirm KEEP-layer tests still carry setup/readback, ordinary zero-call, exact
  selector, six-tool handshake, create/apply/restart/resume/DONE, error distinction, and removal
  retention. Do not add duplicate journey assertions. (FR-004–FR-026, SC-001–SC-007)

### Validation and Review

- [X] **T070** Run the allowed targeted Node suite, `go test ./internal/version ./tests/contract`,
  and `git diff --check`; record before/after test file and line counts.
- [X] **T071** Run `pnpm run validate` exactly once after the simplification edits.
- [X] **T072** Run exactly one final `speckit-analyze` and at most one independent read-only review,
  limited to requirement coverage, fixture fidelity, and residual release-level evidence scope.
- [X] **T073** Commit documentation and test simplification separately, push
  `codex/feature-003-simplify-tests`, and report Feature 003 as NO-GO. Do not merge main.

## Deferred Follow-up

- [X] **T074** HIGH-1 diagnostic precedence: one minimal regression proving an MCP-specific
  failure remains the primary diagnostic when later summary checks fail.
- [X] **T075** HIGH-2 Core envelope closure: one minimal malformed/mismatched envelope
  regression.
- [X] **T076** HIGH-3 failed event/recovery binding: one cross-item result/recovery binding regression
  plus tool, request-ID, and duplicate-item negatives.
- [X] **T077** HIGH-4 aggregate/session MCP fact parity: one injected aggregate/session
  mismatch regression.
- [X] **T080** Align `spec.md`, `plan.md`, `tasks.md`, `data-model.md`, `research.md`,
  `quickstart.md`, Feature/package READMEs, Skill guidance, and both Feature contracts with Codex
  0.147 result-and-state isolation for non-exact selectors. (FR-010, FR-010a, FR-010b, FR-028,
  SC-002)
- [X] **T081** Add Codex-specific MCP presentation guidance through
  `packages/codex/bin/dev-flow-codex.mjs`, `cmd/dev-flow/main.go`, and optional
  `internal/mcp.ServerOptions`; override only server instructions and the `dev_flow_open_task`
  description, preserving default Core/DeepSeek behavior and the exact six-tool schemas/order. Add
  focused existing tests. (FR-010a, FR-010b, FR-013–FR-016)
- [X] **T082** Update `scripts/write-codex-journey-evidence.mjs` and existing Codex tests so the
  final acceptance retains complete bare-selector Core rejections, compares task/event/claim and
  target-repository snapshots before/after, rejects every successful task-bearing call or unsafe
  result, and then continues substantive/resume/removal/reopen. Add at most two regressions.
  (FR-010a, FR-023, FR-028, SC-002, SC-004, SC-007)
- [X] **T083** Replace the substantive bare-selector acceptance request with one non-mutating probe,
  align only the directly affected selector-boundary documentation and existing Node assertions,
  and preserve workspace-write plus Core/repository snapshot enforcement. (FR-010a, FR-010b,
  FR-017, FR-028, SC-002)
- [X] **T084** Repair the real acceptance session boundary observed on reviewed commit `b7ca18e` in
  `scripts/write-codex-journey-evidence.mjs` and
  `packages/codex/tests/journey-harness.test.mjs`: stop substantive immediately after the first
  successful Core mutation following the requested repository change while the task is
  nonterminal, then let one fresh resume session continue that same task to `DONE`. Reuse the
  existing bounded process stop; do not run a real Host during this repair checkpoint. (FR-028,
  SC-004)
- [ ] **T078** Run the final real Codex acceptance journey after T074–T077 close and
  after T080–T084 close, immediately before merge approval. Ordinary must remain zero-call; the
  non-mutating bare-selector probe must retain real call facts while proving unchanged
  task/event/claim and target-repository state before substantive/restart/resume/DONE/removal/reopen.
- [ ] **T079 [EXTERNAL / DEFERRED]** Design release-grade provenance, immutable attempt state,
  digest chaining, crash transactions, and publication evidence in a dedicated release/supply-chain
  feature.

## Merge Preparation

- [X] Two fresh isolated Codex 0.147 development-smoke runs passed on 2026-08-16 with distinct task
  identities, seven committed actions, Core `DONE`, successful removal, and retained-task reopen.
- [X] Run the final targeted/root validation and final analyze/review against the current diff.
- [ ] Commit and push `codex/feature-003-repeatable-development-smoke` with a clean worktree.
- [ ] Complete T078 exactly once against that reviewed commit.

## Dependencies

- T061–T062 precede deletion or rewriting.
- T063 precedes T064–T067.
- T064–T069 precede T070.
- T071 runs once after T070 passes.
- T072 runs once after T071.
- T073 follows T072.
- T074–T077 and the repeatable development smoke are complete.
- T080–T084 and final validation on a clean reviewed commit precede T078.
- T079 belongs to a separate release/supply-chain feature and is not a Feature 003 merge gate.

## Requirements Coverage

| Requirement | Carrying tasks |
|---|---|
| FR-001–FR-008 package/lifecycle | T001–T030, T068–T070 |
| FR-009–FR-014 explicit Skill/six tools and negative state isolation | T015–T030, T063–T070, T080–T083 |
| FR-015–FR-024 Core authority/loop/errors | T031–T051, T063–T070 |
| FR-025 package contracts | T001–T030, T068–T070 |
| FR-026 deterministic Core loop/parser | T031–T043, T063–T070 |
| FR-027 repeatable development smoke | T061, T066–T072 |
| FR-028 final acceptance gate | T061, T067, T078, T080–T084 |
| SC-001 | T015–T030, T068–T070 |
| SC-002 | T015–T030, T063–T070, T080–T083 |
| SC-003 | T031–T043, T069–T070 |
| SC-004–SC-005 | T031–T043, T067, T078 |
| SC-006 | T025, T031–T043, T069–T070 |
| SC-007 | T044–T051, T069–T070 |
| SC-008 | T061–T072, T078 |

## Scope Guard

The historical simplification checkpoint did not authorize product changes or native attempt #4.
Later explicit user authorization covered the bounded four-HIGH and repeatable-smoke repairs now in
the Feature 003 branch. Protocol, DeepSeek, root-validator, permanent ledger, canonical evidence,
release publication, and `main` remain outside the current merge-preparation scope.
