<!-- Generated from skills/taskbelay/core/nodes/delivery.md; edit the shared source and run node scripts/sync-skill-references.mjs. -->

# DELIVERY: taskbelay_submit_delivery

Implementation: `internal/workflow/standard_process.go` — `StandardProcess`.
Implementation: `internal/workflow/payloads.go` — `ValidatePayload, problemClassByTransition`.
Implementation: `internal/application/apply_action_results.go` — `applyDeliveryResult`.

Read the [common procedure](../node-payloads.md#common-submission-procedure) before constructing this input.

## Inputs and prerequisites

Use current requirements, completed plan work and passed current Test records. Each acceptance
entry must appear in requirement order and contain criterion/status/work_item_ids/evidence_ids.
Every work item must map to that criterion and be completed; evidence IDs come from `task.test.evidence_ids`
and their sources/results from `task.evidence`. An actual passed user check is eligible; comprehension
confirmation is a separate requirement. Core fills aggregate evidence IDs and Test/Comprehension IDs.

For a remediation edge send `acceptance:[]` and the actual findings. For completion, all acceptance
links must be current and unverified items empty. Reconcile method artifacts read-only at this point;
file writes, including archive/sync, invalidate current verification under the existing content guard.
See [artifact timing](../artifacts.md#content-after-implementation).

## Calls and returned Actions

### delivery_complete

Condition: `none`; Core guard `delivery_current_and_complete`. Use an empty reason when none is required.

[Complete request, successful response and error example](delivery-examples.md#taskbelay_submit_delivery-delivery_complete).

On a committed result, the Task is in `result`; the expected next node for this edge is `DONE`. Read `result.outcome` and `result.current_action:null`, then use the [terminal presentation](../host-lifecycle.md#terminal-presentation).

### delivery_needs_implementation

Condition: `implementation_gap`; Core guard `delivery_implementation_gap_identified`. The required reason states the actual finding or budget need.

[Complete request, successful response and error example](delivery-examples.md#taskbelay_submit_delivery-delivery_needs_implementation).

On a committed result, the Task is in `result`; the expected next node for this edge is `IMPLEMENT`. Read the complete `result.current_action` and any blocker/outcome.

### delivery_needs_test

Condition: `test_gap`; Core guard `delivery_test_gap_identified`. The required reason states the actual finding or budget need.

[Complete request, successful response and error example](delivery-examples.md#taskbelay_submit_delivery-delivery_needs_test).

On a committed result, the Task is in `result`; the expected next node for this edge is `TEST`. Read the complete `result.current_action` and any blocker/outcome.

### delivery_needs_comprehension

Condition: `comprehension_gap`; Core guard `delivery_comprehension_gap_identified`. The required reason states the actual finding or budget need.

[Complete request, successful response and error example](delivery-examples.md#taskbelay_submit_delivery-delivery_needs_comprehension).

On a committed result, the Task is in `result`; the expected next node for this edge is `COMPREHENSION_REVIEW`. Read the complete `result.current_action` and any blocker/outcome.

### delivery_needs_design

Condition: `design_gap`; Core guard `delivery_design_gap_identified`. The required reason states the actual finding or budget need.

[Complete request, successful response and error example](delivery-examples.md#taskbelay_submit_delivery-delivery_needs_design).

On a committed result, the Task is in `result`; the expected next node for this edge is `DESIGN`. Read the complete `result.current_action` and any blocker/outcome.

### delivery_needs_requirements

Condition: `requirement_gap`; Core guard `delivery_requirement_gap_identified`. The required reason states the actual finding or budget need.

[Complete request, successful response and error example](delivery-examples.md#taskbelay_submit_delivery-delivery_needs_requirements).

On a committed result, the Task is in `result`; the expected next node for this edge is `REQUIREMENTS`. Read the complete `result.current_action` and any blocker/outcome.

## Refusal or lost response

`INVALID_ARGUMENT` reports malformed/unknown/missing fields; a guard rejection reports the failed
condition. A current-revision/work-item/evidence mismatch is not fixed by copying an example value.
Follow [complete rejections](../tool-results.md#complete-rejections-and-bounded-corrections).
For an actually missing response, read the retained operation before
[Action recovery](../recovery.md#uncertain-action-recovery). Never replay from the sample.
