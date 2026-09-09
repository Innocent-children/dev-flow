<!-- Generated from skills/dev-flow/core/nodes/test.md; edit the shared source and run node scripts/sync-skill-references.mjs. -->

# TEST: dev_flow_submit_test

Implementation: `internal/workflow/standard_process.go` — `StandardProcess`.
Implementation: `internal/workflow/payloads.go` — `ValidatePayload, problemClassByTransition`.
Implementation: `internal/application/apply_action_results.go` — `applyTestResult`.

Read the [common procedure](../node-payloads.md#common-submission-procedure) before constructing this input.

## Inputs and prerequisites

Read current implementation, Task Plan, remaining budget and actual command results. Every check
contains name/source/status/summary/command_count/full_suite/full_suite_reason. Automated checks
use 1–20 commands per check; user/static/host_observed checks use zero, full_suite false and an empty
full_suite_reason. A full suite needs a fresh concrete justification; see [verification](../artifacts.md#verification).

A passed transition has no failed/unverified/pending manual items. Failure transitions have concrete
findings; `failed_items` names checks while `findings` explains the defect. Budget increases occur
before extra commands: they contain an adjustment and empty result lists. Existing checks may receive
additional capacity. Core returns a new TEST Action and records no passed check for an increase.
Completed user checks belong in checks; only work not yet run belongs in manual_handoff_items.

Core may commit a TEST result into BLOCKED on the third exact repetition. Read the actual returned
blocker/outcome; the expected destination below never overrides it.

## Calls and returned Actions

### tests_passed

Condition: `none`; Core guard `current_tests_pass`. Use an empty reason when none is required.

<!-- example:mcp dev_flow_submit_test tests_passed -->
```json
{
  "host": "codex",
  "task_id": "task-example",
  "action_id": "action-example",
  "transition_id": "tests_passed",
  "summary": "Completed the current TEST work.",
  "reason": "",
  "artifacts": {
    "current": [],
    "other_process": []
  },
  "method_results": {
    "test.run_budgeted_checks": {
      "capability": "",
      "summary": "Completed the current semantic work for the endpoint change."
    },
    "test.record_evidence": {
      "capability": "",
      "summary": "Completed the current semantic work for the endpoint change."
    },
    "test.classify_failure": {
      "capability": "",
      "summary": "Completed the current semantic work for the endpoint change."
    }
  },
  "node_result": {
    "problem_class": "none",
    "checks": [
      {
        "name": "endpoint-check",
        "source": "automated",
        "status": "passed",
        "summary": "The targeted response check passed.",
        "command_count": 1,
        "full_suite": false,
        "full_suite_reason": ""
      }
    ],
    "failed_items": [],
    "unverified_items": [],
    "manual_handoff_items": [],
    "findings": [],
    "budget_adjustment": null
  }
}
```

On a committed result, the Task is in `result`; the expected next node for this edge is `COMPREHENSION_REVIEW`. Read the complete `result.current_action` and any blocker/outcome.

### tests_failed_implementation

Condition: `implementation_failure`; Core guard `implementation_failure_identified`. The required reason states the actual finding or budget need.

<!-- example:mcp dev_flow_submit_test tests_failed_implementation -->
```json
{
  "host": "codex",
  "task_id": "task-example",
  "action_id": "action-example",
  "transition_id": "tests_failed_implementation",
  "summary": "The response mapper omits the requested field for a valid request.",
  "reason": "The response mapper omits the requested field for a valid request.",
  "artifacts": {
    "current": [],
    "other_process": []
  },
  "method_results": {
    "test.run_budgeted_checks": {
      "capability": "",
      "summary": "Completed the current semantic work and recorded its findings."
    },
    "test.record_evidence": {
      "capability": "",
      "summary": "Completed the current semantic work and recorded its findings."
    },
    "test.classify_failure": {
      "capability": "",
      "summary": "Completed the current semantic work and recorded its findings."
    }
  },
  "node_result": {
    "problem_class": "implementation_failure",
    "checks": [
      {
        "name": "endpoint-check",
        "source": "automated",
        "status": "failed",
        "summary": "The response mapper omits the requested field for a valid request.",
        "command_count": 1,
        "full_suite": false,
        "full_suite_reason": ""
      }
    ],
    "failed_items": [
      "endpoint-check"
    ],
    "unverified_items": [
      "The corrected response behavior remains unverified."
    ],
    "manual_handoff_items": [],
    "findings": [
      "The response mapper omits the requested field for a valid request."
    ],
    "budget_adjustment": null
  }
}
```

On a committed result, the Task is in `result`; the expected next node for this edge is `IMPLEMENT`. Read the complete `result.current_action` and any blocker/outcome.

### tests_expose_design_issue

Condition: `design_failure`; Core guard `test_design_failure_identified`. The required reason states the actual finding or budget need.

<!-- example:mcp dev_flow_submit_test tests_expose_design_issue -->
```json
{
  "host": "codex",
  "task_id": "task-example",
  "action_id": "action-example",
  "transition_id": "tests_expose_design_issue",
  "summary": "The selected mapping approach cannot represent the required response variant.",
  "reason": "The selected mapping approach cannot represent the required response variant.",
  "artifacts": {
    "current": [],
    "other_process": []
  },
  "method_results": {
    "test.run_budgeted_checks": {
      "capability": "",
      "summary": "Completed the current semantic work and recorded its findings."
    },
    "test.record_evidence": {
      "capability": "",
      "summary": "Completed the current semantic work and recorded its findings."
    },
    "test.classify_failure": {
      "capability": "",
      "summary": "Completed the current semantic work and recorded its findings."
    }
  },
  "node_result": {
    "problem_class": "design_failure",
    "checks": [
      {
        "name": "endpoint-check",
        "source": "automated",
        "status": "failed",
        "summary": "The selected mapping approach cannot represent the required response variant.",
        "command_count": 1,
        "full_suite": false,
        "full_suite_reason": ""
      }
    ],
    "failed_items": [
      "endpoint-check"
    ],
    "unverified_items": [
      "The corrected response behavior remains unverified."
    ],
    "manual_handoff_items": [],
    "findings": [
      "The selected mapping approach cannot represent the required response variant."
    ],
    "budget_adjustment": null
  }
}
```

On a committed result, the Task is in `result`; the expected next node for this edge is `DESIGN`. Read the complete `result.current_action` and any blocker/outcome.

### tests_expose_requirement_issue

Condition: `requirement_gap`; Core guard `test_requirement_gap_identified`. The required reason states the actual finding or budget need.

<!-- example:mcp dev_flow_submit_test tests_expose_requirement_issue -->
```json
{
  "host": "codex",
  "task_id": "task-example",
  "action_id": "action-example",
  "transition_id": "tests_expose_requirement_issue",
  "summary": "The requested field semantics for an absent source value are unresolved.",
  "reason": "The requested field semantics for an absent source value are unresolved.",
  "artifacts": {
    "current": [],
    "other_process": []
  },
  "method_results": {
    "test.run_budgeted_checks": {
      "capability": "",
      "summary": "Completed the current semantic work and recorded its findings."
    },
    "test.record_evidence": {
      "capability": "",
      "summary": "Completed the current semantic work and recorded its findings."
    },
    "test.classify_failure": {
      "capability": "",
      "summary": "Completed the current semantic work and recorded its findings."
    }
  },
  "node_result": {
    "problem_class": "requirement_gap",
    "checks": [
      {
        "name": "endpoint-check",
        "source": "automated",
        "status": "failed",
        "summary": "The requested field semantics for an absent source value are unresolved.",
        "command_count": 1,
        "full_suite": false,
        "full_suite_reason": ""
      }
    ],
    "failed_items": [
      "endpoint-check"
    ],
    "unverified_items": [
      "The corrected response behavior remains unverified."
    ],
    "manual_handoff_items": [],
    "findings": [
      "The requested field semantics for an absent source value are unresolved."
    ],
    "budget_adjustment": null
  }
}
```

On a committed result, the Task is in `result`; the expected next node for this edge is `REQUIREMENTS`. Read the complete `result.current_action` and any blocker/outcome.

### verification_budget_increased

Condition: `none`; Core guard `verification_budget_adjustment_justified`. The required reason states the actual finding or budget need.

<!-- example:mcp dev_flow_submit_test verification_budget_increased -->
```json
{
  "host": "codex",
  "task_id": "task-example",
  "action_id": "action-example",
  "transition_id": "verification_budget_increased",
  "summary": "One newly identified response variant needs an additional targeted check before execution.",
  "reason": "One newly identified response variant needs an additional targeted check before execution.",
  "artifacts": {
    "current": [],
    "other_process": []
  },
  "method_results": {
    "test.run_budgeted_checks": {
      "capability": "",
      "summary": "Recorded the pre-run budget need."
    },
    "test.record_evidence": {
      "capability": "",
      "summary": "Recorded the pre-run budget need."
    },
    "test.classify_failure": {
      "capability": "",
      "summary": "Recorded the pre-run budget need."
    }
  },
  "node_result": {
    "problem_class": "none",
    "checks": [],
    "failed_items": [],
    "unverified_items": [],
    "manual_handoff_items": [],
    "findings": [],
    "budget_adjustment": {
      "basis": "verification_gap",
      "additional_checks": [
        {
          "name": "endpoint-check",
          "rationale": "The response variant discovered during verification requires one additional targeted command."
        }
      ],
      "additional_automatic_commands": 1,
      "allow_full_suite": false,
      "allow_manual_handoff": false
    }
  }
}
```

On a committed result, the Task is in `result`; the expected next node for this edge is `TEST`. Read the complete `result.current_action` and any blocker/outcome.

## Refusal or lost response

`INVALID_ARGUMENT` reports malformed/unknown/missing fields; a guard rejection reports the failed
condition. A current-revision/work-item/evidence mismatch is not fixed by copying an example value.
Follow [complete rejections](../tool-results.md#complete-rejections-and-bounded-corrections).
For an actually missing response, read the retained operation before
[Action recovery](../tool-results.md#uncertain-action-recovery). Never replay from the sample.
