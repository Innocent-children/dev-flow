# Implementation Plan: Close the Open-Task Contract

**Branch**: `007-close-open-task-contract` | **Date**: 2026-08-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/007-close-open-task-contract/spec.md`

## Summary

Preserve the existing Core acceptance rules while making the `dev_flow_open_task.new_task` shape directly visible to host schema consumers. Add one inline closed object whose nested verification budget is also inline, retain the shared `$defs` compatibility copies so unrelated tool schemas remain byte-stable, add exact Codex Skill guidance and a valid example, and add regressions for the two observed malformed requests plus shared contract parity. Complete the same feature by aligning current product identity to `0.3.0` while preserving Feature 006's frozen `v0.1.0` release history. No workflow, persistence, recovery, tool-count, or remote publication behavior changes.

## Technical Context

**Language/Version**: Go 1.26 or newer for Core; Markdown for packaged Skill guidance

**Primary Dependencies**: Go standard library, MCP Go SDK already used by the repository

**Storage**: Existing SQLite task store; no schema or stored-data change

**Testing**: Package-local Go tests and existing Go contract tests

**Target Platform**: Local STDIO MCP on every currently supported host

**Project Type**: Go Core with thin host packages

**Performance Goals**: Tool catalog generation and validation remain bounded to the existing six schemas

**Constraints**: Preserve Core Contract `0.1`, six tools, accepted values, closed error envelope, and zero mutation for rejected input

**Scale/Scope**: One open-task schema, one packaged Codex Skill, shared host contract fixtures, and focused tests

## Constitution Check

| Principle | Result | Design response |
|---|---|---|
| I. Self-Contained Product Scope | PASS | FR-001–FR-012 and the two observed failures bound the work. |
| II. Single Workflow Authority | PASS | Core remains the contract authority; the Skill only mirrors invocation guidance. |
| III. One State Machine, Bounded Surface | PASS | No state or tool is added. |
| IV. Thin Host Adapters | PASS | Codex receives types, vocabulary, and an example but no transition logic. |
| V. Recovery Before Retry | PASS | Mutation and recovery behavior are unchanged. |
| VI. Read-Only Repository Boundary | PASS | Runtime Git authority is unchanged. |
| VII. Evidence-Bounded Testing | PASS | Focused schema, decoder, and package guidance checks cover the observed bug. |
| VIII. Proven Simplicity | PASS | Inline one singly-used schema branch; add no interface or dependency. |
| IX. Vertical-Slice Specifications | PASS | The feature independently fixes task-admission contract discoverability. |
| X. Two-Host Contract Parity | PASS | Shared Core fixtures assert one schema for both supported host enum values. |

The Constitution 1.2.0 version-alignment amendment also passes: Feature 007 owns the current
`0.3.0` increment, all current package/plugin authorities align, and historical frozen identities
remain immutable.

Post-design re-check: PASS. The design changes schema presentation without changing accepted values or shared task semantics.

## Project Structure

### Documentation (this feature)

```text
specs/007-close-open-task-contract/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── open-task-input.md
└── tasks.md
```

### Source Code (repository root)

```text
internal/mcp/
├── schemas.go
└── tools_test.go

tests/contract/
├── mcp_contract_test.go
└── fixture_contract_test.go

packages/codex/
├── plugin/skills/dev-flow/SKILL.md
└── tests/package-contract.test.mjs

VERSION
package.json
packages/codex/package.json
packages/codex/plugin/.codex-plugin/plugin.json
packages/deepseek/package.json
packages/codex/tests/release-package.test.mjs
tests/contract/package_manifest_test.go
tests/contract/release_contract_test.go
```

**Structure Decision**: Keep the change in the existing Core MCP schema and Codex package surfaces. Core owns the canonical schema; package guidance and tests consume that contract without adding an adapter-owned validator.

## Design Decisions

### Inline the singly-used admission branch

The raw Core schema already defines correct types under `$defs`, but the observed Codex tool projection rendered `new_task` as `unknown`. `newTask` and `verificationBudget` are consumed only by `dev_flow_open_task`, so their closed definitions will also be placed directly beneath `properties.new_task`. The existing `$defs` copies remain because the repository publishes the same definition bundle with every tool and their removal would change unrelated public schema identities. Contract tests require the inline and compatibility copies to be structurally equal, avoiding a second semantic authority without adding a schema resolver or host-specific validator.

### Keep decoder and error behavior unchanged

`decodeNewTaskInput` already rejects both malformed requests. Tests will prove the existing decoder behavior and lack of repository observation/mutation; production decoder code does not need modification.

### Mirror only invocation facts in the Skill

The Codex Skill will name array-valued fields, accepted verification levels, and one valid JSON example. Core continues to decide compatibility, task creation/resume, and failures.

### Align current identity without rewriting frozen history

Feature 007 advances root `VERSION` and all current package/plugin manifests to `0.3.0`. Tests of
current build output read that authority instead of embedding Feature 006's version. Release
fixtures and publication scenarios that model the frozen `v0.1.0` route remain literal and are
validated internally rather than compared to the current root version.

## Verification Strategy

1. Focused Core schema/decoder tests for inline closed types, valid `targeted`, invalid `focused`, and string-valued lists.
2. Shared MCP contract tests for exact enum/type/closed-object parity and unchanged six-tool catalog.
3. Codex package contract test proving packaged Skill guidance contains the exact types, vocabulary, and example.
4. `git diff --check` for the bounded change.
5. Current-version manifest/build checks plus historical Feature 006 fixture checks.

## Final Publication Phase

After implementation is committed and pushed to clean `main`, prepare `0.3.0` once under
`/Users/innocent-children/dev-flow-releases/v0.3.0`. The release output-name API derives the five
names from the approved version. Run the existing explicit publisher with `--confirm v0.3.0`; it
owns exact Tag/Draft handling, publish-once npm, registry read-back, real Codex journey, final
manifest/checksums, four GitHub asset read-backs, Release finalization, and the durable publication
record. Stop on any conflict or uncertain mutation under the existing recovery rules.

## Complexity Tracking

No Constitution violations or complexity exceptions.
