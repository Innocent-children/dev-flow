# ZCode transport

Implementation: `packages/zcode/.mcp.json`, `packages/zcode/lib/runtime.mjs` and `packages/zcode/hooks/hooks.json`.

The native plugin declares local stdio Core under server key `dev-flow`; ZCode namespaces it as `plugin:dev-flow-zcode:dev-flow`. Discover the tools actually exposed in the current session and use their real qualified names. Do not derive a callable name from a Claude or Codex prefix. Shared examples show Core tool names and `host=zcode`.

Keep the complete MCP result, including any text/structured envelope. Inspect `ok`, error and recovery before reading `result`. Ordinary submissions return `result.current_action`; opening returns `result.task.current_action`; next-action reads return `result.action`. Display truncation does not justify discarding a retained complete response. Follow bounded correction instructions, and recover uncertain writes instead of retrying them blindly.

`dev-flow-zcode artifacts collect|prepare` accepts one closed JSON object on stdin. Retain complete stdout and the exit code; these helpers return Core's `ok/result` or `ok/error` envelope. `host-check pre-file-write|workspace-available` uses its own direct Core response. `host-launch` returns a direct Host result and exits nonzero on rejection. Do not confuse these shapes.

The plugin MCP and Hook invoke `node` with argv using `${ZCODE_PLUGIN_ROOT}/bin/dev-flow-zcode.mjs`. The Hook is a synchronous `process` executor for `Write|Edit`, with no shell interpolation. Standard `hooks/hooks.json` is automatically discovered once. ZCode's documented snake_case Hook aliases supply `cwd`, `hook_event_name`, `tool_name` and `tool_input.file_path`. Core decides whether the path is permitted; a deny returns `hookSpecificOutput.permissionDecision=deny`. Any input/check failure exits 2 so a protected write is blocked. Logs belong on stderr, not protocol stdout.

A missing or untrusted MCP server/Hook is an actual capability gap. Inspect local status and ZCode's plugin/MCP/Hook UI and use a new session after changes. Do not report a package check as a loaded plugin, use project-level hooks (not executed by ZCode), switch Host identity to another Host, or bypass denied writes. `DEV_FLOW_DATA_DIR` must agree for MCP, Hook and helpers.
