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

The ordinary passed transition has no failed/unverified/pending manual items. Failure transitions have concrete
findings; `failed_items` names checks while `findings` explains the defect. Budget increases occur
before extra commands: they contain an adjustment and empty result lists. Existing checks may receive
additional capacity. Core returns a new TEST Action and records no passed check for an increase.
Completed user checks belong in checks and do not require allow_manual_handoff; only work not yet run belongs in manual_handoff_items.

Core may commit a TEST result into BLOCKED on the third exact repetition. Read the actual returned
blocker/outcome; the expected destination below never overrides it.

## Calls and returned Actions

### tests_passed

Condition: `none`; Core guard `current_tests_pass`. Use an empty reason when none is required.

<!-- example:mcp dev_flow_submit_test tests_passed -->
```json
{
  "host": "deepseek",
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

Complete successful request and response: [view every returned field](../successes/dev_flow_submit_test-tests_passed.md).

Possible error for this request: Assume the retained Task and Action are current. the first check is supplied as `source:"user"` while its `command_count` remains 1.

Implementation: `internal/mcp/tools.go` — `ValidateToolInput`;
`internal/workflow/verification_budget.go` — `EvidenceViolations`;
`internal/workflow/payloads.go` — `ValidatePayload`;
`internal/mcp/results.go` — `EncodeError, publicFailure, boundedCorrectionPaths, requestCorrectionPaths`.

<!-- error-case: {"operation":"set","path":"node_result.checks.0.source","value":"user"} -->
<!-- example:mcp-output dev_flow_submit_test tests_passed-error -->
```json
{
  "ok": false,
  "request_id": "request-error-example",
  "tool": "dev_flow_submit_test",
  "error": {
    "code": "INVALID_ARGUMENT",
    "message": "The request does not match the closed Core contract.",
    "details": [
      {
        "path": "node_result.checks[0].command_count",
        "rule": "non_automated_command_count_zero",
        "message": "command_count must equal 0 when source is user, static or host_observed"
      }
    ]
  },
  "recovery": {
    "retry_safe": true,
    "action": "correct_current_action",
    "message": "Correct only the members listed in allowed_paths, using facts already confirmed in the current Action work, and resubmit through the same submission tool once. Do not re-expand requirements, change more code, or guess a user decision; stop when the resubmission fails.",
    "allowed_paths": [
      "node_result.checks[0].command_count"
    ]
  }
}
```

Follow this response’s `recovery.action` and the [response rules](../tool-results.md). Reuse confirmed facts; ask only for a missing user decision.


On a committed result, the Task is in `result`; the expected next node for this edge is `COMPREHENSION_REVIEW`. Read the complete `result.current_action` and any blocker/outcome.

### tests_accepted_with_known_failures

Use only after an actual automated comparison and explicit user acceptance of the exact existing
failure set. Keep the failed checks failed. `known_failure_acceptance` records a separate decision,
not a user/passed check. Its plan revision and content digest are the values the user accepted;
never overwrite them with newer values to make an old confirmation pass. All other checks must pass,
and no unexecuted or pending checks may remain. This is not an override for new or unexplained failures.

Condition: `none`; Core guard `current_known_failures_accepted`. A concrete reason is required.
The existing failure-classification method step covers the comparison and obtaining the verdict.

<!-- example:mcp dev_flow_submit_test tests_accepted_with_known_failures -->
```json
{
  "host": "deepseek",
  "task_id": "task-example",
  "action_id": "action-example",
  "transition_id": "tests_accepted_with_known_failures",
  "summary": "Related checks pass; the user accepts the listed existing suite failure.",
  "reason": "The comparison found no new or changed failures and the developer explicitly accepted this set.",
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
        "name": "python-suite",
        "source": "automated",
        "status": "failed",
        "summary": "The suite retains the existing failures; its exit status is nonzero.",
        "command_count": 1,
        "full_suite": false,
        "full_suite_reason": ""
      },
      {
        "name": "regression-comparison",
        "source": "automated",
        "status": "passed",
        "summary": "Compared failure identities and error contents with the starting commit; no new or changed failures.",
        "command_count": 1,
        "full_suite": false,
        "full_suite_reason": ""
      }
    ],
    "failed_items": [
      "python-suite"
    ],
    "unverified_items": [],
    "manual_handoff_items": [],
    "findings": [],
    "budget_adjustment": null,
    "known_failure_acceptance": {
      "source": "user",
      "summary": "The developer accepts these existing failures after reviewing the comparison.",
      "failed_checks": [
        "python-suite"
      ],
      "comparison_check": "regression-comparison",
      "task_plan_revision": 1,
      "content_digest": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    }
  }
}
```

Complete successful request and response: [view every returned field](../successes/dev_flow_submit_test-tests_accepted_with_known_failures.md).

Possible error for this request: Assume the retained Task and Action are current. `node_result.known_failure_acceptance` is omitted from the request.

Implementation: `internal/mcp/tools.go` — `ValidateToolInput`;
`internal/workflow/test_acceptance.go` — `validateKnownFailureAcceptance`;
`internal/mcp/results.go` — `EncodeError, publicFailure, boundedCorrectionPaths, requestCorrectionPaths`.

<!-- error-case: {"operation":"remove","path":"node_result.known_failure_acceptance"} -->
<!-- example:mcp-output dev_flow_submit_test tests_accepted_with_known_failures-error -->
```json
{
  "ok": false,
  "request_id": "request-error-example",
  "tool": "dev_flow_submit_test",
  "error": {
    "code": "INVALID_ARGUMENT",
    "message": "The request does not match the closed Core contract.",
    "details": [
      {
        "path": "node_result.known_failure_acceptance",
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
      "node_result.known_failure_acceptance"
    ]
  }
}
```

Follow this response’s `recovery.action` and the [response rules](../tool-results.md). Reuse confirmed facts; ask only for a missing user decision.


On success, the expected next node is COMPREHENSION_REVIEW. `result.test.known_failure_acceptance`
and the original failed evidence remain available through delivery and restart. Delivery criteria
reference actual passed checks; automated/manual evidence lists include only passed results.

### tests_failed_implementation

Condition: `implementation_failure`; Core guard `implementation_failure_identified`. The required reason states the actual finding or budget need.

<!-- example:mcp dev_flow_submit_test tests_failed_implementation -->
```json
{
  "host": "deepseek",
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

Complete successful request and response: [view every returned field](../successes/dev_flow_submit_test-tests_failed_implementation.md).

Possible error for this request: Assume the retained Task and Action are current. `node_result.findings` is empty while this transition reports a problem requiring remediation.

Implementation: `internal/mcp/tools.go` — `ValidateToolInput`;
`internal/workflow/payloads.go` — `ValidatePayload, validateProblemClass`;
`internal/workflow/standard_process.go` — `standardTransitions`;
`internal/mcp/results.go` — `EncodeError, publicFailure, boundedCorrectionPaths, requestCorrectionPaths`.

<!-- error-case: {"operation":"set","path":"node_result.findings","value":[]} -->
<!-- example:mcp-output dev_flow_submit_test tests_failed_implementation-error -->
```json
{
  "ok": false,
  "request_id": "request-error-example",
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

Follow this response’s `recovery.action` and the [response rules](../tool-results.md). Reuse confirmed facts; ask only for a missing user decision.


On a committed result, the Task is in `result`; the expected next node for this edge is `IMPLEMENT`. Read the complete `result.current_action` and any blocker/outcome.

### tests_expose_design_issue

Condition: `design_failure`; Core guard `test_design_failure_identified`. The required reason states the actual finding or budget need.

<!-- example:mcp dev_flow_submit_test tests_expose_design_issue -->
```json
{
  "host": "deepseek",
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

Complete successful request and response: [view every returned field](../successes/dev_flow_submit_test-tests_expose_design_issue.md).

Possible error for this request: Assume the retained Task and Action are current. `node_result.findings` is empty while this transition reports a problem requiring remediation.

Implementation: `internal/mcp/tools.go` — `ValidateToolInput`;
`internal/workflow/payloads.go` — `ValidatePayload, validateProblemClass`;
`internal/workflow/standard_process.go` — `standardTransitions`;
`internal/mcp/results.go` — `EncodeError, publicFailure, boundedCorrectionPaths, requestCorrectionPaths`.

<!-- error-case: {"operation":"set","path":"node_result.findings","value":[]} -->
<!-- example:mcp-output dev_flow_submit_test tests_expose_design_issue-error -->
```json
{
  "ok": false,
  "request_id": "request-error-example",
  "tool": "dev_flow_submit_test",
  "error": {
    "code": "TRANSITION_NOT_ALLOWED",
    "message": "The transition guard was not satisfied.",
    "guard": {
      "guard_id": "test_design_failure_identified",
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

### tests_expose_requirement_issue

Condition: `requirement_gap`; Core guard `test_requirement_gap_identified`. The required reason states the actual finding or budget need.

<!-- example:mcp dev_flow_submit_test tests_expose_requirement_issue -->
```json
{
  "host": "deepseek",
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

Complete successful request and response: [view every returned field](../successes/dev_flow_submit_test-tests_expose_requirement_issue.md).

Possible error for this request: Assume the retained Task and Action are current. `node_result.findings` is empty while this transition reports a problem requiring remediation.

Implementation: `internal/mcp/tools.go` — `ValidateToolInput`;
`internal/workflow/payloads.go` — `ValidatePayload, validateProblemClass`;
`internal/workflow/standard_process.go` — `standardTransitions`;
`internal/mcp/results.go` — `EncodeError, publicFailure, boundedCorrectionPaths, requestCorrectionPaths`.

<!-- error-case: {"operation":"set","path":"node_result.findings","value":[]} -->
<!-- example:mcp-output dev_flow_submit_test tests_expose_requirement_issue-error -->
```json
{
  "ok": false,
  "request_id": "request-error-example",
  "tool": "dev_flow_submit_test",
  "error": {
    "code": "TRANSITION_NOT_ALLOWED",
    "message": "The transition guard was not satisfied.",
    "guard": {
      "guard_id": "test_requirement_gap_identified",
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

### verification_budget_increased

Condition: `none`; Core guard `verification_budget_adjustment_justified`. The required reason states the actual finding or budget need.

<!-- example:mcp dev_flow_submit_test verification_budget_increased -->
```json
{
  "host": "deepseek",
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

Complete successful request and response: [view every returned field](../successes/dev_flow_submit_test-verification_budget_increased.md).

Possible error for this request: Assume the retained Task and Action are current. `node_result.budget_adjustment.additional_checks` is empty, including when only a permission is being changed.

Implementation: `internal/mcp/tools.go` — `ValidateToolInput`;
`internal/workflow/payloads.go` — `ValidatePayload`;
`internal/mcp/results.go` — `EncodeError, publicFailure, boundedCorrectionPaths, requestCorrectionPaths`.

<!-- error-case: {"operation":"set","path":"node_result.budget_adjustment.additional_checks","value":[]} -->
<!-- example:mcp-output dev_flow_submit_test verification_budget_increased-error -->
```json
{
  "ok": false,
  "request_id": "request-error-example",
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

Follow this response’s `recovery.action` and the [response rules](../tool-results.md). Reuse confirmed facts; ask only for a missing user decision.


On a committed result, the Task is in `result`; the expected next node for this edge is `TEST`. Read the complete `result.current_action` and any blocker/outcome.

## Refusal or lost response

`INVALID_ARGUMENT` reports malformed/unknown/missing fields; a guard rejection reports the failed
condition. A current-revision/work-item/evidence mismatch is not fixed by copying an example value.
Follow [complete rejections](../tool-results.md#complete-rejections-and-bounded-corrections).
For an actually missing response, read the retained operation before
[Action recovery](../tool-results.md#uncertain-action-recovery). Never replay from the sample.

### Permission-only adjustment

The same `verification_budget_increased` request permits `additional_automatic_commands:0` when a
needed permission changes. Keep `additional_checks` nonempty: name the existing or new check and why
its permission is needed. Populate every required member before submission. A budget error carries
actual counters; a permission error identifies the disallowed operation. Neither requires rerunning
checks that already completed against unchanged content.
