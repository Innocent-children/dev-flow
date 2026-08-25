# current Core contract Node Payload Construction

This reference helps the Host Adapter construct the one closed payload branch returned by the
current Core Action. It is not a process definition, transition table, cursor, or authority. The
fresh Action, the live `dev_flow_apply_action` `inputSchema`, and Core validation remain authoritative.

## Construction rules

Before every ordinary apply:

1. Bind one complete fresh Action and read `action_kind`, `current_node`, `payload_contract`,
   `method_steps`, and every `available_transition`.
2. Select only a transition returned by that Action. Never submit `destination`, `next_node`,
   `next_cursor`, resume node, guard result, or caller classification.
3. The live `dev_flow_apply_action` `inputSchema` is one closed object. `action_kind` is a top-level
   `enum` of every action kind and `payload.node_result` declares the union of every node result
   member, so the schema does not narrow the payload by `action_kind`. Select the branch from the
   fresh Action's `action_kind` and `payload_contract`, send only that branch's `node_result` members,
   and use exactly the six common payload members: `transition_id`, `summary`, `reason`, `artifacts`,
   `method_evidence`, and `node_result`.
   Set `reason=""` whenever the selected transition has `reason_required=false`; provide a nonempty
   reason only when the selected transition has `reason_required=true`.
4. `required_evidence` and `artifacts` are different concepts. `repository_observation` is a Core evidence requirement, not an ArtifactReference role. When no real repository-relative process
   artifact exists, submit `"artifacts": []`.
5. Allowed ArtifactReference roles are only `requirements`, `design`, `task_plan`,
   `implementation`, `test`, `comprehension`, `refactor`, `delivery`, and `other_process`.
   For every ArtifactReference path, work-item `expected_paths`, and node-result `changed_paths`, use
   an ordinary repository-relative path for a single-repository Task
   and `<repository-key>::<repository-relative-path>` for a multi-repository Task. The key must
   already belong to the immutable Core Scope. Do not add a payload field or a second digest.
6. Preserve the complete `node_result` branch wrapper. Every standard node result reports exact
   `changed_paths` or `no_file_changes`; exactly one of a nonempty path list or
   `no_file_changes=true` describes the current effect. Artifact references remain evidence and do
   not replace this mutation envelope. Never flatten baseline fields or encode an array as prose.
7. Submit exactly one MethodEvidence item for every current Action method step, in Action order.
   For completed `plain` work use `"status": "plain_fallback"` and `"capability": ""`.
8. Replace every value beginning `placeholder-` and every exemplar revision/ID with the current
   normalized value read from the current Task/Action. Delivery acceptance, record IDs, and exact
   evidence sets always come from the latest Task projection and are never guessed.
9. Do not include repository facts, payload digests, raw command/output/environment data, or
   unknown members.
10. `INVALID_ARGUMENT` and `TRANSITION_NOT_ALLOWED` are completed Core domain rejections, never
    transport uncertainty. When the result carries `error.details[]` or `error.guard`,
    `recovery.action="correct_current_action"`, and `recovery.retry_safe=true`, submit exactly one
    corrected payload for the same Action: change only the members in `recovery.allowed_paths`, derive
    each corrected value from the returned closed `rule`, and use a new `request_id`. Stop after a
    second failure and report the exact `path` and `rule`; never probe with a third candidate payload.

<!-- node-payload-template:requirements:start -->
```json
{
  "transition_id": "requirements_ready",
  "summary": "placeholder-normalized-summary",
  "reason": "",
  "artifacts": [],
  "method_evidence": [
    {"step_id": "requirements.capture", "status": "plain_fallback", "capability": "", "summary": "placeholder-capture-summary"},
    {"step_id": "requirements.clarify", "status": "plain_fallback", "capability": "", "summary": "placeholder-clarify-summary"},
    {"step_id": "requirements.validate", "status": "plain_fallback", "capability": "", "summary": "placeholder-validation-summary"}
  ],
  "node_result": {
    "problem_class": "none",
    "baseline": {
      "goal": "placeholder-goal",
      "scope": ["placeholder-scope"],
      "out_of_scope": ["placeholder-exclusion"],
      "acceptance_criteria": ["placeholder-acceptance-criterion"],
      "constraints": ["placeholder-constraint"],
      "assumptions": []
    },
    "unresolved_questions": [],
    "changed_paths": ["specs/placeholder-feature/spec.md"],
    "no_file_changes": false
  }
}
```
<!-- node-payload-template:requirements:end -->

Never use `repository_observation` as an artifact role, place goal/scope beside `node_result`, or
omit `problem_class`, `baseline`, or `unresolved_questions`.
`unresolved_questions` is a sibling of `baseline` inside `node_result`; it is never a member of the
closed `baseline` object.

