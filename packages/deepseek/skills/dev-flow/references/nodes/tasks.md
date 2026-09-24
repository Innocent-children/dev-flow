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
not general globs. In a Task that declares additional repositories, every expected path is written as
`<repository-key>::<repository-relative-path>`, including paths in the primary repository, which use
`primary_repository_key`; a path without its key, or with a key the Task does not declare, is refused
with `repository_path_invalid`. A single-repository Task writes plain repository-relative paths and a
keyed path is refused. The saved verification_plan owns the initial budget.

## Calls and returned Actions

### tasks_plan_saved

Condition: `none`; Core guard `task_plan_baseline_complete`. Use an empty reason when none is required.

[Complete request, successful response and error example](tasks-examples.md#dev_flow_submit_tasks-tasks_plan_saved).

On a committed result, the Task is in `result`; the expected next node for this edge is `TASKS`. Read the complete `result.current_action` and any blocker/outcome.

### tasks_ready

Condition: `none`; Core guard `current_plan_user_confirmed`. Replace every example digest and revision
with the saved Core values for the plan actually approved by the user.

[Complete request, successful response and error example](tasks-examples.md#dev_flow_submit_tasks-tasks_ready).

The expected next node is IMPLEMENT. Read the complete returned Task and Action.

### tasks_require_design

Condition: `design_gap`; Core guard `design_not_decomposable`. The required reason states the actual finding or budget need.

[Complete request, successful response and error example](tasks-examples.md#dev_flow_submit_tasks-tasks_require_design).

On a committed result, the Task is in `result`; the expected next node for this edge is `DESIGN`. Read the complete `result.current_action` and any blocker/outcome.

### tasks_require_requirements

Condition: `requirement_gap`; Core guard `material_requirement_gap`. The required reason states the actual finding or budget need.

[Complete request, successful response and error example](tasks-examples.md#dev_flow_submit_tasks-tasks_require_requirements).

On a committed result, the Task is in `result`; the expected next node for this edge is `REQUIREMENTS`. Read the complete `result.current_action` and any blocker/outcome.

## Refusal or lost response

`INVALID_ARGUMENT` reports malformed/unknown/missing fields; a guard rejection reports the failed
condition. A current-revision/work-item/evidence mismatch is not fixed by copying an example value.
Follow [complete rejections](../tool-results.md#complete-rejections-and-bounded-corrections).
For an actually missing response, read the retained operation before
[Action recovery](../recovery.md#uncertain-action-recovery). Never replay from the sample.
