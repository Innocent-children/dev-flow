# DeepSeek Host lifecycle

Implementation: `packages/deepseek/lib/workspace-tool.mjs` — `registerWorkspaceCoordinator`;
`packages/deepseek/lib/workspace-coordinator.mjs` — `workspaceCleanupText`, `createWorkspaceCoordinator`.

## Core terminal operations

Use the shared [cancellation](tool-results.md#cancellation) and
[abandonment](tool-results.md#abandon-an-unavailable-workspace) inputs through qualified DSH tools.
Cancellation requires a fresh cancellation request_id, current Task revision and actual user reason.
Abandonment is only for an unavailable original worktree instance. A lost lifecycle result is read
back from the same Task; it is not an ordinary Action recovery.

Each call requires /dev-flow in the current direct user turn. Example: “/dev-flow cancel Task
 task-example because this change is no longer needed.” Use the actual current Task ID/revision in
the complete shared cancellation example. DONE/CANCELLED release Core claims and preserve Git data.

## Relocation

The shared Core exposes [prepare/resolve relocation](tool-results.md#prepare-relocation), but this
DSH package's workspace_coordinator has no Host relocation/Handoff operation. Tool availability alone
does not provide a complete move procedure. Report automatic Host relocation as unavailable before
creating a relocation blocker; do not call Codex handoff_thread or invent a coordinator operation.
A missing original workspace follows restore/abandon rules, not a substitute same-named worktree.

Implementation: `packages/deepseek/lib/workspace-tool.mjs` — `registerWorkspaceCoordinator`;
`internal/application/relocation.go` — `PrepareTaskRelocation`.

## Terminal presentation

Present actual Task outcome, source/base/base commit, task branch/current HEAD, workspace path,
changed paths and verification. Example: “The Task is DONE; its worktree remains available for review.
The targeted check passed. Cleanup needs its own current confirmation.” Replace all facts with the
actual result. Completing Core does not commit, push, create a PR or delete a branch/worktree.

The coordinator verifies terminal Core Task ID/revision, receipt origin, repository group, current
branch/HEAD and clean status. Assisted deletion additionally requires a remote-source task branch
whose remote HEAD equals the terminal HEAD. Local-source branches are retained for separate manual
review. Dirty, unpushed, mismatched or uncertain resources remain. Do not turn a cleanup refusal into
force deletion or a push. The following examples describe eligible remote-source cleanup; they do
not claim the carried local launch in admission is eligible.

Implementation: `packages/deepseek/lib/workspace-coordinator.mjs` — `cleanupState`, `inspectTerminalWorktree`, `assertRemoteHead`.

## prepare_cleanup

First obtain the fresh terminal Task and a surviving source checkout in the same repository group.
The current direct user message must contain the exact text:

<!-- workspace-confirmation:prepare_cleanup -->
```text
/dev-flow prepare-cleanup launch=11111111-1111-4111-8111-111111111111 repository=primary task=task-example revision=9
```

<!-- example:workspace workspace_coordinator prepare_cleanup -->
```json
{
  "operation": "prepare_cleanup",
  "launch_id": "11111111-1111-4111-8111-111111111111",
  "repository_key": "primary",
  "task_id": "task-example",
  "revision": 9,
  "source_repository_path": "/work/project"
}
```

Result shape: status cleanup_relaunch_required, changed false, launch_id, repository_key, and
relaunch {command,arguments,cwd}. Forward the returned descriptor unchanged; it starts DSH at the
surviving source checkout. The returned resume-cleanup prompt asks for the next exact cleanup
confirmation. It does not authorize deleting the running workspace or the branch in that turn.

## cleanup_worktree

After relaunch at the surviving checkout, the user separately sends:

<!-- workspace-confirmation:cleanup_worktree -->
```text
/dev-flow cleanup-worktree launch=11111111-1111-4111-8111-111111111111 repository=primary task=task-example revision=9
```

<!-- example:workspace workspace_coordinator cleanup_worktree -->
```json
{
  "operation": "cleanup_worktree",
  "launch_id": "11111111-1111-4111-8111-111111111111",
  "repository_key": "primary",
  "task_id": "task-example",
  "revision": 9
}
```

Success shape: {status:"worktree_removed",changed:true,launch_id,repository_key,branch_retained:true}.
An already removed worktree returns changed false with its saved status. The tool concludes the
turn; branch deletion needs its own later current-turn authorization. Uncertain removal is inspected,
not used as permission to repeat Git directly.

## cleanup_branch

After completed worktree cleanup, the user separately sends:

<!-- workspace-confirmation:cleanup_branch -->
```text
/dev-flow cleanup-branch launch=11111111-1111-4111-8111-111111111111 repository=primary task=task-example revision=9
```

<!-- example:workspace workspace_coordinator cleanup_branch -->
```json
{
  "operation": "cleanup_branch",
  "launch_id": "11111111-1111-4111-8111-111111111111",
  "repository_key": "primary",
  "task_id": "task-example",
  "revision": 9,
  "source_repository_path": "/work/project"
}
```

The source path is transient and must be within the current Workspace Root in the same Git group.
The coordinator verifies terminal/local/remote HEAD and that the branch is not checked out, then uses
non-force git branch -d. Success returns status branch_removed with changed true (false if already
recorded). A safe Git refusal retains the branch. The tool concludes the turn.

## Workspace failures

A missing exact confirmation returns DEV_FLOW_WORKSPACE_CLEANUP_CONFIRMATION_REQUIRED. Ask for the
actual returned text; preserve settled choices. A changed Task/revision, mismatched receipt/root,
local source, dirty worktree, unpushed branch or different remote HEAD stops cleanup. These Host
errors are not Core Action recovery instructions. No workspace_coordinator status, relocate,
dispatch-recover or artifact operation exists; use only its five listed operations.

Implementation: `packages/deepseek/lib/workspace-coordinator.mjs` — `authorizeWorkspaceExecution`;
`packages/deepseek/lib/workspace-tool.mjs` — `registerWorkspaceCoordinator`.

## Installation and diagnosis commands

Implementation: `packages/deepseek/package.json` — dsh bundle/main/files;
`packages/deepseek/lib/index.mjs` — `activateDeepSeekIntegration`;
`packages/dev-flow/lib/hosts/deepseek.mjs`.

This package is a DSH bundle with no standalone dev-flow-deepseek CLI. Use the actual Profile and the
DSH lifecycle entry. Complete examples:

```sh
dev-flow status --host deepseek --profile web
dsh --profile web --dump-config
```

Read status/configuration for the selected Profile; a successful dump is not a Task outcome.
After authorized installation or update, restart that Profile. A failure reports the actual missing
runtime/registration rather than starting a second MCP server. Authorized native removal uses:

```sh
dsh plugin --profile web remove dev-flow-deepseek
dsh --profile web --dump-config
```

Inspect every relevant Profile separately; Task and repository data remain. Standard end-user
installation uses the lifecycle guide in the package README. The shipped index selects the exact
supported platform runtime, checks it and registers Skill/MCP/guards. DEV_FLOW_DATA_DIR must be set
before session startup; an explicit directory already exists and is canonical and non-link.
