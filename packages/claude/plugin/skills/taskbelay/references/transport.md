# Claude Code transport

Implementation: `packages/claude/.mcp.json`; `packages/claude/lib/runtime.mjs`.

The plugin provides local stdio Core under server taskbelay. Discover actual tools in the current session; plugin tool names use the scoped prefix mcp__plugin_taskbelay-claude_taskbelay__. Do not manufacture tools or strip their real qualifier. Shared examples use raw Core names and host=claude.

Keep the entire MCP result (including structured content/text envelope). Inspect ok, error/recovery, then result. Ordinary submissions return result.current_action; opening returns result.task.current_action; next-action reads return result.action. A display truncation is not loss of a retained complete response. Follow Core bounded correction rules rather than blindly retrying an uncertain write.

Use `taskbelay-claude artifacts collect|prepare` with a closed JSON object on stdin and retain complete stdout. These commands return `ok/result` or `ok/error` and a process exit code.

Every `taskbelay-claude host-launch <operation>` call also reads one closed UTF-8 JSON object from stdin (at most 1 MiB). Use the Host's process/terminal interface to pass the [complete operation input](admission.md#host-launch-requests) as stdin:

```text
executable: taskbelay-claude
arguments: ["host-launch", "inspect"]
stdin: {"request":"Implement the endpoint field.","repositories":[{"key":"primary","repository_path":"/work/project"}]}
```

Use the actual platform's absolute workspace paths in the body. Exit 0 writes the direct Host result as one JSON object on stdout; it has no Core `ok/result` envelope. A rejected call exits nonzero and writes its error to stderr. Retain the original output and exit code. After an uncertain write, read `host-launch status` when the saved `launch_id` is known; if it is unknown, stop for inspection. A missing response does not authorize repeating preparation, session launch, relocation or cleanup. [Host lifecycle](host-lifecycle.md) gives the recovery inputs. Do not confuse Host results with MCP or artifact responses.

A missing/untrusted MCP server or Hook is a real capability gap. Diagnose using status; do not fabricate success or switch Host identity to codex. TASKBELAY_DATA_DIR must be the same canonical existing directory for MCP, Hook and helpers.
