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

Keep this entire object as `assessment.anchor` and later `prepare.assessment.anchor`. The helper
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

`prepare` requires the complete `assessment` and `user_choice:{source:"user",mode:"dev_flow",summary}`. It validates the assessment, exact assessed root set, resolved unknowns, current anchor and explicit choice before saving a receipt or preparing Git. The receipt retains both under `admission`; a conflicting resubmission is rejected. A valid small-change recommendation may still be followed by the user choosing Dev Flow. Display the assessment before receiving the choice; validation cannot authenticate the conversation itself.

After the Dev Flow choice, use `workspace_mode:"new_branch"` by default: create a confirmed task
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

For an explicitly selected `dedicated_worktree`, obtain local/remote `source_type`, `base_branch`,
`remote_name` for remote, `carry_changes` for local, and the new `target_branch`. Local sources use
`remote_name:""`; remote sources use `carry_changes:false`. Select `managed_worktree` only when the
Host can create and authorize the selected roots, or `cli_worktree` when an installed Codex CLI and
usable interactive terminal are available. Missing capability stops that selected operation.
Write the [handoff JSON](task-handoff.md) outside assessed roots after confirmation. Managed creation
uses `worktree_path:null`; CLI creation names the explicit absolute destination.

The first prepare may omit `launch_id`. Reuse its returned launch ID for all remaining repositories
of the same Task. `workspace_mode` is always explicit in the helper input and saved receipt.

### prepare

<!-- example:host prepare local-managed -->
```json
{
  "request": "Return the requested field from the endpoint.",
  "repository_key": "primary",
  "repository_path": "/work/project",
  "workspace_mode": "dedicated_worktree",
  "source_type": "local",
  "carry_changes": false,
  "remote_name": "",
  "base_branch": "main",
  "target_branch": "codex/endpoint-field",
  "surface": "managed_worktree",
  "worktree_path": null,
  "handoff_file": "/private/tmp/dev-flow-handoff.json",
  "assessment": {
    "change_level": "standard",
    "observed_repositories": [
      "/work/project"
    ],
    "candidate_components": [
      "Endpoint response"
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
  },
  "user_choice": {
    "source": "user",
    "mode": "dev_flow",
    "summary": "The user selected Dev Flow after reading the assessment."
  }
}
```

For a remote CLI launch, the complete input is:

<!-- example:host prepare remote-cli -->
```json
{
  "request": "Return the requested field from the endpoint.",
  "repository_key": "primary",
  "repository_path": "/work/project",
  "workspace_mode": "dedicated_worktree",
  "source_type": "remote",
  "carry_changes": false,
  "remote_name": "origin",
  "base_branch": "main",
  "target_branch": "codex/endpoint-field",
  "surface": "cli_worktree",
  "worktree_path": "/work/tasks/endpoint-field",
  "handoff_file": "/private/tmp/dev-flow-handoff.json",
  "assessment": {
    "change_level": "standard",
    "observed_repositories": [
      "/work/project"
    ],
    "candidate_components": [
      "Endpoint response"
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
  },
  "user_choice": {
    "source": "user",
    "mode": "dev_flow",
    "summary": "The user selected Dev Flow after reading the assessment."
  }
}
```

The helper saves the receipt and, for dedicated worktrees, the handoff material. It resolves the
local branch or fetches only the selected remote branch, freezes `base_commit`, and captures `snapshot_commit` only for confirmed local carry.
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

## Continue in the current directory

<!-- example:host prepare local-branch -->
```json
{
  "request": "Return the requested field from the endpoint.",
  "repository_key": "primary",
  "repository_path": "/work/project",
  "workspace_mode": "new_branch",
  "source_type": "local",
  "carry_changes": false,
  "remote_name": "",
  "base_branch": "main",
  "target_branch": "codex/endpoint-field",
  "surface": "current_session",
  "worktree_path": "/work/project",
  "handoff_file": null,
  "assessment": {
    "change_level": "standard",
    "observed_repositories": [
      "/work/project"
    ],
    "candidate_components": [
      "Endpoint response"
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
  },
  "user_choice": {
    "source": "user",
    "mode": "dev_flow",
    "summary": "The user selected Dev Flow after reading the assessment."
  }
}
```

After `prepared`, call `local-provision` with the saved identity. It rechecks Core availability,
creates the selected local branch or keeps the current branch, and verifies the HEAD, directory and
staged state. It saves the attempt before branch mutation; failures/uncertainty retain the directory
and receipt. Inspect an unfinished operation rather than running another branch command.

<!-- example:host local-provision current-session -->
```json
{"launch_id":"launch-example","repository_key":"primary"}
```

Read `receipt.operation_status.phase` and `workspace_origin`. Once all receipts are `provisioned`,
use `scope`, perform the server handshake and create one Core Task in the current execution session.
A provisioned retry returns retained data without Git changes; inspect current directories and let
Core verify creation/resume. A known or uncertain Core open uses the existing Task resume path.
Never reapply the snapshot to a local directory. Initial content needs preservation checks and new
work still needs its own implementation and verification.

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

Read the saved material and `host-launch status` for every confirmed repository first. Route by
`receipt.operation_status.surface` and `phase`:

| Receipt state | Destination operation |
| --- | --- |
| `managed_worktree` with `dispatching`, `queued`, `dispatched` or `uncertain`, and the actual managed destination is known | Use `bootstrap` below for first initialization. It checks the Git common group, distinct worktree Git directory, frozen HEAD and clean initial status, creates/switches the target branch, then applies the selected snapshot. |
| `current_session` with `prepared` | Run `local-provision` in the existing directory, then continue the current session. |
| `cli_worktree` with `prepared` | The coordinator completes `cli-provision` for every root before launching the destination. |
| Any surface with `provisioned` | Initialization is already recorded. Inspect the existing worktrees and follow the continuation procedure below; preserve carried content and subsequent work. |
| Other, missing or uncertain provisioning state | Inspect the saved operation and actual destination before further mutation. |

