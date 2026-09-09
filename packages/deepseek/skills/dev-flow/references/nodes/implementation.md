<!-- Generated from skills/dev-flow/core/nodes/implementation.md; edit the shared source and run node scripts/sync-skill-references.mjs. -->

# IMPLEMENT: dev_flow_submit_implementation

Implementation: `internal/workflow/standard_process.go` — `StandardProcess`.
Implementation: `internal/workflow/payloads.go` — `ValidatePayload, problemClassByTransition`.
Implementation: `internal/application/apply_action_results.go` — `applyImplementationResult`.

Read the [common procedure](../node-payloads.md#common-submission-procedure) before constructing this input.

## Inputs and prerequisites

Complete every work item in the current plan before selecting the TEST transition. Send actual
completed work-item IDs and deviations; Core computes changed files and fills `task_plan_revision`.
Problem transitions carry concrete findings and only the work actually completed so far. This node
has no `artifacts.current`; process references use `other_process`. Prepare product changes with
`slot:"product"` through the artifact helper.

## Calls and returned Actions

### implementation_ready_for_test

Condition: `none`; Core guard `implementation_report_complete`. Use an empty reason when none is required.

<!-- example:mcp dev_flow_submit_implementation implementation_ready_for_test -->
```json
{
  "host": "deepseek",
  "task_id": "task-example",
  "action_id": "action-example",
  "transition_id": "implementation_ready_for_test",
  "summary": "Completed the current IMPLEMENT work.",
  "reason": "",
  "artifacts": {
    "other_process": []
  },
  "method_results": {
    "implementation.execute_plan": {
      "capability": "",
      "summary": "Completed the current semantic work for the endpoint change."
    },
    "implementation.record_surface": {
      "capability": "",
      "summary": "Completed the current semantic work for the endpoint change."
    },
    "implementation.classify_deviations": {
      "capability": "",
      "summary": "Completed the current semantic work for the endpoint change."
    }
  },
  "node_result": {
    "problem_class": "none",
    "completed_work_item_ids": [
      "work-endpoint"
    ],
    "deviations": [],
    "findings": []
  }
}
```

On a committed result, the Task is in `result`; the expected next node for this edge is `TEST`. Read the complete `result.current_action` and any blocker/outcome.

### implementation_requires_design

Condition: `design_gap`; Core guard `implementation_exposes_design_gap`. The required reason states the actual finding or budget need.

<!-- example:mcp dev_flow_submit_implementation implementation_requires_design -->
```json
{
  "host": "deepseek",
  "task_id": "task-example",
  "action_id": "action-example",
  "transition_id": "implementation_requires_design",
  "summary": "The selected response mapper cannot access the required source value.",
  "reason": "The selected response mapper cannot access the required source value.",
  "artifacts": {
    "other_process": []
  },
  "method_results": {
    "implementation.execute_plan": {
      "capability": "",
      "summary": "Completed the current semantic work and recorded its findings."
    },
    "implementation.record_surface": {
      "capability": "",
      "summary": "Completed the current semantic work and recorded its findings."
    },
    "implementation.classify_deviations": {
      "capability": "",
      "summary": "Completed the current semantic work and recorded its findings."
    }
  },
  "node_result": {
    "problem_class": "design_gap",
    "completed_work_item_ids": [],
    "deviations": [
      "The selected response mapper cannot access the required source value."
    ],
    "findings": [
      "The selected response mapper cannot access the required source value."
    ]
  }
}
```

On a committed result, the Task is in `result`; the expected next node for this edge is `DESIGN`. Read the complete `result.current_action` and any blocker/outcome.

### implementation_requires_requirements

Condition: `requirement_gap`; Core guard `material_requirement_gap`. The required reason states the actual finding or budget need.

<!-- example:mcp dev_flow_submit_implementation implementation_requires_requirements -->
```json
{
  "host": "deepseek",
  "task_id": "task-example",
  "action_id": "action-example",
  "transition_id": "implementation_requires_requirements",
  "summary": "The requested field semantics for an absent source value are unresolved.",
  "reason": "The requested field semantics for an absent source value are unresolved.",
  "artifacts": {
    "other_process": []
  },
  "method_results": {
    "implementation.execute_plan": {
      "capability": "",
      "summary": "Completed the current semantic work and recorded its findings."
    },
    "implementation.record_surface": {
      "capability": "",
      "summary": "Completed the current semantic work and recorded its findings."
    },
    "implementation.classify_deviations": {
      "capability": "",
      "summary": "Completed the current semantic work and recorded its findings."
    }
  },
  "node_result": {
    "problem_class": "requirement_gap",
    "completed_work_item_ids": [],
    "deviations": [
      "The requested field semantics for an absent source value are unresolved."
    ],
    "findings": [
      "The requested field semantics for an absent source value are unresolved."
    ]
  }
}
```

On a committed result, the Task is in `result`; the expected next node for this edge is `REQUIREMENTS`. Read the complete `result.current_action` and any blocker/outcome.

### implementation_needs_refactor

Condition: `code_complexity`; Core guard `implementation_complexity_identified`. The required reason states the actual finding or budget need.

<!-- example:mcp dev_flow_submit_implementation implementation_needs_refactor -->
```json
{
  "host": "deepseek",
  "task_id": "task-example",
  "action_id": "action-example",
  "transition_id": "implementation_needs_refactor",
  "summary": "A redundant wrapper obscures the existing response mapper.",
  "reason": "A redundant wrapper obscures the existing response mapper.",
  "artifacts": {
    "other_process": []
  },
  "method_results": {
    "implementation.execute_plan": {
      "capability": "",
      "summary": "Completed the current semantic work and recorded its findings."
    },
    "implementation.record_surface": {
      "capability": "",
      "summary": "Completed the current semantic work and recorded its findings."
    },
    "implementation.classify_deviations": {
      "capability": "",
      "summary": "Completed the current semantic work and recorded its findings."
    }
  },
  "node_result": {
    "problem_class": "code_complexity",
    "completed_work_item_ids": [],
    "deviations": [
      "A redundant wrapper obscures the existing response mapper."
    ],
    "findings": [
      "A redundant wrapper obscures the existing response mapper."
    ]
  }
}
```

On a committed result, the Task is in `result`; the expected next node for this edge is `REFACTOR`. Read the complete `result.current_action` and any blocker/outcome.

## Refusal or lost response

`INVALID_ARGUMENT` reports malformed/unknown/missing fields; a guard rejection reports the failed
condition. A current-revision/work-item/evidence mismatch is not fixed by copying an example value.
Follow [complete rejections](../tool-results.md#complete-rejections-and-bounded-corrections).
For an actually missing response, read the retained operation before
[Action recovery](../tool-results.md#uncertain-action-recovery). Never replay from the sample.
