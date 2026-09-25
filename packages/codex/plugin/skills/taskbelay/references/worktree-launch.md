# Dedicated worktree launch

Use only after the user selects a dedicated worktree. Complete [assessment and shared preparation](admission.md)
first; local current-directory work follows that guide without dispatch or a new session.

Implementation: `packages/codex/lib/task-launch.mjs` — `prepareTaskLaunch`;
`packages/codex/lib/worktree-lifecycle.mjs` — `preflightWorktreeSelection`.

## Source and execution surface

For an explicitly selected `dedicated_worktree`, obtain local/remote `source_type`, `base_branch`,
`remote_name` for remote, `carry_changes` for local, and the new `target_branch`. Local sources use
`remote_name:""`; remote sources use `carry_changes:false`. Select `managed_worktree` only when the
Host can create and authorize the selected roots, or `cli_worktree` when an installed Codex CLI and
usable interactive terminal are available. Missing capability stops that selected operation.
Write the [handoff JSON](task-handoff.md) outside assessed roots after confirmation. Managed creation
uses `worktree_path:null`; CLI creation names the explicit absolute destination.

[Complete prepare example](launch-examples.md#host-prepare-local-managed).

For a remote CLI launch, the complete input is:

[Complete prepare example](launch-examples.md#host-prepare-remote-cli).

## Managed dispatch

Implementation: `packages/codex/lib/task-launch.mjs` — `beginManagedTaskDispatch, claimManagedTaskDispatch, recordManagedTaskDispatch`.

Use a saved-project ID returned by the current Host project listing. `dispatch-start` saves the exact
Host request; `dispatch-call` grants one invocation. Host task creation is asynchronous. Keep the
coordinator available to record its response and inspect completion; each independent item has its own
launch. A managed multi-repository Task requires a Host that can provision and authorize every root;
reject partial isolation rather than pretending separate child sessions share writable roots.

### dispatch-start

[Complete dispatch-start example](launch-examples.md#host-dispatch-start-managed).

Result: `should_dispatch:false`, receipt phase `dispatch_prepared`, and complete `host_request`.
Keep `receipt.operation_status.dispatch_attempt_id`. Re-reading start/status returns the saved request;
it does not grant a creation call.

### dispatch-call

[Complete dispatch-call example](launch-examples.md#host-dispatch-call-managed).

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

[Complete dispatch-result example](launch-examples.md#host-dispatch-result-queued).
[Complete dispatch-result example](launch-examples.md#host-dispatch-result-ready).

The complete original Host wrapper is also accepted; forward it instead of constructing the sample
object. Read `receipt.operation_status.host_client_thread_id`, `host_thread_id`, phase and `changed`.
A queued result becomes `queued`; ready becomes `dispatched`; null, errors or malformed results become
`uncertain`. A retained original response can later be recorded without another creation call.

### dispatch-recover

Implementation: `packages/codex/lib/task-launch.mjs` — `recoverUncalledManagedTaskDispatch`.
[Complete dispatch-recover example](launch-examples.md#host-dispatch-recover-not-called).

Use only after checking the actual call sequence and stopping the previous caller. Empty Host IDs
alone prove nothing. Output retains the request, rotates the attempt ID and has `should_dispatch:false`;
use the new ID in `dispatch-call`. An actual call or unknown outcome follows reconciliation instead.

### dispatch-reconcile

Implementation: `packages/codex/lib/task-launch.mjs` — `reconcileManagedTaskDispatch`.
[Complete dispatch-reconcile example](launch-examples.md#host-dispatch-reconcile-lookup).

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

[Complete bootstrap example](launch-examples.md#host-bootstrap-managed).

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
[Complete cli-provision example](launch-examples.md#host-cli-provision-single).

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
' /private/tmp/taskbelay-primary-provision.json
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
| Core Task is known, or a previous open call may have occurred | The execution session uses `taskbelay_open_task` with only `host` and the original primary `repository_path`, then compares the returned intent/origins/scope with the launch. Resume a matching Task; handle its recovery/blocker before work. |
| That lookup returns `TASK_NOT_FOUND` | Follow the Core uncertain-creation rule: inspect the prior call/result and actual workspace. Create only after establishing that no earlier creation remains pending and the confirmed launch still applies; a mismatch or uncertain result stays stopped. |

If the Host cannot resume a known destination, report the missing operation instead of silently
starting another consumer. Reuse provisioned receipts and worktrees; a launch failure does not
require another `prepare`, branch, worktree or snapshot application. Keep the coordinator available
while it owns an interactive CLI process; report completion or a required user action from actual
destination output rather than treating process startup as completion.

If the destination cannot connect to Core, follow the [connection rule](connection.md#server-handshake)
before opening a Task and the [Host diagnosis guidance](host-lifecycle.md#installation-and-diagnosis-commands).
Report the actual failed step and retained destination. A working Host session alone does not mean
that a Core Task has opened or that business implementation has begun.
