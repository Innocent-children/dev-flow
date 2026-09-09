# Assessment and launch

Read for a new development request or a receipt-backed bootstrap. Core reads are described in
[tool results](tool-results.md); final handoff material in [task handoff](task-handoff.md).

## Command transport

Implementation: `packages/codex/bin/dev-flow-codex.mjs` — `runCLI`, `readClosedStandardInput`, `runHostLaunchCommand`;
`packages/codex/lib/host-launch-contract.mjs` — `HOST_LAUNCH_OPERATIONS`, `hostLaunchHelp`.

Discover the selected operation before constructing input:

```sh
dev-flow-codex host-launch --help
dev-flow-codex host-launch prepare --help
```

Each `host-launch` operation below receives one closed UTF-8 JSON object on stdin (at most 1 MiB).
Success writes the operation result directly to stdout, with exit 0; there is no MCP `ok/result`
envelope. Failure writes `dev-flow-codex: <message>` to stderr with exit 1; invalid command arguments
exit 2. Read the exit code and original output before using a receipt. Help performs no setup/Git/Core
operation. Example transport after saving a complete input outside all assessed repositories:

```sh
dev-flow-codex host-launch prepare < /private/tmp/dev-flow-input.json > /private/tmp/dev-flow-output.json
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

<!-- example:host inspect single -->
```json
{
  "request": "Return the requested field from the endpoint.",
  "repositories": [
    {
      "key": "primary",
      "repository_path": "/work/project"
    }
  ]
}
```

Output example (complete helper result):

<!-- example:host-output inspect single -->
```json
{
  "request_digest": "6e1ecf5454bf017b0a842e6d3f7f537dd21f1e4b5741ce8967a54a4d33e662e6",
  "repositories": [
    {
      "repository_key": "primary",
      "canonical_root": "/work/project",
      "head": "1111111111111111111111111111111111111111",
      "status_digest": "2222222222222222222222222222222222222222222222222222222222222222",
      "dirty_paths": [],
      "dirty_paths_truncated": false
    }
  ]
}
```

Keep this entire object as `assessment.anchor` and later `prepare.assessment_anchor`. The helper
hashes HEAD/status observations, not working-file contents. Equal status digests do not prove an
already dirty file is unchanged. Report this limit if source content changes while awaiting a choice;
reassess known changed requirements/code rather than claiming that the anchor proves content identity.

Assessment example (Host-owned; this is not a Core tool input):

<!-- example:assessment assessment standard -->
```json
{
  "change_level": "standard",
  "observed_repositories": [
    "/work/project"
  ],
  "candidate_components": [
    "endpoint"
  ],
  "candidate_paths": [
    "src/endpoint.js"
  ],
  "public_contract_flags": [
    "Response field changes"
  ],
  "persistence_or_state_flags": [],
  "host_or_platform_flags": [],
  "verification_shape": [
    "Endpoint response check"
  ],
  "unknowns": [],
  "recommendation": "dev_flow",
  "reasons": [
    "The response is a public contract."
  ],
  "anchor": {
    "request_digest": "6e1ecf5454bf017b0a842e6d3f7f537dd21f1e4b5741ce8967a54a4d33e662e6",
    "repositories": [
      {
        "repository_key": "primary",
        "canonical_root": "/work/project",
        "head": "1111111111111111111111111111111111111111",
        "status_digest": "2222222222222222222222222222222222222222222222222222222222222222",
        "dirty_paths": [],
        "dirty_paths_truncated": false
      }
    ]
  }
}
```

`small` requires one repository/responsibility, clear acceptance, concentrated implementation and
checks, no material unknown and no public-contract/persistence/state/Host/platform/security concern;
its recommendation is `direct`. Missing impact or verification is `uncertain`/`clarify`.
Show the result and ask only if the mode is unresolved. Example: “This changes the endpoint response.
Do you want direct development, Dev Flow, or clarification first?” Reuse an existing valid answer.
A direct choice leaves Dev Flow without creating state. Recheck request/root/HEAD/status before prepare;
a changed anchor requires reassessment and a current choice.

## Confirm source and prepare

Implementation: `packages/codex/lib/task-launch.mjs` — `validatePrepareInput, prepareTaskLaunch`.
Implementation: `packages/codex/lib/worktree-lifecycle.mjs` — `preflightWorktreeSelection, resolveFrozenBase`.

After the Dev Flow choice, obtain each missing selection: repository key; `source_type` local/remote;
`base_branch`; `remote_name` for remote; `carry_changes` for local; new `target_branch`. Show the
source checkout/dirty paths and the complete selection. Example: “Use local main, create
codex/endpoint-field, and carry the displayed staged/unstaged/untracked changes?” A local source
uses `remote_name=""`; a remote source uses `carry_changes=false`. The presence of origin selects
nothing. Previously supplied explicit choices remain valid.

Write the [handoff JSON](task-handoff.md) outside assessed roots only after confirmation.
`surface` follows the actual Host capability; `worktree_path` is null for managed creation and an
explicit absolute destination for CLI. All selections must be present; `launch_id` alone is optional
on the first prepare. For additional repositories reuse its returned launch ID and the complete anchor.

### prepare

<!-- example:host prepare local-managed -->
```json
{
  "request": "Return the requested field from the endpoint.",
  "assessment_anchor": {
    "request_digest": "6e1ecf5454bf017b0a842e6d3f7f537dd21f1e4b5741ce8967a54a4d33e662e6",
    "repositories": [
      {
        "repository_key": "primary",
        "canonical_root": "/work/project",
        "head": "1111111111111111111111111111111111111111",
        "status_digest": "2222222222222222222222222222222222222222222222222222222222222222",
        "dirty_paths": [],
        "dirty_paths_truncated": false
      }
    ]
  },
  "repository_key": "primary",
  "repository_path": "/work/project",
  "source_type": "local",
  "carry_changes": false,
  "remote_name": "",
  "base_branch": "main",
  "target_branch": "codex/endpoint-field",
  "surface": "managed_worktree",
  "worktree_path": null,
  "handoff_file": "/private/tmp/dev-flow-handoff.json"
}
```

For a remote CLI launch, the complete input is:

<!-- example:host prepare remote-cli -->
```json
{
  "request": "Return the requested field from the endpoint.",
  "assessment_anchor": {
    "request_digest": "6e1ecf5454bf017b0a842e6d3f7f537dd21f1e4b5741ce8967a54a4d33e662e6",
    "repositories": [
      {
        "repository_key": "primary",
        "canonical_root": "/work/project",
        "head": "1111111111111111111111111111111111111111",
        "status_digest": "2222222222222222222222222222222222222222222222222222222222222222",
        "dirty_paths": [],
        "dirty_paths_truncated": false
      }
    ]
  },
  "repository_key": "primary",
  "repository_path": "/work/project",
  "source_type": "remote",
  "carry_changes": false,
  "remote_name": "origin",
  "base_branch": "main",
  "target_branch": "codex/endpoint-field",
  "surface": "cli_worktree",
  "worktree_path": "/work/tasks/endpoint-field",
  "handoff_file": "/private/tmp/dev-flow-handoff.json"
}
```

The helper saves the receipt/material, resolves the local branch or fetches only the selected remote
branch, freezes `base_commit`, and captures `snapshot_commit` only for confirmed local carry.
It preserves the source checkout/index/stash. Read `receipt.launch_id`, `repository_key`, `base_commit`,
`snapshot_commit`, `operation_status.phase`, `resumed`, and `fetch_performed`; only `prepared` proceeds.
A stale assessment, branch collision, unsupported source, snapshot failure or partial setup stops
before Core creation. Preserve failed/uncertain destinations for inspection.

### status

Implementation: `packages/codex/bin/dev-flow-codex.mjs` — `runHostLaunchCommand`.
<!-- example:host status launch -->
```json
{
  "launch_id": "launch-example",
  "repository_key": "primary"
}
```

Read `receipt` and its `operation_status`; a missing record returns `receipt:null`. Example:
`{"receipt_path":"/private/tmp/receipt.json","receipt":null}` means no record was found, not that
creation may be repeated. Status does not retry preparation, dispatch, Handoff or cleanup.

## Managed dispatch

Implementation: `packages/codex/lib/task-launch.mjs` — `beginManagedTaskDispatch, claimManagedTaskDispatch, recordManagedTaskDispatch`.

Use a saved-project ID returned by the current Host project listing. `dispatch-start` saves the exact
Host request; `dispatch-call` grants one invocation. Host task creation is asynchronous. Keep the
coordinator available to record its response and inspect completion; each independent item has its own
launch. A managed multi-repository Task requires a Host that can provision and authorize every root;
reject partial isolation rather than pretending separate child sessions share writable roots.

### dispatch-start

<!-- example:host dispatch-start managed -->
```json
{
  "launch_id": "launch-example",
  "repository_key": "primary",
  "project_id": "project-example"
}
```

Result: `should_dispatch:false`, receipt phase `dispatch_prepared`, and complete `host_request`.
Keep `receipt.operation_status.dispatch_attempt_id`. Re-reading start/status returns the saved request;
it does not grant a creation call.

### dispatch-call

<!-- example:host dispatch-call managed -->
```json
{
  "launch_id": "launch-example",
  "repository_key": "primary",
  "dispatch_attempt_id": "3333333333333333333333333333333333333333333333333333333333333333"
}
```

Use the attempt ID from the preceding receipt. Only this invocation's `should_dispatch:true` permits
one Host `create_thread`. The exact `host_request` contains prompt, title and
`target:{type:"project",projectId,environment:{type:"worktree",startingState:{type:"branch",branchName:base_commit}}}`.
Forward the retained object unchanged; the frozen commit is the branch/ref input, and `onMissing` is absent.

Example orchestration when those capabilities are available (the request and response are full values):

```js
const host_response = await tools.mcp__codex_app__create_thread(saved_dispatch.host_request);
store("launch_host_response", host_response);
text(host_response);
```

Save that response through `dispatch-result`. If only `clientThreadId` is returned, it identifies queued
setup; it is not a `threadId`. Use Host status/task inspection for the same creation and never dispatch
again because a response was queued, timed out, truncated in display or missing.

### dispatch-result

<!-- example:host dispatch-result queued -->
```json
{
  "launch_id": "launch-example",
  "repository_key": "primary",
  "host_result": {
    "clientThreadId": "client-example"
  }
}
```
<!-- example:host dispatch-result ready -->
```json
{
  "launch_id": "launch-example",
  "repository_key": "primary",
  "host_result": {
    "threadId": "thread-example",
    "hostId": "local"
  }
}
```

The complete original Host wrapper is also accepted; forward it instead of constructing the sample
object. Read `receipt.operation_status.host_client_thread_id`, `host_thread_id`, phase and `changed`.
A queued result becomes `queued`; ready becomes `dispatched`; null, errors or malformed results become
`uncertain`. A retained original response can later be recorded without another creation call.

### dispatch-recover

Implementation: `packages/codex/lib/task-launch.mjs` — `recoverUncalledManagedTaskDispatch`.
<!-- example:host dispatch-recover not-called -->
```json
{
  "launch_id": "launch-example",
  "repository_key": "primary",
  "dispatch_attempt_id": "3333333333333333333333333333333333333333333333333333333333333333",
  "host_call_not_made": true,
  "previous_caller_stopped": true,
  "reason": "The prior caller stopped after parsing dispatch-call; its call log contains no create_thread invocation."
}
```

Use only after checking the actual call sequence and stopping the previous caller. Empty Host IDs
alone prove nothing. Output retains the request, rotates the attempt ID and has `should_dispatch:false`;
use the new ID in `dispatch-call`. An actual call or unknown outcome follows reconciliation instead.

### dispatch-reconcile

Implementation: `packages/codex/lib/task-launch.mjs` — `reconcileManagedTaskDispatch`.
<!-- example:host dispatch-reconcile lookup -->
```json
{
  "launch_id": "launch-example",
  "repository_key": "primary",
  "candidates": [
    {
      "thread_id": "thread-example",
      "initial_prompt": "Complete original prompt read from the actual Host task."
    }
  ]
}
```

Replace `initial_prompt` with the complete actual initial message. Search current/archived Host tasks
using launch/repository title hints, then inspect prompts; titles can be renamed. Supply all actual
matches. Exactly one prompt match yields `matched:true` and records its Task ID. Zero/multiple matches,
incomplete listing or unavailable inspection remain uncertain and never authorize another creation.

## Bootstrap

Implementation: `packages/codex/lib/task-launch.mjs` — `bootstrapManagedTask`.

The destination reads the saved material and checks the same Git common group, a different worktree
Git directory, frozen HEAD and clean initial status. The helper creates/switches the confirmed target
branch, applies the snapshot if selected, and records the provisioned worktree. Use the helper; raw
Host creation alone has not completed provisioning.

<!-- example:host bootstrap managed -->
```json
{
  "launch_id": "launch-example",
  "repository_key": "primary",
  "worktree_path": "/work/tasks/endpoint-field"
}
```

Use the actual destination path from Host/Git. Read `receipt.operation_status.phase` and
`workspace_origin`; only `provisioned` supplies Core creation fields. A failed/unverifiable bootstrap
stops before Core. The bootstrap route consumes prior confirmations; it does not restart assessment.

## CLI provisioning

Implementation: `packages/codex/lib/task-launch.mjs` — `provisionCliTask, buildCliRelaunchDescriptor`.
<!-- example:host cli-provision single -->
```json
{
  "launch_id": "launch-example",
  "repository_key": "primary",
  "source_repository_path": "/work/project",
  "additional_worktree_paths": []
}
```

Requires a prepared `cli_worktree` receipt. The CLI parser takes `source_repository_path` and passes
it as a helper option. Supply already provisioned additional roots when building the primary relaunch.
Output contains `receipt`, `workspace_origin` and `relaunch:{executable,arguments}`. Invoke that
executable/argv unchanged through the Host's process API after every root is ready and authorized.
The descriptor uses `codex -C <primary>`, one `--add-dir <additional>` per root, then `--` and the saved
bootstrap prompt. It creates no second Core Task. Failure leaves the receipt/destination for inspection.

## Complete repository scope

Implementation: `packages/codex/lib/task-launch.mjs` — `readOpenTaskRepositoryScope, buildOpenTaskRepositoryScope`.
<!-- example:host scope single -->
```json
{
  "launch_id": "launch-example",
  "repository_keys": [
    "primary"
  ],
  "primary_repository_key": "primary"
}
```
<!-- example:host scope multiple -->
```json
{
  "launch_id": "launch-example",
  "repository_keys": [
    "api",
    "web"
  ],
  "primary_repository_key": "api"
}
```

Call only after every selected repository has a provisioned receipt belonging to the same launch and
request. Read the complete result as the repository fields of `dev_flow_open_task`: `repository_path`,
`workspace_origin`, and, for multiple repositories, `primary_repository_key` and closed
`additional_repositories[{key,repository_path,workspace_origin}]`. Add only `host` and `new_task` from
[Core opening](tool-results.md#open-or-resume-a-task). Missing/mismatched records stop the whole creation.
One Core Task supports a primary plus at most seven additional repositories. An explicit resume uses
the existing worktree and omits these creation fields.
