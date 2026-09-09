# REQUIREMENTS: dev_flow_submit_requirements

Implementation: `internal/workflow/standard_process.go` — `StandardProcess`.
Implementation: `internal/workflow/payloads.go` — `ValidatePayload, problemClassByTransition`.
Implementation: `internal/application/apply_action_results.go` — `applyRequirementsResult`.

Read the [common procedure](../node-payloads.md#common-submission-procedure) before constructing this input.

## Inputs and prerequisites

Use actual requirement discussion and resolved user answers. `baseline` is required, and
`acceptance_criteria` must be nonempty. All scope/constraint/assumption members are string arrays.
Requirements has only the ready transition. If a material question remains, ask it and stay here;
there is no synthetic clarification transition. Example: “Should the field be null or absent when
its source value is missing?” Wait for that required answer before submitting.

## Calls and returned Actions

### requirements_ready

Condition: `none`; Core guard `requirements_baseline_complete`. Use an empty reason when none is required.

<!-- example:mcp dev_flow_submit_requirements requirements_ready -->
```json
{
  "host": "{{host}}",
  "task_id": "task-example",
  "action_id": "action-example",
  "transition_id": "requirements_ready",
  "summary": "Completed the current REQUIREMENTS work.",
  "reason": "",
  "artifacts": {
    "current": [],
    "other_process": []
  },
  "method_results": {
    "requirements.capture": {
      "capability": "",
      "summary": "Completed the current semantic work for the endpoint change."
    },
    "requirements.clarify": {
      "capability": "",
      "summary": "Completed the current semantic work for the endpoint change."
    },
    "requirements.validate": {
      "capability": "",
      "summary": "Completed the current semantic work for the endpoint change."
    }
  },
  "node_result": {
    "problem_class": "none",
    "baseline": {
      "goal": "Return the requested field from the endpoint.",
      "scope": [
        "Endpoint response"
      ],
      "out_of_scope": [
        "Other endpoints"
      ],
      "acceptance_criteria": [
        "The response contains the requested field."
      ],
      "constraints": [],
      "assumptions": []
    },
    "unresolved_questions": []
  }
}
```

On a committed result, the Task is in `result`; the expected next node for this edge is `DESIGN`. Read the complete `result.current_action` and any blocker/outcome.

## Refusal or lost response

`INVALID_ARGUMENT` reports malformed/unknown/missing fields; a guard rejection reports the failed
condition. A current-revision/work-item/evidence mismatch is not fixed by copying an example value.
Follow [complete rejections](../tool-results.md#complete-rejections-and-bounded-corrections).
For an actually missing response, read the retained operation before
[Action recovery](../tool-results.md#uncertain-action-recovery). Never replay from the sample.
