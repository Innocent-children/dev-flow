<!-- Generated from skills/taskbelay/core/nodes/refactor.md; edit the shared source and run node scripts/sync-skill-references.mjs. -->

# REFACTOR: taskbelay_submit_refactor

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

[Complete request, successful response and error example](refactor-examples.md#taskbelay_submit_refactor-refactor_ready_for_test).

On a committed result, the Task is in `result`; the expected next node for this edge is `TEST`. Read the complete `result.current_action` and any blocker/outcome.

### refactor_requires_design

Condition: `design_change`; Core guard `refactor_design_change_required`. The required reason states the actual finding or budget need.

[Complete request, successful response and error example](refactor-examples.md#taskbelay_submit_refactor-refactor_requires_design).

On a committed result, the Task is in `result`; the expected next node for this edge is `DESIGN`. Read the complete `result.current_action` and any blocker/outcome.

### refactor_requires_requirements

Condition: `requirement_change`; Core guard `refactor_requirement_change_required`. The required reason states the actual finding or budget need.

[Complete request, successful response and error example](refactor-examples.md#taskbelay_submit_refactor-refactor_requires_requirements).

On a committed result, the Task is in `result`; the expected next node for this edge is `REQUIREMENTS`. Read the complete `result.current_action` and any blocker/outcome.

## Refusal or lost response

`INVALID_ARGUMENT` reports malformed/unknown/missing fields; a guard rejection reports the failed
condition. A current-revision/work-item/evidence mismatch is not fixed by copying an example value.
Follow [complete rejections](../tool-results.md#complete-rejections-and-bounded-corrections).
For an actually missing response, read the retained operation before
[Action recovery](../recovery.md#uncertain-action-recovery). Never replay from the sample.
