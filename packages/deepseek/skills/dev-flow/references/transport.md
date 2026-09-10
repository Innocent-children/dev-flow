# DeepSeek tool transport

Implementation: `packages/deepseek/lib/index.mjs` — `activateDeepSeekIntegration`;
`packages/deepseek/lib/tool-names.mjs` — `DEV_FLOW_QUALIFIED_TOOL_NAMES`;
`packages/deepseek/lib/workspace-tool.mjs` — `readCoreTask`.

## Names, arguments and authorization

Call the visible DSH MCP tool whose name is `mcp__dev_flow__` plus the Core raw name. For example,
Core returns submission_tool dev_flow_submit_test; invoke mcp__dev_flow__dev_flow_submit_test with
the complete TEST input. The common examples' marker/tool field remains a Core raw name; the DSH
call name is qualified and every input uses host deepseek.

For a current direct user message such as “/dev-flow continue Task task-example”, use the complete [saved Task read request and response](tool-results.md#read-saved-state-and-the-next-action),
invoked as `mcp__dev_flow__dev_flow_get_task` with `host:"deepseek"`.

Use the actual Task ID, not the sample. Every Core call requires a current user selector even when
the Skill was selected implicitly. The guard derives this from DSH session events and the current
call, including nested calls. DEV_FLOW_SELECTOR_REQUIRED/NO_OPEN_TURN/NO_AGENT stops the call; ask
for the concrete current-turn input. Repository-scope denial requires a valid authorized root,
not an alternative path spelling or a widened Workspace Root.

Implementation: `packages/deepseek/lib/authorization.mjs` — `authorizeDevFlowExecution`, `deriveCurrentTurn`.

## Complete result handling

The integration configures the DSH MCP client to the packaged stdio Core. Read the complete Dev Flow
envelope from the actual DSH tool result. The adapter's readCoreTask reads text blocks and locates the
JSON envelope; it checks the wrapper's isError and envelope.ok before accessing result.task. For
ordinary Agent work retain the original DSH result first, then interpret the shared ok/result/error/
recovery contract. A DSH error wrapper does not erase a complete Core rejection.

The [complete successful Task read](successes/dev_flow_get_task-read.md) includes the resolved
request and every returned field. For a rejection, use the executable
[guard-rejection response](tool-results.md#complete-rejections-and-bounded-corrections), including
its `guard.failures` and the exact `recovery.message` returned by Core.

For that guard rejection read the current qualified get_next_action once. Do not extract result from the
rejection, replay the submission, or attribute an older IMPLEMENT recovery assessment to it. Use
[Core result handling](tool-results.md#submission-response-handling) for success paths and
[uncertain recovery](tool-results.md#uncertain-action-recovery) only if the original outcome is genuinely
missing. A shortened display is not uncertainty when the complete result remains accessible.

DSH supplies its own tool execution/result interfaces. This Skill does not require Codex functions.exec,
store, create_thread or handoff_thread. Do not start another Core server to retrieve a result.
