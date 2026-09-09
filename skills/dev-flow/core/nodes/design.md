# DESIGN: dev_flow_submit_design

Implementation: `internal/workflow/standard_process.go` — `StandardProcess`.
Implementation: `internal/workflow/payloads.go` — `ValidatePayload, problemClassByTransition`.
Implementation: `internal/application/apply_action_results.go` — `applyDesignResult`.

Read the [common procedure](../node-payloads.md#common-submission-procedure) before constructing this input.

## Inputs and prerequisites

Read current requirements and the actual affected code. A ready result supplies the complete
baseline; a requirement return supplies `baseline:null` and findings. `complexity_justification`
is a string array. Core fills `requirements_revision`; the Host omits it.

## Calls and returned Actions

### design_ready

Condition: `none`; Core guard `design_baseline_complete`. Use an empty reason when none is required.

<!-- example:mcp dev_flow_submit_design design_ready -->
```json
{
  "host": "{{host}}",
  "task_id": "task-example",
  "action_id": "action-example",
  "transition_id": "design_ready",
  "summary": "Completed the current DESIGN work.",
  "reason": "",
  "artifacts": {
    "current": [],
    "other_process": []
  },
  "method_results": {
    "design.choose_approach": {
      "capability": "",
      "summary": "Completed the current semantic work for the endpoint change."
    },
    "design.review_complexity": {
      "capability": "",
      "summary": "Completed the current semantic work for the endpoint change."
    },
    "design.record_decisions": {
      "capability": "",
      "summary": "Completed the current semantic work for the endpoint change."
    }
  },
  "node_result": {
    "problem_class": "none",
    "baseline": {
      "approach": "Add the field in the existing response mapper.",
      "components": [
        "Endpoint response mapper"
      ],
      "decisions": [
        "Reuse the existing response type."
      ],
      "rejected_alternatives": [
        "A new response mapping layer is unnecessary."
      ],
      "complexity_justification": [
        "The existing mapper owns this response."
      ],
      "risks": []
    },
    "findings": []
  }
}
```

On a committed result, the Task is in `result`; the expected next node for this edge is `TASKS`. Read the complete `result.current_action` and any blocker/outcome.

### design_requires_requirements

Condition: `requirement_gap`; Core guard `material_requirement_gap`. The required reason states the actual finding or budget need.

<!-- example:mcp dev_flow_submit_design design_requires_requirements -->
```json
{
  "host": "{{host}}",
  "task_id": "task-example",
  "action_id": "action-example",
  "transition_id": "design_requires_requirements",
  "summary": "The requested field semantics for an absent source value are unresolved.",
  "reason": "The requested field semantics for an absent source value are unresolved.",
  "artifacts": {
    "current": [],
    "other_process": []
  },
  "method_results": {
    "design.choose_approach": {
      "capability": "",
      "summary": "Completed the current semantic work and recorded its findings."
    },
    "design.review_complexity": {
      "capability": "",
      "summary": "Completed the current semantic work and recorded its findings."
    },
    "design.record_decisions": {
      "capability": "",
      "summary": "Completed the current semantic work and recorded its findings."
    }
  },
  "node_result": {
    "problem_class": "requirement_gap",
    "baseline": null,
    "findings": [
      "The requested field semantics for an absent source value are unresolved."
    ]
  }
}
```

On a committed result, the Task is in `result`; the expected next node for this edge is `REQUIREMENTS`. Read the complete `result.current_action` and any blocker/outcome.

## Refusal or lost response

`INVALID_ARGUMENT` reports malformed/unknown/missing fields; a guard rejection reports the failed
condition. A current-revision/work-item/evidence mismatch is not fixed by copying an example value.
Follow [complete rejections](../tool-results.md#complete-rejections-and-bounded-corrections).
For an actually missing response, read the retained operation before
[Action recovery](../tool-results.md#uncertain-action-recovery). Never replay from the sample.
