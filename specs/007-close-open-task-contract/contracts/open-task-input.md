# Contract: `dev_flow_open_task` Input

## Closed request

```json
{
  "host": "codex",
  "repository_path": "/absolute/repository",
  "new_task": {
    "goal": "Return the requested field from the bounded endpoint.",
    "scope": ["Update the endpoint response"],
    "out_of_scope": ["Change unrelated endpoints"],
    "acceptance_criteria": ["The response contains the requested field"],
    "verification_budget": {
      "level": "targeted",
      "max_automatic_commands": 4,
      "allow_full_suite": false,
      "allow_manual_handoff": true
    }
  }
}
```

The request and both nested objects are closed. `new_task` may be omitted or null only for resume. The accepted verification levels are exactly `minimal`, `targeted`, and `full`.

## Required regression cases

| Case | Expected result |
|---|---|
| Valid request above | Contract validation succeeds |
| `level: "focused"` | `INVALID_ARGUMENT`, no task mutation |
| `scope` encoded as one string | `INVALID_ARGUMENT`, no task mutation |
| `out_of_scope` encoded as one string | `INVALID_ARGUMENT`, no task mutation |
| `acceptance_criteria` encoded as one string | `INVALID_ARGUMENT`, no task mutation |
| `new_task` omitted or null for resume | Contract validation succeeds |

The public error envelope remains unchanged and does not expose private paths or internal decoder details.
