# Contract: Dev Flow MCP Tools 0.2

## 1. Common Rules

- Transport remains local STDIO.
- The public catalog contains exactly six tools and no aliases.
- Every input/output object is closed; unknown or duplicate member names are rejected.
- Identifiers, strings, arrays, payloads, task snapshots, and result envelopes obey Core Limits 0.2.
- Every result uses the existing typed result-envelope pattern with `schema_version: 2`.
- Tool annotations remain descriptive and do not grant OS authority.
- No tool accepts a shell command, arbitrary environment, database path, process-definition file,
  destination node, or output path.
- `host` accepts only `codex` or `deepseek`.
- `supported_hosts` means Core accepts the identity; it is not a product-support claim.
- Standard task state is governed only by `standard-development@1`.
- Tool/method artifacts never mutate Core without a valid `dev_flow_apply_action`.

## 2. Exact Tool Catalog

```text
dev_flow_server_info
dev_flow_open_task
dev_flow_get_task
dev_flow_get_next_action
dev_flow_apply_action
dev_flow_cancel_task
```

| Tool | Read-only | Idempotent | Destructive | Open-world |
| --- | ---: | ---: | ---: | ---: |
| `dev_flow_server_info` | true | true | false | false |
| `dev_flow_open_task` | false | false | false | false |
| `dev_flow_get_task` | true | true | false | false |
| `dev_flow_get_next_action` | true | true | false | false |
| `dev_flow_apply_action` | false | false | false | false |
| `dev_flow_cancel_task` | false | false | true | false |

## 3. Shared Types

### 3.1 Process reference

```json
{
  "process_id": "standard-development",
  "process_version": 1,
  "definition_digest": "<lowercase-sha256>"
}
```

Supported references are returned by Core. Callers do not choose them during task creation.

### 3.2 Task intent input

```json
{
  "request": "Simplify the order submission implementation.",
  "initial_scope": ["order submission path"],
  "initial_out_of_scope": ["payment provider replacement"],
  "known_acceptance_criteria": ["duplicate submission is rejected"],
  "verification_budget": {
    "level": "targeted",
    "max_automatic_commands": 4,
    "allow_full_suite": false,
    "allow_manual_handoff": true
  },
  "method_profile": "spec-kit"
}
```

Required members:

```text
request
initial_scope
initial_out_of_scope
known_acceptance_criteria
verification_budget
method_profile
```

All members are always present in a new-task object; the three lists may be empty. This closed shape
intentionally permits requirements grooming after task creation.

`method_profile` is exactly `plain`, `spec-kit`, or `openspec`.

### 3.3 Artifact reference input

```json
{
  "role": "design",
  "path": "specs/008-example/plan.md",
  "digest": "<lowercase-sha256>",
  "summary": "Current bounded design."
}
```

`path` is repository-relative and parent-safe. Content is not accepted.

### 3.4 Method evidence input

```json
{
  "step_id": "design.choose_approach",
  "status": "completed",
  "capability": "speckit-plan",
  "summary": "The current plan artifact records the selected approach."
}
```

`status` is `completed`, `not_run`, `unavailable`, or `plain_fallback`. `step_id` must be returned by
the current action. Command logs, prompts, token data, and environment dumps are forbidden.

### 3.5 Verification evidence input

```json
{
  "source": "automated",
  "name": "targeted_order_test",
  "status": "passed",
  "summary": "The duplicate submission scenario passed.",
  "command_count": 1,
  "full_suite": false
}
```

The caller cannot provide evidence ID, digest, timestamp, raw command, or raw output. Core generates
identity and digest after validation.

## 4. Shared Operation Probe

`dev_flow_get_task` and `dev_flow_get_next_action` accept optional `operation_probe`:

