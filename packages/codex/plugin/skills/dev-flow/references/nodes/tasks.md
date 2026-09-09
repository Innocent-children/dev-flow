<!-- Generated from skills/dev-flow/core/nodes/tasks.md; edit the shared source and run node scripts/sync-skill-references.mjs. -->

# TASKS: dev_flow_submit_tasks

Implementation: `internal/workflow/standard_process.go` — `StandardProcess`.
Implementation: `internal/workflow/payloads.go` — `ValidatePayload, problemClassByTransition`.
Implementation: `internal/application/apply_action_results.go` — `applyTaskPlanResult`.

Read the [common procedure](../node-payloads.md#common-submission-procedure) before constructing this input.

## Inputs and prerequisites

Show the requirements, design, work items, expected files and verification plan to the developer.
Use exact files first and explain the reason and coverage of each directory/** range. Include additions,
modifications and removals with their purposes. Discuss objections and revise the applicable planning
node; choosing Dev Flow or a worktree is not approval of an implementation plan.

First use `tasks_plan_saved` with a complete baseline, empty findings and `user_confirmation:null`.
Core saves the plan and stays in TASKS. Read the saved requirements/design digests and task_plan digest
and revision. Present that exact complete plan and obtain the user's explicit approval. An earlier
explicit approval remains usable only if it covers this same content; do not invent a verdict or
silently approve newly added details. Waiting for a reply stays in TASKS with no blocker.

Then use `tasks_ready` with `baseline:null`, empty findings and the user's confirmation quoting those
four current values. Core saves the confirmation and its time in `task_plan.confirmation` and
`task_plan.confirmed_at`. A missing/mismatched confirmation cannot enter IMPLEMENT. Do not edit plan
artifacts while confirming; save any revised plan first. Every save creates a new plan revision,
including an identical resave, and requires a current confirmation. Resume a saved draft without
resaving it unnecessarily. Returning upstream invalidates downstream planning; expand_scope returns
to TASKS and requires a revised plan and confirmation. The two existing upstream-return edges still
require findings, a reason, `baseline:null` and `user_confirmation:null`.

Core fills baseline.design_revision only for plan saving. Work-item acceptance_indexes are zero-based
indexes into current requirements.acceptance_criteria. expected_paths supports exact paths or directory/**,
including repository-qualified paths. The saved verification_plan owns the initial budget.

## Calls and returned Actions

### tasks_plan_saved

Condition: `none`; Core guard `task_plan_baseline_complete`. Use an empty reason when none is required.

<!-- example:mcp dev_flow_submit_tasks tasks_plan_saved -->
```json
{
  "host": "codex",
  "task_id": "task-example",
  "action_id": "action-example",
  "transition_id": "tasks_plan_saved",
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
    "user_confirmation": null,
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

On a committed result, the Task is in `result`; the expected next node for this edge is `TASKS`. Read the complete `result.current_action` and any blocker/outcome.

### tasks_ready

Condition: `none`; Core guard `current_plan_user_confirmed`. Replace every example digest and revision
with the saved Core values for the plan actually approved by the user.

<!-- example:mcp dev_flow_submit_tasks tasks_ready -->
```json
{
  "host": "codex",
  "task_id": "task-example",
  "action_id": "action-example",
  "transition_id": "tasks_ready",
  "summary": "The user approved the displayed complete current plan.",
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
    "baseline": null,
    "findings": [],
    "user_confirmation": {
      "source": "user",
      "status": "passed",
      "summary": "The developer approved the requirements, design, work items, files and verification.",
      "requirements_digest": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "design_digest": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      "task_plan_digest": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      "task_plan_revision": 1
    }
  }
}
```

The expected next node is IMPLEMENT. Read the complete returned Task and Action.

### tasks_require_design

Condition: `design_gap`; Core guard `design_not_decomposable`. The required reason states the actual finding or budget need.

<!-- example:mcp dev_flow_submit_tasks tasks_require_design -->
```json
{
  "host": "codex",
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
    "user_confirmation": null,
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
  "host": "codex",
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
    "user_confirmation": null,
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
