# DESIGN: taskbelay_submit_design

Implementation: `internal/workflow/standard_process.go` — `StandardProcess`.
Implementation: `internal/workflow/payloads.go` — `ValidatePayload, problemClassByTransition`.
Implementation: `internal/application/apply_action_results.go` — `applyDesignResult`.

Read the [common procedure](../node-payloads.md#common-submission-procedure) before constructing this input.

## Inputs and prerequisites

Show the proposed approach, affected components, decisions, alternatives and risks to the developer and discuss requested changes. This presentation is part of the planning work, not a silent internal step. The final TASKS confirmation covers this exact design together with requirements and the complete work/file/verification plan.

Read current requirements and the actual affected code. A ready result supplies the complete
baseline; a requirement return supplies `baseline:null` and findings. `complexity_justification`
is a string array. Core fills `requirements_revision`; the Host omits it.

## Calls and returned Actions

### design_ready

Condition: `none`; Core guard `design_baseline_complete`. Use an empty reason when none is required.

[Complete request, successful response and error example](design-examples.md#taskbelay_submit_design-design_ready).

On a committed result, the Task is in `result`; the expected next node for this edge is `TASKS`. Read the complete `result.current_action` and any blocker/outcome.

### design_requires_requirements

Condition: `requirement_gap`; Core guard `material_requirement_gap`. The required reason states the actual finding or budget need.

[Complete request, successful response and error example](design-examples.md#taskbelay_submit_design-design_requires_requirements).

On a committed result, the Task is in `result`; the expected next node for this edge is `REQUIREMENTS`. Read the complete `result.current_action` and any blocker/outcome.

## Refusal or lost response

`INVALID_ARGUMENT` reports malformed/unknown/missing fields; a guard rejection reports the failed
condition. A current-revision/work-item/evidence mismatch is not fixed by copying an example value.
Follow [complete rejections](../tool-results.md#complete-rejections-and-bounded-corrections).
For an actually missing response, read the retained operation before
[Action recovery](../recovery.md#uncertain-action-recovery). Never replay from the sample.
