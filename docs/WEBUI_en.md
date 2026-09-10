# Dev Flow Local WebUI

[中文](WEBUI.md) | [English](WEBUI_en.md)

> The local visualization and diagnostic entry for durable Tasks, working directories, and recovery state.

Control Center is embedded in Go Core and reads the same SQLite Tasks as Codex and DeepSeek. The
browser keeps no second process state and does not fetch, create branches/worktrees, hand off a Host,
or clean resources.

## Available information

- the shared Task overview, filters, current stage, revision, and legal next action;
- requirements, design, Task Plan, implementation, tests, comprehension, verification records, and timeline, with
  verification explicitly shown as unplanned before TASKS;
- each repository's confirmed source/base/base commit, task branch, worktree path, and repository group;
- current HEAD, clean/dirty state, identity/history/content digests, Task surface, and current changed paths;
- planned checks and rationales, initial/current budget, commands used by the current plan, full-suite
  count, and every increase reason;
- file-scope, verification, history, relocation, Recovery, and workspace-unavailable conditions;
- provisioning receipt identity, current Host, completed verification, and keep/review/handoff/cleanup choices;
- current Core, data directory, and runtime status.

The interface supports Simplified Chinese and English. Initial selection follows browser language;
a manual choice remains in the browser and never enters Core, a Task, a receipt, or account state.

The verification panel shows whether planning is complete, the planned checks, full-suite and test-code expectations, current-plan usage, and each justified increase. Older plan records remain in the timeline. WebUI displays Core’s results; the Host decides which checks to run.

## Mutation boundary

Workspace cards show new local branches, current branches or dedicated worktrees. Local-mode notes explain
that all edits in the shared directory are observed and local resources are retained at completion.
Workspace relocation is available only when every repository uses a dedicated worktree.

Codex or DeepSeek creates new Tasks after read-only assessment, developer confirmation, workspace selection and preparation. The page displays and handles existing Tasks.

The page may submit these operations using the current Task and Action identifiers returned by Core:

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
observation. Neither local modes nor dedicated worktrees offer an option to ignore a supposedly external change.

## Completion and Action recovery

Before entering TEST, every work item in the current Task Plan must be completed. DELIVERY receives explicit acceptance results linking each criterion to completed work items mapped to that criterion and passed checks in the current Test. Automated, static, Host-observed and explicit manual checks are supported. Comprehension confirmation remains separate and does not automatically substitute for acceptance checks. Missing, incorrect or outdated references reject the submission.

WebUI and MCP share Core semantic submission, operation retention and recovery. Core retains the canonical payload; the page sends the current Task revision, Action ID and semantic results. Network failures first trigger a Core read. Reopening the page discovers pending operations and recovers them by Action ID. Invalid completion results neither advance the Task nor retain an operation.

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
`$HOME/.dev-flow/data` on macOS and `%LOCALAPPDATA%\dev-flow\data` on
Windows. Codex and DeepSeek share it.

React, TypeScript, and Vite participate only in the build. Static assets are embedded in Core, so
runtime use needs no Node server, CDN, external font, or separate WebUI package. See the
[Command Reference](COMMANDS_en.md), [Architecture](ARCHITECTURE_en.md), and
[Support Matrix](SUPPORT-MATRIX_en.md).

## Not currently supported

- remote access, accounts, team permissions, or cloud synchronization;
- browser-owned shell, file editing, Git mutation, Host handoff, or publication;
- browser-created shared-checkout Tasks or automatic reconstruction of a missing worktree;
- user-defined graphs or another copy of Task state.

## Desktop entry and file errors

The desktop pet can open the selected Task in this WebUI. It uses a local development package and the configured Adapter’s Core. Installation, controls and appearances are described in the [desktop pet guide](DESKTOP-PETS_en.md).

When a submission omits changed process files, the page shows the missing repository paths separately from request-field errors. A correction is allowed only when Core confirms no write and explicitly permits one correction of the listed artifact fields. Workspace and history errors follow their existing recovery rules. Integration fields belong in [artifact collection and submission](ARTIFACTS_en.md).

Task details show the confirmed worktree source and whether local content was carried. Creation and source selection happen in the Host; see [worktree sources](WORKTREE-SOURCES_en.md).

Existing planned checks can receive more verification capacity for remaining work or a rerun. The page records the concrete reason and increase without creating a passed result.
