<!-- Generated from skills/dev-flow/core/recovery-examples.md; edit the shared source and run node scripts/sync-skill-references.mjs. -->

# Recover an Action or resolve a blocker: examples

Read the [recover an action or resolve a blocker instructions](recovery.md) first. Use current values and the live schema; sample IDs and user decisions are never defaults.

Implementation: `internal/mcp/skill_examples_test.go`; `internal/mcp/skill_error_examples_test.go`;
`internal/mcp/skill_success_examples_test.go`.

## dev_flow_recover_action-saved-operation

<!-- example:mcp dev_flow_recover_action saved-operation -->
```json
{
  "host": "codex",
  "task_id": "task-example",
  "action_id": "saved-action"
}
```

Complete successful request and response: [view every returned field](successes/dev_flow_recover_action-saved-operation.md).

Possible error for this request: the supplied `task_id` has no record in the connected Core store.

Implementation: `internal/mcp/tools.go` — `ValidateToolInput`;
`internal/application/service.go` — `loadOwned, mapStoreError`;
`internal/mcp/server.go` — `dispatch`;
`internal/mcp/results.go` — `EncodeError, publicFailure, boundedCorrectionPaths, requestCorrectionPaths`.

<!-- error-case: {"operation":"missing_task"} -->
<!-- example:mcp-output dev_flow_recover_action saved-operation-error -->
```json
{
  "ok": false,
  "request_id": "request-error-example",
  "tool": "dev_flow_recover_action",
  "error": {
    "code": "TASK_NOT_FOUND",
    "message": "The task was not found."
  },
  "recovery": {
    "retry_safe": false,
    "action": "read_task",
    "message": "Confirm the retained Task identity and connected Core instance before reading; do not repeat the same missing lookup unchanged."
  }
}
```

## dev_flow_resolve_blocker-allow_once

<!-- example:mcp dev_flow_resolve_blocker allow_once -->
```json
{
  "host": "codex",
  "task_id": "task-example",
  "action_id": "blocked-action",
  "choice": "allow_once",
  "reason": "The user allows this exact prepared write."
}
```

Complete successful request and response: [view every returned field](successes/dev_flow_resolve_blocker-allow_once.md).

Possible error for this request: `choice:"allow_once"` is submitted with an empty `reason`.

Implementation: `internal/mcp/tools.go` — `ValidateToolInput`;
`internal/mcp/results.go` — `EncodeError, publicFailure, boundedCorrectionPaths, requestCorrectionPaths`.

<!-- error-case: {"operation":"set","path":"reason","value":""} -->
<!-- example:mcp-output dev_flow_resolve_blocker allow_once-error -->
```json
{
  "ok": false,
  "request_id": "request-error-example",
  "tool": "dev_flow_resolve_blocker",
  "error": {
    "code": "INVALID_ARGUMENT",
    "message": "The request does not match the closed Core contract.",
    "details": [
      {
        "path": "reason",
        "rule": "text_not_normalized",
        "message": "text must be non-empty, trimmed and within the declared limit"
      }
    ]
  },
  "recovery": {
    "retry_safe": true,
    "action": "correct_request",
    "message": "Correct only allowed_paths using established values and user decisions. Keep the same tool and existing request identity fields unless listed. Do not add the response request_id to tools that do not accept it. Submit once; ask only for missing facts or decisions, and stop if the corrected request fails.",
    "allowed_paths": [
      "reason"
    ]
  }
}
```

## dev_flow_resolve_blocker-expand_scope

<!-- example:mcp dev_flow_resolve_blocker expand_scope -->
```json
{
  "host": "codex",
  "task_id": "task-example",
  "action_id": "blocked-action",
  "choice": "expand_scope",
  "reason": "The user requested a plan update for this path."
}
```

Complete successful request and response: [view every returned field](successes/dev_flow_resolve_blocker-expand_scope.md).

Possible error for this request: `choice:"expand_scope"` is submitted with an empty `reason`.

Implementation: `internal/mcp/tools.go` — `ValidateToolInput`;
`internal/mcp/results.go` — `EncodeError, publicFailure, boundedCorrectionPaths, requestCorrectionPaths`.

<!-- error-case: {"operation":"set","path":"reason","value":""} -->
<!-- example:mcp-output dev_flow_resolve_blocker expand_scope-error -->
```json
{
  "ok": false,
  "request_id": "request-error-example",
  "tool": "dev_flow_resolve_blocker",
  "error": {
    "code": "INVALID_ARGUMENT",
    "message": "The request does not match the closed Core contract.",
    "details": [
      {
        "path": "reason",
        "rule": "text_not_normalized",
        "message": "text must be non-empty, trimmed and within the declared limit"
      }
    ]
  },
  "recovery": {
    "retry_safe": true,
    "action": "correct_request",
    "message": "Correct only allowed_paths using established values and user decisions. Keep the same tool and existing request identity fields unless listed. Do not add the response request_id to tools that do not accept it. Submit once; ask only for missing facts or decisions, and stop if the corrected request fails.",
    "allowed_paths": [
      "reason"
    ]
  }
}
```

