# ZCode transport

Implementation: `packages/zcode/.mcp.json`, `packages/zcode/lib/runtime.mjs` and `packages/zcode/hooks/hooks.json`.

The native plugin declares local stdio Core under server key `taskbelay`; ZCode namespaces it as `plugin:taskbelay-zcode:taskbelay`. Discover the tools actually exposed in the current session and use their real qualified names. Do not derive a callable name from a Claude or Codex prefix. Shared examples show Core tool names and `host=zcode`.

Keep the complete MCP result, including any text/structured envelope. Inspect `ok`, error and recovery before reading `result`. Ordinary submissions return `result.current_action`; opening returns `result.task.current_action`; next-action reads return `result.action`. Display truncation does not justify discarding a retained complete response. Follow bounded correction instructions, and recover uncertain writes instead of retrying them blindly.

`taskbelay-zcode artifacts collect|prepare` accepts one closed JSON object on stdin. Retain complete stdout and the exit code; these helpers return Core's `ok/result` or `ok/error` envelope. `host-check pre-file-write|workspace-available` uses its own direct Core response.

Every `taskbelay-zcode host-launch <operation>` call reads one closed UTF-8 JSON object from stdin (at most 1 MiB). Use the Host's process/terminal interface to pass the [complete operation input](admission.md#host-launch-requests) as stdin:

```text
executable: taskbelay-zcode
arguments: ["host-launch", "inspect"]
stdin: {"request":"Implement the endpoint field.","repositories":[{"key":"primary","repository_path":"/work/project"}]}
```

Use the actual platform's absolute workspace paths in the body. Exit 0 writes the direct Host result as one JSON object on stdout, without a Core `ok/result` envelope. A rejected call exits nonzero and writes its error to stderr; a failed `prepare` that saved a launch also reports `launch_id` and `receipt_path` on stderr. Retain the original output and exit code. After an uncertain write, read `host-launch status` when the `launch_id` is known; if it is unknown, stop for inspection. [Host lifecycle](host-lifecycle.md) gives the recovery inputs. Do not confuse these shapes with MCP or artifact responses.

The plugin MCP and Hook invoke `node` with argv using `${ZCODE_PLUGIN_ROOT}/bin/taskbelay-zcode.mjs`. The Hook is a synchronous `process` executor for `Write|Edit`, with no shell interpolation. Standard `hooks/hooks.json` is automatically discovered once. ZCode's documented snake_case Hook aliases supply `cwd`, `hook_event_name`, `tool_name` and `tool_input.file_path`. Core decides whether the path is permitted; a deny returns `hookSpecificOutput.permissionDecision=deny`. Any input/check failure exits 2 so a protected write is blocked. Logs belong on stderr, not protocol stdout.

A missing or untrusted MCP server/Hook is an actual capability gap. Inspect local status and ZCode's plugin/MCP/Hook UI and use a new session after changes. Do not report a package check as a loaded plugin, use project-level hooks (not executed by ZCode), switch Host identity to another Host, or bypass denied writes. `TASKBELAY_DATA_DIR` must agree for MCP, Hook and helpers.
