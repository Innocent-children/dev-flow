# TASKS: dev_flow_submit_tasks

Implementation: `internal/workflow/standard_process.go` — `StandardProcess`.
Implementation: `internal/workflow/payloads.go` — `ValidatePayload, problemClassByTransition`.
Implementation: `internal/application/apply_action_results.go` — `applyTaskPlanResult`.

Read the [common procedure](../node-payloads.md#common-submission-procedure) before constructing this input.

## Inputs and prerequisites

Read current requirements/design, actual paths and existing tests before planning. Each work
item identifies its paths, acceptance indexes, verification and dependencies. `acceptance_indexes`
are zero-based indexes into current requirements; dependencies refer to IDs in this plan.
`src/file.js` is exact, `src/**` is a directory suffix; `src` is not a prefix and general globs such
as `src/*.js` are unsupported. Multi-repository paths use `key::relative-path`.

Plan every acceptance criterion and the complete Task `current_changed_paths`, including confirmed
carried content, apart from retained process artifacts. A return to design/requirements uses
`baseline:null`. Core fills `design_revision`. Initial verification budget is defined here, after
analysis, and cannot be inferred from Task creation or an earlier plan.

## Calls and returned Actions

### tasks_ready

Condition: `none`; Core guard `task_plan_baseline_complete`. Use an empty reason when none is required.

<!-- example:mcp dev_flow_submit_tasks tasks_ready -->
```json
{
  "host": "{{host}}",
  "task_id": "task-example",
  "action_id": "action-example",
  "transition_id": "tasks_ready",
  "summary": "Completed the current TASKS work.",
  "reason": "",
  "artifacts": {
    "current": [],
    "other_process": []
  },
  "method_results": {
    "tasks.decompose": {
      "capability": "",
      "summary": "Completed the current semantic work for the endpoint change."
    },
    "tasks.map_acceptance": {
      "capability": "",
      "summary": "Completed the current semantic work for the endpoint change."
    },
    "tasks.analyze_consistency": {
      "capability": "",
      "summary": "Completed the current semantic work for the endpoint change."
    },
    "tasks.plan_verification": {
      "capability": "",
      "summary": "Completed the current semantic work for the endpoint change."
    }
  },
  "node_result": {
    "problem_class": "none",
    "baseline": {
      "work_items": [
        {
          "work_item_id": "work-endpoint",
          "summary": "Return the field and cover its response contract.",
          "expected_paths": [
            "src/endpoint.js",
            "tests/endpoint.test.js"
          ],
          "acceptance_indexes": [
            0
          ],
          "verification_steps": [
            "Run endpoint-check."
          ],
          "dependencies": []
        }
      ],
      "verification_plan": {
        "checks": [
          {
            "name": "endpoint-check",
            "rationale": "Check the changed response contract."
          }
        ],
        "initial_budget": {
          "level": "targeted",
          "max_automatic_commands": 2,
          "allow_full_suite": false,
          "allow_manual_handoff": false
        },
        "full_suite_expected": false,
        "test_code_changes_expected": true
      }
    },
    "findings": []
  }
}
```

On a committed result, the Task is in `result`; the expected next node for this edge is `IMPLEMENT`. Read the complete `result.current_action` and any blocker/outcome.

### tasks_require_design

Condition: `design_gap`; Core guard `design_not_decomposable`. The required reason states the actual finding or budget need.

<!-- example:mcp dev_flow_submit_tasks tasks_require_design -->
```json
{
  "host": "{{host}}",
  "task_id": "task-example",
  "action_id": "action-example",
  "transition_id": "tasks_require_design",
  "summary": "The selected response mapper cannot access the required source value.",
  "reason": "The selected response mapper cannot access the required source value.",
  "artifacts": {
    "current": [],
    "other_process": []
  },
  "method_results": {
    "tasks.decompose": {
      "capability": "",
      "summary": "Completed the current semantic work and recorded its findings."
    },
    "tasks.map_acceptance": {
      "capability": "",
      "summary": "Completed the current semantic work and recorded its findings."
    },
    "tasks.analyze_consistency": {
      "capability": "",
      "summary": "Completed the current semantic work and recorded its findings."
    },
    "tasks.plan_verification": {
      "capability": "",
      "summary": "Completed the current semantic work and recorded its findings."
    }
  },
  "node_result": {
    "problem_class": "design_gap",
    "baseline": null,
    "findings": [
      "The selected response mapper cannot access the required source value."
    ]
  }
}
```

On a committed result, the Task is in `result`; the expected next node for this edge is `DESIGN`. Read the complete `result.current_action` and any blocker/outcome.

### tasks_require_requirements

Condition: `requirement_gap`; Core guard `material_requirement_gap`. The required reason states the actual finding or budget need.

<!-- example:mcp dev_flow_submit_tasks tasks_require_requirements -->
```json
{
  "host": "{{host}}",
  "task_id": "task-example",
  "action_id": "action-example",
  "transition_id": "tasks_require_requirements",
  "summary": "The requested field semantics for an absent source value are unresolved.",
  "reason": "The requested field semantics for an absent source value are unresolved.",
  "artifacts": {
    "current": [],
    "other_process": []
  },
  "method_results": {
    "tasks.decompose": {
      "capability": "",
      "summary": "Completed the current semantic work and recorded its findings."
    },
    "tasks.map_acceptance": {
      "capability": "",
      "summary": "Completed the current semantic work and recorded its findings."
    },
    "tasks.analyze_consistency": {
      "capability": "",
      "summary": "Completed the current semantic work and recorded its findings."
    },
    "tasks.plan_verification": {
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

On a committed result, the Task is in `result`; the expected next node for this edge is `REQUIREMENTS`. Read the complete `result.current_action` and any blocker/outcome.

## Refusal or lost response

`INVALID_ARGUMENT` reports malformed/unknown/missing fields; a guard rejection reports the failed
condition. A current-revision/work-item/evidence mismatch is not fixed by copying an example value.
Follow [complete rejections](../tool-results.md#complete-rejections-and-bounded-corrections).
For an actually missing response, read the retained operation before
[Action recovery](../tool-results.md#uncertain-action-recovery). Never replay from the sample.
