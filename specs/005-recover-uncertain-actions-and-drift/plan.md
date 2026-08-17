# Implementation Plan: Recover Uncertain Actions and Repository Drift

**Branch**: `005-recover-uncertain-actions-and-drift`  
**Spec**: [spec.md](./spec.md)  
**Status**: Implementation complete through T038; final root validation and Spec Kit gates pending.

## Summary

Feature 005 adds deterministic proof around the existing Core recovery contract. The design starts
from the delivered Feature 002 recovery implementation and the merged Feature 003 Codex adapter.
It does not wait for Feature 004, add a public contract, migrate SQLite, or expose fault injection.

The preferred outcome is a test-dominant hardening change. Production code is changed only when a
new bounded test demonstrates an actual invariant violation.

## Technical Context

| Item | Decision |
|---|---|
| Language | Go `>=1.26`; Node.js `>=24` only for the existing Codex contract test |
| Core contract | Existing Core Contract 0.1 and six MCP tools |
| Persistence | Existing SQLite schema; no migration |
| Transport | Existing local STDIO MCP |
| Repository access | Existing read-only Git observer |
| Host dependency | Merged Feature 003 Codex product only |
| Deferred host | Feature 004 DeepSeek; no code or native evidence in this feature |
| Failure model | Test-only discarded result, dependency wrapper, failing writer, and subprocess restart |
| Native host budget | None |
| Full validation budget | One root `pnpm run validate` at final checkpoint |

## Entry Gate

Before the first implementation edit:

1. update local `main`;
2. verify Feature 003 is present and its final acceptance is recorded;
3. record the Feature 003 merge commit and Core fixture digest in `research.md`;
4. confirm `packages/deepseek/` is outside the writable scope;
5. run the baseline targeted recovery, Store, repository, MCP, journey, and Codex tests once.

A baseline failure is investigated before adding new tests. It is not hidden by changing the new
feature requirements.

## User Story 1 Implementation Inventory

The checkpoint is implemented against the following current paths:

```text
tests/contract/mcp_contract_test.go
tests/contract/fixture_contract_test.go
tests/journeys/README.md
tests/journeys/recovery_test_helpers_test.go
tests/journeys/recovery_uncertainty_test.go
internal/application/recovery_test_support_test.go
internal/application/get_task_test.go
internal/application/next_action_test.go
internal/application/apply_action_test.go
internal/mcp/recovery_test_support_test.go
internal/mcp/server_test.go
internal/store/sqlite_test.go
internal/store/concurrency_test.go
```

The writable scope for this checkpoint is limited to:

```text
specs/005-recover-uncertain-actions-and-drift/**
tests/contract/mcp_contract_test.go
tests/contract/fixture_contract_test.go
tests/journeys/README.md
tests/journeys/recovery_test_helpers_test.go
tests/journeys/recovery_uncertainty_test.go
internal/application/*_test.go
internal/recovery/*_test.go
internal/repository/*_test.go
internal/store/*_test.go
internal/mcp/*_test.go
packages/codex/tests/skill-contract.test.mjs
packages/codex/plugin/skills/dev-flow/SKILL.md
```

Production changes are conditional on a newly added deterministic test proving an operation
sequencing or idempotency defect. T016 permits only `internal/application/apply_action.go`,
`internal/application/get_task.go`, and `internal/store/sqlite.go`. `packages/deepseek/` is outside
the writable scope and its baseline diff is empty.

## Delivered Implementation Result — 2026-08-17

T001–T033 passed without changing any Core, Application, Recovery, Repository, Store, or MCP Go
production file. User Story 1 delivered lost-result and duplicate-write proof; User Story 2
delivered five-class, exact-adoption, read-only, stale-source, and blocker proof; User Story 3
delivered binding-component, alias, replacement, race, and restart proof. All helper mechanisms
remain in `_test.go` files.

The new Codex static contract first exposed an ambiguity in the Skill prose. The only Skill change
clarifies the five uncertainty shapes, the eight values retained from one fresh action/apply
dispatch, the exact seven-member existing `operation_probe`, exact payload-or-`null` behavior,
read-before-retry ordering, complete domain-error separation, and obedience to Core-owned recovery
assessment. It adds no retry classifier or public surface. `packages/deepseek/` remains unchanged.

Evidence labels remain literal: test-local pre-commit failure, post-commit discarded result,
pre-serialization discard, bounded partial writer, SQLite close/reopen, two-handle deterministic
race, temporary Git fixture mutation, and Codex Skill static contract. The root repository
validation is reported separately after its single authorized run. No real host crash, DeepSeek
Harness, Feature 006, or release work is part of the result.

## Constitution Check

| Principle | Result | Design response |
|---|---|---|
| Single workflow authority | PASS | Only Core is exercised; no adapter state or retry classifier is added. |
| One bounded surface | PASS | Six tools, existing states, and five recovery classes remain unchanged. |
| Thin host adapters | PASS | Codex only retains probe/read-before-retry guidance. |
| Recovery before retry | PASS | Every uncertain mutation scenario performs authoritative read-back. |
| Read-only repository | PASS | Core never executes a Git mutation. |
| Evidence-bounded testing | PASS | Named deterministic boundaries replace an exhaustive crash matrix. |
| Proven simplicity | PASS | No production failure framework or new abstraction is introduced. |
| Vertical slice | PASS | The feature proves one recovery-hardening capability. |
| Two-host parity | PASS | No public semantic change occurs; Feature 004 is therefore not required. |

If implementation needs a public contract or schema change, the Constitution Check becomes FAIL and
work stops for an explicit amendment.

