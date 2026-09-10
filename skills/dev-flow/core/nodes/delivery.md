# DELIVERY: dev_flow_submit_delivery

Implementation: `internal/workflow/standard_process.go` — `StandardProcess`.
Implementation: `internal/workflow/payloads.go` — `ValidatePayload, problemClassByTransition`.
Implementation: `internal/application/apply_action_results.go` — `applyDeliveryResult`.

Read the [common procedure](../node-payloads.md#common-submission-procedure) before constructing this input.

## Inputs and prerequisites

Use current requirements, completed plan work and passed current Test records. Each acceptance
entry must appear in requirement order and contain criterion/status/work_item_ids/evidence_ids.
Every work item must map to that criterion and be completed; evidence IDs come from `task.test.evidence_ids`
and their sources/results from `task.evidence`. An actual passed user check is eligible; comprehension
confirmation is a separate requirement. Core fills aggregate evidence IDs and Test/Comprehension IDs.

For a remediation edge send `acceptance:[]` and the actual findings. For completion, all acceptance
links must be current and unverified items empty. Reconcile method artifacts read-only at this point;
file writes, including archive/sync, invalidate current verification under the existing content guard.
See [artifact timing](../artifacts.md#content-after-implementation).

## Calls and returned Actions

### delivery_complete

Condition: `none`; Core guard `delivery_current_and_complete`. Use an empty reason when none is required.

<!-- example:mcp dev_flow_submit_delivery delivery_complete -->
```json
{
  "host": "{{host}}",
  "task_id": "task-example",
  "action_id": "action-example",
  "transition_id": "delivery_complete",
  "summary": "Completed the current DELIVERY work.",
  "reason": "",
  "artifacts": {
    "current": [],
    "other_process": []
  },
  "method_results": {
    "delivery.reconcile_acceptance": {
      "capability": "",
      "summary": "Completed the current semantic work for the endpoint change."
    },
    "delivery.reconcile_method_artifacts": {
      "capability": "",
      "summary": "Completed the current semantic work for the endpoint change."
    },
    "delivery.prepare_summary": {
      "capability": "",
      "summary": "Completed the current semantic work for the endpoint change."
    }
  },
  "node_result": {
    "problem_class": "none",
    "acceptance": [
      {
        "criterion": "The response contains the requested field.",
        "status": "satisfied",
        "work_item_ids": [
          "work-endpoint"
        ],
        "evidence_ids": [
          "evidence-endpoint"
        ]
      }
    ],
    "unverified_items": [],
    "risks": [],
    "findings": []
  }
}
```

Complete successful request and response: [view every returned field](../successes/dev_flow_submit_delivery-delivery_complete.md).

Possible error for this request: Assume the retained Task and Action are current. `node_result.acceptance[0].evidence_ids` is omitted from the request.

Implementation: `internal/mcp/tools.go` — `ValidateToolInput`;
`internal/workflow/action_schema.go` — `ValidateSubmissionNodeResult`;
`internal/workflow/payloads.go` — `requiredMemberViolations`;
`internal/mcp/results.go` — `EncodeError, publicFailure, boundedCorrectionPaths, requestCorrectionPaths`.

<!-- error-case: {"operation":"remove","path":"node_result.acceptance.0.evidence_ids"} -->
<!-- example:mcp-output dev_flow_submit_delivery delivery_complete-error -->
```json
{
  "ok": false,
  "request_id": "request-error-example",
  "tool": "dev_flow_submit_delivery",
  "error": {
    "code": "INVALID_ARGUMENT",
    "message": "The request does not match the closed Core contract.",
    "details": [
      {
        "path": "node_result.acceptance[0].evidence_ids",
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
      "node_result.acceptance[0].evidence_ids"
    ]
  }
}
```

Follow this response’s `recovery.action` and the [response rules](../tool-results.md). Reuse confirmed facts; ask only for a missing user decision.


On a committed result, the Task is in `result`; the expected next node for this edge is `DONE`. Read `result.outcome` and `result.current_action:null`, then use the [terminal presentation](../host-lifecycle.md#terminal-presentation).

### delivery_needs_implementation

Condition: `implementation_gap`; Core guard `delivery_implementation_gap_identified`. The required reason states the actual finding or budget need.

<!-- example:mcp dev_flow_submit_delivery delivery_needs_implementation -->
```json
{
  "host": "{{host}}",
  "task_id": "task-example",
  "action_id": "action-example",
  "transition_id": "delivery_needs_implementation",
  "summary": "One accepted response variant is not implemented.",
  "reason": "One accepted response variant is not implemented.",
  "artifacts": {
    "current": [],
    "other_process": []
  },
  "method_results": {
    "delivery.reconcile_acceptance": {
      "capability": "",
      "summary": "Completed the current semantic work and recorded its findings."
    },
    "delivery.reconcile_method_artifacts": {
      "capability": "",
      "summary": "Completed the current semantic work and recorded its findings."
    },
    "delivery.prepare_summary": {
      "capability": "",
      "summary": "Completed the current semantic work and recorded its findings."
    }
  },
  "node_result": {
    "problem_class": "implementation_gap",
    "acceptance": [],
    "unverified_items": [],
    "risks": [],
    "findings": [
      "One accepted response variant is not implemented."
    ]
  }
}
```

Complete successful request and response: [view every returned field](../successes/dev_flow_submit_delivery-delivery_needs_implementation.md).

Possible error for this request: Assume the retained Task and Action are current. `node_result.findings` is empty while this transition reports a problem requiring remediation.

Implementation: `internal/mcp/tools.go` — `ValidateToolInput`;
`internal/workflow/payloads.go` — `ValidatePayload, validateProblemClass`;
`internal/workflow/standard_process.go` — `standardTransitions`;
`internal/mcp/results.go` — `EncodeError, publicFailure, boundedCorrectionPaths, requestCorrectionPaths`.

<!-- error-case: {"operation":"set","path":"node_result.findings","value":[]} -->
<!-- example:mcp-output dev_flow_submit_delivery delivery_needs_implementation-error -->
```json
{
  "ok": false,
  "request_id": "request-error-example",
  "tool": "dev_flow_submit_delivery",
  "error": {
    "code": "TRANSITION_NOT_ALLOWED",
    "message": "The transition guard was not satisfied.",
    "guard": {
      "guard_id": "delivery_implementation_gap_identified",
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


On a committed result, the Task is in `result`; the expected next node for this edge is `IMPLEMENT`. Read the complete `result.current_action` and any blocker/outcome.

### delivery_needs_test

Condition: `test_gap`; Core guard `delivery_test_gap_identified`. The required reason states the actual finding or budget need.

<!-- example:mcp dev_flow_submit_delivery delivery_needs_test -->
```json
{
  "host": "{{host}}",
  "task_id": "task-example",
  "action_id": "action-example",
  "transition_id": "delivery_needs_test",
  "summary": "The response criterion lacks a current passed check.",
  "reason": "The response criterion lacks a current passed check.",
  "artifacts": {
    "current": [],
    "other_process": []
  },
  "method_results": {
    "delivery.reconcile_acceptance": {
      "capability": "",
      "summary": "Completed the current semantic work and recorded its findings."
    },
    "delivery.reconcile_method_artifacts": {
      "capability": "",
      "summary": "Completed the current semantic work and recorded its findings."
    },
    "delivery.prepare_summary": {
      "capability": "",
      "summary": "Completed the current semantic work and recorded its findings."
    }
  },
  "node_result": {
    "problem_class": "test_gap",
    "acceptance": [],
    "unverified_items": [],
    "risks": [],
    "findings": [
      "The response criterion lacks a current passed check."
    ]
  }
}
```

Complete successful request and response: [view every returned field](../successes/dev_flow_submit_delivery-delivery_needs_test.md).

Possible error for this request: Assume the retained Task and Action are current. `node_result.findings` is empty while this transition reports a problem requiring remediation.

Implementation: `internal/mcp/tools.go` — `ValidateToolInput`;
`internal/workflow/payloads.go` — `ValidatePayload, validateProblemClass`;
`internal/workflow/standard_process.go` — `standardTransitions`;
`internal/mcp/results.go` — `EncodeError, publicFailure, boundedCorrectionPaths, requestCorrectionPaths`.

<!-- error-case: {"operation":"set","path":"node_result.findings","value":[]} -->
<!-- example:mcp-output dev_flow_submit_delivery delivery_needs_test-error -->
```json
{
  "ok": false,
  "request_id": "request-error-example",
  "tool": "dev_flow_submit_delivery",
  "error": {
    "code": "TRANSITION_NOT_ALLOWED",
    "message": "The transition guard was not satisfied.",
    "guard": {
      "guard_id": "delivery_test_gap_identified",
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


On a committed result, the Task is in `result`; the expected next node for this edge is `TEST`. Read the complete `result.current_action` and any blocker/outcome.

### delivery_needs_comprehension

Condition: `comprehension_gap`; Core guard `delivery_comprehension_gap_identified`. The required reason states the actual finding or budget need.

<!-- example:mcp dev_flow_submit_delivery delivery_needs_comprehension -->
```json
{
  "host": "{{host}}",
  "task_id": "task-example",
  "action_id": "action-example",
  "transition_id": "delivery_needs_comprehension",
  "summary": "The developer has not confirmed understanding of the current implementation.",
  "reason": "The developer has not confirmed understanding of the current implementation.",
  "artifacts": {
    "current": [],
    "other_process": []
  },
  "method_results": {
    "delivery.reconcile_acceptance": {
      "capability": "",
      "summary": "Completed the current semantic work and recorded its findings."
    },
    "delivery.reconcile_method_artifacts": {
      "capability": "",
      "summary": "Completed the current semantic work and recorded its findings."
    },
    "delivery.prepare_summary": {
      "capability": "",
      "summary": "Completed the current semantic work and recorded its findings."
    }
  },
  "node_result": {
    "problem_class": "comprehension_gap",
    "acceptance": [],
    "unverified_items": [],
    "risks": [],
    "findings": [
      "The developer has not confirmed understanding of the current implementation."
    ]
  }
}
```

Complete successful request and response: [view every returned field](../successes/dev_flow_submit_delivery-delivery_needs_comprehension.md).

Possible error for this request: Assume the retained Task and Action are current. `node_result.findings` is empty while this transition reports a problem requiring remediation.

Implementation: `internal/mcp/tools.go` — `ValidateToolInput`;
`internal/workflow/payloads.go` — `ValidatePayload, validateProblemClass`;
`internal/workflow/standard_process.go` — `standardTransitions`;
`internal/mcp/results.go` — `EncodeError, publicFailure, boundedCorrectionPaths, requestCorrectionPaths`.

<!-- error-case: {"operation":"set","path":"node_result.findings","value":[]} -->
<!-- example:mcp-output dev_flow_submit_delivery delivery_needs_comprehension-error -->
```json
{
  "ok": false,
  "request_id": "request-error-example",
  "tool": "dev_flow_submit_delivery",
  "error": {
    "code": "TRANSITION_NOT_ALLOWED",
    "message": "The transition guard was not satisfied.",
    "guard": {
      "guard_id": "delivery_comprehension_gap_identified",
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


On a committed result, the Task is in `result`; the expected next node for this edge is `COMPREHENSION_REVIEW`. Read the complete `result.current_action` and any blocker/outcome.

### delivery_needs_design

Condition: `design_gap`; Core guard `delivery_design_gap_identified`. The required reason states the actual finding or budget need.

<!-- example:mcp dev_flow_submit_delivery delivery_needs_design -->
```json
{
  "host": "{{host}}",
  "task_id": "task-example",
  "action_id": "action-example",
  "transition_id": "delivery_needs_design",
  "summary": "The selected response mapper cannot access the required source value.",
  "reason": "The selected response mapper cannot access the required source value.",
  "artifacts": {
    "current": [],
    "other_process": []
  },
  "method_results": {
    "delivery.reconcile_acceptance": {
      "capability": "",
      "summary": "Completed the current semantic work and recorded its findings."
    },
    "delivery.reconcile_method_artifacts": {
      "capability": "",
      "summary": "Completed the current semantic work and recorded its findings."
    },
    "delivery.prepare_summary": {
      "capability": "",
      "summary": "Completed the current semantic work and recorded its findings."
    }
  },
  "node_result": {
    "problem_class": "design_gap",
    "acceptance": [],
    "unverified_items": [],
    "risks": [],
    "findings": [
      "The selected response mapper cannot access the required source value."
    ]
  }
}
```

Complete successful request and response: [view every returned field](../successes/dev_flow_submit_delivery-delivery_needs_design.md).

Possible error for this request: Assume the retained Task and Action are current. `node_result.findings` is empty while this transition reports a problem requiring remediation.

Implementation: `internal/mcp/tools.go` — `ValidateToolInput`;
`internal/workflow/payloads.go` — `ValidatePayload, validateProblemClass`;
`internal/workflow/standard_process.go` — `standardTransitions`;
`internal/mcp/results.go` — `EncodeError, publicFailure, boundedCorrectionPaths, requestCorrectionPaths`.

<!-- error-case: {"operation":"set","path":"node_result.findings","value":[]} -->
<!-- example:mcp-output dev_flow_submit_delivery delivery_needs_design-error -->
```json
{
  "ok": false,
  "request_id": "request-error-example",
  "tool": "dev_flow_submit_delivery",
  "error": {
    "code": "TRANSITION_NOT_ALLOWED",
    "message": "The transition guard was not satisfied.",
    "guard": {
      "guard_id": "delivery_design_gap_identified",
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

### delivery_needs_requirements

Condition: `requirement_gap`; Core guard `delivery_requirement_gap_identified`. The required reason states the actual finding or budget need.

<!-- example:mcp dev_flow_submit_delivery delivery_needs_requirements -->
```json
{
  "host": "{{host}}",
  "task_id": "task-example",
  "action_id": "action-example",
  "transition_id": "delivery_needs_requirements",
  "summary": "The requested field semantics for an absent source value are unresolved.",
  "reason": "The requested field semantics for an absent source value are unresolved.",
  "artifacts": {
    "current": [],
    "other_process": []
  },
  "method_results": {
    "delivery.reconcile_acceptance": {
      "capability": "",
      "summary": "Completed the current semantic work and recorded its findings."
    },
    "delivery.reconcile_method_artifacts": {
      "capability": "",
      "summary": "Completed the current semantic work and recorded its findings."
    },
    "delivery.prepare_summary": {
      "capability": "",
      "summary": "Completed the current semantic work and recorded its findings."
    }
  },
  "node_result": {
    "problem_class": "requirement_gap",
    "acceptance": [],
    "unverified_items": [],
    "risks": [],
    "findings": [
      "The requested field semantics for an absent source value are unresolved."
    ]
  }
}
```

Complete successful request and response: [view every returned field](../successes/dev_flow_submit_delivery-delivery_needs_requirements.md).

Possible error for this request: Assume the retained Task and Action are current. `node_result.findings` is empty while this transition reports a problem requiring remediation.

Implementation: `internal/mcp/tools.go` — `ValidateToolInput`;
`internal/workflow/payloads.go` — `ValidatePayload, validateProblemClass`;
`internal/workflow/standard_process.go` — `standardTransitions`;
`internal/mcp/results.go` — `EncodeError, publicFailure, boundedCorrectionPaths, requestCorrectionPaths`.

<!-- error-case: {"operation":"set","path":"node_result.findings","value":[]} -->
<!-- example:mcp-output dev_flow_submit_delivery delivery_needs_requirements-error -->
```json
{
  "ok": false,
  "request_id": "request-error-example",
  "tool": "dev_flow_submit_delivery",
  "error": {
    "code": "TRANSITION_NOT_ALLOWED",
    "message": "The transition guard was not satisfied.",
    "guard": {
      "guard_id": "delivery_requirement_gap_identified",
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

## Refusal or lost response

`INVALID_ARGUMENT` reports malformed/unknown/missing fields; a guard rejection reports the failed
condition. A current-revision/work-item/evidence mismatch is not fixed by copying an example value.
Follow [complete rejections](../tool-results.md#complete-rejections-and-bounded-corrections).
For an actually missing response, read the retained operation before
[Action recovery](../tool-results.md#uncertain-action-recovery). Never replay from the sample.
