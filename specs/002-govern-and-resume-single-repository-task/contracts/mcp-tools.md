# Contract: Dev Flow MCP Tools 0.1

## Common Rules

- Transport: local STDIO only.
- Tool inputs are JSON objects with `additionalProperties: false`.
- Unknown or duplicate object-member names are rejected at every nesting level before typed
  dispatch; aliases are not accepted.
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
- `recovery_assessment` is a typed read-success member containing the five-class Core assessment.
  The result envelope's top-level error-only `recovery` member is retry guidance. They are distinct
  names/models and never substitute for one another.

### Tool annotations

Annotations are explicit conservative descriptions, not authorization:

| Tool | read-only | idempotent | destructive | open-world |
| --- | --- | --- | --- | --- |
| `dev_flow_server_info` | true | true | false | false |
| `dev_flow_open_task` | false | false | false | false |
| `dev_flow_get_task` | true | true | false | false |
| `dev_flow_get_next_action` | true | true | false | false |
| `dev_flow_apply_action` | false | false | false | false |
| `dev_flow_cancel_task` | false | false | true | false |

The hints never grant shell, filesystem, Git, database, or network authority. Core state mutation is
not described as read-only, cancellation is conservatively destructive to active task state, and no
tool claims an open-world/network capability.

## Shared `operation_probe` input

`dev_flow_get_task` and `dev_flow_get_next_action` accept this optional closed member:

```json
{
  "operation_id": "original-uncertain-apply-request-id",
  "source_phase": "PLAN",
  "expected_revision": 3,
  "action_id": "action-id",
  "action_kind": "IMPLEMENT_CHANGE",
  "repository_binding_digest": "issuance-sha256",
  "payload": {
    "result": "succeeded",
    "summary": "Implemented the bounded change.",
    "changed_paths": ["internal/example.go"],
    "no_file_changes": false,
    "deviations": [],
    "scope_confirmed": true
  }
}
```

`operation_id` is the original uncertain ApplyAction request ID, not the current read request ID. Host and
task ID come from the enclosing tool input. The ID is available after response loss because the
caller supplied it in the original `dev_flow_apply_action.request_id`; it is not learned only from
the response. `payload` is either the exact original closed payload or
JSON `null` when no result/evidence was retained. No caller payload digest, classification, blocker,
resume/next phase, replacement binding, path observation, source/diff/status, command/output, or
environment data is accepted. Core validates/canonicalizes the payload and computes the operation
digest itself as specified in `contracts/state-machine.md`.

## Shared `recovery_assessment` success result

When non-null, the member has exactly the `RecoveryAssessment` fields defined in `data-model.md`:
classification, operation reference, task/current-action identity, issuance/authoritative/observed
binding digests, repository relation, latest LastOperation relation, operation evidence state,
Core-derived operation payload digest, optional committed proof, `action_retry_safe`, closed `next_advice`, optional
`unblock_condition`, and fresh `observed_at`. It contains no free-form details or filesystem/source/
diff/status/environment/command/output data. The same model is used only by task read and
next-action read; ApplyAction never returns this transient read model.

