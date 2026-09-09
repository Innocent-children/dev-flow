# Host and Task lifecycle

Use only for the requested lifecycle operation. Core preparation/cancellation/abandonment have their
own identities; Host launch receipts track Git/Host effects. They do not create another Core cursor.
Host commands use the [stdin/stdout transport](admission.md#command-transport).

## Core lifecycle operations

Use shared [cancellation](tool-results.md#cancellation) and
[abandonment](tool-results.md#abandon-an-unavailable-workspace) inputs with the current user authority.
Their readback uses the same retained Task and lifecycle identity, separately from Action recovery.

## Relocation

Use [Core relocation preparation](tool-results.md#prepare-relocation) after user authorization.
It retains the source binding and relocation blocker before the Host move. Readback of uncertain
preparation and cancellation/abandonment is defined in [Core lifecycle](tool-results.md#cancellation).

A coordinator other than the moving task performs Handoff. The calling task cannot move itself.
Use the actual Host thread ID, which is distinct from Core task_id.

### handoff-start

Implementation: `packages/codex/lib/task-launch.mjs` — `beginTaskHandoff`.
<!-- example:host handoff-start start -->
```json
{
  "launch_id": "launch-example",
  "repository_key": "primary",
  "relocation_id": "relocation-example",
  "thread_id": "thread-example"
}
```

Copy launch/repository from the provisioned receipt and relocation ID from Core. Only
`should_dispatch:true` permits one Host call, using the complete returned `host_request`:

```js
const handoff_response = await tools.mcp__codex_app__handoff_thread(saved_handoff.host_request);
store("handoff_response", handoff_response);
text(handoff_response);
```

The producer supplies threadId and followUpPrompt. Persisted `handoff_dispatching` precedes the Host
call. `should_dispatch:false` means read the existing attempt; it does not permit another Handoff.

### handoff-result

Implementation: `packages/codex/lib/task-launch.mjs` — `recordTaskHandoff`.
<!-- example:host handoff-result record -->
```json
{
  "launch_id": "launch-example",
  "repository_key": "primary",
  "host_result": {
    "operationId": "host-operation-example",
    "revision": 1
  }
}
```

Forward the complete actual Host response, including its wrapper; the sample shows its inner shape.
Read `receipt.operation_status.host_operation_id` and `host_operation_revision`; valid values produce
`handoff_pending`, while a missing/malformed response produces `uncertain`. Read the known Host
operation using the Host status capability; no missing result authorizes redispatch. For example,
where the current Host exposes this schema:

```js
const status = await tools.mcp__codex_app__get_handoff_status({
  operationId: saved_receipt.operation_status.host_operation_id,
  afterRevision: saved_receipt.operation_status.host_operation_revision,
  waitMs: 30000
});
text(status);
```

Read its actual changed revision/status/destination before recording the next command.

### handoff-status

Implementation: `packages/codex/lib/task-launch.mjs` — `recordTaskHandoffStatus`.
<!-- example:host handoff-status pending -->
```json
{
  "launch_id": "launch-example",
  "repository_key": "primary",
  "status": "pending",
  "revision": 2,
  "worktree_path": null
}
```
<!-- example:host handoff-status succeeded -->
```json
{
  "launch_id": "launch-example",
  "repository_key": "primary",
  "status": "succeeded",
  "revision": 3,
  "worktree_path": "/work/tasks/relocated-endpoint"
}
```

Use the Host operation revision, not the Core revision. Record failed status in the same shape with
`status:"failed"` and the observed path or null. Output retains receipt/changed/relocation_id. Only
actual Host success proceeds to Core resolution; failure keeps the original binding and claims.

Resolve at the destination with the current blocked Action and every actual destination root:

See the complete [Core relocation resolution input](tool-results.md#complete-relocation).

Core checks repository group, frozen base, equivalent content/surface and claim conflicts, then replaces
bindings together. Success is the complete Task in `result`; follow `result.current_action`.
`ACTIVE_TASK_CONFLICT` during creation does not authorize this process. Relocation is same-machine;
Git merge/rebase/commit/push and cross-machine transfers require their own operations/authority.



## Terminal presentation

Implementation: `internal/application/apply_action_results.go` — `applyDeliveryResult`.
Implementation: `packages/codex/lib/worktree-lifecycle.mjs` — `terminalCleanupDecision`.

On DONE/CANCELLED, present the actual source/base/base commit, task branch/current HEAD, worktree path,
clean/dirty state, current changed paths, performed checks and remaining risks. Example: “Task is DONE.
The change remains in codex/endpoint-field at /work/tasks/endpoint-field. The targeted check passed;
the worktree is dirty and remains available for review.” Replace every fact with current Core/Git data.
No terminal result implies a commit, push, pull request, Handoff or deletion.

### cleanup-decision

Read fresh Core/Git facts and query eligibility; this command grants no deletion authority:

<!-- example:host cleanup-decision keep -->
```json
{
  "lifecycle": "DONE",
  "surface": "cli_worktree",
  "clean": false,
  "pushed": false,
  "stateCertain": true
}
```

Output members are `automatic_cleanup` (always false), `worktree_cleanup` and `branch_cleanup`.
Keep active, dirty, uncertain or unpushed resources under the returned decision. Managed-worktree
cleanup belongs to the Host; do not replace it with shell Git commands. An authorized terminal
Host-only Handoff does not prepare Core relocation or mutate a terminal Task.

### cleanup-worktree

Implementation: `packages/codex/lib/task-launch.mjs` — `cleanupCliTaskWorktree`.

Only for a verified terminal, clean CLI worktree after explicit deletion authorization. `terminal`
comes from a fresh Core result and `authorized` from that user decision; they are not default booleans.

<!-- example:host cleanup-worktree remove-worktree -->
```json
{
  "launch_id": "launch-example",
  "repository_key": "primary",
  "source_repository_path": "/work/project",
  "terminal": true,
  "authorized": true
}
```

The helper saves the attempt before removal, verifies the exact receipt-owned repository/worktree,
and removes without force. Read changed/uncertain and receipt cleanup status. A requested-but-uncertain
attempt is inspected, not retried blindly. The branch remains until a separate decision.

### cleanup-branch

Implementation: `packages/codex/lib/task-launch.mjs` — `cleanupTaskBranch`.

After completed worktree cleanup and separate current branch-deletion authorization:

<!-- example:host cleanup-branch remove-branch -->
```json
{
  "launch_id": "launch-example",
  "repository_key": "primary",
  "source_repository_path": "/work/project",
  "terminal": true,
  "authorized": true
}
```

Success records completed branch cleanup. The helper uses non-force `git branch -d`; an unmerged
branch remains on Git refusal. A missing identity, wrong repository, prior uncertain attempt or
missing authorization stops. Worktree deletion authorization alone does not supply this authorization.

## Installation and diagnosis commands

Implementation: `packages/codex/bin/dev-flow-codex.mjs` — `runCLI, writeStatusSuccess, writeLifecycleSuccess, writeSetupSuccess`.

Use lifecycle commands when the user requests installation/diagnosis/removal or a failure calls for
repair. They are not repeated preconditions for every Action. They use argv, not JSON on stdin.
The package supports `--json` only on status/setup/remove; unknown arguments exit 2. Operational errors
exit 1 with a `dev-flow-codex:` stderr message. Use the current executable's help before repair.

| Interaction and complete example | Result and next step |
| --- | --- |
| `dev-flow-codex --help` | Usage plus Host/artifact help; no setup, stdin or Core operation. |
| `dev-flow-codex status --json` | operation/status/changed/package_version/core_version/receipt_path/registration. Inspect readiness/registration; this is not Task state. |
| `dev-flow-codex --version` | Text `dev-flow-codex <package-version> (core <core-version>)`; versions are independent. |
| `dev-flow-codex setup --json` | Setup result from registration/configuration checks, including completed changes and next steps. If setup partially fails, report the actual completed changes and returned repair step. |
| `dev-flow-codex remove --json` | operation/status/changed/receipt_path/next_step. Stops matching WebUI and removes owned registration; read the npm uninstall handoff. Task/Git data remain. |
| `dev-flow-codex mcp` | Installed stdio server entry used by plugin registration. It streams MCP messages, not a one-shot JSON result; normal Skill work calls the registered tools instead of starting a second server. |

Implementation of registration: `packages/codex/plugin/.mcp.json`;
`packages/codex/lib/lifecycle.mjs` — `setupRegistration`, `removeRegistration`.
`DEV_FLOW_DATA_DIR`, when used, is set before starting Codex and is shared with MCP, artifact commands
and Hook. It must be an existing canonical absolute directory. Help does not resolve it. A changed
launch environment takes effect in a new session. The internal Hook/host-check argv and message examples
are in [artifacts](artifacts.md#pretooluse-hook).
