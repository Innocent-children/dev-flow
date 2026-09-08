# Dev Flow Local WebUI

[中文](WEBUI.md) | [English](WEBUI_en.md)

> The local visualization and diagnostic entry for durable Tasks, dedicated worktrees, and recovery state.

Control Center is embedded in Go Core and reads the same SQLite Tasks as Codex and DeepSeek. The
browser keeps no second process state and does not fetch, create branches/worktrees, hand off a Host,
or clean resources.

## Available information

- the shared Task overview, filters, current stage, revision, and legal next action;
- requirements, design, Task Plan, implementation, tests, comprehension, verification records, and timeline, with
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
observation. A dedicated worktree has no option to ignore a supposedly external change.

## Completion and Action recovery

Before entering TEST, every work item in the current Task Plan must be completed. DELIVERY receives explicit acceptance results linking each criterion to completed work items mapped to that criterion and passed checks in the current Test. Automated, static, Host-observed and explicit manual checks are supported. Comprehension confirmation remains separate and does not automatically substitute for acceptance checks. Missing, incorrect or outdated references reject the submission.

WebUI and MCP share Core semantic submission, operation retention and recovery. Core retains the canonical payload; the page sends the current Task revision, Action ID and semantic results. Network failures first trigger a Core read. Reopening the page discovers pending operations and recovers them by Action ID. Invalid completion results neither advance the Task nor retain an operation.

### Action HTTP fields

| Route | Request fields, in addition to csrf |
| --- | --- |
| `POST /api/tasks/{task_id}/actions/submit` | request_id, task_revision, action_id, payload; payload follows the current semantic form schema |
| `POST /api/tasks/{task_id}/recovery/assess` | action_id |
| `POST /api/tasks/{task_id}/recovery/apply` | action_id |

A null `pending_action_id` means the current detail read found no unapplied operation. A present ID exposes recovery controls. Core re-reads and validates the Action to decide the actual result.

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

## Desktop task entry

On macOS arm64, the desktop pet uses a local development package containing `DevFlowPet.app`, with Core supplied by an already configured Codex or DeepSeek Adapter.
Regular npm file lists and release preparation currently omit the native app; see the [desktop pet guide](DESKTOP-PETS_en.md#local-build-and-installation) to obtain it.
The pet shows one selected Task's saved state and opens its WebUI. Core owns Task state; presentation indicates neither live Host activity nor completion percentages.

Appearances can use a single PNG, a native animation pack, a standard Codex format 1/2 atlas, or Dev Flow's high-resolution extension. Five task clips are required;
additional artwork determines whether walking, waving, or thinking is available. Only Codex-layout atlases have the fixed nine-clip, 57-frame extraction.
Idle activities have a separate switch, task prompts take priority, and automatic movement preserves manual placement.
Program updates, replacement of an installed app copy, and artwork reimports are separate operations. See the [desktop pet guide](DESKTOP-PETS_en.md) for installation, all trigger rules, and troubleshooting.

The local pet package retains the default appearance. Import Whale Girl or other custom appearances as separate artwork packs through Import appearance. Artwork is stored in the user directory and preserved across application updates.

## Windows desktop features

The Windows 10/11 x64 desktop pet aligns with macOS task selection and status bubbles, WebUI navigation, tray/context menus, static and native animated PNG/SVG appearances, Codex PNG/WebP atlas imports, nine actions, dragging, six scale settings, hide/restore and independent start/stop. Windows uses a separate Electron implementation while macOS retains Swift/AppKit; both only read Core state. The Windows local package is built by `scripts/build-desktop-pet-windows.mjs`, with user data in `%LOCALAPPDATA%\dev-flow\pet`. See the [desktop pet guide](DESKTOP-PETS_en.md) for building, installation, updates and verification.

The current Windows development distribution includes both Adapter packages and the desktop app. After installing the launcher package, use `dev-flow install --host all --yes` and `dev-flow pet start`. Repair and reinstall use the same entry, verify bundled artifact hashes, refresh the desktop app, and preserve Task data, settings and appearances.

## Missing artifact handling

Missing process files return `artifact_manifest_incomplete` and `error.repository_paths`, separately from request field paths. Only after Core proves zero writes and explicitly permits correction may the caller correct the specified artifact fields once on the same Action. Workspace and history failures keep their existing recovery routes; WebUI displays omitted paths. See [artifact collection and submission](ARTIFACTS_en.md).
