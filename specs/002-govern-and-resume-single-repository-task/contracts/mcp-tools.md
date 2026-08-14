# Contract: Dev Flow MCP Tools 0.1

## Common Rules

- Transport: local STDIO only.
- Tool inputs are JSON objects with `additionalProperties: false`.
- String, array, and aggregate byte limits from Core Limits 0.1 are enforced before domain dispatch;
  the result envelope is rejected before write if its encoded size exceeds that table.
- Every result uses `result-envelope.schema.json`.
- The envelope's `schema_version` identifies the Dev Flow result contract. MCP wire-version
  negotiation belongs to the official SDK and is not persisted as task or product workflow state.
- Tool annotations are descriptive only and do not grant operating-system authority.
- No tool accepts a shell command, arbitrary environment, database path, or output file path.
- `host` accepts only `codex` or `deepseek`.
- The MCP input decoder rejects unknown fields. Domain receives typed values and does not parse
  arbitrary JSON.

## 1. `dev_flow_server_info`

### Input

```json
{}
```

### Success Result

```json
{
  "product": "dev-flow",
  "version": "${VERSION}",
  "schema_version": 1,
  "transport": "stdio",
  "health": "ready",
  "supported_hosts": ["codex", "deepseek"],
  "tools": [
    "dev_flow_server_info",
    "dev_flow_open_task",
    "dev_flow_get_task",
    "dev_flow_get_next_action",
    "dev_flow_apply_action",
    "dev_flow_cancel_task"
  ]
}
```

No task data or filesystem paths are returned.

## 2. `dev_flow_open_task`

Creates a new task or resumes the unique compatible active task owned by the requesting host.

### Input

```json
{
  "host": "codex",
  "repository_path": "/absolute/or/resolvable/path",
  "new_task": {
    "goal": "Implement the requested behavior",
    "scope": ["bounded item"],
    "out_of_scope": ["explicit exclusion"],
    "acceptance_criteria": ["observable criterion"],
    "verification_budget": {
      "level": "targeted",
      "max_automatic_commands": 2,
      "allow_full_suite": false,
      "allow_manual_handoff": true
    }
  }
}
```

`new_task` may be omitted only to resume. When an active compatible task exists:

- same host + omitted `new_task`: resume;
- same host + exact normalized contract: resume;
- same host + different contract: `ACTIVE_TASK_CONFLICT`;
- different host: `HOST_OWNERSHIP_CONFLICT`.

A valid Git repository with no commits is accepted with `head: null`, `unborn: true`, and the branch
reported by Git when present.

### Success Result

Returns:

- task summary;
- `created` boolean;
- current action or terminal outcome;
- exact revision;
- repository binding.

## 3. `dev_flow_get_task`

### Input

```json
{
  "host": "codex",
  "task_id": "task-id"
}
```

### Success Result

Returns the authoritative task projection:

- immutable contract;
- phase;
- revision;
- repository binding;
- blocker if any;
- last committed operation summary;
- evidence summaries;
- outcome if terminal;
- no private database path or raw event payload.

This operation may freshly observe and report recovery/drift guidance, but never writes an event,
increments revision, changes phase, creates a blocker, or persists the observation.

## 4. `dev_flow_get_next_action`

### Input

```json
{
  "host": "codex",
  "task_id": "task-id"
}
```

### Success Result

For active task:

```json
{
  "task_id": "task-id",
  "phase": "PLAN",
  "revision": 3,
  "action": {
    "action_id": "action-id",
    "kind": "IMPLEMENT_CHANGE",
    "repository_binding_digest": "sha256",
    "allowed_effects": ["edit_repository_files"],
    "required_evidence": [],
    "payload_schema": {},
    "guidance": "Implement only the current plan and report changed paths."
  }
}
```

For terminal task, returns the outcome and no action.

Repeated calls are read-only and return the persisted current action identity. Fresh observation may
add recovery guidance but cannot mutate task state or repository binding.

## 5. `dev_flow_apply_action`

### Input

```json
{
  "host": "codex",
  "task_id": "task-id",
  "revision": 3,
  "action_id": "action-id",
  "action_kind": "IMPLEMENT_CHANGE",
  "repository_binding_digest": "sha256",
  "payload": {}
}
```

`payload` must match the phase-specific closed schema returned by
`dev_flow_get_next_action`.

The five identity fields are the originally issued `task_id`, revision, action ID, action kind, and
repository-binding digest. The Core re-observes before commit. Ordinary non-implementation actions
require an exact binding match. `IMPLEMENT_CHANGE` may update only the worktree fingerprint while
repository/common-directory identity, branch/detached, and HEAD/unborn remain exact; its accepted
fresh observation becomes the next revision's binding. `RESOLVE_BLOCKER` may accept a new binding
only under the blocker's stored condition and may return only to its stored `resume_phase`.

### Success Result

Returns the committed task projection and next action or terminal outcome.

### Mandatory Failure Behavior

- stale revision → `REVISION_CONFLICT`;
- stale/wrong action → `ACTION_STALE`;
- unauthorized repository drift → `REPOSITORY_DRIFT`;
- unknown payload field → `INVALID_ARGUMENT`;
- budget violation → `VERIFICATION_BUDGET_EXCEEDED`;
- terminal task → `TASK_TERMINAL`.

No failed result may partially write task/event/claim data.

## 6. `dev_flow_cancel_task`

### Input

```json
{
  "host": "codex",
  "task_id": "task-id",
  "revision": 4,
  "reason": "User explicitly cancelled the task"
}
```

### Success Result

Returns the CANCELLED outcome, released-claim status, and retained task ID.

Cancellation never deletes task data or repository content.

## Stable Error Codes

```text
INVALID_ARGUMENT
NOT_GIT_REPOSITORY
TASK_NOT_FOUND
ACTIVE_TASK_CONFLICT
HOST_OWNERSHIP_CONFLICT
REVISION_CONFLICT
ACTION_STALE
REPOSITORY_DRIFT
VERIFICATION_BUDGET_EXCEEDED
TASK_BLOCKED
TASK_TERMINAL
SCHEMA_UNSUPPORTED
STORAGE_UNAVAILABLE
INTERNAL_ERROR
```

Errors may add bounded details defined by the code, but adapters must branch on `code`, not message.
