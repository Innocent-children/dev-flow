# Tasks: Repository Binding Authorized Mutations

**Input**: Design documents from `specs/011-repository-binding-mutations/`
**Tests**: Required deterministic regression coverage; only the targeted budget below is authorized.

## Phase 1: Contract Foundation

**Goal**: Make the mutation envelope explicit and closed before changing apply behavior.

- [X] T001 [P] [US1] Add failing closed-payload tests for required `changed_paths`/`no_file_changes` on REQUIREMENTS, DESIGN, TASKS, TEST, COMPREHENSION_REVIEW and DELIVERY in `internal/workflow/payloads_test.go` and `internal/workflow/phase5d_hardening_test.go` (FR-003, FR-005, FR-016; `contracts/apply-payloads.md`).
- [X] T002 [P] [US1] Add failing MCP/schema fixture assertions for the six node-result mutation envelopes in `internal/mcp/graph_contract_test.go`, `internal/mcp/phase5d_hardening_test.go`, `internal/mcp/request_binding_test.go`, `internal/mcp/recovery_graph_test.go`, `internal/workflow/operation_test.go`, `internal/workflow/standard_process_test.go`, `tests/contract/graph_contract_test.go`, `tests/journeys/process_graph_iteration_test.go`, `protocol/fixtures/graph-host-parity-codex.json`, and `protocol/fixtures/graph-host-parity-deepseek.json` (FR-003, FR-015, FR-016; `contracts/apply-payloads.md`).
- [X] T003 [US1] Implement the closed mutation-envelope members and XOR/path validation in `internal/workflow/payloads.go` and `internal/mcp/schemas.go` (FR-003, FR-008; SC-001; `contracts/apply-payloads.md`).

**Checkpoint**: Closed payload and MCP schema agree; no apply behavior changed before T003.

## Phase 2: User Story 1 - Complete Authorized Repository Writes (P1)

**Independent Test**: Real temporary Git issuance → edit → apply succeeds for REQUIREMENTS and fake-observer contract tests cover every writable node.

- [X] T004 [US1] Add deterministic issuance→edit→apply coverage for REQUIREMENTS, DESIGN, TASKS, IMPLEMENT and REFACTOR, including exact artifact/effect separation, in `internal/application/repository_binding_mutation_test.go` (FR-004, FR-005, FR-010, FR-016; SC-001).
- [X] T005 [US1] Derive every process-node repository effect from node-result mutation facts and stop deriving paths from artifact references in `internal/recovery/reconcile.go` and `internal/recovery/reconcile_test.go` (FR-003, FR-005, FR-012; `contracts/repository-binding.md`, `contracts/recovery.md`).
- [X] T006 [US1] Rebind successful process-artifact Actions to fresh repository observations and enforce no-change/exact semantics in `internal/application/apply_action.go` and `internal/application/apply_action_results.go` (FR-006, FR-010, FR-013; SC-001, SC-003).

**Checkpoint**: All writable nodes can complete their own declared effects with the original Action.

## Phase 3: User Story 2 - Reject True Drift and Stale Authority (P1)

**Independent Test**: Each forbidden fact, stale identity and undeclared path returns its stable error with zero Store writes.

- [X] T007 [US2] Add zero-write tests for read-only/no-change violations, undeclared paths, root/identity/branch/HEAD drift, stale revision/Action/process/binding and exact error precedence in `internal/application/repository_binding_mutation_test.go` (FR-006–FR-009, FR-016; SC-002).
- [X] T008 [US2] Enforce current Action allowed effects and deterministic error precedence before repository-effect adoption in `internal/application/apply_action.go` and `internal/recovery/reconcile.go` (FR-006–FR-009; `contracts/apply-payloads.md`).
- [X] T009 [US2] Add ordinary/recovery zero-write and unchanged public-error assertions in `internal/application/stabilization_test.go`, `internal/application/recovery_graph_test.go`, and `internal/recovery/reconcile_test.go`; keep `internal/mcp/results.go` error identities unchanged (FR-009, FR-012; SC-002).

**Checkpoint**: Legal worktree effects and true drift are separated without weakening stale-authority guards.

## Phase 4: User Story 3 - Dirty Baseline, Multi-repository and Restart (P2)

**Independent Test**: Dirty baseline plus authorized delta succeeds; two-repository restart succeeds atomically; one forbidden component stops all writes.

- [X] T010 [US3] Add dirty-baseline modified/untracked-file and restart/resume tests using temporary real Git and temporary SQLite in `internal/application/repository_binding_mutation_test.go` (FR-004, FR-013, FR-014, FR-016; SC-003).
- [X] T011 [US3] Add multi-repository authorized scoped-path success and per-component branch/HEAD/identity drift zero-write tests in `internal/application/repository_binding_mutation_test.go` and `internal/recovery/reconcile_test.go` (FR-002, FR-011, FR-012, FR-016; SC-004).
- [X] T012 [US3] Route multi-repository and resumed Actions through the same mutation-envelope proof in `internal/recovery/reconcile.go` and `internal/application/apply_action.go`, with no SQLite schema or claim changes (FR-011–FR-015; SC-003, SC-004).

**Checkpoint**: Single- and multi-repository semantics survive restart without Task recreation.

## Phase 5: Documentation, Validation and Convergence