## dev_flow_resolve_blocker-reject

<!-- example:mcp dev_flow_resolve_blocker reject -->
```json
{
  "host": "codex",
  "task_id": "task-example",
  "action_id": "blocked-action",
  "choice": "reject",
  "reason": "The user rejected the write and the retained content has been restored."
}
```

Complete successful request and response: [view every returned field](successes/dev_flow_resolve_blocker-reject.md).

Possible error for this request: `choice:"reject"` is submitted with an empty `reason`.

Implementation: `internal/mcp/tools.go` — `ValidateToolInput`;
`internal/mcp/results.go` — `EncodeError, publicFailure, boundedCorrectionPaths, requestCorrectionPaths`.

<!-- error-case: {"operation":"set","path":"reason","value":""} -->
<!-- example:mcp-output dev_flow_resolve_blocker reject-error -->
```json
{
  "ok": false,
  "request_id": "request-error-example",
  "tool": "dev_flow_resolve_blocker",
  "error": {
    "code": "INVALID_ARGUMENT",
    "message": "The request does not match the closed Core contract.",
    "details": [
      {
        "path": "reason",
        "rule": "text_not_normalized",
        "message": "text must be non-empty, trimmed and within the declared limit"
      }
    ]
  },
  "recovery": {
    "retry_safe": true,
    "action": "correct_request",
    "message": "Correct only allowed_paths using established values and user decisions. Keep the same tool and existing request identity fields unless listed. Do not add the response request_id to tools that do not accept it. Submit once; ask only for missing facts or decisions, and stop if the corrected request fails.",
    "allowed_paths": [
      "reason"
    ]
  }
}
```

## dev_flow_resolve_blocker-verification-or-recovery

<!-- example:mcp dev_flow_resolve_blocker verification-or-recovery -->
```json
{
  "host": "codex",
  "task_id": "task-example",
  "action_id": "blocked-action"
}
```

Complete successful request and response: [view every returned field](successes/dev_flow_resolve_blocker-verification-or-recovery.md).

Possible error for this request: the supplied `task_id` has no record in the connected Core store.

Implementation: `internal/mcp/tools.go` — `ValidateToolInput`;
`internal/application/service.go` — `loadOwned, mapStoreError`;
`internal/mcp/server.go` — `dispatch`;
`internal/mcp/results.go` — `EncodeError, publicFailure, boundedCorrectionPaths, requestCorrectionPaths`.

<!-- error-case: {"operation":"missing_task"} -->
<!-- example:mcp-output dev_flow_resolve_blocker verification-or-recovery-error -->
```json
{
  "ok": false,
  "request_id": "request-error-example",
  "tool": "dev_flow_resolve_blocker",
  "error": {
    "code": "TASK_NOT_FOUND",
    "message": "The task was not found."
  },
  "recovery": {
    "retry_safe": false,
    "action": "read_task",
    "message": "Confirm the retained Task identity and connected Core instance before reading; do not repeat the same missing lookup unchanged."
  }
}
```

## dev_flow_resolve_blocker-history

<!-- example:mcp dev_flow_resolve_blocker history -->
```json
{
  "host": "codex",
  "task_id": "task-example",
  "action_id": "blocked-action",
  "history_resolution": {
    "choice": "accept_current_history",
    "reason": "The user authorized this history change and Core can observe the resulting history."
  }
}
```

Complete successful request and response: [view every returned field](successes/dev_flow_resolve_blocker-history.md).

Possible error for this request: `history_resolution.choice` is valid but `history_resolution.reason` is empty.

Implementation: `internal/mcp/tools.go` — `ValidateToolInput`;
`internal/domain/blocker.go` — `WorkspaceHistoryResolutionInput, Validate`;
`internal/mcp/results.go` — `EncodeError, publicFailure, boundedCorrectionPaths, requestCorrectionPaths`.

<!-- error-case: {"operation":"set","path":"history_resolution.reason","value":""} -->
<!-- example:mcp-output dev_flow_resolve_blocker history-error -->
```json
{
  "ok": false,
  "request_id": "request-error-example",
  "tool": "dev_flow_resolve_blocker",
  "error": {
    "code": "INVALID_ARGUMENT",
    "message": "The request does not match the closed Core contract.",
    "details": [
      {
        "path": "history_resolution.reason",
        "rule": "text_not_normalized",
        "message": "text must be non-empty, trimmed and within the declared limit"
      }
    ]
  },
  "recovery": {
    "retry_safe": false,
    "action": "none",
    "message": "Inspect the reported fields and current schema. This response does not authorize automatic resubmission."
  }
}
```