## Design Decisions

### 1. Simulate failure outside production behavior

Use the least invasive mechanism for each boundary:

- **pre-commit**: a test-local Store/dependency wrapper returns the intended error before the
  transaction can commit;
- **post-commit lost result**: call the real application mutation, deliberately discard the returned
  result, close all objects, and reopen;
- **pre-serialization**: invoke the application mutation successfully and stop before MCP result
  encoding;
- **partial response**: a test-local writer accepts a bounded prefix and returns an error;
- **process restart**: use the existing subprocess/self-reexec journey pattern.

No production environment variable, CLI flag, MCP field, build tag, global hook, or persisted
failure plan is permitted.

### 2. Preserve the public contract

The feature may correct internal sequencing or comparison logic, but must not change:

- MCP tool count, names, inputs, or result schemas;
- normal state or recovery-class vocabulary;
- stable public error codes;
- SQLite schema version;
- repository-claim semantics;
- Codex/DeepSeek protocol fixtures.

Contract tests explicitly guard these invariants.

### 3. Reuse existing recovery authority

`internal/recovery/` remains the only classifier/reconciler. Tests may add cases to existing tables,
but a second classifier under application, MCP, or Codex is prohibited.

### 4. Keep evidence local and truthful

The feature produces test results, not a release ledger or native-host report. A failing writer
proves partial local STDIO result handling; it does not prove a particular host's operating-system
crash behavior.

## Project Structure

### Primary implementation/test paths

```text
internal/application/apply_action.go
internal/application/apply_action_test.go
internal/application/get_task.go
internal/application/get_task_test.go
internal/application/next_action.go
internal/application/next_action_test.go
internal/recovery/classify.go
internal/recovery/classify_test.go
internal/recovery/reconcile.go
internal/recovery/reconcile_test.go
internal/repository/fingerprint.go
internal/repository/git_observer.go
internal/repository/git_observer_test.go
internal/repository/binding_test.go
internal/store/sqlite.go
internal/store/sqlite_test.go
internal/store/concurrency_test.go
internal/store/restart_test.go
internal/mcp/server.go
internal/mcp/server_test.go
tests/journeys/core_restart_test.go
tests/journeys/recovery_uncertainty_test.go
packages/codex/plugin/skills/dev-flow/SKILL.md
packages/codex/tests/skill-contract.test.mjs
tests/contract/mcp_contract_test.go
tests/contract/fixture_contract_test.go
```

New test-support code, if needed, stays in `_test.go` files. Production packages do not gain a
generic failure-injection interface.

### Documentation paths

```text
specs/005-recover-uncertain-actions-and-drift/**
docs/PRODUCT.md
docs/ARCHITECTURE.md
```

Update product or architecture documentation only when delivered behavior requires it; do not
rewrite unrelated host or release documentation from the implementation branch.

## Implementation Phases

### Phase 1 — Baseline and contract guard

Record the exact merged baseline, map current tests to every existing recovery class, and add
contract assertions that forbid an accidental public/schema expansion.

### Phase 2 — Lost-result proof

Add the real SQLite/restart journey, pre-commit dependency failure, partial writer, exact-probe, and
duplicate-write assertions. Correct only demonstrated sequencing or idempotency gaps.

### Phase 3 — Reconciliation proof

Complete exact-evidence, partial, conflicting, insufficient-evidence, stale-source, and exact
blocker-resolution cases through existing APIs.

### Phase 4 — Drift and concurrency proof

Exercise each complete binding component, canonical path aliases, repository replacement, and
two-handle apply races.

### Phase 5 — Codex contract and final validation

Confirm the Codex Skill preserves the original operation identity, rereads after every uncertain
result shape, and never chooses a recovery class itself. Reconcile docs, run targeted checks, then
run the root validator once.

## Verification Strategy

### Targeted Go checks

```bash
go test ./internal/recovery
go test ./internal/application
go test ./internal/repository
go test ./internal/store
go test ./internal/mcp
go test ./tests/journeys
go test ./tests/contract
```

Run only the package affected by the current task. Do not run the full list after each edit.

### Targeted Codex check

```bash
node --test packages/codex/tests/skill-contract.test.mjs
```

### Final checkpoint

```bash
node --test packages/codex/tests/skill-contract.test.mjs
go test ./tests/contract
git diff --check
pnpm run validate
```

No Go file changed during T034–T037, so no `gofmt` target exists. The root validator runs once after
targeted checks and documentation are complete. After it passes, run one final `$speckit-analyze`
and one final `$speckit-converge`.

## Complexity Tracking

No Constitution exception is approved. The following proposals require stopping rather than
implementation:

| Proposal | Reason it is rejected |
|---|---|
| Public fault-injection switch | Creates production behavior solely for tests. |
| Seventh MCP recovery tool | Existing apply/read tools already express the contract. |
| New recovery state/class | Duplicates or expands the frozen workflow. |
| Event replay runtime | Snapshot and `LastOperation` remain the authority. |
| DeepSeek parity implementation | Feature 004 is explicitly deferred. |
| Exhaustive crash/fuzz matrix | Exceeds the bounded evidence budget. |

## Delivery Gate

Feature 005 is complete when:

1. all three user-story checkpoints pass independently;
2. public contract/schema guard tests pass;
3. `packages/deepseek/` is unchanged;
4. no production failure switch exists;
5. the final root validation passes once;
6. `$speckit-converge` finds no acceptance gap;
7. documentation states exactly which boundaries were deterministic simulations.
