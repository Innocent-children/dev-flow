# IMPLEMENT: taskbelay_submit_implementation

Implementation: `internal/workflow/standard_process.go` — `StandardProcess`.
Implementation: `internal/workflow/payloads.go` — `ValidatePayload, problemClassByTransition`.
Implementation: `internal/application/apply_action_results.go` — `applyImplementationResult`.

Read the [common procedure](../node-payloads.md#common-submission-procedure) before constructing this input.

## Inputs and prerequisites

Complete every work item in the current plan before selecting the TEST transition. Send actual
completed work-item IDs and deviations; Core computes changed files and fills `task_plan_revision`.
Problem transitions carry concrete findings and only the work actually completed so far. This node
has no `artifacts.current`; process references use `other_process`. Prepare product changes with
`slot:"product"` through the artifact helper.

## Calls and returned Actions

### implementation_ready_for_test

Condition: `none`; Core guard `implementation_report_complete`. Use an empty reason when none is required.

[Complete request, successful response and error example](implementation-examples.md#taskbelay_submit_implementation-implementation_ready_for_test).

On a committed result, the Task is in `result`; the expected next node for this edge is `TEST`. Read the complete `result.current_action` and any blocker/outcome.

### implementation_requires_design

Condition: `design_gap`; Core guard `implementation_exposes_design_gap`. The required reason states the actual finding or budget need.

[Complete request, successful response and error example](implementation-examples.md#taskbelay_submit_implementation-implementation_requires_design).

On a committed result, the Task is in `result`; the expected next node for this edge is `DESIGN`. Read the complete `result.current_action` and any blocker/outcome.

### implementation_requires_requirements

Condition: `requirement_gap`; Core guard `material_requirement_gap`. The required reason states the actual finding or budget need.

[Complete request, successful response and error example](implementation-examples.md#taskbelay_submit_implementation-implementation_requires_requirements).

On a committed result, the Task is in `result`; the expected next node for this edge is `REQUIREMENTS`. Read the complete `result.current_action` and any blocker/outcome.

### implementation_needs_refactor

Condition: `code_complexity`; Core guard `implementation_complexity_identified`. The required reason states the actual finding or budget need.

[Complete request, successful response and error example](implementation-examples.md#taskbelay_submit_implementation-implementation_needs_refactor).

On a committed result, the Task is in `result`; the expected next node for this edge is `REFACTOR`. Read the complete `result.current_action` and any blocker/outcome.

## Refusal or lost response

`INVALID_ARGUMENT` reports malformed/unknown/missing fields; a guard rejection reports the failed
condition. A current-revision/work-item/evidence mismatch is not fixed by copying an example value.
Follow [complete rejections](../tool-results.md#complete-rejections-and-bounded-corrections).
For an actually missing response, read the retained operation before
[Action recovery](../recovery.md#uncertain-action-recovery). Never replay from the sample.