Raw managed Host creation alone has not completed provisioning. For first managed initialization:

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

### Continue from provisioned worktrees

Read each receipt's actual `worktree_path`, target branch and source repository identity, and inspect
the corresponding Git worktree/common-directory relationship, current branch, HEAD and status.
Check every root is accessible to the execution session. `bootstrap` on a `provisioned` receipt
returns saved data without rechecking Git; `scope` also assembles saved receipts rather than observing
the current worktrees. Their successful return alone does not establish current workspace validity.

The clean initial state and exact frozen HEAD checks belong to first managed initialization. Carried
changes can make a newly provisioned worktree dirty, and later authorized work or linear commits can
change status/HEAD. Preserve that content; compare the launch snapshot only for carried content that
is meant to remain unchanged. Core validates an existing Task's current history and content when
opening/resuming it. Never reapply the snapshot or reset the worktree to make it look newly created.

After the server handshake, use the [session/Core state table](#continue-after-a-launch-failure) to
choose creation or resume. Assemble all confirmed receipts through `scope` only for creation. For
resume, omit creation fields and preserve the existing Task's repository scope and method profile.

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

### Launch the interactive Codex session

The returned `codex` command starts an interactive session. Host-launch JSON commands use closed
stdin; this relaunch needs terminal stdin, stdout and stderr. Request a PTY through the actual process
tool (for example, `exec_command` with `tty:true`) and retain its session ID for subsequent reads.
Inspect terminal capability separately from `TERM`: changing `TERM` does not allocate a terminal.
Check `test -t 0 && test -t 1 && test -t 2` inside the PTY before launch. Preserve a usable `TERM`.
If it is unset or `dumb`, use the terminal type supported by that Host's PTY, such as
`xterm-256color` only when supported, in the launch environment. If support cannot be established,
report that specific limitation. Read any TUI compatibility prompt and answer only when the existing
authorization covers its effect; a trust or permission prompt may require the user's decision.

Load the saved descriptor from a file while preserving terminal stdin. For example, on a POSIX Host,
run this command through its PTY-enabled process tool, replacing the path with the complete saved
primary `cli-provision` output:

```sh
node --input-type=module -e '
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
const { relaunch } = JSON.parse(readFileSync(process.argv[1], "utf8"));
const result = spawnSync(relaunch.executable, relaunch.arguments, { stdio: "inherit", shell: false });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
' /private/tmp/dev-flow-primary-provision.json
```

A script file also preserves stdin. A heredoc such as `python3 - <<'PY'` or `node <<'JS'` redirects
stdin to the script text; a child inheriting that input has no terminal even when the outer command
uses a PTY. Pass the returned executable and arguments as separate process values, including the
complete saved prompt, rather than rebuilding a shell command or substituting `codex exec`.

### Continue after a launch failure

Separate worktree provisioning, Host session startup and Core Task opening in the reported result.
Keep the launch ID, each repository receipt, primary relaunch descriptor, process/session ID, and
original startup output. A terminal error describes the attempted invocation; check its stdin
redirection and PTY options before declaring the Host incapable of providing a terminal.

The process tool's session ID identifies a running command; the Codex task/thread ID identifies its
conversation; Core `task_id` identifies the saved development Task. Keep these identities separate.
The receipt's `provisioned` phase records Git preparation, not Core creation or a live Codex session.

| Observed state | Next operation and owner |
| --- | --- |
| Invocation definitely failed before a Codex session started | The coordinator corrects the invocation and reuses the saved descriptor after checking all roots. |
| Destination process/session is running | The coordinator reads that same session's output and handles required input. The destination alone performs Core calls and repository work. |
| Process exited, but a Codex task/thread is known | Inspect and resume that conversation through the available Host resume operation, in its original worktree with all required roots authorized. Pass the known Codex ID, not a Core ID; preserve saved context. |
| Process or conversation outcome is uncertain | Inspect retained output and Host task status before another launch or consumer. Resolve that uncertainty first. |
| Execution session is ready and no Core open call has occurred | After the handshake and worktree checks, use `scope` and the complete creation input once. |
| Core Task is known, or a previous open call may have occurred | The execution session uses `dev_flow_open_task` with only `host` and the original primary `repository_path`, then compares the returned intent/origins/scope with the launch. Resume a matching Task; handle its recovery/blocker before work. |
| That lookup returns `TASK_NOT_FOUND` | Follow the Core uncertain-creation rule: inspect the prior call/result and actual workspace. Create only after establishing that no earlier creation remains pending and the confirmed launch still applies; a mismatch or uncertain result stays stopped. |

If the Host cannot resume a known destination, report the missing operation instead of silently
starting another consumer. Reuse provisioned receipts and worktrees; a launch failure does not
require another `prepare`, branch, worktree or snapshot application. Keep the coordinator available
while it owns an interactive CLI process; report completion or a required user action from actual
destination output rather than treating process startup as completion.

If the destination cannot connect to Core, follow the [connection rule](tool-results.md#server-handshake)
before opening a Task and the [Host diagnosis guidance](host-lifecycle.md#installation-and-diagnosis-commands).
Report the actual failed step and retained destination. A working Host session alone does not mean
that a Core Task has opened or that business implementation has begun.

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
