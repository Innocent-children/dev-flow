# DeepSeek assessment and workspace launch

Implementation: `packages/deepseek/lib/workspace-tool.mjs` — `registerWorkspaceCoordinator`;
`packages/deepseek/lib/workspace-coordinator.mjs` — `authorizeWorkspaceExecution`, `createWorkspaceCoordinator`.

## Read-only assessment

Read the full relevant request discussion, current repository rules, candidate code/callers/tests,
manifests, configuration, HEAD and Git status within the existing Workspace Root. Perform required
project-index discovery before selecting candidate repositories. Candidate paths are a lower bound,
not a final file plan. Assessment is Host work; there is no DSH inspect/host-launch operation.

Record change_level, observed_repositories, candidate_components, candidate_paths,
public_contract_flags, persistence_or_state_flags, host_or_platform_flags, verification_shape,
unknowns, recommendation and reasons. Example Host assessment (not a Core/coordinator input):

```json
{"change_level":"standard","observed_repositories":["/work/project"],"candidate_components":["endpoint"],"candidate_paths":["src/endpoint.js"],"public_contract_flags":["Response field change"],"persistence_or_state_flags":[],"host_or_platform_flags":[],"verification_shape":["Targeted endpoint check"],"unknowns":[],"recommendation":"dev_flow","reasons":["The response is a public contract."]}
```

Small means a bounded single-repository/responsibility change with clear acceptance, targeted checks
and no material public-contract/state/Host/security/recovery concern. Unresolved impact or verification
is uncertain/clarify. Show the assessment and obtain only an unresolved mode choice. Before choosing
Dev Flow there is no Core/coordinator call, file edit, test/build, dependency installation, Git write
or launch receipt. A direct choice exits Dev Flow without its state or provisioning.

Retain the exact request and observed root/HEAD/status context; reassess a known change before
confirmation. The coordinator independently observes the source during provisioning; it accepts no
assessment or user_choice fields and does not verify a Host assessment object. Status text alone also cannot
prove that an already dirty file's contents remained unchanged.

Implementation: `packages/deepseek/lib/workspace-coordinator.mjs` — `observeSourceRepository`, `validateRepositoryRequests`.

## Workspace choice and confirmation

After the user chooses Dev Flow, default to `workspace_mode:"new_branch"`: create a task branch
from the current HEAD in the original directory. Explicit alternatives are `current_branch` and
`dedicated_worktree`. Show the current directory, branch and dirty paths. Reuse valid choices;
obtain only missing target-branch or initial-content decisions.

Local modes use `source_type:"local"`, `remote_name:""` and the actual current branch as `base_branch`.
`new_branch` requires an unused target branch; `current_branch` uses that same current branch as its
target. `carry_changes:true` accepts initial staged/unstaged/non-ignored untracked changes for Task
tracking. Preserve index, file contents, ignored configuration and installed dependencies in place.
Unaccepted dirty contents stop preparation. Core's read-only workspace-available check stops an
occupied directory before any branch change, and Core acquires all claims again when creating Task.
The check is not a directory reservation; keep a single preparation/execution owner.

When all roots use local modes, `provision` returns `status:"ready"` and `open_task` in the existing
Workspace Root. Perform the server handshake, then open one Core Task using this complete descriptor;
continue the same DSH session without `consume` or relaunch. Treat a known/uncertain Core open as a
resume. Initial modifications require preservation checks and do not count as verified new work.

An explicit dedicated-worktree choice keeps the source/base/target/carry preparation below. Mixed
selections use a new session rooted at the common parent of the existing Workspace Root and prepared
sibling worktrees. Every selected root must be writable in that actual session. Any repository failure
prevents the complete Core open; keep local branches/modifications and inspect the saved operation.

## Confirmation and tool shape

The current workspace_coordinator tool has exactly five operations: provision, consume,
prepare_cleanup, cleanup_worktree, cleanup_branch. It is a DSH tool with a JSON argument object;
its result is rendered as JSON text. Provision/consume are below; cleanup is in [lifecycle](host-lifecycle.md).
It is not a shell command or a Core tool. Source/base/target/carry choices are explicit, and previously
settled choices remain usable, but the guard requires the following exact text in the current direct
user turn. Show the actual values and request only that missing confirmation.

