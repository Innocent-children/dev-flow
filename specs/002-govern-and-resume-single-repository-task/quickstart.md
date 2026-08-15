# Quickstart: Govern and Resume a Single-Repository Task

## Activate the feature

Set the pre-authored feature before launching Codex:

```bash
export SPECIFY_FEATURE_DIRECTORY="specs/002-govern-and-resume-single-repository-task"
```

Do not handcraft `.specify/feature.json`; Spec Kit manages it for features created through
`$speckit-specify`.

## Review before implementation

```text
$speckit-clarify
$speckit-checklist
$speckit-analyze
```

Do not start implementation while a Constitution or contract inconsistency remains.

## Implement by slices

Recommended order:

1. Setup and domain types;
2. Workflow transitions;
3. SQLite Store and repository claim;
4. Read-only Git observer;
5. Application service;
6. MCP adapter and fixtures;
7. Restart/recovery journey.

Example:

```text
$speckit-implement
Implement only Phase 1 and Phase 2, including SQLite Store and the read-only Git Observer, but do
not implement Application, Recovery behavior, MCP, or Host products. Run only the listed targeted
checks and stop.
```

For the Phase 1–2 checkpoint, run only:

```bash
go test ./internal/domain ./internal/workflow
CGO_ENABLED=0 go test ./internal/store ./internal/repository
go vet ./internal/domain ./internal/workflow ./internal/store ./internal/repository
go test ./tests/contract -run 'TestRepositoryLayout|TestRepositoryRelativeMarkdownLinks'
```

## Core commands after implementation

```bash
go test ./internal/domain ./internal/workflow
go test ./internal/store ./internal/repository
go test ./internal/application
go test ./internal/mcp ./tests/contract
go test ./tests/journeys -run TestCoreRestartJourney
```

Do not run `go test ./...` or `pnpm run validate` locally at the Phase 1–2 checkpoint. The checkpoint
Draft PR runs the repository's complete `validate` job once in GitHub Actions.

## Manual server smoke

Build:

```bash
go build -o ./tmp/dev-flow ./cmd/dev-flow
```

Start STDIO server:

```bash
DEV_FLOW_DATA_DIR="$(mktemp -d)" ./tmp/dev-flow mcp --stdio
```

The directory must already exist and be usable. Core owns the fixed internal `dev-flow.db` filename;
there is no database-path flag or MCP input.

Use an MCP inspector or the contract test harness. Do not type arbitrary JSON-RPC manually and
treat parsing success as product evidence.

## Restart journey

The journey must:

1. create a temporary Git repository and first commit;
2. start the Core with a temporary data directory;
3. open a Codex-owned task;
4. advance through at least PLAN;
5. stop the process;
6. start a new process on the same database;
7. resume the exact task;
8. complete the remaining phases;
9. verify DONE and released repository claim;
10. reopen once more and read the terminal outcome.

## Negative checks

Verify without broad test expansion:

- stale revision;
- stale action;
- unknown payload field;
- changed HEAD;
- worktree fingerprint change outside `IMPLEMENT_CHANGE`, or any non-worktree binding change during
  `IMPLEMENT_CHANGE`;
- second host ownership conflict;
- duplicate repository claim;
- full-suite evidence when prohibited;
- cancellation releases claim;
- Core never invokes a Git mutation command.

## Completion

Run:

```text
$speckit-converge
```

Then run one final:

```bash
pnpm run validate
```

`pnpm run validate` already includes Go list/vet/test, repository contracts, and package dry-pack;
do not precede it with a duplicate full `go test ./...` run.

Do not run real Codex or DeepSeek journeys in this feature.
