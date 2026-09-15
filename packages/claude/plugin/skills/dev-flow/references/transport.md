# Claude Code transport

Implementation: packages/claude/.mcp.json; packages/claude/lib/runtime.mjs.

The plugin provides local stdio Core under server dev-flow. Discover actual tools in the current session; plugin tool names use the scoped prefix mcp__plugin_dev-flow-claude_dev-flow__. Do not manufacture tools or strip their real qualifier. Shared examples use raw Core names and host=claude.

Keep the entire MCP result (including structured content/text envelope). Inspect ok, error/recovery, then result. Ordinary submissions return result.current_action; opening returns result.task.current_action; next-action reads return result.action. A display truncation is not loss of a retained complete response. Follow Core bounded correction rules rather than blindly retrying an uncertain write.

Use dev-flow-claude artifacts collect/prepare with a closed JSON object on stdin and retain complete stdout. These commands return ok/result or ok/error and a process exit code. host-launch commands instead return their direct result and exit nonzero on rejection. Never confuse those wrappers.

A missing/untrusted MCP server or Hook is a real capability gap. Diagnose using status; do not fabricate success or switch Host identity to codex. DEV_FLOW_DATA_DIR must be the same canonical existing directory for MCP, Hook and helpers.

