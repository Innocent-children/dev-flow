<!-- Generated from skills/dev-flow/core/successes/dev_flow_server_info-handshake.md; edit the shared source and run node scripts/sync-skill-references.mjs. -->

# dev_flow_server_info: handshake

Implementation: `internal/mcp/server.go` — `dispatch`; `internal/application/submit_action.go` — `SubmitAction`.

Complete successful call from the documented scenario. The repository observer is a fixed test fixture;
Host authorization and Git operations are not executed here. Runtime IDs and timestamps use stable
example values, and operation digests use a sample digest. All other fields are compared with the
actual Core response. The resolved request below shows the current Task values substituted for the
identity and confirmation placeholders in the calling reference.

Resolved request:

<!-- example:resolved-mcp dev_flow_server_info handshake -->
```json
{}
```

Complete response:

<!-- example:mcp-success dev_flow_server_info handshake -->
```json
{
  "ok": true,
  "request_id": "request-success-example",
  "result": {
    "health": "ready",
    "host_preferences": {
      "codex": {
        "codebase_memory": false
      },
      "deepseek": {
        "codebase_memory": false
      }
    },
    "method_profiles": [
      "plain",
      "spec-kit",
      "openspec"
    ],
    "product": "dev-flow",
    "supported_hosts": [
      "codex",
      "deepseek"
    ],
    "supported_processes": [
      {
        "definition_digest": "eb35dcd623a1673abf768209fd4e7cb07979afb31b102c527bd4066b74a24430",
        "new_task_supported": true,
        "process_id": "standard-development"
      }
    ],
    "tools": [
      "dev_flow_server_info",
      "dev_flow_open_task",
      "dev_flow_get_task",
      "dev_flow_get_next_action",
      "dev_flow_submit_requirements",
      "dev_flow_submit_design",
      "dev_flow_submit_tasks",
      "dev_flow_submit_implementation",
      "dev_flow_submit_test",
      "dev_flow_submit_comprehension",
      "dev_flow_submit_refactor",
      "dev_flow_submit_delivery",
      "dev_flow_prepare_task_relocation",
      "dev_flow_resolve_blocker",
      "dev_flow_recover_action",
      "dev_flow_cancel_task",
      "dev_flow_abandon_task"
    ],
    "transport": "stdio",
    "version": "0.14.0"
  },
  "tool": "dev_flow_server_info"
}
```
