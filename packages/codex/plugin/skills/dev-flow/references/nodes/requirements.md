<!-- Generated from skills/dev-flow/core/nodes/requirements.md; edit the shared source and run node scripts/sync-skill-references.mjs. -->

# REQUIREMENTS: dev_flow_submit_requirements

Implementation: `internal/workflow/standard_process.go` — `StandardProcess`.
Implementation: `internal/workflow/payloads.go` — `ValidatePayload, problemClassByTransition`.
Implementation: `internal/application/apply_action_results.go` — `applyRequirementsResult`.

Read the [common procedure](../node-payloads.md#common-submission-procedure) before constructing this input.

## Inputs and prerequisites

Show the developer your understanding of the goal, scope and acceptance criteria, including open questions. Reuse resolved answers; do not hide this phase as internal analysis. A separate approval at every planning node is unnecessary, but the complete plan must later be explicitly approved in TASKS.

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
  "host": "codex",
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

Complete successful request and response: [view every returned field](../successes/dev_flow_submit_requirements-requirements_ready.md).

Possible error for this request: Assume the retained Task and Action are current. `node_result.baseline.goal` is omitted from the request.

Implementation: `internal/mcp/tools.go` — `ValidateToolInput`;
`internal/workflow/action_schema.go` — `ValidateSubmissionNodeResult`;
`internal/workflow/payloads.go` — `requiredMemberViolations`;
`internal/mcp/results.go` — `EncodeError, publicFailure, boundedCorrectionPaths, requestCorrectionPaths`.

<!-- error-case: {"operation":"remove","path":"node_result.baseline.goal"} -->
<!-- example:mcp-output dev_flow_submit_requirements requirements_ready-error -->
```json
{
  "ok": false,
  "request_id": "request-error-example",
  "tool": "dev_flow_submit_requirements",
  "error": {
    "code": "INVALID_ARGUMENT",
    "message": "The request does not match the closed Core contract.",
    "details": [
      {
        "path": "node_result.baseline.goal",
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
      "node_result.baseline.goal"
    ]
  }
}
```

Follow this response’s `recovery.action` and the [response rules](../tool-results.md). Reuse confirmed facts; ask only for a missing user decision.


On a committed result, the Task is in `result`; the expected next node for this edge is `DESIGN`. Read the complete `result.current_action` and any blocker/outcome.

## Refusal or lost response

`INVALID_ARGUMENT` reports malformed/unknown/missing fields; a guard rejection reports the failed
condition. A current-revision/work-item/evidence mismatch is not fixed by copying an example value.
Follow [complete rejections](../tool-results.md#complete-rejections-and-bounded-corrections).
For an actually missing response, read the retained operation before
[Action recovery](../tool-results.md#uncertain-action-recovery). Never replay from the sample.