```json
{
  "operation_id": "original-apply-request-id",
  "process_id": "standard-development",
  "process_version": 1,
  "process_definition_digest": "<sha256>",
  "source_cursor": "REFACTOR",
  "expected_revision": 12,
  "action_id": "action-id",
  "action_kind": "COMPLETE_REFACTOR",
  "repository_binding_digest": "<issuance-sha256>",
  "payload": {
    "transition_id": "refactor_ready_for_test",
    "summary": "Removed the unnecessary factory.",
    "reason": "",
    "artifacts": [],
    "method_evidence": [],
    "node_result": {
      "changed_paths": ["internal/order/factory.go"],
      "no_file_changes": false,
      "simplifications": ["Removed one indirection layer"],
      "behavior_change_intended": false,
      "findings": []
    }
  }
}
```

Rules:

- `operation_id` is the original uncertain apply `request_id`.
- Process/cursor/action/revision/binding values come from the same original action.
- `payload` is the exact original closed payload or JSON `null` when it was not completely retained.
- No caller payload digest, destination, classification, blocker, next cursor, authoritative binding,
  repository facts, command/output, or environment is accepted.
- Core canonicalizes the payload and computes the operation digest itself.
- Without all non-payload identity members, the caller must not send a partial/fabricated probe.

### Recovery assessment

A successful probed read returns the same five-class assessment model as Core Contract 0.1, updated
to carry process reference and `source_cursor` instead of assuming a standard phase:

```text
not_started
completed_and_recorded
completed_but_unrecorded
partially_completed
conflicting
```

The assessment remains transient/read-only. Apply results never embed the assessment. The
result-envelope top-level error `recovery` object remains error advice and is not a classification.

## 5. `dev_flow_server_info`

### Input

```json
{}
```

### Success result

