<!-- Generated from skills/dev-flow/core/tool-results.md; edit the shared source and run node scripts/sync-skill-references.mjs. -->

# Core calls, result handling and recovery

Implementation: `internal/mcp/schemas.go` — `buildCatalog`;
`internal/mcp/tools.go` — `ValidateToolInput`;
`internal/mcp/results.go` — `Envelope`, `EncodeSuccess`, `EncodeError`;
`internal/mcp/output_schemas.go` — `toolOutputSchema`.

## MCP transport and value sources

Use the actual tool name and result retention procedure in [Host transport](transport.md).
Names in this reference and example markers are Core raw names. The complete example arguments use
`host="deepseek"`; the Host adapter determines the callable name, wrapper and current-turn permission.
Inputs are closed JSON objects. Success envelopes have ok/request_id/tool/result; error envelopes
have ok/request_id/tool/error/recovery and no successful result. The output tool field remains the
Core raw name even when the Host calls a qualified name.

`request_id` in an envelope is Core's response identity; the cancellation input supplies its own
request_id. `result.recovery_assessment` concerns retained Action operations and is distinct from
error-envelope `recovery`. Output examples labeled projection show only the fields being discussed;
retain the complete real Task/Action before choosing another operation.

## Server handshake

Implementation: `internal/mcp/server.go` — `dispatch`;
`internal/mcp/results.go` — `ServerInfoResult`;
`internal/mcp/schemas.go` — `ToolNames`.

After admission/provisioning or on explicit resume, the first Core call is `dev_flow_server_info`:

<!-- example:mcp dev_flow_server_info handshake -->
```json
{}
```

Read `result.product`, `version`, `transport`, `health`, `supported_hosts`, `supported_processes`,
`method_profiles`, `tools`, and `host_preferences.deepseek.codebase_memory`. Require product `dev-flow`,
canonical version, stdio/ready, deepseek support, one supported `standard-development` process with a
canonical definition digest and `new_task_supported:true`, profiles plain/spec-kit/openspec, and a
boolean codebase-memory preference. Core/package versions are independent.

The complete tool-name set is:

- `dev_flow_server_info`
- `dev_flow_open_task`
- `dev_flow_get_task`
- `dev_flow_get_next_action`
- `dev_flow_submit_requirements`
- `dev_flow_submit_design`
- `dev_flow_submit_tasks`
- `dev_flow_submit_implementation`
- `dev_flow_submit_test`
- `dev_flow_submit_comprehension`
- `dev_flow_submit_refactor`
- `dev_flow_submit_delivery`
- `dev_flow_prepare_task_relocation`
- `dev_flow_resolve_blocker`
- `dev_flow_recover_action`
- `dev_flow_cancel_task`
- `dev_flow_abandon_task`

