# Dev Flow Local WebUI

[中文](WEBUI.md) | [English](WEBUI_en.md)

> The local visualization and diagnostic entry for durable Tasks, dedicated worktrees, and recovery state.

Control Center is embedded in Go Core and reads the same SQLite Tasks as Codex and DeepSeek. The
browser keeps no second process state and does not fetch, create branches/worktrees, hand off a Host,
or clean resources.

## What you can view

- the shared Task overview, filters, current stage, revision, and legal next action;
- requirements, design, Task Plan, implementation, tests, comprehension, evidence, and timeline, with
  verification explicitly shown as unplanned before TASKS;
- each repository's confirmed remote/base/base commit, task branch, worktree path, and repository group;
- current HEAD, clean/dirty state, identity/history/content digests, Task surface, and current changed paths;
- planned checks and rationales, initial/current budget, commands used by the current plan, full-suite
  count, and every increase reason;
- file-scope, verification, history, relocation, Recovery, and workspace-unavailable conditions;
- provisioning receipt identity, current Host, completed verification, and keep/review/handoff/cleanup choices;
- current Core, data directory, and runtime status.

The interface supports Simplified Chinese and English. Initial selection follows browser language;
a manual choice remains in the browser and never enters Core, a Task, a receipt, or account state.

The verification panel renders only structured state retained by Core. Before TASKS completes,
`plan` and `current_budget` are null. Afterwards it shows planned checks plus full-suite and test-code
expectations. `usage` counts only the current Task Plan revision; older records remain in facts and
timeline. Every increase shows its basis, reason, added checks, increment, and resulting budget. The
WebUI neither infers full-suite necessity from remaining capacity nor runs verification commands.

## Mutation boundary

The WebUI no longer creates a new Task from an arbitrary checkout. A new Task must pass Host-side
read-only assessment, developer confirmation, fetch, dedicated-worktree provisioning, and verification
in Codex or DeepSeek before the target Host calls Core.

The page may submit semantic operations using current Core identities:

- resolve file-scope, verification, or history blockers;
- retain a concretely justified increase through the current TEST Action's
  `verification_budget_increased` transition;
- prepare a Core blocker for same-machine relocation and submit destination paths after Host handoff;
- cancel while the workspace remains observable;
- explicitly abandon a genuinely missing workspace with the exact revision and a non-empty reason;
- archive a terminal Task or perform separately confirmed irreversible Task-data cleanup.

Actual handoff, worktree deletion, and branch deletion belong to the Host. Worktree and branch cleanup
are separately authorized, and the page never automatically removes an active, dirty, unpushed,
unknown-owner, or uncertain resource.

Hosts still ask Core before supported structured writes outside the Task Plan. Bash, external
processes, and other tools may write first; Core finds those changes during the next Task/Action Git
observation. A dedicated worktree has no option to ignore a supposedly external change.

## Start, open, inspect, and stop

```bash
dev-flow webui start
dev-flow webui status
dev-flow webui open
dev-flow webui stop
```

`start` opens the browser unless `--no-open` is supplied. Every command accepts `--plain` or `--json`.
Only `start` may create a missing default data directory: mode `0700` on macOS or the current user's
LocalAppData ACL on Windows. An explicit `DEV_FLOW_DATA_DIR` must already exist, canonicalize, and not
traverse a symbolic link.

```bash
export DEV_FLOW_DATA_DIR="/absolute/path/to/existing-directory"
dev-flow webui start
```

```powershell
$env:DEV_FLOW_DATA_DIR = "C:\absolute\existing-directory"
dev-flow webui start
```

## Local single-user boundary

The service binds an OS-assigned `tcp4 127.0.0.1` port. Browser mutations verify exact Origin, a
random session value from the current process, and the Task revision, so a stale page cannot submit an
old operation. These checks prevent mistaken local requests; they are not account authentication or
multi-user isolation. Same-user and administrator processes remain inside the local trust boundary.

The runtime receipt binds PID, process-start identity, data-root digest, and loopback URL. Stop and
uninstall act only on its exact process. It is distinct from Host provisioning receipts, Core Action
operations, and relocation records; none substitutes for another.

## States and data

`status` returns `ready`, `read_only`, `incompatible`, or `unavailable`. Default Task data lives at
`$HOME/Library/Application Support/dev-flow/data` on macOS and `%LOCALAPPDATA%\dev-flow\data` on
Windows. Codex and DeepSeek share it.

React, TypeScript, and Vite participate only in the build. Static assets are embedded in Core, so
runtime use needs no Node server, CDN, external font, or separate WebUI package. See the
[Command Reference](COMMANDS_en.md), [Architecture](ARCHITECTURE_en.md), and
[Support Matrix](SUPPORT-MATRIX_en.md).

## Not currently supported

- remote access, accounts, team permissions, or cloud synchronization;
- browser-owned shell, file editing, Git mutation, Host handoff, or publication;
- browser-created shared-checkout Tasks or automatic reconstruction of a missing worktree;
- user-defined graphs or another Task-state authority.
