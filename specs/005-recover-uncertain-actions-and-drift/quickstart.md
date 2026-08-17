# Quickstart: Validate Recovery Hardening

**Status**: Implementation complete through T038; final root validation and Spec Kit gates pending.

## Prerequisites

- Feature 003 is merged into the checked-out `main`.
- Go satisfies the repository minimum version.
- Node.js and pnpm satisfy the root engine ranges for the final Codex contract check.
- The worktree is clean before starting implementation.

Activate the feature explicitly:

```bash
export SPECIFY_FEATURE_DIRECTORY="$PWD/specs/005-recover-uncertain-actions-and-drift"
```

## 1. Record the baseline

Record the Feature 003 merge commit, root version, Core fixture digest, and baseline targeted test
results in `research.md`.

Confirm the public surface before edits:

```bash
go test ./tests/contract -run 'MCP|Fixture|Schema'
```

Expected result: the six-tool Core Contract 0.1 passes and no Feature 005 schema exists.

## 2. Validate lost-result behavior

Run the focused journey and application/MCP cases:

```bash
go test ./internal/application
go test ./internal/store
go test ./internal/mcp
go test ./tests/journeys
go test ./tests/contract
```

Expected outcomes:

- post-commit discarded result: one revision and one event;
- exact probe after reopen: `completed_and_recorded`;
- pre-commit failure: zero writes and `not_started`;
- partial response: no caller success;
- duplicate committed operation: zero additional writes.

## 3. Validate reconciliation

```bash
go test ./internal/recovery
go test ./internal/application
go test ./internal/store
go test ./tests/contract
```

Expected result: all five existing classes are covered, reads are zero-write, and only explicit
recovery apply records/adopts or blocks.

## 4. Validate drift and concurrency

```bash
go test ./internal/repository
go test ./internal/store
go test ./tests/journeys
go test ./tests/contract
```

Expected result: complete binding changes safe-stop, aliases share one claim, repository replacement
does not rebind, and two handles produce at most one commit.

## 5. Validate the Codex caller contract

```bash
node --test packages/codex/tests/skill-contract.test.mjs
```

Expected result: 11 tests pass. Every missing, malformed, cancelled, truncated, or transport-failed
mutation result retains the original apply identity and exact closed payload, uses the existing
seven-member probe with exact payload or JSON `null`, calls `dev_flow_get_task` before any retry,
and calls `dev_flow_get_next_action` only when a current action/outcome is needed. A complete
`ok=false` remains a domain error, and the Skill does not choose a recovery class.

## 6. Final checkpoint

After all targeted checks and documentation are complete:

```bash
node --test packages/codex/tests/skill-contract.test.mjs
go test ./tests/contract
git diff --check
pnpm run validate
```

Run `pnpm run validate` exactly once. Only after it passes, run one `$speckit-analyze`, followed by
one `$speckit-converge`; append only a concrete uncovered acceptance requirement.

## Evidence wording

Use the literal evidence boundary: test-local pre-commit failure, post-commit discarded result,
pre-serialization discard, bounded partial writer, SQLite close/reopen, two-handle deterministic
race, temporary Git fixture mutation, Codex Skill static contract, or root repository validation.
Do not relabel any of them as a real Codex crash, operating-system power loss, real network
interruption, DeepSeek evidence, or release-artifact evidence. No extra real Codex Host Journey or
DeepSeek Harness is part of this quickstart.