The result-envelope top-level `recovery` object appears only when `ok=false` and retains its existing
error-retry shape. T062 fixtures must exercise both names separately: five-class success fixtures
use `result.recovery_assessment`; domain-error fixtures use top-level `recovery` and never a
classification.

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
  "task_id": "task-id",
  "operation_probe": null
}
```

### Success Result

Returns a typed object with:

- `task`: the authoritative projection containing immutable contract, phase, revision, repository
  binding, blocker if any, last committed operation summary, evidence, and terminal outcome;
- `recovery_assessment`: null without a probe, otherwise the exact transient model from
  `data-model.md`;
- no private database path or raw event payload.

Without a probe this operation does not observe the repository. With a probe it observes every
phase, including terminal and blocked, and returns either a complete assessment or an existing
bounded error; it never fabricates an unavailable assessment. It never writes an event, increments
revision, changes phase/LastOperation, creates a blocker, or persists the observation/assessment.

## 4. `dev_flow_get_next_action`

### Input

```json
{
  "host": "codex",
  "task_id": "task-id",
  "operation_probe": null
}
```

### Success Result

For active task:

```json
{
  "task_id": "task-id",
  "phase": "PLAN",
  "revision": 3,
  "blocker": null,
  "action": {
    "action_id": "action-id",
    "kind": "IMPLEMENT_CHANGE",
    "repository_binding_digest": "sha256",
    "allowed_effects": ["edit_repository_files"],
    "required_evidence": [],
    "payload_contract": "PLAN",
    "guidance": "Implement only the current plan and report changed paths."
  },
  "outcome": null,
  "recovery_assessment": null
}
```

For a terminal task, returns the outcome and no action/blocker. For a blocked task, returns the
persisted `RESOLVE_BLOCKER` action and Blocker including its machine condition. A non-null probe
produces the same RecoveryAssessment as `get_task`, including on blocked and terminal tasks.

Repeated calls are read-only and return the persisted current action identity. Without a probe there
is no observation and assessment is null. With identical task/probe/repository facts, every
assessment field is stable except `observed_at`; no observation can mutate task state or repository
binding.

## 5. `dev_flow_apply_action`

### Input

```json
{
  "request_id": "request-apply-id",
  "host": "codex",
  "task_id": "task-id",
  "revision": 3,
  "action_id": "action-id",
  "action_kind": "IMPLEMENT_CHANGE",
  "repository_binding_digest": "sha256",
  "payload": {},
  "recovery_apply": null
}
```

The public input schema selects one closed payload branch from `action_kind`; each branch is labeled
with the corresponding Action `payload_contract`. Required-evidence names are not payload field
aliases. `payload` is non-null for every normal apply and `RESOLVE_BLOCKER`.
`request_id` is required and chosen/retained by the caller before dispatch. For a normal apply it is
both response correlation and the operation ID stored in LastOperation/TaskEvent, so a lost response
does not erase the identity needed by a later probe.

`recovery_apply` is normally null/omitted; when present it is exactly
`{"operation_id":"<original uncertain ApplyAction request ID>","source_phase":"<original phase>"}`,
and payload may be null. The enclosing recovery call's `request_id` is response correlation and is
not the probed operation identity. It may equal `recovery_apply.operation_id`; Core neither requires
nor infers recovery from inequality. Its result envelope echoes that current `request_id`, while any
committed LastOperation.OperationID and TaskEvent.RequestID use `recovery_apply.operation_id`. No
other recovery field is accepted.

The five identity fields are the originally issued `task_id`, revision, action ID, action kind, and
repository-binding digest. The Core re-observes before commit. Ordinary non-implementation actions
require an exact binding match. `IMPLEMENT_CHANGE` may update only the worktree fingerprint while
repository/common-directory identity, branch/detached, and HEAD/unborn remain exact; its accepted
fresh observation becomes the next revision's binding. `RESOLVE_BLOCKER` succeeds only through
Feature 002's exact `restore_issuance_binding` condition and may return only to its stored
`resume_phase`; it does not adopt changed worktree or identity state.

`PREPARE_HANDOFF` is shared by REVIEW and HANDOFF, so the public schema exposes one merged wire
branch containing their existing result vocabulary. The adapter performs the existing ordinary
no-probe Application task read to select the authoritative sealed source-Phase payload type. That
read does not observe Git or write state; the following ApplyAction still applies the exact
revision, action, binding, workflow, recovery, and terminal checks.

### Success Result

Normal mutation returns the committed task projection and next action or terminal outcome.
Explicit recovery apply returns the same ordinary ApplyAction result shape; it never embeds the
read-only RecoveryAssessment:

- `completed_and_recorded`: current committed read-back, zero writes;
- `not_started`: current task, zero writes; retry safety is obtained from the required preceding
  read assessment;
- `completed_but_unrecorded`: one normal transition/evidence transaction;
- current-source `partially_completed` or `conflicting`: one transaction entering `BLOCKED` with a
  Core-generated condition and `RESOLVE_BLOCKER` action;
- superseded source without exact commit proof: the existing revision/action error, zero writes.

The Core independently reruns classification during explicit recovery apply rather than trusting
the preceding read, but returns only the resulting Task projection. Five-class objects remain
inside successful read results and never appear in ApplyAction or the top-level error-only
`recovery` guidance object.

### Mandatory Failure Behavior

- stale revision → `REVISION_CONFLICT`;
- stale/wrong action → `ACTION_STALE`;
- unauthorized repository drift → `REPOSITORY_DRIFT`;
- unknown payload field → `INVALID_ARGUMENT`;
- duplicate object member → `INVALID_ARGUMENT`;
- budget violation → `VERIFICATION_BUDGET_EXCEEDED`;
- terminal task → `TASK_TERMINAL`.

For `RESOLVE_BLOCKER`, stale blocker/condition also maps to `ACTION_STALE`, stale caller observation
maps to `REPOSITORY_DRIFT`, and wrong phase/payload/result or nil/typed-nil maps to
`INVALID_ARGUMENT`. The exact payload and transaction effects are authoritative in
`contracts/state-machine.md`.

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
Any loaded persisted binding that fails the Repository digest verifier returns
`STORAGE_UNAVAILABLE`; a fresh observer binding that fails it returns `INTERNAL_ERROR`. The pure
persisted check does not count as repository observation. Neither case returns
`recovery_assessment` or writes state.