For the complete provision example below, the user's message is:

<!-- workspace-confirmation:provision -->
```text
/dev-flow confirm-workspace
repository=primary;mode=dedicated_worktree;source=local;carry=true;remote=;base=main;target=feature/endpoint-field
```

Use one line per repository, primary first. For local sources remote_name is empty and carry_changes
is the user's explicit choice. For remote sources carry_changes is false and remote_name/base_branch
are explicit. Show staged/unstaged/non-ignored untracked paths. Ignored content is excluded; carrying
preserves source contents and staged state, and an application conflict stops provisioning.

Implementation: `packages/deepseek/lib/workspace-coordinator.mjs` — `workspaceConfirmationText`, `authorizeWorkspaceExecution`.

## provision

The request string carries the actual admitted requirements/constraints; profile is the running DSH
Profile, not the Core method_profile. Each repository source path comes from canonical read-only
inspection inside the current Workspace Root. The coordinator freezes the current HEAD for local modes, or the selected local/fetched branch for
dedicated worktrees, plus any accepted initial snapshot; do not run its Git mutations through Bash.

<!-- example:workspace workspace_coordinator provision-worktree -->
```json
{
  "operation": "provision",
  "request": "Return the requested endpoint field and preserve the confirmed local content.",
  "profile": "web",
  "repositories": [
    {
      "repository_key": "primary",
      "workspace_mode": "dedicated_worktree",
      "source_repository_path": "/work/project",
      "source_type": "local",
      "carry_changes": true,
      "remote_name": "",
      "base_branch": "main",
      "target_branch": "feature/endpoint-field"
    }
  ]
}
```

Complete successful request and response: [view every returned field](successes/workspace-workspace_coordinator-provision-worktree.md).

For the dedicated-worktree selection above, the success projection is:

```json
{"status":"relaunch_required","launch_id":"11111111-1111-4111-8111-111111111111","request_digest":"<returned digest>","workspace_root":"/work/.dev-flow-worktrees/11111111-1111-4111-8111-111111111111/primary","source_dirty_paths":{"primary":["notes/change.md"]},"source_dirty_paths_truncated":{"primary":false},"relaunch":{"command":"dsh","arguments":["--profile","web","<complete returned resume-worktree prompt>"],"cwd":"/work/.dev-flow-worktrees/11111111-1111-4111-8111-111111111111/primary"}}
```

Preserve the complete actual relaunch command/arguments/cwd and show it unchanged. For `status:"relaunch_required"`, the source session
stops for a new DSH session at that cwd; it cannot widen its running Root. The returned prompt carries
the admitted request directly. DeepSeek does not accept Codex handoff_file or host_request fields.

On definite failure, Core has not opened a Task and the coordinator only compensates receipt-owned
resources it can prove safe. An interrupted/timed-out operation may be uncertain; preserve its receipt
and filesystem for inspection, without another provision. There is no status/reconcile operation in
the five-operation tool; report that limit rather than calling Codex helpers or guessing a new launch.
A failed repository prevents a partial multi-repository Core open.

For a default local launch, the exact confirmation is:

<!-- workspace-confirmation:provision -->
```text
/dev-flow confirm-workspace
repository=primary;mode=new_branch;source=local;carry=true;remote=;base=main;target=feature/endpoint-field
```

<!-- example:workspace workspace_coordinator provision-local -->
```json
{
  "operation": "provision",
  "request": "Return the requested endpoint field and preserve the confirmed local content.",
  "profile": "web",
  "repositories": [{
    "repository_key": "primary",
    "workspace_mode": "new_branch",
    "source_repository_path": "/work/project",
    "source_type": "local",
    "carry_changes": true,
    "remote_name": "",
    "base_branch": "main",
    "target_branch": "feature/endpoint-field"
  }]
}
```