- [X] T013 [P] Synchronize the apply mutation-envelope behavior in `README.md`, `README_en.md`, `README_zh-TW.md`, `README_ja.md`, `README_ko.md`, `README_es.md`, `README_fr.md`, `README_de.md`, and `README_pt-BR.md` (FR-003–FR-007, FR-015).
- [X] T014 [P] Synchronize technical and Host documentation in `docs/PRODUCT.md`, `docs/PRODUCT_en.md`, `docs/ARCHITECTURE.md`, `docs/ARCHITECTURE_en.md`, `docs/COMMANDS.md`, `docs/COMMANDS_en.md`, `docs/CODEX_en.md`, `docs/DEEPSEEK_en.md`, `packages/codex/README.md`, `packages/deepseek/README.md`, `packages/codex/plugin/skills/dev-flow/references/node-payloads.md`, and `packages/deepseek/skills/dev-flow/references/node-payloads.md`; update direct assertions/fixtures in `packages/codex/tests/skill-contract.test.mjs`, `packages/deepseek/tests/skill-contract.test.mjs`, `packages/codex/tests/fake-core-contract.test.mjs`, `packages/codex/tests/journey-harness.test.mjs`, `packages/codex/tests/fixtures/graph-method-profiles.json`, `tests/contract/testdata/final-local-payloads.json`, and the payload construction text only in `scripts/write-codex-journey-evidence.mjs` (FR-003–FR-007, FR-015).
- [X] T015 Run only the eight targeted commands from `specs/011-repository-binding-mutations/plan.md` and record command/result/consumed count in `specs/011-repository-binding-mutations/tasks.md`; diagnose failures before any bounded retry (FR-017; SC-005).
- [X] T016 Reconcile `specs/011-repository-binding-mutations/README.md`, `spec.md`, `plan.md`, `research.md`, `data-model.md`, `quickstart.md`, `contracts/`, `checklists/requirements.md`, and `tasks.md`, then run `$speckit-converge` and stop at the completed targeted-validation checkpoint (FR-016, FR-017; SC-001–SC-005).

## Dependencies

- T001 and T002 precede T003.
- T003 precedes T004–T012.
- T004 precedes T005–T006; T007 precedes T008–T009; T010–T011 precede T012.
- T013 and T014 may run after production contract shape stabilizes.
- T015 follows T001–T014; T016 follows T015.

## Verification Budget

| # | Command | Requirement | Status |
| --- | --- | --- | --- |
| 1 | `go test ./internal/workflow -run 'Payload\|StandardProcess' -count=1` | FR-003, FR-015, FR-016 | Passed after one assertion-fixture retry |
| 2 | `go test ./internal/repository -run 'Binding\|Fingerprint\|GitObserver' -count=1` | FR-001, FR-016 | Passed |
| 3 | `go test ./internal/recovery -run 'Repository\|Recovery\|Reconcile' -count=1` | FR-004–FR-012, FR-016 | Passed |
| 4 | `go test ./internal/application -run 'RepositoryBindingMutation\|ImplementationTransitionsRepositoryEffects\|RefactorTransitionsRepositoryEffects\|ApplyRepositoryDrift' -count=1` | FR-004–FR-016 | Passed after one multi-repository error-identity assertion retry |
| 5 | `go test ./internal/mcp -run 'Schema\|Payload\|Repository\|Recovery' -count=1` | FR-003, FR-008, FR-015, FR-016 | Passed |
| 6 | `go test ./tests/contract -run 'Graph\|Repository\|Schema' -count=1` | FR-015–FR-017 | Passed |
| 7 | `node --test packages/codex/tests/skill-contract.test.mjs` | FR-003, FR-005, FR-015 | Initial whitespace-sensitive assertion failed; passed in combined retry |
| 8 | `node --test packages/deepseek/tests/skill-contract.test.mjs` | FR-003, FR-005, FR-015 | Passed in combined Codex/DeepSeek command |

Maximum automatic commands: 12. Commands 9–10 were consumed by the recorded workflow/application assertion
reruns; command 11 is the narrow post-review application/recovery coverage check; command 12 closed the
unknown-effect allowed-authority guard found during convergence review.
Full suite, Host Journey, registry lifecycle, platform matrix, stress/performance/fuzz and release
commands are forbidden. No commit or push is authorized.

## Validation Log

1. FAIL — workflow command: DESIGN test fixture lacked the newly required mutation members.
2. PASS — same workflow command after adding exact no-change members.
3. PASS — repository binding/fingerprint/Git observer command.
4. PASS — recovery comparison/effect/reconcile command.
5. FAIL — application command: multi-repository test compared a detailed `REPOSITORY_DRIFT` by pointer instead of error code.
6. PASS — same application command after using `errors.Is`; production error text remained unchanged.
7. PASS — MCP schema/payload/repository/recovery command.
8. PASS — contract graph/repository/schema command.
9. FAIL — Codex skill-contract command: one documentation regex required same-line `do not`.
10. PASS — combined `node --test packages/codex/tests/skill-contract.test.mjs packages/deepseek/tests/skill-contract.test.mjs` after whitespace-tolerant assertion repair; both Host mirrors passed.
11. PASS — `go test ./internal/application ./internal/recovery -run 'RepositoryBindingMutation|RepositoryEffectRequiresCurrentActionWriteAuthority|MultiRepositoryRecoveryAggregatesPartialAndConflictingFacts' -count=1` covered the post-review DESIGN/TASKS, read-only effect, and multi-repository identity additions.
12. PASS — `go test ./internal/recovery -run 'RepositoryEffectRequiresCurrentActionWriteAuthority' -count=1` closed the convergence finding that an unknown internal effect kind must never reuse process-artifact authority.

Budget consumed: **12/12** automatic validation commands. No retry capacity remains.