```json
{
  "product": "dev-flow",
  "version": "<repository VERSION>",
  "schema_version": 2,
  "core_limits_version": "0.2",
  "transport": "stdio",
  "health": "ready",
  "supported_hosts": ["codex", "deepseek"],
  "supported_processes": [
    {
      "process_id": "standard-development",
      "process_version": 1,
      "definition_digest": "<sha256>",
      "new_task_supported": true
    }
  ],
  "method_profiles": ["plain", "spec-kit", "openspec"],
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

No task, path, database, method installation, or environment data is returned.

## 6. `dev_flow_open_task`

Creates a new standard task or resumes the unique compatible active task for the repository/host.

### Input: new task

```json
{
  "host": "codex",
  "repository_path": "/absolute/or/resolvable/path",
  "new_task": {
    "request": "Simplify order submission and retain behavior.",
    "initial_scope": ["order submission path"],
    "initial_out_of_scope": ["payment provider replacement"],
    "known_acceptance_criteria": [],
    "verification_budget": {
      "level": "targeted",
      "max_automatic_commands": 4,
      "allow_full_suite": false,
      "allow_manual_handoff": true
    },
    "method_profile": "spec-kit"
  }
}
```

### Input: resume

```json
{
  "host": "codex",
  "repository_path": "/absolute/or/resolvable/path",
  "new_task": null
}
```

`new_task` may be omitted or null only for resume.

### Selection rules

When a compatible active task exists:

- same host + null/omitted new task: resume;
- same host + exact normalized new-task intent: resume;
- same host + different intent/profile/budget: `ACTIVE_TASK_CONFLICT`;
- different host: `HOST_OWNERSHIP_CONFLICT`.

When no active task exists:

- null/omitted new task: `TASK_NOT_FOUND`;
- valid new task: create `standard-development@1` at `REQUIREMENTS`;
- caller process/entry/destination members: `INVALID_ARGUMENT`.

No alternate or historical process is accepted or created.

### Success result

Returns:

```json
{
  "created": true,
  "task": "<TaskProjection>",
  "recovery_assessment": null
}
```

The task includes the persisted current action. A new action's transition set contains exactly
`requirements_ready`.

## 7. Task Projection

A standard active task projects:

```json
{
  "task_id": "task-id",
  "origin_host": "codex",
  "snapshot_version": 2,
  "process_id": "standard-development",
  "process_version": 1,
  "process_definition_digest": "<sha256>",
  "intent": {
    "request": "Simplify order submission and retain behavior.",
    "initial_scope": ["order submission path"],
    "initial_out_of_scope": ["payment provider replacement"],
    "known_acceptance_criteria": [],
    "verification_budget": {
      "level": "targeted",
      "max_automatic_commands": 4,
      "allow_full_suite": false,
      "allow_manual_handoff": true
    },
    "method_profile": "spec-kit"
  },
  "current_cursor": "REQUIREMENTS",
  "resume_cursor": null,
  "repository": "<RepositoryBinding>",
  "baselines": {
    "requirements": null,
    "design": null,
    "task_plan": null,
    "history": []
  },
  "implementation": null,
  "test": null,
  "comprehension": null,
  "current_action": "<ProcessActionProjection>",
  "blocker": null,
  "last_operation": "<LastOperation|null>",
  "evidence": [],
  "outcome": null,
  "revision": 1,
  "created_at": "<UTC>",
  "updated_at": "<UTC>",
  "completed_at": null
}
```

No private database path, raw event payload, full artifact body, command, output, or source file is
returned.

## 8. Process Action Projection

```json
{
  "action_id": "action-id",
  "kind": "COMPLETE_TEST",
  "task_id": "task-id",
  "revision": 8,
  "process": {
    "process_id": "standard-development",
    "process_version": 1,
    "definition_digest": "<sha256>"
  },
  "current_node": "TEST",
  "node_purpose": "Verify the current repository behavior within the task verification budget.",
  "entry_conditions": ["Current implementation and repository binding are available."],
  "completion_conditions": ["Checks and problem classification are complete."],
  "repository_binding_digest": "<sha256>",
  "allowed_effects": [
    "read_repository",
    "run_verification_commands",
    "edit_process_artifacts"
  ],
  "required_evidence": [
    {"kind": "repository_observation", "required": true},
    {"kind": "test_summary", "required": true}
  ],
  "payload_contract": "test-result@1",
  "method_steps": [
    {
      "step_id": "test.run_budgeted_checks",
      "purpose": "Run only checks authorized by the current verification plan.",
      "required": true
    },
    {
      "step_id": "test.record_evidence",
      "purpose": "Record actual check sources and outcomes.",
      "required": true
    },
    {
      "step_id": "test.classify_failure",
      "purpose": "Classify a failure as implementation, design, or requirements.",
      "required": true
    }
  ],
  "available_transitions": [
    {
      "transition_id": "tests_passed",
      "destination": "COMPREHENSION_REVIEW",
      "guard_id": "current_tests_pass",
      "when": "All required current checks pass.",
      "reason_required": false
    },
    {
      "transition_id": "tests_failed_implementation",
      "destination": "IMPLEMENT",
      "guard_id": "implementation_failure_identified",
      "when": "A current failure is attributable to implementation.",
      "reason_required": true
    },
    {
      "transition_id": "tests_expose_design_issue",
      "destination": "DESIGN",
      "guard_id": "test_design_failure_identified",
      "when": "A current failure demonstrates a design defect.",
      "reason_required": true
    },
    {
      "transition_id": "tests_expose_requirement_issue",
      "destination": "REQUIREMENTS",
      "guard_id": "test_requirement_gap_identified",
      "when": "A current failure demonstrates a requirement gap.",
      "reason_required": true
    }
  ],
  "method_profile": "spec-kit",
  "guidance": "Complete the TEST node contract and select exactly one returned transition.",
  "issued_at": "<UTC>"
}
```

Repeated reads return the same persisted action identity and complete action contract.

Every active Process Action contains these closed top-level members at minimum:

```text
task_id
revision
action_id
process_id
process_version
process_definition_digest
current_node
node_purpose
entry_conditions
completion_conditions
allowed_effects
required_evidence
method_steps
available_transitions
payload_contract
guidance
repository_binding_digest
```

## 9. `dev_flow_get_task`

### Input

```json
{
  "host": "codex",
  "task_id": "task-id",
  "operation_probe": null
}
```

### Success result

```json
{
  "task": "<TaskProjection>",
  "recovery_assessment": null
}
```

Without a probe, it does not observe the repository and does not mutate. With a probe, it performs
the existing bounded observation/classification and still performs zero task writes.

## 10. `dev_flow_get_next_action`

### Input

```json
{
  "host": "codex",
  "task_id": "task-id",
  "operation_probe": null
}
```

### Active success result

```json
{
  "task_id": "task-id",
  "snapshot_version": 2,
  "process": "<ProcessReference>",
  "current_cursor": "TEST",
  "revision": 8,
  "method_profile": "spec-kit",
  "blocker": null,
  "action": "<ProcessActionProjection>",
  "outcome": null,
  "recovery_assessment": null
}
```

For terminal tasks, `action` and `blocker` are null and `outcome` is present. For blocked tasks,
returns the exact persisted blocker and `RESOLVE_BLOCKER` action.

## 11. `dev_flow_apply_action`

### 11.1 Shared top-level input

```json
{
  "request_id": "opaque-request-id",
  "host": "codex",
  "task_id": "task-id",
  "revision": 8,
  "action_id": "action-id",
  "action_kind": "COMPLETE_TEST",
  "process_id": "standard-development",
  "process_version": 1,
  "process_definition_digest": "<sha256>",
  "source_cursor": "TEST",
  "repository_binding_digest": "<sha256>",
  "payload": {},
  "recovery_apply": null
}
```

All identity values come from the same fresh action. `revision` is an integer. The top-level object
must not be nested inside payload.

### 11.2 Shared standard payload envelope

Every standard node payload is:

```json
{
  "transition_id": "<one transition returned by current action>",
  "summary": "<required normalized summary>",
  "reason": "<empty or required according to transition>",
  "artifacts": [],
  "method_evidence": [],
  "node_result": {}
}
```

Common rules:

- `transition_id`, `summary`, `reason`, `artifacts`, `method_evidence`, and `node_result` are required.
- `reason` is empty for a transition with `reason_required=false`; non-empty for true.
- `artifacts` and `method_evidence` may be empty when semantic obligations are otherwise satisfied.
- `node_result` selects exactly one closed branch from the current action kind.
- Caller destination/process/node/guard/classification fields are forbidden inside payload.

### 11.3 REQUIREMENTS result

```json
{
  "transition_id": "requirements_ready",
  "summary": "Requirements are bounded and testable.",
  "reason": "",
  "artifacts": [],
  "method_evidence": [],
  "node_result": {
    "baseline": {
      "goal": "Simplify order submission while retaining behavior.",
      "scope": ["order submission path"],
      "out_of_scope": ["payment provider replacement"],
      "acceptance_criteria": [
        "duplicate submission remains rejected",
        "the developer can explain the final request path"
      ],
      "constraints": ["No generic workflow framework"],
      "assumptions": []
    },
    "unresolved_questions": []
  }
}
```

Rules:

- only `requirements_ready` is accepted;
- baseline and non-empty acceptance are required;
- unresolved questions must be empty;
- Core assigns baseline revision/digest/time.

### 11.4 DESIGN result

```json
{
  "transition_id": "design_ready",
  "summary": "Selected a direct bounded design.",
  "reason": "",
  "artifacts": [],
  "method_evidence": [],
  "node_result": {
    "baseline": {
      "requirements_revision": 1,
      "approach": "Keep one service boundary and remove duplicate adapters.",
      "components": ["order service", "submission guard"],
      "decisions": ["Use the existing service instead of a new framework"],
      "rejected_alternatives": ["Generic pipeline framework"],
      "complexity_justification": [],
      "risks": ["Existing callers depend on error shape"]
    },
    "findings": []
  }
}
```

For `design_ready`, baseline is required and findings may be empty. For
`design_requires_requirements`, baseline is null, findings contain a material requirement gap, and
reason is required.

### 11.5 TASKS result

```json
{
  "transition_id": "tasks_ready",
  "summary": "The design is decomposed into bounded work.",
  "reason": "",
  "artifacts": [],
  "method_evidence": [],
  "node_result": {
    "baseline": {
      "design_revision": 1,
      "work_items": [
        {
          "work_item_id": "remove-duplicate-adapter",
          "summary": "Remove the redundant adapter.",
          "expected_paths": ["internal/order/adapter.go"],
          "acceptance_indexes": [0, 1],
          "verification_steps": ["Run the targeted order submission tests."],
          "dependencies": []
        }
      ]
    },
    "findings": []
  }
}
```

For `tasks_ready`, baseline is required. Backward transitions require null baseline, non-empty
findings consistent with the selected destination, and reason.

### 11.6 IMPLEMENT result

```json
{
  "transition_id": "implementation_ready_for_test",
  "summary": "Removed the redundant adapter.",
  "reason": "",
  "artifacts": [],
  "method_evidence": [],
  "node_result": {
    "task_plan_revision": 1,
    "completed_work_item_ids": ["remove-duplicate-adapter"],
    "changed_paths": ["internal/order/adapter.go"],
    "no_file_changes": false,
    "deviations": [],
    "findings": []
  }
}
```

Exactly one of non-empty `changed_paths` or `no_file_changes=true` is accepted. Backward/refactor
transitions require findings matching the selected problem class and a reason. The fresh repository
observation is authoritative for accepted binding.

### 11.7 TEST result

```json
{
  "transition_id": "tests_passed",
  "summary": "Targeted order tests passed.",
  "reason": "",
  "artifacts": [],
  "method_evidence": [],
  "node_result": {
    "checks": [
      {
        "source": "automated",
        "name": "targeted_order_test",
        "status": "passed",
        "summary": "Duplicate and normal submission scenarios passed.",
        "command_count": 1,
        "full_suite": false
      }
    ],
    "failed_items": [],
    "unverified_items": [],
    "manual_handoff_items": [],
    "findings": []
  }
}
```

Rules:

- `tests_passed` requires no failed items/findings attributable to a defect and obeys budget.
- A failure transition requires a reason and at least one failed check/item/finding consistent with
  implementation, design, or requirement classification.
- Core creates EvidenceSummary IDs and a current TestRecord only for `tests_passed`.

### 11.8 COMPREHENSION_REVIEW result

```json
{
  "transition_id": "comprehension_passed",
  "summary": "The developer can explain and maintain the result.",
  "reason": "",
  "artifacts": [],
  "method_evidence": [],
  "node_result": {
    "explained_components": ["request entry", "submission guard", "repository write"],
    "unresolved_questions": [],
    "unnecessary_abstractions": [],
    "maintenance_risks": [],
    "user_confirmation": {
      "source": "user",
      "status": "passed",
      "summary": "The developer confirmed the simplified request path is understandable."
    }
  }
}
```

Rules:

- pass requires current TestRecord, non-empty explained components, empty unresolved/abstraction
  lists, and the exact user-confirmation shape;
- user confirmation creates a Core-owned user EvidenceSummary and ComprehensionAssessment;
- remediation transitions require null user confirmation, a reason, and findings in the appropriate
  list;
- AI/static/host-observed evidence cannot substitute for `source=user`.

### 11.9 REFACTOR result

```json
{
  "transition_id": "refactor_ready_for_test",
  "summary": "Removed unnecessary indirection without intended behavior change.",
  "reason": "",
  "artifacts": [],
  "method_evidence": [],
  "node_result": {
    "changed_paths": ["internal/order/factory.go"],
    "no_file_changes": false,
    "simplifications": ["Replaced the generic factory with direct construction"],
    "behavior_change_intended": false,
    "findings": []
  }
}
```

`refactor_ready_for_test` requires at least one simplification and proceeds only to `TEST`.
Backward transitions require reason/findings. `behavior_change_intended=true` is invalid for the
forward refactor edge and must route to design/requirements instead.

### 11.10 DELIVERY result

```json
{
  "transition_id": "delivery_complete",
  "summary": "Current acceptance, verification, comprehension, and risks are reconciled.",
  "reason": "",
  "artifacts": [],
  "method_evidence": [],
  "node_result": {
    "acceptance": [
      {
        "criterion": "duplicate submission remains rejected",
        "status": "satisfied"
      },
      {
        "criterion": "the developer can explain the final request path",
        "status": "satisfied"
      }
    ],
    "automated_evidence_ids": ["evidence-test"],
    "manual_evidence_ids": ["evidence-comprehension"],
    "test_record_id": "test-record",
    "comprehension_record_id": "comprehension-record",
    "unverified_items": [],
    "risks": [],
    "findings": []
  }
}
```

For `delivery_complete`:

- acceptance count/order/text equals latest requirements;
- every criterion is satisfied;
- test/comprehension IDs are exact/current;
- evidence IDs resolve to correct sources;
- unverified items and findings are empty;
- current repository binding matches both records.

Backward transitions require no completed delivery data, a non-empty finding/reason, and select the
matching remediation node.

### 11.11 Blocker resolution

Uses the existing exact machine-condition model with process/source cursor added to identity. It
cannot select a normal transition or destination.

### 11.12 Recovery apply

`recovery_apply` is normally null. When Core read advice permits explicit recovery:

```json
{
  "operation_id": "original-uncertain-apply-request-id",
  "source_cursor": "REFACTOR"
}
```

The top-level request carries the same original process/action identity. Payload is exact original
payload or null. Core reruns classification and returns the ordinary committed/read-back Task shape,
not a RecoveryAssessment object.

## 12. Apply Success and Failure

A successful normal mutation returns the committed Task projection and next action or outcome.

Mandatory failures include:

```text
INVALID_ARGUMENT
NOT_GIT_REPOSITORY
TASK_NOT_FOUND
ACTIVE_TASK_CONFLICT
HOST_OWNERSHIP_CONFLICT
REVISION_CONFLICT
ACTION_STALE
TRANSITION_NOT_ALLOWED
PROCESS_UNSUPPORTED
REPOSITORY_DRIFT
VERIFICATION_BUDGET_EXCEEDED
TASK_BLOCKED
TASK_TERMINAL
SCHEMA_UNSUPPORTED
STORAGE_UNAVAILABLE
INTERNAL_ERROR
```

Decode precedence:

- unknown/duplicate/wrong type/forbidden destination → `INVALID_ARGUMENT`;
- known well-typed transition absent for source/current action → `TRANSITION_NOT_ALLOWED`;
- unsupported process ID/version/digest in loaded/caller identity → `PROCESS_UNSUPPORTED` or stale
  identity error according to source;
- stale revision/action/binding retain existing stable errors.

Every rejected mutation is zero-write.

## 13. `dev_flow_cancel_task`

### Input

```json
{
  "host": "codex",
  "task_id": "task-id",
  "revision": 12,
  "reason": "The developer explicitly cancelled the task."
}
```

### Success result

Returns the `CANCELLED` outcome, released-claim status, and retained task ID. It never deletes task
data, method artifacts, repository files, or adjacent state.

## 14. Contract and Storage-Generation Boundary

- Core Contract 0.2 supports only `standard-development@1` tasks stored as snapshot version 2.
- A Schema 1/pre-graph database is rejected before task decoding as `SCHEMA_UNSUPPORTED` with zero
  writes; no Contract 0.1 task projection is returned.
- A Contract 0.2 adapter contains no legacy action branch, dual task projection, or historical-task
  continuation behavior.
- Shared Host fixtures validate identical current Core semantics for `host=codex` and
  `host=deepseek`.
- Real DeepSeek product support remains out of scope.
