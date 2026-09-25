# Assessment and local launch

Read for a new request or saved local launch. This page covers current-directory work; read
[worktree launch](worktree-launch.md) only for a selected dedicated workspace or Host-session recovery.
After every repository is ready, use [Core connection](connection.md) to create or resume the Task.

## Command transport

Implementation: `packages/codex/bin/taskbelay-codex.mjs` — `runCLI`, `readClosedStandardInput`, `runHostLaunchCommand`;
`packages/codex/lib/host-launch-contract.mjs` — `HOST_LAUNCH_OPERATIONS`, `hostLaunchHelp`.

Discover the selected operation before constructing input:

```sh
taskbelay-codex host-launch --help
taskbelay-codex host-launch prepare --help
```

Each `host-launch` operation below receives one closed UTF-8 JSON object on stdin (at most 1 MiB).
Success writes the operation result directly to stdout, with exit 0; there is no MCP `ok/result`
envelope. Failure writes `taskbelay-codex: <message>` to stderr with exit 1; invalid command arguments
exit 2. Read the exit code and original output before using a receipt. Help performs no setup/Git/Core
operation. Example transport after saving a complete input outside all assessed repositories:

```sh
taskbelay-codex host-launch prepare < /private/tmp/taskbelay-input.json > /private/tmp/taskbelay-output.json
```

Use private files and filesystem JSON parsing. Preserve each complete result in orchestration context;
display only needed fields. Pass branch/path values as individual argv values. For Windows, use actual
canonical absolute Windows paths and the Host's process APIs; the JSON protocol is the same.

## Read-only assessment

Implementation: `packages/codex/lib/task-admission.mjs` — `inspectAdmissionAnchor, validateSuitabilityAssessment`.

Read the whole relevant discussion, repository rules, candidate symbols/callers, tests, manifests,
configuration, HEAD and status. Complete any repository-index discovery required by applicable
instructions. Before a choice, perform no Core call, file edit, build/test, dependency installation,
Git write, receipt write or dispatch. The `inspect` helper below performs the read-only Git part.
Candidate paths are discovered candidates, not the final plan.

### inspect

Inputs: the exact admitted request overview, and every candidate key/root. Keep the same request
string for prepare and the handoff. `inspect` canonicalizes paths; duplicate roots/keys are rejected.

