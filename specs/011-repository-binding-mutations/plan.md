# Implementation Plan: Repository Binding Authorized Mutations

**Branch**: `main` | **Date**: 2026-08-25 | **Spec**: [spec.md](spec.md)

## Summary

Replace the implicit coupling between `artifacts[]` and repository-effect proof with an explicit,
closed `changed_paths`/`no_file_changes` mutation envelope on every standard node result. Keep the
existing binding digest composition, Git observer, Repository Scope, process graph and SQLite Task
shape. Ordinary apply and recovery derive one Core-owned repository effect from the node result and
validate it against baseline plus fresh observation before any Store mutation.

## Technical Context

**Language/Version**: Go 1.25.0 per `go.mod`
**Primary Dependencies**: Go standard library and existing internal packages
**Storage**: Existing SQLite snapshot/event/claim schema; no schema or codec change
**Testing**: Go package tests with temporary real Git repositories and temporary SQLite
**Target Platform**: Existing Core-supported local platforms; no platform expansion
**Project Type**: Go Core plus closed MCP schema projection
**Performance Goals**: No extra Git command or repository scan per apply
**Constraints**: Read-only Git; zero-write rejection; exact path envelope; no full suite or real Host Journey
**Scale/Scope**: One to eight participating repositories and existing bounded path limits

## Constitution Check

### Pre-research gate

- **I Go Core Single Authority**: PASS. Core derives and validates repository effects.
- **II Hosts and Methods Are Adapters**: PASS. Host supplies typed facts, not classification.
- **III Read-only Core**: PASS. Existing Git observer remains read-only.
- **IV Incremental Architecture**: PASS. Extend existing result DTOs and effect derivation; no new state machine.
- **V Optional Indexes**: PASS. Product behavior has no index dependency.
- **VI Acceptance-bound Verification**: PASS. Only named package/contract tests are budgeted.
- **VII Feature/Release Separation**: PASS. No version, Tag, publication or release work.
- **VIII Specification First**: PASS. This complete Product Feature precedes code changes.

### Post-design gate

All gates remain PASS. The design changes no persistence schema, process topology, Host activation or
tool catalog. The public apply payload shape and process-artifact semantics are closed in contracts.

## Baseline and Root Cause

- `internal/repository/fingerprint.go` includes canonical root, Git common directory digest,
  repository identity, branch/detached, HEAD/unborn and worktree fingerprint in `BindingDigest`.
- `internal/recovery/reconcile.go` classifies stable identity with a changed fingerprint as
  `worktree_only_changed`.
- `DeriveRepositoryEffect` reads paths from Implementation/Refactor results but derives every other
  node's paths from `StandardPayload.Artifacts`.
- `matchesDeclaredPaths` accepts only `baseline ChangedPaths ∪ derived paths == fresh ChangedPaths`.
  An allowed process-file edit omitted from artifact evidence is therefore rejected as drift.
- Current application tests mutate a fake binding directly and do not execute a real Git issuance →
  edit → apply journey for REQUIREMENTS/DESIGN/TASKS or restart/resume.

## Design

1. Add required `changed_paths` and `no_file_changes` members to REQUIREMENTS, DESIGN, TASKS, TEST,
   COMPREHENSION_REVIEW and DELIVERY node results. IMPLEMENT and REFACTOR retain existing fields.
2. Validate the same XOR invariant and repository-contract path rules for all eight results.
3. Derive process-artifact effects from node-result facts. `artifacts[]` remains baseline/evidence material.
4. Require exact binding when `no_file_changes=true` or the Action lacks a repository-write effect.
5. For write Actions, accept only stable identity plus path equality for every repository.
6. Rebind every successful write Action to the fresh observation before the next Action is issued.
7. Recovery uses the same derived envelope and comparison; artifact presence is not completion proof.

## Persistence and Existing Tasks

Disposition is `not-applicable`: no SQLite table, snapshot field, claim, codec or schema version changes.
Persisted Actions retain revision, Action identity, process reference and issuance binding. After restart,
Hosts read the live apply schema and submit the current closed node result. No Task recreation is introduced.

## Public Contract and Documentation

- Update `internal/mcp/schemas.go` and directly affected fixtures/tests.
- Synchronize all maintained root README locales, `docs/PRODUCT*`, `docs/ARCHITECTURE*`,
  `docs/COMMANDS*`, `docs/CODEX*`, `docs/DEEPSEEK*`, and both Host package README pairs where the apply
  contract is described.
- Tool names, action kinds, Node IDs, transitions and error identities remain unchanged.

## Source Code

```text
internal/workflow/payloads.go
internal/workflow/payloads_test.go
internal/mcp/schemas.go
internal/mcp/graph_contract_test.go
internal/mcp/phase5d_hardening_test.go
internal/mcp/request_binding_test.go
internal/recovery/reconcile.go
internal/recovery/reconcile_test.go
internal/application/apply_action.go
internal/application/apply_action_results.go
internal/application/repository_binding_mutation_test.go
protocol/fixtures/
README*.md
docs/{PRODUCT,ARCHITECTURE,COMMANDS}*.md
docs/CODEX_en.md
docs/DEEPSEEK_en.md
packages/{codex,deepseek}/README.md
packages/codex/plugin/skills/dev-flow/references/node-payloads.md
packages/codex/tests/skill-contract.test.mjs
packages/deepseek/skills/dev-flow/references/node-payloads.md
packages/deepseek/tests/skill-contract.test.mjs
```

## Test Budget and Checkpoint

Maximum 12 automatic commands. The initial 10-command estimate was corrected after implementation review:
two assertion-only failures consumed the original retry reserve before the already-required DESIGN/TASKS,
read-only-effect and multi-repository identity cases had direct executable coverage.

1. `go test ./internal/workflow -run 'Payload|StandardProcess' -count=1`
2. `go test ./internal/repository -run 'Binding|Fingerprint|GitObserver' -count=1`
3. `go test ./internal/recovery -run 'Repository|Recovery|Reconcile' -count=1`
4. `go test ./internal/application -run 'RepositoryBindingMutation|ImplementationTransitionsRepositoryEffects|RefactorTransitionsRepositoryEffects|ApplyRepositoryDrift' -count=1`
5. `go test ./internal/mcp -run 'Schema|Payload|Repository|Recovery' -count=1`
6. `go test ./tests/contract -run 'Graph|Repository|Schema' -count=1`
7. `node --test packages/codex/tests/skill-contract.test.mjs`
8. `node --test packages/deepseek/tests/skill-contract.test.mjs`

Commands 9–11 cover the two recorded assertion-root-cause reruns and one narrow application/recovery
coverage command. Command 12 closed the convergence review's unknown-effect authority guard. Prohibited:
`go test ./...`, `pnpm run validate`, full validation, real Host Journey, registry lifecycle, platform
matrix, stress/performance/fuzz and release commands. Stop after targeted validation and converge.

## Rejected Complexity

- Per-path persisted content baselines: changes the Task model and adds observation state.
- Host-side cursor or writer attribution: duplicates Core authority and cannot prove same-path authorship.
- Disabling worktree drift: permits undeclared changes.
- Cancelling/recreating Tasks: prevents an Action from completing its own authorized effects.