On success proceed without a handshake approval question. On absent/truncated original data, unhealthy
or incompatible identity/catalog, stop before opening a Task and report the exact failed condition.
Installation repair follows [Host diagnosis](host-lifecycle.md#installation-and-diagnosis-commands)
after appropriate user authority; do not start another
MCP server or inspect binaries to bypass the result. Setup owns installed-resource/version checks.

## Open or resume a Task

Implementation: `internal/application/open_task.go` — `OpenTask`.

For new creation, all receipts/worktrees must be verified first. Copy the complete verified repository descriptor from [Host admission](admission.md)
into the repository members. `new_task.request` is the admitted request string; scope/exclusions/
known acceptance are arrays derived from the actual request. Profile follows explicit plain, Spec Kit
or OpenSpec intent, otherwise plain. No verification budget is selected at creation.

<!-- example:mcp dev_flow_open_task create -->
```json
{
  "host": "deepseek",
  "repository_path": "/work/tasks/endpoint-field",
  "workspace_origin": {
    "mode": "dedicated_worktree",
    "source_type": "local",
    "carry_changes": false,
    "remote_name": "",
    "base_branch": "main",
    "base_commit": "1111111111111111111111111111111111111111",
    "task_branch": "task/endpoint-field",
    "provisioning_receipt_id": "receipt-example"
  },
  "new_task": {
    "request": "Return the requested field from the endpoint.",
    "initial_scope": [
      "Endpoint response"
    ],
    "initial_out_of_scope": [
      "Other endpoints"
    ],
    "known_acceptance_criteria": [
      "The response contains the requested field."
    ],
    "method_profile": "plain"
  }
}
```

For a complete confirmed multi-repository Scope, the call includes both origins. These fields come
from one verified Host launch descriptor after both worktrees are provisioned and writable:

<!-- example:mcp dev_flow_open_task multiple -->
```json
{
  "host": "deepseek",
  "repository_path": "/work/tasks/api",
  "primary_repository_key": "api",
  "workspace_origin": {
    "mode": "dedicated_worktree",
    "source_type": "local",
    "carry_changes": false,
    "remote_name": "",
    "base_branch": "main",
    "base_commit": "1111111111111111111111111111111111111111",
    "task_branch": "task/endpoint-field",
    "provisioning_receipt_id": "receipt-api"
  },
  "additional_repositories": [
    {
      "key": "web",
      "repository_path": "/work/tasks/web",
      "workspace_origin": {
        "mode": "dedicated_worktree",
        "source_type": "local",
        "carry_changes": false,
        "remote_name": "",
        "base_branch": "main",
        "base_commit": "1111111111111111111111111111111111111111",
        "task_branch": "task/endpoint-field",
        "provisioning_receipt_id": "receipt-web"
      }
    }
  ],
  "new_task": {
    "request": "Return the field and show it in the client.",
    "initial_scope": [
      "API response",
      "Client rendering"
    ],
    "initial_out_of_scope": [
      "Other endpoints"
    ],
    "known_acceptance_criteria": [
      "The client shows the response field."
    ],
    "method_profile": "plain"
  }
}
```

For an existing Task, return to its original worktree instance, preserve its immutable Scope/profile,
and omit all creation members:

<!-- example:mcp dev_flow_open_task resume -->
```json
{
  "host": "deepseek",
  "repository_path": "/work/tasks/endpoint-field"
}
```

Success projection: `{"ok":true,"result":{"created":false,"task":{"task_id":"task-example",
"revision":4,"current_cursor":"IMPLEMENT","current_action":{"action_id":"action-example"}},
"recovery_assessment":null}}`. Handle recovery before `result.task.current_action`. `created:true`
identifies creation; neither value permits another Task for the same launch.

Creation errors such as `ACTIVE_TASK_CONFLICT`, `WORKTREE_PROVISIONING_REQUIRED`, ownership failure or
unavailable workspace stop. After an uncertain creation, call the resume example on the same worktree;
compare returned intent/origin/scope with the confirmed launch. `TASK_NOT_FOUND`, mismatch or another
uncertain result stops for inspection. A recreated directory is not the original worktree instance.

## Read saved state and the next Action

Implementation: `internal/application/next_action.go` — `GetNextAction`.
Implementation: `internal/mcp/server.go` — `dispatch`.

`dev_flow_get_task` reads saved records. Use the Task ID from a complete earlier result:

<!-- example:mcp dev_flow_get_task read -->
```json
{
  "host": "deepseek",
  "task_id": "task-example"
}
```

Success projection: `{"ok":true,"result":{"task":{"task_id":"task-example","revision":4},
"recovery_assessment":null}}`. Read the full `result.task`, including baselines, verification,
`test.evidence_ids`, evidence, blocker, outcome and last_operation. Do not fabricate `operation_probe`;
ordinary reads automatically return the retained assessment.

Before new repository work following a saved-state read, obtain the guarded Action:

<!-- example:mcp dev_flow_get_next_action guarded-read -->
```json
{
  "host": "deepseek",
  "task_id": "task-example"
}
```

Success projection: `{"ok":true,"result":{"action":{"action_id":"action-example"},
"blocker":null,"outcome":null,"recovery_assessment":null}}`. This operation observes Git and may
persist a workspace blocker or invalidate old verification; it is not a pure saved-state read.
Handle recovery, blocker and outcome before action. If the returned assessment says `read_next_action`,
consume this complete guarded Action once; do not keep querying because the completed assessment remains.

## Submission response handling

Implementation: `internal/mcp/results.go` — `EncodeSuccess`, `EncodeError`;
`internal/mcp/output_schemas.go` — `outputDescription`.

All eight submit tools, resolve_blocker and recover_action return the Task directly in result.
Retain the complete original response using [Host transport](transport.md), then check ok before
reading success fields. An error has no successful Task. A committed terminal Task has current_action
null. Read the complete current_action when constructing the next call, including all its transitions,
method steps and digests. Validate against the live output contract before choosing another operation.

A local caching/formatting exception or a shortened display does not make an already retained complete
result uncertain. Retrieve that original object or read it in bounded parts; use operation recovery
only when the original result itself cannot be established. Complete domain errors keep their returned
error/recovery instruction even when the Host marks the call as an error.

## Complete rejections and bounded corrections

Implementation: `internal/mcp/results.go` — `EncodeError, boundedCorrectionPaths`.

Example rejection (an error envelope, not a successful Task):

<!-- example:mcp-output dev_flow_submit_test guard-rejection -->
```json
{
  "ok": false,
  "request_id": "request-example",
  "tool": "dev_flow_submit_test",
  "error": {
    "code": "TRANSITION_NOT_ALLOWED",
    "message": "The transition guard was not satisfied.",
    "guard": {
      "guard_id": "implementation_failure_identified",
      "failures": [
        {
          "path": "node_result.findings",
          "rule": "problem_findings_present",
          "message": "Problem findings must be present."
        }
      ]
    }
  },
  "recovery": {
    "retry_safe": false,
    "action": "read_next_action",
    "message": "Read the current Action and its transitions."
  }
}
```

Follow the returned `recovery.action`, not the sample's prose. `read_next_action` permits one guarded
read, not replay of the rejected input. The previous IMPLEMENT operation is not the outcome of a
rejected TEST submission. `retry_safe:false`/`action:none` stops. Internal errors and uncertain writes
never authorize payload guessing.

A correctable zero-write rejection explicitly has `action:correct_current_action`, `retry_safe:true`
and `allowed_paths`. Example projection:

```json
{"ok":false,"error":{"code":"INVALID_ARGUMENT","details":[{"path":"node_result.findings","rule":"required_member_missing","message":"A required member is missing."}]},"recovery":{"retry_safe":true,"action":"correct_current_action","message":"Correct only the listed fields.","allowed_paths":["node_result.findings"]}}
```

Confirm the same current Action/tool, reread its schema, and change only listed fields from facts
already established. For a failed implementation check, `findings` describes the actual defect; failed
check names alone do not fill it. A missing user verdict requires the user's answer. If the error lists
`repository_paths`/`artifact_manifest_incomplete`, collect/classify/prepare again and change only the
allowed artifact members. Preserve node meaning, transition and method conclusions.

Host policy permits one corrected submission, followed by a stop if it fails again. Core supplies the
zero-write decision and allowed fields; it does not count this Host retry limit. Report exact field,
rule and failure without displaying private submitted values. See the complete
[Test failure example](nodes/test.md#tests_failed_implementation) for the corrected call shape.

## Uncertain Action recovery

Implementation: `internal/application/recover_action.go` — `RecoverAction`.

If an ordinary submit/resolve/recover response is genuinely missing or malformed, retain the original
Task/Action IDs and first call the saved-state `dev_flow_get_task` example. On fresh resume use
`recovery_assessment.operation.action_id`, not a possibly newer `current_action.action_id`.
A missing/mismatched/incomplete recovery assessment stops. Core retains the normalized payload;
the Host does not rebuild it.

Recovery response projection:

```json
{"ok":true,"result":{"task":{"task_id":"task-example","revision":4},"recovery_assessment":{"task_revision":4,"operation":{"action_id":"saved-action","operation_id":"saved-operation","expected_revision":4},"next_advice":"submit_recovery_apply"}}}
```

| Returned next_advice | Next interaction |
| --- | --- |
| `retry_current_action` | Re-perform the current Action's allowed repository work, then recover the saved Action. |
| `submit_recovery_apply` | Recover the saved Action immediately. |
| `read_next_action` | Consume the complete guarded Action already returned by open/next-action; after get_task obtain one get_next_action. |
| `resolve_blocker` | Restore the required repository condition, then resolve the current blocked Action. |
| `stop_for_repository_drift` | Report the retained condition and stop. |

Recovery call example for either of the first two returned instructions:

<!-- example:mcp dev_flow_recover_action saved-operation -->
```json
{
  "host": "deepseek",
  "task_id": "task-example",
  "action_id": "saved-action"
}
```

Success is the complete Task in `result`, with next `result.current_action` or terminal outcome.
Follow it; do not resubmit the old node payload. An unknown instruction stops. This table applies
Core's returned advice; it does not recompute recovery classification from file state.
Creation, cancellation, abandonment and relocation use their own readback rules in this reference
and the lifecycle sections below, never Action recovery.

## Resolve blockers

Implementation: `internal/mcp/schemas.go` — `buildCatalog`.
Implementation: `internal/workflow/submission_schema.go` — `CurrentSubmissionSchema`.

Read the fresh blocker and Action first. File-scope choices require an explicit user choice and reason.
Show the retained paths and proposed purpose. Example: “The write includes src/extra.js outside the
plan. Allow this exact write once, revise the plan, or restore the path?” Reuse only a still-valid
answer for this exact write. The three complete input alternatives are:

<!-- example:mcp dev_flow_resolve_blocker allow_once -->
```json
{
  "host": "deepseek",
  "task_id": "task-example",
  "action_id": "blocked-action",
  "choice": "allow_once",
  "reason": "The user allows this exact prepared write."
}
```
<!-- example:mcp dev_flow_resolve_blocker expand_scope -->
```json
{
  "host": "deepseek",
  "task_id": "task-example",
  "action_id": "blocked-action",
  "choice": "expand_scope",
  "reason": "The user requested a plan update for this path."
}
```
<!-- example:mcp dev_flow_resolve_blocker reject -->
```json
{
  "host": "deepseek",
  "task_id": "task-example",
  "action_id": "blocked-action",
  "choice": "reject",
  "reason": "The user rejected the write and the retained content has been restored."
}
```

`allow_once` is restricted to the same prepared intent/path set; `expand_scope` returns to TASKS to
save revised expected paths with tasks_plan_saved and explicitly confirm that current plan before tasks_ready (use its requirements return only for a requirement change); `reject` resumes
only after actual restoration. None of these expands immutable Repository Scope.

For `repeated_verification_failure`, `unchanged_verification_result` or
`unchanged_test_implementation_loop`, stop and ask for a different approach, one further attempt or
cancellation. After the explicit retry/approach answer, or after a recovery blocker's required
repository condition is restored, use only identity fields:

<!-- example:mcp dev_flow_resolve_blocker verification-or-recovery -->
```json
{
  "host": "deepseek",
  "task_id": "task-example",
  "action_id": "blocked-action"
}
```

For a workspace-history blocker, complete the separately authorized Git operation first, then:

<!-- example:mcp dev_flow_resolve_blocker history -->
```json
{
  "host": "deepseek",
  "task_id": "task-example",
  "action_id": "blocked-action",
  "history_resolution": {
    "choice": "accept_current_history",
    "reason": "The user authorized this history change and Core can observe the resulting history."
  }
}
```

Success returns the full Task directly; continue only from its current Action. Rejection leaves the
condition unresolved. Relocation uses the distinct [relocation input](#complete-relocation);
do not mix file-scope, history and relocation members. Workspace unavailability requires restoration
of the original instance or explicit abandonment, not recreation of a same-named directory.

## Prepare relocation

Implementation: `internal/application/control_center_lifecycle.go` — `PrepareTaskRelocation`.
Implementation: `internal/application/relocation.go` — `PrepareTaskRelocation`.

First verify that [Host lifecycle](host-lifecycle.md#relocation) supplies an available, authorized
relocation procedure. The Core tool alone does not supply a Host move. After explicit user authority, retain the current Core Task ID/revision and prepare once:

<!-- example:mcp dev_flow_prepare_task_relocation prepare -->
```json
{
  "host": "deepseek",
  "task_id": "task-example",
  "revision": 8
}
```

Success projection: `{"ok":true,"result":{"relocation_id":"relocation-example",
"task":{"task_id":"task-example","current_cursor":"BLOCKED"}}}`. Retain the complete returned
Task, relocation ID, source bindings/content/surface and resume node. Claims remain bound to the
source during Handoff. If the response is lost, get the same Task and verify the saved relocation
and blocker at the expected successor revision; reuse only that matching identity.


## Complete relocation

Implementation: `internal/application/relocation.go` — `resolveTaskRelocation`, `validateTaskRelocationDestination`.

After actual Host success, use the current blocked Action, saved relocation ID and all verified destination roots:

<!-- example:mcp dev_flow_resolve_blocker relocation -->
```json
{
  "host": "deepseek",
  "task_id": "task-example",
  "action_id": "blocked-action",
  "relocation_id": "relocation-example",
  "relocation_destinations": [
    {
      "key": "primary",
      "repository_path": "/work/tasks/relocated-endpoint"
    }
  ]
}
```

Core checks repository group, frozen base, equivalent content/surface and claim conflicts, then replaces bindings together. Success returns the complete Task directly; follow its current_action. Failed or uncertain Host movement keeps the original binding and claims and does not permit this resolution.

## Cancellation

Implementation: `internal/application/cancel_task.go` — `CancelTask`.
Implementation: `internal/mcp/schemas.go` — `buildCatalog`.

After the user explicitly cancels an active Task, obtain its current revision and create one fresh
cancellation request ID. Retain it before the call; use the actual user reason.

<!-- example:mcp dev_flow_cancel_task cancel -->
```json
{
  "request_id": "cancel-request-example",
  "host": "deepseek",
  "task_id": "task-example",
  "revision": 8,
  "reason": "The user cancelled this endpoint change."
}
```

Success returns the complete Task directly: `result.current_cursor` is CANCELLED,
`result.current_action` is null and `result.outcome` explains termination. It does not delete Git data.
Core must still observe the worktree. After response loss, call get_task and compare
`task.last_operation.operation_id` with the retained cancellation request, kind `cancel_task`, and
terminal outcome. Report a different terminal operation accurately; active/mismatched/uncertain reads
stop for inspection. Do not invoke Action recovery or blindly repeat cancellation.

## Abandon an unavailable workspace

Implementation: `internal/application/abandon_task.go` — `AbandonTask`.

Use only when the original workspace instance is unavailable and the user explicitly abandons the
Task instead of restoring that instance. Core attempts an observation to establish unavailability.

<!-- example:mcp dev_flow_abandon_task abandon -->
```json
{
  "host": "deepseek",
  "task_id": "task-example",
  "revision": 8,
  "reason": "The original worktree is unavailable and the user explicitly abandoned the Task."
}
```

Success returns the CANCELLED Task and releases its claims while retaining the last known binding.
After a lost result, get_task and verify the terminal outcome, `last_operation.kind=abandon_task`
and expected successor revision. A live workspace, conflicting revision or mismatched result stops;
a same-named new directory cannot stand in for the original instance.