<!-- node-payload-template:design:start -->
```json
{
  "transition_id": "design_ready",
  "summary": "placeholder-normalized-summary",
  "reason": "",
  "artifacts": [],
  "method_evidence": [
    {"step_id": "design.choose_approach", "status": "plain_fallback", "capability": "", "summary": "placeholder-approach-summary"},
    {"step_id": "design.review_complexity", "status": "plain_fallback", "capability": "", "summary": "placeholder-complexity-summary"},
    {"step_id": "design.record_decisions", "status": "plain_fallback", "capability": "", "summary": "placeholder-decision-summary"}
  ],
  "node_result": {
    "problem_class": "none",
    "baseline": {
      "requirements_revision": 1,
      "approach": "placeholder-approach",
      "components": ["placeholder-component"],
      "decisions": ["placeholder-decision"],
      "rejected_alternatives": ["placeholder-rejected-alternative"],
      "complexity_justification": [],
      "risks": []
    },
    "findings": [],
    "changed_paths": ["specs/placeholder-feature/plan.md"],
    "no_file_changes": false
  }
}
```
<!-- node-payload-template:design:end -->

Use the current requirements revision. The field `complexity` is forbidden; the required field is
`complexity_justification`, even when its value is an empty array.

<!-- node-payload-template:tasks:start -->
```json
{
  "transition_id": "tasks_ready",
  "summary": "placeholder-normalized-summary",
  "reason": "",
  "artifacts": [],
  "method_evidence": [
    {"step_id": "tasks.decompose", "status": "plain_fallback", "capability": "", "summary": "placeholder-decomposition-summary"},
    {"step_id": "tasks.map_acceptance", "status": "plain_fallback", "capability": "", "summary": "placeholder-acceptance-map-summary"},
    {"step_id": "tasks.analyze_consistency", "status": "plain_fallback", "capability": "", "summary": "placeholder-consistency-summary"}
  ],
  "node_result": {
    "problem_class": "none",
    "baseline": {
      "design_revision": 1,
      "work_items": [
        {
          "work_item_id": "placeholder-work-item-id",
          "summary": "placeholder-work-item-summary",
          "expected_paths": ["src/placeholder.mjs"],
          "acceptance_indexes": [0],
          "verification_steps": ["placeholder-targeted-verification"],
          "dependencies": []
        }
      ]
    },
    "findings": [],
    "changed_paths": ["specs/placeholder-feature/tasks.md"],
    "no_file_changes": false
  }
}
```
<!-- node-payload-template:tasks:end -->

<!-- node-payload-template:implement:start -->
```json
{
  "transition_id": "implementation_ready_for_test",
  "summary": "placeholder-normalized-summary",
  "reason": "",
  "artifacts": [],
  "method_evidence": [
    {"step_id": "implementation.execute_plan", "status": "plain_fallback", "capability": "", "summary": "placeholder-execution-summary"},
    {"step_id": "implementation.record_surface", "status": "plain_fallback", "capability": "", "summary": "placeholder-surface-summary"},
    {"step_id": "implementation.classify_deviations", "status": "plain_fallback", "capability": "", "summary": "placeholder-deviation-summary"}
  ],
  "node_result": {
    "problem_class": "none",
    "task_plan_revision": 1,
    "completed_work_item_ids": ["placeholder-work-item-id"],
    "changed_paths": ["src/placeholder.mjs"],
    "no_file_changes": false,
    "deviations": [],
    "findings": []
  }
}
```
<!-- node-payload-template:implement:end -->

Exactly one of a nonempty `changed_paths` list or `no_file_changes=true` describes the current
implementation result.

<!-- node-payload-template:test:start -->
```json
{
  "transition_id": "tests_passed",
  "summary": "placeholder-normalized-summary",
  "reason": "",
  "artifacts": [],
  "method_evidence": [
    {"step_id": "test.run_budgeted_checks", "status": "plain_fallback", "capability": "", "summary": "placeholder-check-summary"},
    {"step_id": "test.record_evidence", "status": "plain_fallback", "capability": "", "summary": "placeholder-evidence-summary"},
    {"step_id": "test.classify_failure", "status": "plain_fallback", "capability": "", "summary": "placeholder-classification-summary"}
  ],
  "node_result": {
    "problem_class": "none",
    "checks": [
      {"source": "automated", "name": "placeholder-check-name", "status": "passed", "summary": "placeholder-check-result", "command_count": 1, "full_suite": false},
      {"source": "user", "name": "placeholder-developer-check", "status": "passed", "summary": "placeholder-developer-result", "command_count": 0, "full_suite": false}
    ],
    "failed_items": [],
    "unverified_items": [],
    "manual_handoff_items": [],
    "findings": [],
    "changed_paths": [],
    "no_file_changes": true
  }
}
```
<!-- node-payload-template:test:end -->

Completed developer-run verification is a `source="user"` check with `command_count=0` and
`full_suite=false`; the human command is described in `summary` and never charged to the automatic budget.
`manual_handoff_items` contains only bounded checks still awaiting user execution. Once the developer reports a
completed result, record the user check and remove that item from `manual_handoff_items`.

