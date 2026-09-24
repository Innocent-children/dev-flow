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

[Complete request, successful response and error example](comprehension-examples.md#dev_flow_submit_comprehension-comprehension_passed).

On a committed result, the Task is in `result`; the expected next node for this edge is `DELIVERY`. Read the complete `result.current_action` and any blocker/outcome.

### implementation_defect

Condition: `implementation_defect`; Core guard `implementation_defect_identified`. The required reason states the actual finding or budget need.

[Complete request, successful response and error example](comprehension-examples.md#dev_flow_submit_comprehension-implementation_defect).

On a committed result, the Task is in `result`; the expected next node for this edge is `IMPLEMENT`. Read the complete `result.current_action` and any blocker/outcome.

### code_too_complex

Condition: `code_complexity`; Core guard `code_complexity_identified`. The required reason states the actual finding or budget need.

[Complete request, successful response and error example](comprehension-examples.md#dev_flow_submit_comprehension-code_too_complex).

On a committed result, the Task is in `result`; the expected next node for this edge is `REFACTOR`. Read the complete `result.current_action` and any blocker/outcome.

### design_too_complex

Condition: `design_complexity`; Core guard `design_complexity_identified`. The required reason states the actual finding or budget need.

[Complete request, successful response and error example](comprehension-examples.md#dev_flow_submit_comprehension-design_too_complex).

On a committed result, the Task is in `result`; the expected next node for this edge is `DESIGN`. Read the complete `result.current_action` and any blocker/outcome.

### evidence_insufficient

Condition: `verification_gap`; Core guard `verification_gap_identified`. The required reason states the actual finding or budget need.

[Complete request, successful response and error example](comprehension-examples.md#dev_flow_submit_comprehension-evidence_insufficient).

On a committed result, the Task is in `result`; the expected next node for this edge is `TEST`. Read the complete `result.current_action` and any blocker/outcome.

### requirement_unclear

Condition: `requirement_gap`; Core guard `comprehension_requirement_gap_identified`. The required reason states the actual finding or budget need.

[Complete request, successful response and error example](comprehension-examples.md#dev_flow_submit_comprehension-requirement_unclear).

On a committed result, the Task is in `result`; the expected next node for this edge is `REQUIREMENTS`. Read the complete `result.current_action` and any blocker/outcome.

## Refusal or lost response

`INVALID_ARGUMENT` reports malformed/unknown/missing fields; a guard rejection reports the failed
condition. A current-revision/work-item/evidence mismatch is not fixed by copying an example value.
Follow [complete rejections](../tool-results.md#complete-rejections-and-bounded-corrections).
For an actually missing response, read the retained operation before
[Action recovery](../recovery.md#uncertain-action-recovery). Never replay from the sample.
