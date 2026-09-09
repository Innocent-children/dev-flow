# Tool results and operation recovery

MCP returns an envelope in `structuredContent` and the same JSON in the text content. Read the
complete envelope once. `ok=true` carries `result`; `ok=false` carries `error` and `recovery`.
The tool's output Schema describes the envelope and the paths used below. Retained record contents
remain Core-owned. A missing/truncated envelope is an uncertain result, not an empty Task.

## Submission response handling

In Codex `functions.exec`, retain the complete tool response before reading success-only fields.
`store` accepts JSON-serializable values: saving `undefined` throws before the error can be displayed.
The session Task cache is a convenience; Core remains the owner of Task state.

For the eight submission tools, use the following block immediately after assigning the awaited
response to `submission_response`. This example only records and presents the response; select the
next operation from the complete Core result after the script returns.

<!-- submission-response-example:start -->
```js
store("submission_response", submission_response);
const envelope = submission_response.structuredContent ??
  JSON.parse(submission_response.content[0].text);
text(envelope);
if (envelope.ok === false) {
  // Keep the previous Task and handle the returned error and recovery instruction.
  exit();
}
if (envelope.ok !== true || envelope.result === null ||
    typeof envelope.result !== "object" || Array.isArray(envelope.result)) {
  throw new Error("Incomplete submission response; inspect the retained original response.");
}
store("task", envelope.result);
```
<!-- submission-response-example:end -->

Validate the complete envelope against the live output Schema before choosing another operation.
The example assumes the documented MCP envelope; malformed or truncated responses keep the Skill's
uncertain-result rules. Terminal success still carries a Task with `current_action=null`.

A complete `ok=false` response uses `error` and `recovery`, including when MCP sets `isError=true`.
Read those fields before extracting a Task or Action. A local caching/formatting exception does not
turn a retained domain error into transport uncertainty. Read the retained original response without
repeating the submission. If it cannot be recovered completely, apply recovery-before-retry.

For a complete rejection with `recovery.action="read_next_action"`, request one guarded current
Action and follow its returned instructions. This read is not permission to replay or correct the
rejected payload; corrections still require the Skill's bounded-correction conditions. A previously
completed IMPLEMENT assessment is not the outcome of a rejected TEST submission. An Action mismatch
remains a stopping condition when recovering a genuinely uncertain submission.

## Success result paths

| Tool | Task | Action and recovery |
| --- | --- | --- |
| `dev_flow_server_info` | None | Server identity and capabilities are in `result`. |
| `dev_flow_open_task` | `result.task` | Read `result.recovery_assessment` before `result.task.current_action`; `result.created` distinguishes creation from resume. |
| `dev_flow_get_task` | `result.task` | Saved records and `result.recovery_assessment`; use `get_next_action` to obtain a fresh workspace guard before new repository work. |
| `dev_flow_get_next_action` | No Task object | Read `result.recovery_assessment` before `result.action`; `result.blocker` and `result.outcome` may stop work. |
| All eight `dev_flow_submit_*` tools, `dev_flow_resolve_blocker`, `dev_flow_recover_action` | `result` | The next Action is `result.current_action`. Handle blocker/outcome first; terminal Actions are null. |
| `dev_flow_cancel_task`, `dev_flow_abandon_task` | `result` | Inspect `result.outcome`; a successful cancellation has `current_cursor=CANCELLED` and no current Action. |
| `dev_flow_prepare_task_relocation` | `result.task` | Retain `result.relocation_id`; the Task has the relocation blocker. |

## Pending Action on resume

A resumed Task can return both its source Action and a recovery assessment because the previous
submission was retained before its Task transition committed. Follow `recovery_assessment.next_advice`
before performing that source Action. Read the saved identity from
`recovery_assessment.operation.action_id`, together with the returned Task ID. `current_action_id`
can identify a later Action and is not the recovery identity.

Use the Skill's recovery-before-retry rules for that saved operation. Do not rebuild or resubmit
its node result. For `read_next_action`, consume the complete guarded Action already returned by
`open_task` or `get_next_action`, after checking blocker/outcome. When the advice came from the
saved-state-only `get_task`, perform one `get_next_action` lookup and consume its result. A completed
assessment may remain present: do not repeat the lookup merely because the same `read_next_action`
advice is returned. An assessment belonging to another Task/operation or an incomplete result stops recovery.

## Uncertain lifecycle results

These operations have their own identities; `dev_flow_recover_action` recovers a retained Action
submission, not a lifecycle operation. User authorization remains in effect, but uncertainty is
resolved through Core reads before another mutation.

| Uncertain operation | Retain before calling | Readback and next step |
| --- | --- | --- |
| New `open_task` | Exact provisioned worktree paths, repository scope and admitted intent | Call `open_task` on the same participating worktree with only `host` and `repository_path`, omitting `new_task` and creation fields. Compare returned intent, origin and scope to the confirmed launch; handle recovery first. A conflict, `TASK_NOT_FOUND`, mismatched identity or uncertain read stops; never create another worktree or substitute a new Task. |
| `cancel_task` | Task ID, current revision and a fresh cancellation `request_id` | Call `get_task`; verify `task.last_operation.operation_id` equals the cancellation request, its kind is `cancel_task`, and the Task is `CANCELLED`. A different terminal outcome is reported as such, not attributed to this call. An active/mismatched result stops for inspection instead of blind cancellation retry. |
| `abandon_task` | Task ID and revision | Call `get_task`; verify the returned terminal outcome and `last_operation.kind=abandon_task` at the expected successor revision. Report another terminal result accurately. An active, conflicting or uncertain result stops; do not invoke Action recovery. |
| `prepare_task_relocation` | Task ID and revision | Call `get_task`; inspect the retained relocation and relocation blocker at the expected successor revision. Reuse only a matching relocation identity/source; otherwise stop before Host handoff. |
| Host creation, handoff or cleanup | Launch/repository identity plus the original Host task/operation marker | Use `host-launch status` and the matching Host query. Preserve `should_dispatch=false` and uncertain phases; never repeat the Host mutation to discover its result. |

Lifecycle readback may legitimately have `recovery_assessment=null`. Inspect its Task/operation
result using this table; a previous Action assessment is not proof of the lifecycle operation.
If readback cannot establish the result, report the precise missing identity/state and stop.

## Task-plan field meanings

`acceptance_indexes` addresses the current Requirements `acceptance_criteria` array from zero.
For criteria `["returns the field", "rejects invalid input"]`, indexes `[0]` and `[1]` identify the
first and second criteria. Each index must be smaller than the current criterion count.

`expected_paths` uses forward slashes and repository-relative paths. `src/api.go` matches that file;
`src/**` covers descendants. `src` is an exact path, not a directory prefix, and `src/*.go` is not a
supported wildcard. Multi-repository paths attach the confirmed key, for example `api::src/**`.
Use only the current Task's declared keys. `dependencies` refers to work-item IDs in the same plan.