[Complete inspect example](launch-examples.md#host-inspect-single).

The linked response includes the complete helper result and its retained assessment anchor.

Keep this entire object as `assessment.anchor` and later `prepare.assessment.anchor`. The helper
hashes HEAD/status observations, not working-file contents. Equal status digests do not prove an
already dirty file is unchanged. Report this limit if source content changes while awaiting a choice;
reassess known changed requirements/code rather than claiming that the anchor proves content identity.

Assessment example (Host-owned; this is not a Core tool input):

[Complete assessment example](launch-examples.md#assessment-assessment-standard).

`small` requires one repository/responsibility, clear acceptance, concentrated implementation and
checks, no material unknown and no public-contract/persistence/state/Host/platform/security concern;
its recommendation is `direct`. Missing impact or verification is `uncertain`/`clarify`.
Show the result and ask only if the mode is unresolved. Example: “This changes the endpoint response.
Do you want direct development, TaskBelay, or clarification first?” Reuse an existing valid answer.
A direct choice leaves TaskBelay without creating state. Recheck request/root/HEAD/status before prepare;
a changed anchor requires reassessment and a current choice.

A dependent sequence toward one result is one request. For explicitly requested independent parallel
items, assess each and obtain its item/branch choices before dispatch. Each has its own Host task,
worktree and Core Task. One directory has one active Task; use separately selected dedicated worktrees
or execute sequentially. `ACTIVE_TASK_CONFLICT` requires resolving or resuming the existing Task.

## Confirm source and prepare

Implementation: `packages/codex/lib/task-launch.mjs` — `validatePrepareInput, prepareTaskLaunch`.
Implementation: `packages/codex/lib/worktree-lifecycle.mjs` — `preflightWorktreeSelection, resolveFrozenBase`.

`prepare` requires the complete `assessment` and `user_choice:{source:"user",mode:"taskbelay",summary}`. It validates the assessment, exact assessed root set, resolved unknowns, current anchor and explicit choice before saving a receipt or preparing Git. The receipt retains both under `admission`; a conflicting resubmission is rejected. A valid small-change recommendation may still be followed by the user choosing TaskBelay. Display the assessment before receiving the choice; validation cannot authenticate the conversation itself.

After the TaskBelay choice, use `workspace_mode:"new_branch"` by default: create a confirmed task
branch from the current HEAD in the existing directory. The user can instead select `current_branch`
or `dedicated_worktree`. Show every repository's canonical path, observed current branch and dirty
paths. Reuse valid choices and authorization; ask only for an unresolved target branch or acceptance
of existing changes. A workspace choice still does not approve an unseen implementation plan.

For `new_branch` and `current_branch`, use `source_type:"local"`, `remote_name:""`, the observed
current branch as `base_branch`, `surface:"current_session"`, `worktree_path:repository_path`, and
`handoff_file:null`. With `current_branch`, `target_branch` is also the observed current branch;
with `new_branch`, it is a new local branch. Both keep the current directory, index, ignored files
and environment. `carry_changes:true` explicitly includes initial staged/unstaged/non-ignored untracked
content in the Task. Dirty content with `carry_changes:false` stops preparation. Existing commits
before the frozen starting HEAD are starting code, not newly completed Task work.

Both `prepare` and `local-provision` ask Core's read-only `host-check workspace-available` to check
for an active Task in the directory. An occupied directory stops preparation before switching branches;
resume or resolve the existing Task. This check does not reserve the directory, and the Host must keep
one execution owner during preparation. Core still acquires every Task claim atomically at creation.

Check that the execution session can access every selected directory. When all directories are already
authorized, continue the same session; local mode requires no child task, TTY, relaunch or handoff JSON.
For a multi-repository selection containing dedicated worktrees, establish a real Host surface that can
authorize every resulting root before preparing any repository. Separate child sessions are not one
shared writable scope. Read `scope` only after every repository is ready.

For an explicitly selected dedicated worktree, read [worktree launch](worktree-launch.md) for source,
Host-surface and handoff requirements before prepare.

The first prepare may omit `launch_id`. Reuse its returned launch ID for all remaining repositories
of the same Task. `workspace_mode` is always explicit in the helper input and saved receipt.

### prepare

Use the [local-branch input](launch-examples.md#host-prepare-local-branch) for the default mode.
Dedicated-worktree inputs are linked from [worktree launch](worktree-launch.md).

The helper saves the receipt and, for dedicated worktrees, the handoff material. It resolves the
local branch or fetches only the selected remote branch, freezes `base_commit`, and captures `snapshot_commit` only for confirmed local carry.
It preserves the source checkout/index/stash. Read `receipt.launch_id`, `repository_key`, `base_commit`,
`snapshot_commit`, `operation_status.phase`, `resumed`, and `fetch_performed`; only `prepared` proceeds.
A stale assessment, branch collision, unsupported source, snapshot failure or partial setup stops
before Core creation. Preserve failed/uncertain destinations for inspection.

Snapshot capture compares HEAD and the index, working-file, and untracked Git trees from two reads.
Changed content stops preparation even if status is unchanged; it does not retry automatically.
Inspect the retained source and receipt before continuing. Keep one writer during preparation:
this is not an atomic snapshot under arbitrary concurrent writes. This content check does not change
the assessment anchor's HEAD/status contract described above.

### status

Implementation: `packages/codex/bin/taskbelay-codex.mjs` — `runHostLaunchCommand`.
[Complete status example](launch-examples.md#host-status-launch).

Read `receipt` and its `operation_status`; a missing record returns `receipt:null`. Example:
`{"receipt_path":"/private/tmp/receipt.json","receipt":null}` means no record was found, not that
creation may be repeated. Status does not retry preparation, dispatch, Handoff or cleanup.

## Continue in the current directory

[Complete prepare example](launch-examples.md#host-prepare-local-branch).

After `prepared`, call `local-provision` with the saved identity. It rechecks Core availability,
creates the selected local branch or keeps the current branch, and verifies the HEAD, directory and
staged state. It saves the attempt before branch mutation; failures/uncertainty retain the directory
and receipt. Inspect an unfinished operation rather than running another branch command.

[Complete local-provision example](launch-examples.md#host-local-provision-current-session).

Read `receipt.operation_status.phase` and `workspace_origin`. Once all receipts are `provisioned`,
use `scope`, perform the server handshake and create one Core Task in the current execution session.
A provisioned retry returns retained data without Git changes; inspect current directories and let
Core verify creation/resume. A known or uncertain Core open uses the existing Task resume path.
Never reapply the snapshot to a local directory. Initial content needs preservation checks and new
work still needs its own implementation and verification.

## Continue a saved launch

Read `host-launch status` with the saved launch/repository identity; do not repeat assessment.

| Receipt and actual session state | Next step |
| --- | --- |
| `current_session`, `prepared` | Run [local-provision](#continue-in-the-current-directory). |
| `managed_worktree` | Follow [bootstrap](worktree-launch.md#bootstrap) for its actual phase. |
| `cli_worktree`, `prepared` | The coordinator completes [CLI provisioning](worktree-launch.md#cli-provisioning). |
| `provisioned` | Inspect actual roots, permissions and Git identity. Preserve carried content and later work. Read [connection](connection.md) and resume any existing or uncertain Core Task. Create only after establishing that no prior creation remains pending and the confirmed launch still applies. |
| Missing, failed or uncertain preparation | Inspect the retained operation and destination before another mutation. |

Receipt status records workspace preparation, not Core creation. `scope` assembles saved receipts;
its success does not verify the current workspace. Never reapply snapshots or reset a workspace to
make it look newly created. [Launch recovery](worktree-launch.md#continue-after-a-launch-failure)
separates Host process/session uncertainty from Core creation.

## Complete repository scope

Implementation: `packages/codex/lib/task-launch.mjs` — `readOpenTaskRepositoryScope, buildOpenTaskRepositoryScope`.
[Single-repository scope example](launch-examples.md#host-scope-single).
[Multiple-repository scope example](launch-examples.md#host-scope-multiple).

Call only after every selected repository has a provisioned receipt belonging to the same launch and
request. Read the complete result as the repository fields of `taskbelay_open_task`: `repository_path`,
`workspace_origin`, and, for multiple repositories, `primary_repository_key` and closed
`additional_repositories[{key,repository_path,workspace_origin}]`. Add only `host` and `new_task` from
[Core opening](connection.md#open-or-resume-a-task). Missing/mismatched records stop the whole creation.
One Core Task supports a primary plus at most seven additional repositories. An explicit resume uses
the existing worktree and omits these creation fields.
