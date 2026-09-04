# Action submission reference

The current Action's `submission_tool` is the only mutation tool for that Action. Its live schema
is the exact input contract. The Host sends current work results; Core fills revision, Action kind,
process identity, source cursor, repository binding, artifact roles, method step identity/order/status
and the internal payload envelope.

Core also fills the system-state members `requirements_revision` (Design baseline),
`design_revision` (Tasks baseline) and `task_plan_revision` (Implementation) from the current Task
snapshot after it verifies the current Action. Node templates omit them. A client that sends
one of these Core-owned members violates the closed submission contract.

## Common input

Every ordinary submission contains exactly:

- `host`, `task_id`, and `action_id`;
- one `transition_id` returned by the current Action;
- normalized `summary` and the transition's required or empty `reason`;
- `artifacts`, split into the live schema's optional `current` slot and required
  `other_process` slot;
- `method_results`, keyed by every current `method_steps[].step_id`;
- the action-specific `node_result`.

Artifact entries contain only `path`, `digest`, and `summary`. Core assigns the role. Method
result entries contain only `capability` and `summary`. Use the actual capability ID when one
completed the step, otherwise use an empty capability after completed ordinary work.

Do not send `request_id`, revision, Action kind, process identity, source cursor, repository binding,
`payload`, `method_evidence`, artifact `role`, destination, or recovery fields.

## Tool mapping

| Action kind | Submission tool |
| --- | --- |
| `COMPLETE_REQUIREMENTS` | `dev_flow_submit_requirements` |
| `COMPLETE_DESIGN` | `dev_flow_submit_design` |
| `COMPLETE_TASKS` | `dev_flow_submit_tasks` |
| `COMPLETE_IMPLEMENTATION` | `dev_flow_submit_implementation` |
| `COMPLETE_TEST` | `dev_flow_submit_test` |
| `COMPLETE_COMPREHENSION_REVIEW` | `dev_flow_submit_comprehension` |
| `COMPLETE_REFACTOR` | `dev_flow_submit_refactor` |
| `COMPLETE_DELIVERY` | `dev_flow_submit_delivery` |
| `RESOLVE_BLOCKER` | `dev_flow_resolve_blocker` |

For a file-scope blocker, `dev_flow_resolve_blocker` also requires `choice` (`allow_once`,
`expand_scope`, or `reject`) and a non-empty `reason`. Omit both members for repository-recovery and
automatic-verification blockers.

For `task_relocation_pending`, provide the retained `relocation_id` and every
`relocation_destinations[{key,repository_path}]`. For `workspace_history_conflict`, provide
`history_resolution` with exactly `choice="accept_current_history"` and a non-empty `reason` after
explicit review. File-scope, relocation, and history members are mutually exclusive; use only the
branch selected by the current blocker and live schema.

## Node-result members

Use the live tool schema for types and nested members. These are the closed top-level members:

| Submission tool | Required `node_result` members |
| --- | --- |
| Requirements | `problem_class`, `baseline`, `unresolved_questions` |
| Design | `problem_class`, `baseline`, `findings` |
| Tasks | `problem_class`, `baseline`, `findings` |
| Implementation | `problem_class`, `completed_work_item_ids`, `deviations`, `findings` |
| Test | `problem_class`, `checks`, `failed_items`, `unverified_items`, `manual_handoff_items`, `findings`, `budget_adjustment` |
| Comprehension | `problem_class`, `explained_components`, `unresolved_questions`, `unnecessary_abstractions`, `maintenance_risks`, `user_confirmation`, `findings` |
| Refactor | `problem_class`, `simplifications`, `behavior_change_intended`, `findings` |
| Delivery | `problem_class`, `unverified_items`, `risks`, `findings` |

The Host never submits file-effect fields. Core observes the dedicated worktree before applying an
Action and computes the Action delta and current Task surface from Git facts.

Delivery submissions never send `acceptance`, `automated_evidence_ids`, `manual_evidence_ids`,
`test_record_id`, or `comprehension_record_id`. Core derives those authority members from the current
Requirements, Test, Comprehension, and Evidence records before canonical validation and Recovery
retention. A submission containing any of those members violates the closed contract.

The Tasks baseline contains `work_items` plus `verification_plan`. The plan contains `checks[]` with
`name` and `rationale`, `initial_budget`, `full_suite_expected`, and
`test_code_changes_expected`. Core fills only `design_revision`.

Every Test submission includes `budget_adjustment`. Normal pass/failure transitions send `null`.
`verification_budget_increased` sends a closed adjustment with `basis`, `additional_checks`,
`additional_automatic_commands`, `allow_full_suite`, and `allow_manual_handoff`; all check and result
lists stay empty and the transition reason gives the concrete need. Every check includes
`full_suite_reason`: it is empty unless `full_suite=true`, in which case it records the current
suite-specific risk.

Completed developer-run verification is a `source="user"` check with `command_count=0`,
`full_suite=false`, and `full_suite_reason=""`. Put only work nobody has run yet in `manual_handoff_items`.

## Requirements example

```json
{
  "host": "codex",
  "task_id": "task-current",
  "action_id": "action-current",
  "transition_id": "requirements_ready",
  "summary": "Requirements completed.",
  "reason": "",
  "artifacts": {
    "current": [],
    "other_process": []
  },
  "method_results": {
    "requirements.capture": {"capability": "", "summary": "Captured the bounded requirements."},
    "requirements.clarify": {"capability": "", "summary": "Resolved material questions."},
    "requirements.validate": {"capability": "", "summary": "Validated scope and acceptance."}
  },
  "node_result": {
    "problem_class": "none",
    "baseline": {
      "goal": "Current goal",
      "scope": [],
      "out_of_scope": [],
      "acceptance_criteria": ["Current criterion"],
      "constraints": [],
      "assumptions": []
    },
    "unresolved_questions": []
  }
}
```

For DeepSeek, use `host="deepseek"` and the qualified tool name
`mcp__dev_flow__<submission_tool>`. All other fields remain the same.
