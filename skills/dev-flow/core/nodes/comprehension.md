# COMPREHENSION_REVIEW: dev_flow_submit_comprehension

Implementation: `internal/workflow/standard_process.go` — `StandardProcess`.
Implementation: `internal/workflow/payloads.go` — `ValidatePayload, problemClassByTransition`.
Implementation: `internal/application/apply_action_results.go` — `applyComprehensionResult`.

Read the [common procedure](../node-payloads.md#common-submission-procedure) before constructing this input.

## Inputs and prerequisites

Explain the current requirements, design and code paths; identify concrete unnecessary abstractions
and maintenance concerns, then ask: “Can you explain and maintain this implementation?” Wait for the
actual user's verdict. A passed input requires that current explicit answer. Core validates the
source/status fields; The Host is responsible for truthfully obtaining the human answer.

All problem transitions use `user_confirmation:null`. Record the concrete defect, complexity,
verification gap or unresolved question that matches the selected edge. A generic continuation
message is not a comprehension verdict. Method tools cannot supply it.

## Calls and returned Actions

### comprehension_passed

Condition: `none`; Core guard `current_user_comprehension_confirmed`. Use an empty reason when none is required.

<!-- example:mcp dev_flow_submit_comprehension comprehension_passed -->
```json
{
  "host": "{{host}}",
  "task_id": "task-example",
  "action_id": "action-example",
  "transition_id": "comprehension_passed",
  "summary": "Completed the current COMPREHENSION_REVIEW work.",
  "reason": "",
  "artifacts": {
    "current": [],
    "other_process": []
  },
  "method_results": {
    "comprehension.explain": {
      "capability": "",
      "summary": "Completed the current semantic work for the endpoint change."
    },
    "comprehension.identify_complexity": {
      "capability": "",
      "summary": "Completed the current semantic work for the endpoint change."
    },
    "comprehension.obtain_user_verdict": {
      "capability": "",
      "summary": "Completed the current semantic work for the endpoint change."
    }
  },
  "node_result": {
    "problem_class": "none",
    "explained_components": [
      "Endpoint response mapper and its targeted check."
    ],
    "unresolved_questions": [],
    "unnecessary_abstractions": [],
    "maintenance_risks": [],
    "user_confirmation": {
      "source": "user",
      "status": "passed",
      "summary": "The developer explicitly confirmed they can explain and maintain the result."
    },
    "findings": []
  }
}
```

On a committed result, the Task is in `result`; the expected next node for this edge is `DELIVERY`. Read the complete `result.current_action` and any blocker/outcome.

### implementation_defect

Condition: `implementation_defect`; Core guard `implementation_defect_identified`. The required reason states the actual finding or budget need.

<!-- example:mcp dev_flow_submit_comprehension implementation_defect -->
```json
{
  "host": "{{host}}",
  "task_id": "task-example",
  "action_id": "action-example",
  "transition_id": "implementation_defect",
  "summary": "The implementation omits a required response variant.",
  "reason": "The implementation omits a required response variant.",
  "artifacts": {
    "current": [],
    "other_process": []
  },
  "method_results": {
    "comprehension.explain": {
      "capability": "",
      "summary": "Completed the current semantic work and recorded its findings."
    },
    "comprehension.identify_complexity": {
      "capability": "",
      "summary": "Completed the current semantic work and recorded its findings."
    },
    "comprehension.obtain_user_verdict": {
      "capability": "",
      "summary": "Completed the current semantic work and recorded its findings."
    }
  },
  "node_result": {
    "problem_class": "implementation_defect",
    "explained_components": [
      "Endpoint response mapper and its targeted check."
    ],
    "unresolved_questions": [],
    "unnecessary_abstractions": [],
    "maintenance_risks": [],
    "user_confirmation": null,
    "findings": [
      "The implementation omits a required response variant."
    ]
  }
}
```

On a committed result, the Task is in `result`; the expected next node for this edge is `IMPLEMENT`. Read the complete `result.current_action` and any blocker/outcome.

### code_too_complex

Condition: `code_complexity`; Core guard `code_complexity_identified`. The required reason states the actual finding or budget need.

<!-- example:mcp dev_flow_submit_comprehension code_too_complex -->
```json
{
  "host": "{{host}}",
  "task_id": "task-example",
  "action_id": "action-example",
  "transition_id": "code_too_complex",
  "summary": "A redundant wrapper obscures the existing response mapper.",
  "reason": "A redundant wrapper obscures the existing response mapper.",
  "artifacts": {
    "current": [],
    "other_process": []
  },
  "method_results": {
    "comprehension.explain": {
      "capability": "",
      "summary": "Completed the current semantic work and recorded its findings."
    },
    "comprehension.identify_complexity": {
      "capability": "",
      "summary": "Completed the current semantic work and recorded its findings."
    },
    "comprehension.obtain_user_verdict": {
      "capability": "",
      "summary": "Completed the current semantic work and recorded its findings."
    }
  },
  "node_result": {
    "problem_class": "code_complexity",
    "explained_components": [
      "Endpoint response mapper and its targeted check."
    ],
    "unresolved_questions": [],
    "unnecessary_abstractions": [
      "A redundant wrapper obscures the existing response mapper."
    ],
    "maintenance_risks": [],
    "user_confirmation": null,
    "findings": [
      "A redundant wrapper obscures the existing response mapper."
    ]
  }
}
```

On a committed result, the Task is in `result`; the expected next node for this edge is `REFACTOR`. Read the complete `result.current_action` and any blocker/outcome.

### design_too_complex

Condition: `design_complexity`; Core guard `design_complexity_identified`. The required reason states the actual finding or budget need.

<!-- example:mcp dev_flow_submit_comprehension design_too_complex -->
```json
{
  "host": "{{host}}",
  "task_id": "task-example",
  "action_id": "action-example",
  "transition_id": "design_too_complex",
  "summary": "The design adds an unnecessary mapping layer.",
  "reason": "The design adds an unnecessary mapping layer.",
  "artifacts": {
    "current": [],
    "other_process": []
  },
  "method_results": {
    "comprehension.explain": {
      "capability": "",
      "summary": "Completed the current semantic work and recorded its findings."
    },
    "comprehension.identify_complexity": {
      "capability": "",
      "summary": "Completed the current semantic work and recorded its findings."
    },
    "comprehension.obtain_user_verdict": {
      "capability": "",
      "summary": "Completed the current semantic work and recorded its findings."
    }
  },
  "node_result": {
    "problem_class": "design_complexity",
    "explained_components": [
      "Endpoint response mapper and its targeted check."
    ],
    "unresolved_questions": [],
    "unnecessary_abstractions": [
      "The design adds an unnecessary mapping layer."
    ],
    "maintenance_risks": [],
    "user_confirmation": null,
    "findings": [
      "The design adds an unnecessary mapping layer."
    ]
  }
}
```

On a committed result, the Task is in `result`; the expected next node for this edge is `DESIGN`. Read the complete `result.current_action` and any blocker/outcome.

### evidence_insufficient

Condition: `verification_gap`; Core guard `verification_gap_identified`. The required reason states the actual finding or budget need.

<!-- example:mcp dev_flow_submit_comprehension evidence_insufficient -->
```json
{
  "host": "{{host}}",
  "task_id": "task-example",
  "action_id": "action-example",
  "transition_id": "evidence_insufficient",
  "summary": "The required response variant has no current passed check.",
  "reason": "The required response variant has no current passed check.",
  "artifacts": {
    "current": [],
    "other_process": []
  },
  "method_results": {
    "comprehension.explain": {
      "capability": "",
      "summary": "Completed the current semantic work and recorded its findings."
    },
    "comprehension.identify_complexity": {
      "capability": "",
      "summary": "Completed the current semantic work and recorded its findings."
    },
    "comprehension.obtain_user_verdict": {
      "capability": "",
      "summary": "Completed the current semantic work and recorded its findings."
    }
  },
  "node_result": {
    "problem_class": "verification_gap",
    "explained_components": [
      "Endpoint response mapper and its targeted check."
    ],
    "unresolved_questions": [],
    "unnecessary_abstractions": [],
    "maintenance_risks": [],
    "user_confirmation": null,
    "findings": [
      "The required response variant has no current passed check."
    ]
  }
}
```

On a committed result, the Task is in `result`; the expected next node for this edge is `TEST`. Read the complete `result.current_action` and any blocker/outcome.

### requirement_unclear

Condition: `requirement_gap`; Core guard `comprehension_requirement_gap_identified`. The required reason states the actual finding or budget need.

<!-- example:mcp dev_flow_submit_comprehension requirement_unclear -->
```json
{
  "host": "{{host}}",
  "task_id": "task-example",
  "action_id": "action-example",
  "transition_id": "requirement_unclear",
  "summary": "The requested field semantics for an absent source value are unresolved.",
  "reason": "The requested field semantics for an absent source value are unresolved.",
  "artifacts": {
    "current": [],
    "other_process": []
  },
  "method_results": {
    "comprehension.explain": {
      "capability": "",
      "summary": "Completed the current semantic work and recorded its findings."
    },
    "comprehension.identify_complexity": {
      "capability": "",
      "summary": "Completed the current semantic work and recorded its findings."
    },
    "comprehension.obtain_user_verdict": {
      "capability": "",
      "summary": "Completed the current semantic work and recorded its findings."
    }
  },
  "node_result": {
    "problem_class": "requirement_gap",
    "explained_components": [
      "Endpoint response mapper and its targeted check."
    ],
    "unresolved_questions": [
      "The requested field semantics for an absent source value are unresolved."
    ],
    "unnecessary_abstractions": [],
    "maintenance_risks": [],
    "user_confirmation": null,
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
