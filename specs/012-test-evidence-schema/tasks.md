# Tasks: Precise TEST Evidence Schema Exposure

**Input**: `spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`
**Verification budget**: four targeted commands; no full suite or real Host journey

## Phase 1: Foundational schema regression tests

- [x] T001 [P] [US1] Add nine complete apply-branch and action/payload mismatch schema tests for FR-001, FR-002, FR-007, FR-008 and SC-001 in `internal/mcp/graph_contract_test.go`
- [x] T002 [P] [US2] Add automated/user/static/host_observed JSON Schema matrix tests for FR-003, FR-006, FR-007 and SC-002 in `internal/mcp/phase5d_hardening_test.go`
- [x] T003 [P] [US2] Extend workflow evidence validation tests for completed user checks and invalid non-automated command/full-suite combinations for FR-003–FR-006 and SC-002 in `internal/workflow/verification_budget_test.go`

**Checkpoint**: Tests describe the new schema while current implementation fails the MCP structural assertions.

## Phase 2: User Story 1 - Concrete action-specific apply schema (P1)

**Goal**: Each action kind exposes one complete closed apply object with its concrete payload.

**Independent Test**: Targeted MCP tests inspect nine branches and validate current ordinary/recovery request fixtures.

- [x] T004 [US1] Replace generic payload plus allOf narrowing with nine complete discriminated apply objects for FR-001, FR-002, FR-007, FR-008 and SC-001, SC-004 in `internal/mcp/schemas.go`

## Phase 3: User Story 2 - Exact user evidence mapping (P1)

**Goal**: Schema and workflow enforce identical source-specific budget facts.

**Independent Test**: A user check with command_count 0 passes without consuming automatic budget; nonzero/full-suite user checks fail before mutation.

- [x] T005 [US2] Build four source-specific TEST check schema branches for FR-003, FR-006, FR-007 and SC-002, SC-005 in `internal/mcp/schemas.go`
- [x] T006 [US2] Add application journey coverage for four automatic commands plus one zero-command user check and zero-write invalid variants for FR-004–FR-007, FR-010 and SC-003, SC-005 in `internal/application/phase5d_hardening_test.go`
- [x] T007 [P] [US2] Document completed user evidence versus outstanding manual handoff for FR-004, FR-005, FR-009 in `packages/codex/plugin/skills/dev-flow/references/node-payloads.md` and `packages/deepseek/skills/dev-flow/references/node-payloads.md`
- [x] T008 [P] [US2] Assert both packaged references contain the exact user evidence contract for FR-009 and SC-004 in `packages/codex/tests/package-contract.test.mjs` and `packages/deepseek/tests/package-contract.test.mjs`

## Phase 4: User Story 3 - Feature 010 continuation evidence (P2)

**Goal**: Prove the previously rejected evidence combination is valid without rewriting the cancelled Task.

**Independent Test**: Deterministic application test reaches COMPREHENSION_REVIEW with automatic count four and retained source=user evidence.

- [x] T009 [US3] Add the Feature 010 evidence-shape regression and cancelled-Task non-reuse assertion for FR-010–FR-012 and SC-003, SC-005 in `internal/application/phase5d_hardening_test.go`

## Phase 5: Reconciliation

- [x] T010 Reconcile Feature status, exact validation results, and no-release checkpoint in `specs/012-test-evidence-schema/README.md` and `specs/012-test-evidence-schema/tasks.md`

## Dependencies

```text
T001 ─┐
T002 ─┼─ T004/T005 ─ T006/T009
T003 ─┘             └─ T007/T008 ─ T010
```

T001–T003 are parallel test-authoring tasks. T004 and T005 share `internal/mcp/schemas.go` and run sequentially.
T006 and T009 share one application test file and run sequentially. T007 and T008 are parallel with application tests.

## Verification Commands

- V1: `go test ./internal/mcp -run 'Test.*(Apply|Evidence|Schema)'`
- V2: `go test ./internal/workflow -run 'TestEvaluateVerificationBudget'`
- V3: `go test ./internal/application -run 'Test.*(Manual|UserEvidence)'`
- V4: `node --test packages/codex/tests/package-contract.test.mjs packages/deepseek/tests/package-contract.test.mjs`

## Validation Evidence

- V1 attempt 1 exposed a TEST fixture missing the three required method-evidence items; no product relaxation was made.
- Combined V1+V2 retry passed for `internal/mcp` and `internal/workflow`.
- V3 passed for `internal/application`, including automatic budget 4 plus zero-command user evidence and zero-write invalid input.
- V4 passed 16/16 Codex/DeepSeek package contract tests.
- Full suite, real Host, registry and release validation were not run by design.

## Implementation Strategy

MVP is US1 plus the source-specific schema foundation. US2 closes the actual INVALID_ARGUMENT regression. US3 proves
the preserved Feature 010 evidence shape. Stop after V1–V4 and do not enter release work.