<!-- node-payload-template:comprehension-complexity:start -->
```json
{
  "transition_id": "code_too_complex",
  "summary": "placeholder-normalized-summary",
  "reason": "placeholder-required-complexity-reason",
  "artifacts": [],
  "method_evidence": [
    {"step_id": "comprehension.explain", "status": "plain_fallback", "capability": "", "summary": "placeholder-explanation-summary"},
    {"step_id": "comprehension.identify_complexity", "status": "plain_fallback", "capability": "", "summary": "placeholder-complexity-summary"},
    {"step_id": "comprehension.obtain_user_verdict", "status": "plain_fallback", "capability": "", "summary": "placeholder-user-verdict-summary"}
  ],
  "node_result": {
    "problem_class": "code_complexity",
    "explained_components": ["placeholder-component"],
    "unresolved_questions": [],
    "unnecessary_abstractions": ["placeholder-unnecessary-abstraction"],
    "maintenance_risks": [],
    "user_confirmation": null,
    "findings": ["placeholder-matching-complexity-fact"],
    "changed_paths": [],
    "no_file_changes": true
  }
}
```
<!-- node-payload-template:comprehension-complexity:end -->

<!-- node-payload-template:comprehension-passed:start -->
```json
{
  "transition_id": "comprehension_passed",
  "summary": "placeholder-normalized-summary",
  "reason": "",
  "artifacts": [],
  "method_evidence": [
    {"step_id": "comprehension.explain", "status": "plain_fallback", "capability": "", "summary": "placeholder-explanation-summary"},
    {"step_id": "comprehension.identify_complexity", "status": "plain_fallback", "capability": "", "summary": "placeholder-complexity-summary"},
    {"step_id": "comprehension.obtain_user_verdict", "status": "plain_fallback", "capability": "", "summary": "placeholder-user-verdict-summary"}
  ],
  "node_result": {
    "problem_class": "none",
    "explained_components": ["placeholder-component"],
    "unresolved_questions": [],
    "unnecessary_abstractions": [],
    "maintenance_risks": [],
    "user_confirmation": {"source": "user", "status": "passed", "summary": "placeholder-explicit-user-verdict-summary"},
    "findings": [],
    "changed_paths": [],
    "no_file_changes": true
  }
}
```
<!-- node-payload-template:comprehension-passed:end -->

No AI or method capability may create the passing user confirmation.

<!-- node-payload-template:refactor:start -->
```json
{
  "transition_id": "refactor_ready_for_test",
  "summary": "placeholder-normalized-summary",
  "reason": "",
  "artifacts": [],
  "method_evidence": [
    {"step_id": "refactor.simplify", "status": "plain_fallback", "capability": "", "summary": "placeholder-simplification-summary"},
    {"step_id": "refactor.reconcile_artifacts", "status": "plain_fallback", "capability": "", "summary": "placeholder-reconciliation-summary"},
    {"step_id": "refactor.record_surface", "status": "plain_fallback", "capability": "", "summary": "placeholder-surface-summary"}
  ],
  "node_result": {
    "problem_class": "none",
    "changed_paths": ["src/placeholder.mjs"],
    "no_file_changes": false,
    "simplifications": ["placeholder-simplification"],
    "behavior_change_intended": false,
    "findings": []
  }
}
```
<!-- node-payload-template:refactor:end -->

<!-- node-payload-template:delivery:start -->
```json
{
  "transition_id": "delivery_complete",
  "summary": "placeholder-normalized-summary",
  "reason": "",
  "artifacts": [],
  "method_evidence": [
    {"step_id": "delivery.reconcile_acceptance", "status": "plain_fallback", "capability": "", "summary": "placeholder-acceptance-summary"},
    {"step_id": "delivery.reconcile_method_artifacts", "status": "plain_fallback", "capability": "", "summary": "placeholder-artifact-summary"},
    {"step_id": "delivery.prepare_summary", "status": "plain_fallback", "capability": "", "summary": "placeholder-delivery-summary"}
  ],
  "node_result": {
    "problem_class": "none",
    "acceptance": [{"criterion": "placeholder-current-criterion", "status": "satisfied"}],
    "automated_evidence_ids": ["placeholder-current-automated-evidence-id"],
    "manual_evidence_ids": ["placeholder-current-comprehension-evidence-id"],
    "test_record_id": "placeholder-current-test-record-id",
    "comprehension_record_id": "placeholder-current-comprehension-record-id",
    "unverified_items": [],
    "risks": [],
    "findings": [],
    "changed_paths": [],
    "no_file_changes": true
  }
}
```
<!-- node-payload-template:delivery:end -->

Acceptance order/text and the automated/manual evidence lists must exactly equal the latest Core
projection. Use only current TestRecord and ComprehensionAssessment IDs; stale or guessed IDs are
forbidden.

<!-- node-payload-template:blocked:start -->
```json
{
  "blocker_id": "placeholder-current-blocker-id",
  "condition": {
    "kind": "restore_issuance_binding",
    "expected_binding_digest": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
  },
  "observed_binding_digest": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
}
```
<!-- node-payload-template:blocked:end -->

For `RESOLVE_BLOCKER`, use the exact current blocker ID, stored condition, and freshly observed
binding digest required by Core. Never submit a resume node or destination.
