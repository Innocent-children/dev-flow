# dev_flow_add_experience_note: experience_note

Implementation: `internal/mcp/experience.go` — `dispatchExperience`; `internal/application/experience.go`; `internal/store/experience.go`.

Complete successful call from the documented scenario. The repository observer is a fixed test fixture;
Host authorization and Git operations are not executed here. Runtime IDs and timestamps use stable
example values, and operation digests use a sample digest. All other fields are compared with the
actual Core response. The resolved request below shows the current Task values substituted for the
identity and confirmation placeholders in the calling reference.

Resolved request:

<!-- example:resolved-mcp dev_flow_add_experience_note experience_note -->
```json
{
  "expected_revision": 1,
  "experience_id": "experience-example",
  "host": "{{host}}",
  "request_id": "experience-note",
  "task_id": "task-example",
  "user_note": "I will check snapshot ownership before putting auxiliary data in the Task."
}
```

Complete response:

<!-- example:mcp-success dev_flow_add_experience_note experience_note -->
```json
{
  "ok": true,
  "request_id": "request-success-example",
  "result": {
    "change_reason": "User supplement",
    "content": {
      "applicability": "Auxiliary reasoning that does not change task workflow.",
      "basis": "The existing Action compares its saved Task revision.",
      "cause": "Auxiliary notes must not share the workflow snapshot revision.",
      "next_checks": "Check which data belongs in the Action snapshot before adding a write.",
      "problem": "An Action can become stale when its Task revision changes.",
      "references": [
        {
          "kind": "discussion",
          "locator": "Current task architecture discussion",
          "summary": "Task revision belongs to workflow operations."
        }
      ],
      "repository_keys": [
        "primary"
      ],
      "resolution": "Save task experience with its own revision.",
      "status": "supported",
      "title": "Independent experience records"
    },
    "content_digest": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "created_at": "2026-09-10T00:00:00Z",
    "experience_id": "experience-example",
    "projects": [
      {
        "group": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        "key": "primary",
        "path": "/work/tasks/endpoint-field"
      }
    ],
    "revision": 2,
    "stage": "COMPREHENSION_REVIEW",
    "task_id": "task-example",
    "updated_at": "2026-09-10T00:00:00Z",
    "updated_stage": "COMPREHENSION_REVIEW",
    "user_notes": [
      {
        "created_at": "2026-09-10T00:00:00Z",
        "text": "I will check snapshot ownership before putting auxiliary data in the Task."
      }
    ]
  },
  "tool": "dev_flow_add_experience_note"
}
```
