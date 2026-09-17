<!-- Generated from skills/dev-flow/core/successes/dev_flow_export_experiences-experience_export.md; edit the shared source and run node scripts/sync-skill-references.mjs. -->

# dev_flow_export_experiences: experience_export

Implementation: `internal/mcp/experience.go` — `dispatchExperience`; `internal/application/experience.go`; `internal/store/experience.go`.

Complete successful call from the documented scenario. The repository observer is a fixed test fixture;
Host authorization and Git operations are not executed here. Runtime IDs and timestamps use stable
example values, and operation digests use a sample digest. All other fields are compared with the
actual Core response. The resolved request below shows the current Task values substituted for the
identity and confirmation placeholders in the calling reference.

Resolved request:

<!-- example:resolved-mcp dev_flow_export_experiences experience_export -->
```json
{
  "host": "deepseek",
  "task_id": "task-example"
}
```

Complete response:

<!-- example:mcp-success dev_flow_export_experiences experience_export -->
```json
{
  "ok": true,
  "request_id": "request-success-example",
  "result": {
    "error": "Could not export experiences. Saved data is intact; retry export.",
    "exported_generation": 0,
    "generation": 1,
    "path": "",
    "task_id": "task-example"
  },
  "tool": "dev_flow_export_experiences"
}
```
