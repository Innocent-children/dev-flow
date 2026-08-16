# Tasks: Codex Explicit Dev Flow

**Input**: [spec.md](./spec.md), [plan.md](./plan.md), [data-model.md](./data-model.md),
[research.md](./research.md), and contracts in `contracts/`.

**Current checkpoint**: simplify Feature 003 verification without changing product adapter/Core code,
running a real host, building a final artifact, publishing evidence, or consuming native attempt #4.

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

- [ ] **T061** Synchronize `spec.md`, `plan.md`, `tasks.md`, `data-model.md`,
  `research.md`, `quickstart.md`, Feature README, and the two Feature contracts once. Keep the
  ten product validation goals; explicitly defer ledger/provenance/crash/version-matrix scope; record
  HIGH-1 through HIGH-4 as pending minimal regression cases. (FR-023, FR-025–FR-028, SC-004–SC-008)
- [ ] **T062** Record the temporary KEEP/MERGE/REWRITE/DEFER/DELETE audit in
  `plan.md` and delete only tests/contracts whose sole behavior is explicitly deferred.

### Host Fixtures and Parser

- [ ] **T063** Add sanitized Codex 0.147 fixtures
  `tests/contract/testdata/codex-0.147/{success,core-domain-error,transport-error}.jsonl`.
  Retain official item/status/tool/result-presence/text-structured parity/typed-error shapes and
  reject prompt/source/path/environment/token/secret material. (FR-023, FR-026)
- [ ] **T064** Rewrite `scripts/validate-codex-journey-evidence.mjs` and
  `packages/codex/tests/journey-evidence.test.mjs` as the three-shape parser layer. Add exactly one
  `test.todo` for each pending HIGH without fixing product behavior. (FR-023, FR-026; HIGH-1–4)
- [ ] **T065** Extend `tests/contract/fixture_contract_test.go` with fixture presence, shape, and
  sanitization checks; do not add a general fixture framework.

### Repeatable Smoke

- [ ] **T066** Rewrite `packages/codex/tests/fixtures/fake-native-tool.mjs` as a thin emitter of
  the three checked-in host fixtures. It MUST NOT synthesize selector or MCP status semantics.
- [ ] **T067** Rewrite `scripts/write-codex-journey-evidence.mjs`,
  `scripts/run-codex-real-journey.sh`, and `packages/codex/tests/journey-harness.test.mjs` as a
  repeatable smoke layer with ephemeral output only. Prove two fixture-smoke runs are identical and
  create no ledger, report, artifact, or canonical evidence. Keep real-host smoke/acceptance entry
  points but do not execute them. (FR-027, FR-028)

### Retained Contracts

- [ ] **T068** Update `packages/codex/package.json`,
  `packages/codex/tests/package-contract.test.mjs`, and
  `tests/contract/package_manifest_test.go` for parser/native-smoke scripts and remove
  release-report script expectations. Preserve package build/allowlist coverage. (FR-001–FR-008,
  FR-025)
- [ ] **T069** Confirm KEEP-layer tests still carry setup/readback, ordinary zero-call, exact
  selector, six-tool handshake, create/apply/restart/resume/DONE, error distinction, and removal
  retention. Do not add duplicate journey assertions. (FR-004–FR-026, SC-001–SC-007)

### Validation and Review

- [ ] **T070** Run the allowed targeted Node suite, `go test ./internal/version ./tests/contract`,
  and `git diff --check`; record before/after test file and line counts.
- [ ] **T071** Run `pnpm run validate` exactly once after all edits.
- [ ] **T072** Run exactly one final `speckit-analyze` and at most one independent read-only review,
  limited to requirement coverage, fixture fidelity, and residual release-level evidence scope.
- [ ] **T073** Commit documentation and test simplification separately, push
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
- [ ] **T078 [DEFERRED]** Run the final real Codex acceptance journey after T074–T077 close and
  immediately before merge approval.
- [ ] **T079 [DEFERRED]** Design release-grade provenance, immutable attempt state, digest chaining,
  crash transactions, and publication evidence in a dedicated release/supply-chain feature.

## Dependencies

- T061–T062 precede deletion or rewriting.
- T063 precedes T064–T067.
- T064–T069 precede T070.
- T071 runs once after T070 passes.
- T072 runs once after T071.
- T073 follows T072.
- T074–T077 are complete; T078–T079 remain deferred to their independent checkpoints.

## Requirements Coverage

| Requirement | Carrying tasks |
|---|---|
| FR-001–FR-008 package/lifecycle | T001–T030, T068–T070 |
| FR-009–FR-014 explicit Skill/six tools | T015–T030, T063–T070 |
| FR-015–FR-024 Core authority/loop/errors | T031–T051, T063–T070 |
| FR-025 package contracts | T001–T030, T068–T070 |
| FR-026 deterministic Core loop/parser | T031–T043, T063–T070 |
| FR-027 repeatable development smoke | T061, T066–T072 |
| FR-028 final acceptance gate | T061, T067, T078 |
| SC-001 | T015–T030, T068–T070 |
| SC-002 | T015–T030, T063–T070 |
| SC-003 | T031–T043, T069–T070 |
| SC-004–SC-005 | T031–T043, T067, T078 |
| SC-006 | T025, T031–T043, T069–T070 |
| SC-007 | T044–T051, T069–T070 |
| SC-008 | T061–T072, T078 |

## Scope Guard

This checkpoint MUST NOT modify product adapter/plugin/Core/protocol/DeepSeek/root-validator code,
must not build a final artifact or create reports/evidence, must not touch the external attempt
ledger, and must not start Codex or execute attempt #4.
