# Codex tool transport

Implementation: `internal/mcp/results.go` — `Envelope`, `EncodeSuccess`, `EncodeError`;
`internal/mcp/output_schemas.go` — `outputDescription`.

Resolve the visible Codex tool for the Core raw name. For example, this session may expose
`tools.mcp__dev_flow__dev_flow_get_task`. The Core example's JSON is the complete tool argument;
Core tool names are not shell commands. Set `host="codex"`.

```js
const response = await tools.mcp__dev_flow__dev_flow_get_task({host: "codex", task_id: current_task_id});
store("core_response", response);
text(response.structuredContent ?? JSON.parse(response.content[0].text));
```

## Retain submission responses

Implementation: `internal/mcp/results.go` — `EncodeSuccess, EncodeError`.
Implementation: `internal/mcp/output_schemas.go` — `outputDescription`.

All eight submit tools, resolve_blocker and recover_action return the Task directly in `result`.
In `functions.exec`, the following example retains full input before accessing success-only fields.
On a Host without these orchestration helpers, retain/read the complete native tool result in the same
order; `store` is a Host convenience, not a Dev Flow API or a required production dependency.

<!-- submission-response-example:start -->
```js
store("submission_response", submission_response);
const envelope = submission_response.structuredContent ??
  JSON.parse(submission_response.content[0].text);
if (envelope.ok === false) {
  text(envelope);
  exit();
}
if (envelope.ok !== true || envelope.result === null ||
    typeof envelope.result !== "object" || Array.isArray(envelope.result)) {
  throw new Error("Incomplete submission response; inspect the retained original response.");
}
store("task", envelope.result);
text({ok: true, task_id: envelope.result.task_id, revision: envelope.result.revision,
  current_cursor: envelope.result.current_cursor, blocker: envelope.result.blocker,
  outcome: envelope.result.outcome});
```
<!-- submission-response-example:end -->

Read the complete saved `task.current_action` when constructing the next call, including all its
returned transitions, method steps and digests. The concise display above does not remove these values.
A complete committed terminal Task has `current_action:null`. Check the original envelope against the
live output contract before choosing another operation. A local cache/formatting exception or a
truncated display does not make an already retained complete result uncertain. Retrieve the original
object or read it in bounded parts; recover only if the original result itself cannot be established.

Use the shared [result contract](tool-results.md) for successful paths, errors and recovery.
