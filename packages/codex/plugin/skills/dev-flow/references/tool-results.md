# Tool results and operation recovery

MCP returns an envelope in `structuredContent` and the same JSON in the text content. Read the
complete envelope once. `ok=true` carries `result`; `ok=false` carries `error` and `recovery`.
The tool's output Schema describes the envelope and the paths used below. Retained record contents
remain Core-owned. A missing/truncated envelope is an uncertain result, not an empty Task.

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
