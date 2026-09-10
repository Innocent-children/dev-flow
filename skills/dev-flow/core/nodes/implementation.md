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
  "host": "{{host}}",
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

Complete successful request and response: [view every returned field](../successes/dev_flow_submit_implementation-implementation_ready_for_test.md).

Possible error for this request: Assume the retained Task and Action are current. `node_result.completed_work_item_ids` is omitted from the request.

Implementation: `internal/mcp/tools.go` — `ValidateToolInput`;
`internal/workflow/action_schema.go` — `ValidateSubmissionNodeResult`;
`internal/workflow/payloads.go` — `requiredMemberViolations`;
`internal/mcp/results.go` — `EncodeError, publicFailure, boundedCorrectionPaths, requestCorrectionPaths`.

<!-- error-case: {"operation":"remove","path":"node_result.completed_work_item_ids"} -->
<!-- example:mcp-output dev_flow_submit_implementation implementation_ready_for_test-error -->
```json
{
  "ok": false,
  "request_id": "request-error-example",
  "tool": "dev_flow_submit_implementation",
  "error": {
    "code": "INVALID_ARGUMENT",
    "message": "The request does not match the closed Core contract.",
    "details": [
      {
        "path": "node_result.completed_work_item_ids",
        "rule": "required_member_missing",
        "message": "the closed contract requires this member"
      }
    ]
  },
  "recovery": {
    "retry_safe": true,
    "action": "correct_current_action",
    "message": "Correct only the members listed in allowed_paths, using facts already confirmed in the current Action work, and resubmit through the same submission tool once. Do not re-expand requirements, change more code, or guess a user decision; stop when the resubmission fails.",
    "allowed_paths": [
      "node_result.completed_work_item_ids"
    ]
  }
}
```

Follow this response’s `recovery.action` and the [response rules](../tool-results.md). Reuse confirmed facts; ask only for a missing user decision.


On a committed result, the Task is in `result`; the expected next node for this edge is `TEST`. Read the complete `result.current_action` and any blocker/outcome.

### implementation_requires_design

Condition: `design_gap`; Core guard `implementation_exposes_design_gap`. The required reason states the actual finding or budget need.

