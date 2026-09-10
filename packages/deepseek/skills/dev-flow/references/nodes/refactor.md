<!-- Generated from skills/dev-flow/core/nodes/refactor.md; edit the shared source and run node scripts/sync-skill-references.mjs. -->

# REFACTOR: dev_flow_submit_refactor

Implementation: `internal/workflow/standard_process.go` — `StandardProcess`.
Implementation: `internal/workflow/payloads.go` — `ValidatePayload, problemClassByTransition`.
Implementation: `internal/application/apply_action_results.go` — `applyRefactorResult`.

Read the [common procedure](../node-payloads.md#common-submission-procedure) before constructing this input.

## Inputs and prerequisites

Simplify the approved behavior within the current plan. Ready-for-test requires concrete
simplifications, `behavior_change_intended:false`, and completion of every planned work item in the
current implementation record. Return to design/requirements when the simplification needs those
changes. This node has no `artifacts.current`. Reconcile repository process files before the next TEST.

## Calls and returned Actions

### refactor_ready_for_test

Condition: `none`; Core guard `refactor_report_complete`. Use an empty reason when none is required.

<!-- example:mcp dev_flow_submit_refactor refactor_ready_for_test -->
```json
{
  "host": "deepseek",
  "task_id": "task-example",
  "action_id": "action-example",
  "transition_id": "refactor_ready_for_test",
  "summary": "Completed the current REFACTOR work.",
  "reason": "",
  "artifacts": {
    "other_process": []
  },
  "method_results": {
    "refactor.simplify": {
      "capability": "",
      "summary": "Completed the current semantic work for the endpoint change."
    },
    "refactor.reconcile_artifacts": {
      "capability": "",
      "summary": "Completed the current semantic work for the endpoint change."
    },
    "refactor.record_surface": {
      "capability": "",
      "summary": "Completed the current semantic work for the endpoint change."
    }
  },
  "node_result": {
    "problem_class": "none",
    "simplifications": [
      "Removed a redundant response mapping wrapper."
    ],
    "behavior_change_intended": false,
    "findings": []
  }
}
```

Complete successful request and response: [view every returned field](../successes/dev_flow_submit_refactor-refactor_ready_for_test.md).

Possible error for this request: Assume the retained Task and Action are current. `node_result.simplifications` is omitted from the request.

Implementation: `internal/mcp/tools.go` — `ValidateToolInput`;
`internal/workflow/action_schema.go` — `ValidateSubmissionNodeResult`;
`internal/workflow/payloads.go` — `requiredMemberViolations`;
`internal/mcp/results.go` — `EncodeError, publicFailure, boundedCorrectionPaths, requestCorrectionPaths`.

<!-- error-case: {"operation":"remove","path":"node_result.simplifications"} -->
<!-- example:mcp-output dev_flow_submit_refactor refactor_ready_for_test-error -->
```json
{
  "ok": false,
  "request_id": "request-error-example",
  "tool": "dev_flow_submit_refactor",
  "error": {
    "code": "INVALID_ARGUMENT",
    "message": "The request does not match the closed Core contract.",
    "details": [
      {
        "path": "node_result.simplifications",
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
      "node_result.simplifications"
    ]
  }
}
```

Follow this response’s `recovery.action` and the [response rules](../tool-results.md). Reuse confirmed facts; ask only for a missing user decision.


On a committed result, the Task is in `result`; the expected next node for this edge is `TEST`. Read the complete `result.current_action` and any blocker/outcome.

### refactor_requires_design

Condition: `design_change`; Core guard `refactor_design_change_required`. The required reason states the actual finding or budget need.

<!-- example:mcp dev_flow_submit_refactor refactor_requires_design -->
```json
{
  "host": "deepseek",
  "task_id": "task-example",
  "action_id": "action-example",
  "transition_id": "refactor_requires_design",
  "summary": "The simplification requires changing the selected design.",
  "reason": "The simplification requires changing the selected design.",
  "artifacts": {
    "other_process": []
  },
  "method_results": {
    "refactor.simplify": {
      "capability": "",
      "summary": "Completed the current semantic work and recorded its findings."
    },
    "refactor.reconcile_artifacts": {
      "capability": "",
      "summary": "Completed the current semantic work and recorded its findings."
    },
    "refactor.record_surface": {
      "capability": "",
      "summary": "Completed the current semantic work and recorded its findings."
    }
  },
  "node_result": {
    "problem_class": "design_change",
    "simplifications": [],
    "behavior_change_intended": true,
    "findings": [
      "The simplification requires changing the selected design."
    ]
  }
}
```

Complete successful request and response: [view every returned field](../successes/dev_flow_submit_refactor-refactor_requires_design.md).

Possible error for this request: Assume the retained Task and Action are current. `node_result.findings` is empty while this transition reports a problem requiring remediation.

Implementation: `internal/mcp/tools.go` — `ValidateToolInput`;
`internal/workflow/payloads.go` — `ValidatePayload, validateProblemClass`;
`internal/workflow/standard_process.go` — `standardTransitions`;
`internal/mcp/results.go` — `EncodeError, publicFailure, boundedCorrectionPaths, requestCorrectionPaths`.

<!-- error-case: {"operation":"set","path":"node_result.findings","value":[]} -->
<!-- example:mcp-output dev_flow_submit_refactor refactor_requires_design-error -->
```json
{
  "ok": false,
  "request_id": "request-error-example",
  "tool": "dev_flow_submit_refactor",
  "error": {
    "code": "TRANSITION_NOT_ALLOWED",
    "message": "The transition guard was not satisfied.",
    "guard": {
      "guard_id": "refactor_design_change_required",
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

### refactor_requires_requirements

Condition: `requirement_change`; Core guard `refactor_requirement_change_required`. The required reason states the actual finding or budget need.

<!-- example:mcp dev_flow_submit_refactor refactor_requires_requirements -->
```json
{
  "host": "deepseek",
  "task_id": "task-example",
  "action_id": "action-example",
  "transition_id": "refactor_requires_requirements",
  "summary": "The proposed simplification changes the requested response semantics.",
  "reason": "The proposed simplification changes the requested response semantics.",
  "artifacts": {
    "other_process": []
  },
  "method_results": {
    "refactor.simplify": {
      "capability": "",
      "summary": "Completed the current semantic work and recorded its findings."
    },
    "refactor.reconcile_artifacts": {
      "capability": "",
      "summary": "Completed the current semantic work and recorded its findings."
    },
    "refactor.record_surface": {
      "capability": "",
      "summary": "Completed the current semantic work and recorded its findings."
    }
  },
  "node_result": {
    "problem_class": "requirement_change",
    "simplifications": [],
    "behavior_change_intended": true,
    "findings": [
      "The proposed simplification changes the requested response semantics."
    ]
  }
}
```

Complete successful request and response: [view every returned field](../successes/dev_flow_submit_refactor-refactor_requires_requirements.md).

Possible error for this request: Assume the retained Task and Action are current. `node_result.findings` is empty while this transition reports a problem requiring remediation.

Implementation: `internal/mcp/tools.go` — `ValidateToolInput`;
`internal/workflow/payloads.go` — `ValidatePayload, validateProblemClass`;
`internal/workflow/standard_process.go` — `standardTransitions`;
`internal/mcp/results.go` — `EncodeError, publicFailure, boundedCorrectionPaths, requestCorrectionPaths`.

<!-- error-case: {"operation":"set","path":"node_result.findings","value":[]} -->
<!-- example:mcp-output dev_flow_submit_refactor refactor_requires_requirements-error -->
```json
{
  "ok": false,
  "request_id": "request-error-example",
  "tool": "dev_flow_submit_refactor",
  "error": {
    "code": "TRANSITION_NOT_ALLOWED",
    "message": "The transition guard was not satisfied.",
    "guard": {
      "guard_id": "refactor_requirement_change_required",
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
