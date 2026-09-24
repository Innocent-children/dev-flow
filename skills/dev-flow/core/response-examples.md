# Core response handling: examples

Read the [core response handling instructions](tool-results.md) first. Use current values and the live schema; sample IDs and user decisions are never defaults.

Implementation: `internal/mcp/skill_examples_test.go`; `internal/mcp/skill_error_examples_test.go`;
`internal/mcp/skill_success_examples_test.go`.



## dev_flow_submit_test-budget-exceeded

<!-- example:mcp-output dev_flow_submit_test budget-exceeded -->
```json
{
  "ok": false,
  "request_id": "request-example",
  "tool": "dev_flow_submit_test",
  "error": {
    "code": "VERIFICATION_BUDGET_EXCEEDED",
    "budget": {
      "used": 8,
      "requested": 6,
      "limit": 13
    },
    "message": "The submitted evidence exceeds the current verification budget.",
    "details": [
      {
        "path": "verification.current_budget.max_automatic_commands",
        "rule": "automatic_budget_exceeded",
        "message": "existing plus submitted automatic commands exceed the current limit"
      }
    ]
  },
  "recovery": {
    "retry_safe": false,
    "action": "read_next_action",
    "message": "Return to the current TEST Action and submit only a specifically justified verification budget increase before running more automatic checks."
  }
}
```

## dev_flow_submit_test-budget-checks-correction

<!-- example:mcp-output dev_flow_submit_test budget-checks-correction -->
```json
{
  "ok": false,
  "request_id": "request-example",
  "tool": "dev_flow_submit_test",
  "error": {
    "code": "INVALID_ARGUMENT",
    "message": "The request does not match the closed Core contract.",
    "details": [
      {
        "path": "node_result.budget_adjustment.additional_checks",
        "rule": "budget_checks_required",
        "message": "additional_checks must include at least one check name and a specific explanation, including for a permission-only adjustment"
      }
    ]
  },
  "recovery": {
    "retry_safe": true,
    "action": "correct_current_action",
    "message": "Correct only the members listed in allowed_paths, using facts already confirmed in the current Action work, and resubmit through the same submission tool once. Do not re-expand requirements, change more code, or guess a user decision; stop when the resubmission fails.",
    "allowed_paths": [
      "node_result.budget_adjustment.additional_checks"
    ]
  }
}
```

## dev_flow_submit_test-guard-rejection

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