Complete successful request and response: [view every returned field](successes/workspace-workspace_coordinator-provision-local.md).

The result has `status:"ready"`, `workspace_root:"/work/project"` and the complete `open_task` repository
arguments, including `workspace_origin.mode:"new_branch"`. It has no `relaunch`. Call Core once in
this session after the handshake. `current_branch` uses the same shape with both branch fields set
to the observed current branch and creates no branch.

## First launch or Task recovery

Before choosing `consume`, read the retained launch/open results and relevant session history. The
`resume-worktree` text identifies a launch; reusing it does not establish that Core has no Task.
The receipt's `consumed` status records workspace checks, not successful Core creation. Use the
following route while preserving the confirmed request and repository choices:

| Actual state | Next operation |
| --- | --- |
| First destination launch, with no prior Core open attempt | With the exact current-turn launch message, call `consume` below. After `consumed` and a successful server handshake, create once using its complete repository descriptor and actual `new_task` facts. |
| Core Task already exists | Start in the original worktree with every participating repository inside the authorized DSH Workspace Root. Perform the server handshake, then call Core open with only `host:"deepseek"` and the original primary `repository_path`. Handle recovery/blocker before the returned Action. |
| A Core open call may have occurred, but its result is missing or uncertain | Perform the handshake and the same Core resume call on the original primary worktree. Compare the returned intent, origins and full repository scope with the confirmed launch. Follow the shared uncertain-creation rule; `TASK_NOT_FOUND`, mismatch or another uncertain result stops for inspection, not another creation attempt. |
| Provisioning itself is incomplete or uncertain | Preserve its receipt and destinations and follow the provisioning failure rule above. Core resume cannot substitute for unfinished workspace preparation. |

The Core calls require `/dev-flow` in the current direct user turn. An existing Task resume does not
require a new `confirm-workspace` or `resume-worktree` confirmation. The exact consume confirmation
applies only when that operation is needed. Use the complete [Core creation/resume inputs and
uncertain-creation rules](tool-results.md#open-or-resume-a-task).

Existing or uncertain Core Tasks bypass `consume`: that operation checks the original frozen HEAD
even for a previously consumed receipt. Normal later commits can fail that initial-state check.
Preserve current work and let Core validate the existing Task's workspace; resetting HEAD, cleaning
changes, reapplying the snapshot or repeating `provision` is not a recovery step. A previous session
still performing the work must be resolved before another session continues it.

## consume

For first launch selected above, the destination's exact current user message includes the returned
launch identity:

<!-- workspace-confirmation:consume -->
```text
/dev-flow resume-worktree launch=11111111-1111-4111-8111-111111111111
```

<!-- example:workspace workspace_coordinator consume -->
```json
{
  "operation": "consume",
  "launch_id": "11111111-1111-4111-8111-111111111111"
}
```

Complete successful request and response: [view every returned field](successes/workspace-workspace_coordinator-consume.md).

The coordinator checks the receipt Workspace Root, every worktree's repository group, target branch,
HEAD equal to the frozen base commit, and read/write access. It requires a clean worktree when
carry_changes is false; with carry_changes true, a successful consume is not a byte-for-byte snapshot
comparison. Only status consumed proceeds. For first creation, copy its complete open_task object
directly into the Core open's repository fields; add host deepseek and actual new_task facts:

```text
tool: mcp__dev_flow__dev_flow_open_task
arguments: { ...consume.open_task, host: "deepseek", new_task: <current intent> }
```

This is a construction sketch; the [shared opening examples](tool-results.md#open-or-resume-a-task)
show complete JSON inputs. Every workspace_origin includes mode, source_type, carry_changes,
remote_name, base_branch, base_commit, task_branch and provisioning_receipt_id. Forward every root,
including the primary_repository_key and additional_repositories array returned for this launch.
First call the [Core server handshake](tool-results.md#server-handshake) with the current user selector.
A consumed bootstrap does not repeat assessment. Missing/mismatched receipts or roots stop before Core.
For existing or uncertain Core Tasks, use the recovery routes above instead of this creation sketch.
