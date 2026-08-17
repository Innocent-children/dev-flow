# Quickstart: Validate Recovery Hardening

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
go test ./tests/journeys -run 'Uncertain|LostResult|Restart'
go test ./internal/application -run 'Recovery|OperationProbe|Duplicate'
go test ./internal/mcp -run 'Partial|Writer|Uncertain'
```

Expected outcomes:

- post-commit discarded result: one revision and one event;
- exact probe after reopen: `completed_and_recorded`;
- pre-commit failure: zero writes and `not_started`;
- partial response: no caller success;
- duplicate committed operation: zero additional writes.

## 3. Validate reconciliation

```bash
go test ./internal/recovery -run 'NotStarted|Completed|Partial|Conflict|Blocker'
```

Expected result: all five existing classes are covered, reads are zero-write, and only explicit
recovery apply records/adopts or blocks.

## 4. Validate drift and concurrency

```bash
go test ./internal/repository -run 'Binding|Alias|Replace|Tracked|Untracked|Unborn'
go test ./internal/store -run 'Concurrent|Revision|Restart|Claim'
go test ./tests/journeys -run 'Drift|Concurrent'
```

Expected result: complete binding changes safe-stop, aliases share one claim, repository replacement
does not rebind, and two handles produce at most one commit.

## 5. Validate the Codex caller contract

```bash
node --test packages/codex/tests/skill-contract.test.mjs
```

Expected result: every missing, malformed, cancelled, truncated, or transport-failed mutation result
requires authoritative read-back with the retained operation identity. The Skill does not choose a
recovery class.

## 6. Final checkpoint

After all targeted checks and documentation are complete:

```bash
git diff --check
pnpm run validate
```

Run the root validator once. Then run `$speckit-converge`; append only a concrete uncovered
acceptance requirement.

## Evidence wording

Report deterministic results as deterministic Core/Store/MCP/repository evidence. Do not label a
failing writer or subprocess test as a real Codex or DeepSeek crash.