<!-- example:mcp dev_flow_submit_implementation implementation_requires_design -->
```json
{
  "host": "{{host}}",
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

Complete successful request and response: [view every returned field](../successes/dev_flow_submit_implementation-implementation_requires_design.md).

Possible error for this request: Assume the retained Task and Action are current. `node_result.findings` is empty while this transition reports a problem requiring remediation.

Implementation: `internal/mcp/tools.go` — `ValidateToolInput`;
`internal/workflow/payloads.go` — `ValidatePayload, validateProblemClass`;
`internal/workflow/standard_process.go` — `standardTransitions`;
`internal/mcp/results.go` — `EncodeError, publicFailure, boundedCorrectionPaths, requestCorrectionPaths`.

<!-- error-case: {"operation":"set","path":"node_result.findings","value":[]} -->
<!-- example:mcp-output dev_flow_submit_implementation implementation_requires_design-error -->
```json
{
  "ok": false,
  "request_id": "request-error-example",
  "tool": "dev_flow_submit_implementation",
  "error": {
    "code": "TRANSITION_NOT_ALLOWED",
    "message": "The transition guard was not satisfied.",
    "guard": {
      "guard_id": "implementation_exposes_design_gap",
      "failures": [
        {
          "path": "node_result.findings",
          "rule": "problem_findings_present",
          "message": "findings must not be empty when problem_class is not none"
        }
      ]
    }
  },
  "recovery": {
    "retry_safe": false,
    "action": "read_next_action",
    "message": "Read the complete current transition set."
  }
}
```

Follow this response’s `recovery.action` and the [response rules](../tool-results.md). Reuse confirmed facts; ask only for a missing user decision.


On a committed result, the Task is in `result`; the expected next node for this edge is `DESIGN`. Read the complete `result.current_action` and any blocker/outcome.

### implementation_requires_requirements

Condition: `requirement_gap`; Core guard `material_requirement_gap`. The required reason states the actual finding or budget need.

<!-- example:mcp dev_flow_submit_implementation implementation_requires_requirements -->
```json
{
  "host": "{{host}}",
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

Complete successful request and response: [view every returned field](../successes/dev_flow_submit_implementation-implementation_requires_requirements.md).

Possible error for this request: Assume the retained Task and Action are current. `node_result.findings` is empty while this transition reports a problem requiring remediation.

Implementation: `internal/mcp/tools.go` — `ValidateToolInput`;
`internal/workflow/payloads.go` — `ValidatePayload, validateProblemClass`;
`internal/workflow/standard_process.go` — `standardTransitions`;
`internal/mcp/results.go` — `EncodeError, publicFailure, boundedCorrectionPaths, requestCorrectionPaths`.

<!-- error-case: {"operation":"set","path":"node_result.findings","value":[]} -->
<!-- example:mcp-output dev_flow_submit_implementation implementation_requires_requirements-error -->
```json
{
  "ok": false,
  "request_id": "request-error-example",
  "tool": "dev_flow_submit_implementation",
  "error": {
    "code": "TRANSITION_NOT_ALLOWED",
    "message": "The transition guard was not satisfied.",
    "guard": {
      "guard_id": "material_requirement_gap",
      "failures": [
        {
          "path": "node_result.findings",
          "rule": "problem_findings_present",
          "message": "findings must not be empty when problem_class is not none"
        }
      ]
    }
  },
  "recovery": {
    "retry_safe": false,
    "action": "read_next_action",
    "message": "Read the complete current transition set."
  }
}
```

Follow this response’s `recovery.action` and the [response rules](../tool-results.md). Reuse confirmed facts; ask only for a missing user decision.


On a committed result, the Task is in `result`; the expected next node for this edge is `REQUIREMENTS`. Read the complete `result.current_action` and any blocker/outcome.

### implementation_needs_refactor

Condition: `code_complexity`; Core guard `implementation_complexity_identified`. The required reason states the actual finding or budget need.

<!-- example:mcp dev_flow_submit_implementation implementation_needs_refactor -->
```json
{
  "host": "{{host}}",
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

Complete successful request and response: [view every returned field](../successes/dev_flow_submit_implementation-implementation_needs_refactor.md).

Possible error for this request: Assume the retained Task and Action are current. `node_result.findings` is empty while this transition reports a problem requiring remediation.

Implementation: `internal/mcp/tools.go` — `ValidateToolInput`;
`internal/workflow/payloads.go` — `ValidatePayload, validateProblemClass`;
`internal/workflow/standard_process.go` — `standardTransitions`;
`internal/mcp/results.go` — `EncodeError, publicFailure, boundedCorrectionPaths, requestCorrectionPaths`.

<!-- error-case: {"operation":"set","path":"node_result.findings","value":[]} -->
<!-- example:mcp-output dev_flow_submit_implementation implementation_needs_refactor-error -->
```json
{
  "ok": false,
  "request_id": "request-error-example",
  "tool": "dev_flow_submit_implementation",
  "error": {
    "code": "TRANSITION_NOT_ALLOWED",
    "message": "The transition guard was not satisfied.",
    "guard": {
      "guard_id": "implementation_complexity_identified",
      "failures": [
        {
          "path": "node_result.findings",
          "rule": "problem_findings_present",
          "message": "findings must not be empty when problem_class is not none"
        }
      ]
    }
  },
  "recovery": {
    "retry_safe": false,
    "action": "read_next_action",
    "message": "Read the complete current transition set."
  }
}
```

Follow this response’s `recovery.action` and the [response rules](../tool-results.md). Reuse confirmed facts; ask only for a missing user decision.


On a committed result, the Task is in `result`; the expected next node for this edge is `REFACTOR`. Read the complete `result.current_action` and any blocker/outcome.

## Refusal or lost response

`INVALID_ARGUMENT` reports malformed/unknown/missing fields; a guard rejection reports the failed
condition. A current-revision/work-item/evidence mismatch is not fixed by copying an example value.
Follow [complete rejections](../tool-results.md#complete-rejections-and-bounded-corrections).
For an actually missing response, read the retained operation before
[Action recovery](../tool-results.md#uncertain-action-recovery). Never replay from the sample.
