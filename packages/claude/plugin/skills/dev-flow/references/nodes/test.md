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

[Complete request, successful response and error example](test-examples.md#dev_flow_submit_test-tests_passed).

On a committed result, the Task is in `result`; the expected next node for this edge is `COMPREHENSION_REVIEW`. Read the complete `result.current_action` and any blocker/outcome.

### tests_accepted_with_known_failures

Use only after an actual automated comparison and explicit user acceptance of the exact existing
failure set. Keep the failed checks failed. `known_failure_acceptance` records a separate decision,
not a user/passed check. Its plan revision and content digest are the values the user accepted;
never overwrite them with newer values to make an old confirmation pass. All other checks must pass,
and no unexecuted or pending checks may remain. This is not an override for new or unexplained failures.

Condition: `none`; Core guard `current_known_failures_accepted`. A concrete reason is required.
The existing failure-classification method step covers the comparison and obtaining the verdict.

[Complete request, successful response and error example](test-examples.md#dev_flow_submit_test-tests_accepted_with_known_failures).

On success, the expected next node is COMPREHENSION_REVIEW. `result.test.known_failure_acceptance`
and the original failed evidence remain available through delivery and restart. Delivery criteria
reference actual passed checks; automated/manual evidence lists include only passed results.

### tests_failed_implementation

Condition: `implementation_failure`; Core guard `implementation_failure_identified`. The required reason states the actual finding or budget need.

[Complete request, successful response and error example](test-examples.md#dev_flow_submit_test-tests_failed_implementation).

On a committed result, the Task is in `result`; the expected next node for this edge is `IMPLEMENT`. Read the complete `result.current_action` and any blocker/outcome.

### tests_expose_design_issue

Condition: `design_failure`; Core guard `test_design_failure_identified`. The required reason states the actual finding or budget need.

[Complete request, successful response and error example](test-examples.md#dev_flow_submit_test-tests_expose_design_issue).

On a committed result, the Task is in `result`; the expected next node for this edge is `DESIGN`. Read the complete `result.current_action` and any blocker/outcome.

### tests_expose_requirement_issue

Condition: `requirement_gap`; Core guard `test_requirement_gap_identified`. The required reason states the actual finding or budget need.

[Complete request, successful response and error example](test-examples.md#dev_flow_submit_test-tests_expose_requirement_issue).

On a committed result, the Task is in `result`; the expected next node for this edge is `REQUIREMENTS`. Read the complete `result.current_action` and any blocker/outcome.

### verification_budget_increased

Condition: `none`; Core guard `verification_budget_adjustment_justified`. The required reason states the actual finding or budget need.

[Complete request, successful response and error example](test-examples.md#dev_flow_submit_test-verification_budget_increased).

On a committed result, the Task is in `result`; the expected next node for this edge is `TEST`. Read the complete `result.current_action` and any blocker/outcome.

## Refusal or lost response

`INVALID_ARGUMENT` reports malformed/unknown/missing fields; a guard rejection reports the failed
condition. A current-revision/work-item/evidence mismatch is not fixed by copying an example value.
Follow [complete rejections](../tool-results.md#complete-rejections-and-bounded-corrections).
For an actually missing response, read the retained operation before
[Action recovery](../recovery.md#uncertain-action-recovery). Never replay from the sample.

### Permission-only adjustment

The same `verification_budget_increased` request permits `additional_automatic_commands:0` when a
needed permission changes. Keep `additional_checks` nonempty: name the existing or new check and why
its permission is needed. Populate every required member before submission. A budget error carries
actual counters; a permission error identifies the disallowed operation. Neither requires rerunning
checks that already completed against unchanged content.
