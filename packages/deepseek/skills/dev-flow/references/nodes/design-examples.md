<!-- Generated from skills/dev-flow/core/nodes/design-examples.md; edit the shared source and run node scripts/sync-skill-references.mjs. -->

# DESIGN submission examples

Read [design instructions](design.md) and use only the example for the transition returned by Core.
Replace sample identities, artifacts, checks and user verdicts with current values.

Implementation: `internal/mcp/skill_examples_test.go`; `internal/mcp/skill_error_examples_test.go`;
`internal/mcp/skill_success_examples_test.go`.

## dev_flow_submit_design-design_ready

<!-- example:mcp dev_flow_submit_design design_ready -->
```json
{
  "host": "deepseek",
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

Complete successful request and response: [view every returned field](../successes/dev_flow_submit_design-design_ready.md).

Possible error for this request: Assume the retained Task and Action are current. `node_result.baseline.approach` is omitted from the request.

Implementation: `internal/mcp/tools.go` — `ValidateToolInput`;
`internal/workflow/action_schema.go` — `ValidateSubmissionNodeResult`;
`internal/workflow/payloads.go` — `requiredMemberViolations`;
`internal/mcp/results.go` — `EncodeError, publicFailure, boundedCorrectionPaths, requestCorrectionPaths`.

<!-- error-case: {"operation":"remove","path":"node_result.baseline.approach"} -->
<!-- example:mcp-output dev_flow_submit_design design_ready-error -->
```json
{
  "ok": false,
  "request_id": "request-error-example",
  "tool": "dev_flow_submit_design",
  "error": {
    "code": "INVALID_ARGUMENT",
    "message": "node_result.baseline.approach: the closed contract requires this member",
    "details": [
      {
        "path": "node_result.baseline.approach",
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
      "node_result.baseline.approach"
    ]
  }
}
```

## dev_flow_submit_design-design_requires_requirements

<!-- example:mcp dev_flow_submit_design design_requires_requirements -->
```json
{
  "host": "deepseek",
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

Complete successful request and response: [view every returned field](../successes/dev_flow_submit_design-design_requires_requirements.md).

Possible error for this request: Assume the retained Task and Action are current. `node_result.findings` is empty while this transition reports a problem requiring remediation.

Implementation: `internal/mcp/tools.go` — `ValidateToolInput`;
`internal/workflow/payloads.go` — `ValidatePayload, validateProblemClass`;
`internal/workflow/standard_process.go` — `standardTransitions`;
`internal/mcp/results.go` — `EncodeError, publicFailure, boundedCorrectionPaths, requestCorrectionPaths`.

<!-- error-case: {"operation":"set","path":"node_result.findings","value":[]} -->
<!-- example:mcp-output dev_flow_submit_design design_requires_requirements-error -->
```json
{
  "ok": false,
  "request_id": "request-error-example",
  "tool": "dev_flow_submit_design",
  "error": {
    "code": "TRANSITION_NOT_ALLOWED",
    "message": "node_result.findings: findings must not be empty when problem_class is not none",
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
