# Implementation Plan: Precise TEST Evidence Schema Exposure

## Summary

重构 `internal/mcp/schemas.go` 中 `dev_flow_apply_action` 的 JSON Schema组合方式，使每个 action kind
成为一个完整、closed、top-level discriminated object分支，并将 TEST check按 evidence source拆为
source-specific分支。Wire JSON、workflow validator、工具 catalog、Task/Action和持久化保持不变。

## Technical Context

- Language: Go 1.25 Core/MCP, packaged Markdown Host adapter references.
- Current authority: `internal/workflow/verification_budget.go` 已执行精确 source规则。
- Current MCP shape: generic payload `oneOf` + apply object `allOf` action branches.
- Target MCP shape: top-level `oneOf` of nine complete apply object schemas.
- Persistence disposition: `not-applicable`.
- External dependencies: none.

## Constitution Check

### Before design

- Core remains the only Task, Action, transition, evidence and budget authority.
- This Feature aligns MCP schema with current Core validation; it adds no second semantics.
- Existing wire fields and six-tool catalog remain closed and unchanged.
- Validation is targeted to schema, workflow/application regression and packaged references.
- No release or Git mutation is included.

### After design

- One schema helper for evidence branches and one helper for full apply branches are the smallest direct change.
- No schema version, migration, provider abstraction or compatibility decoder is introduced.
- Invalid combinations are rejected before application/store mutation.
- Both Host references mirror the exact same facts.

## Current Baseline

`graphPayloads` already returns nine concrete payloads, but `buildCatalog` also assigns a generic payload union to the
base apply object and narrows it through `allOf`. The Codex callable projection preserves the action-kind union but
collapses payload to unknown. TEST check schema exposes a broad enum/range while
`validateNormalizedEvidenceInput` requires automated commands `1..20` and all non-automated commands `0` with
`full_suite=false`.

## Selected Design

### A. Source-specific EvidenceInput schema

Add a helper producing four complete check objects:

- automated: source const automated, command_count 1..20, full_suite boolean;
- user: source const user, command_count const 0, full_suite const false;
- static: source const static, command_count const 0, full_suite const false;
- host_observed: source const host_observed, command_count const 0, full_suite const false.

All branches retain the current required fields, status enum, name/summary bounds and additionalProperties=false.

### B. Complete discriminated apply branches

Build shared top-level apply properties once. For every action kind, clone those properties and replace:

- `action_kind` with its const;
- `payload` with nullable concrete payload for that action.

Each branch is a complete closed object with the existing required fields. Each branch retains the current recovery
constraint: recovery_apply may carry identity with nullable payload; ordinary apply has recovery_apply null/omitted
and a concrete payload. The final apply schema is a top-level `oneOf` of these complete branches.

### C. References and regression tests

Update Codex and DeepSeek node-payload references with a second TEST check example for completed developer evidence
using source user, command_count 0 and full_suite false. State explicitly that `manual_handoff_items` contains only
outstanding work. Tests inspect schema structure, validate the source matrix, prove old automated payload compatibility,
and execute the four-automatic-plus-user-check application journey with zero-write invalid cases.

## Exact Change Surface

- `internal/mcp/schemas.go`
- `internal/mcp/graph_contract_test.go`
- `internal/mcp/phase5d_hardening_test.go`
- `internal/workflow/verification_budget_test.go`
- `internal/application/phase5d_hardening_test.go`
- `packages/codex/plugin/skills/dev-flow/references/node-payloads.md`
- `packages/deepseek/skills/dev-flow/references/node-payloads.md`
- `packages/codex/tests/package-contract.test.mjs`
- `packages/deepseek/tests/package-contract.test.mjs`

## Test Budget

1. `go test ./internal/mcp -run 'Test.*(Apply|Evidence|Schema)'`
2. `go test ./internal/workflow -run 'TestEvaluateVerificationBudget'`
3. `go test ./internal/application -run 'Test.*(Manual|UserEvidence)'`
4. `node --test packages/codex/tests/package-contract.test.mjs packages/deepseek/tests/package-contract.test.mjs`

No full repository suite, real Host journey, registry or release validation.

## Risks

- The in-process JSON Schema validator may interpret top-level oneOf differently; contract tests cover all nine kinds.
- Codex callable projection is Host-owned; repository tests can prove the schema shape but cannot prove a running Host's
  generated TypeScript declaration without a separately authorized real Host gate.
- Recovery apply must retain nullable payload behavior; schema tests cover ordinary and recovery branches.

