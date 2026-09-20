<!-- Generated from skills/dev-flow/core/verification.md; edit the shared source and run node scripts/sync-skill-references.mjs. -->

# Verification

Implementation: `internal/workflow/verification_budget.go` — `EvaluateVerificationBudget, EvidenceViolations`.
Implementation: `internal/application/apply_action_results.go` — `applyVerificationBudgetAdjustment, applyTestResult`.

Choose checks after requirements/design/impact/test structure are understood, then record the initial
plan at TASKS. Before each command reassess current diff, acceptance, causal impact or observed failure.
Use the closest sufficient checks; stop adding checks after the current work is adequately verified.
Remaining capacity alone does not justify broader tests. Before each full suite, state the remaining
risk, why targeted checks are insufficient, the actual impact and any repository requirement for that
checkpoint. Record the current reason, including on a rerun.

If capacity is insufficient, use the [complete budget-increase call](nodes/test.md#verification_budget_increased)
before extra commands. Its basis is new_impact/new_risk/verification_failure/verification_gap; increase
only what the named checks require. Reuse existing check names for additional work on them. An increase
changes capacity and the TEST Action, not test results. A refusal leaves prior capacity current.

Example completed user check (one member of the full TEST checks array):

```json
{"name":"user-response-check","source":"user","status":"passed","summary":"The developer ran the response check and reported it passed.","command_count":0,"full_suite":false,"full_suite_reason":""}
```

Completed user checks do not require allow_manual_handoff; that permission controls work still waiting for manual execution. Use only an actual completed user check. Keep automated/static/Host-observed/user results distinct;
manual_handoff_items lists work not yet run. The [TEST examples](nodes/test.md) contain complete pass,
failure and adjustment calls. On the third exact repeated result/failure/implementation loop, Core may
block; an explicit user decision precedes another attempt.

Host review policy: review the current diff and causal impact, fix only related defects, then recheck
those fixes. Explicit user-requested review stays read-only and stops after findings until repair is
separately requested. Add test code for durable behavior/contracts, important failures or actual
regressions; one-off prose edits normally need a one-off check. This policy chooses work; Core records
the supplied plan/results and remains responsible for transitions.

Known failures use the dedicated `tests_accepted_with_known_failures` transition and separate
`known_failure_acceptance` record in [TEST](nodes/test.md#tests_accepted_with_known_failures). Retain
failed automatic results and a distinct passed regression comparison. Record the exact failed set,
user decision and the content/plan the user accepted. Pending work and new failures require their
normal handling. Reuse a still-current explicit decision; changing acceptance content requires a new
verdict, not an automatic field correction. Delivery links only actual passed checks to criteria.
