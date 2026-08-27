# Action submission reference

The current Action's `submission_tool` is the only mutation tool for that Action. Its live schema
is the exact input contract. The Host sends current work results; Core fills revision, Action kind,
process identity, source cursor, repository binding, artifact roles, method step identity/order/status
and the internal payload envelope.

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

## Node-result members

Use the live tool schema for types and nested members. These are the closed top-level members:

| Submission tool | Required `node_result` members |
| --- | --- |
| Requirements | `problem_class`, `baseline`, `unresolved_questions`, `changed_paths`, `no_file_changes` |
| Design | `problem_class`, `baseline`, `findings`, `changed_paths`, `no_file_changes` |
| Tasks | `problem_class`, `baseline`, `findings`, `changed_paths`, `no_file_changes` |
| Implementation | `problem_class`, `task_plan_revision`, `completed_work_item_ids`, `changed_paths`, `no_file_changes`, `deviations`, `findings` |
| Test | `problem_class`, `checks`, `failed_items`, `unverified_items`, `manual_handoff_items`, `findings`, `changed_paths`, `no_file_changes` |
| Comprehension | `problem_class`, `explained_components`, `unresolved_questions`, `unnecessary_abstractions`, `maintenance_risks`, `user_confirmation`, `findings`, `changed_paths`, `no_file_changes` |
| Refactor | `problem_class`, `changed_paths`, `no_file_changes`, `simplifications`, `behavior_change_intended`, `findings` |
| Delivery | `problem_class`, `acceptance`, `automated_evidence_ids`, `manual_evidence_ids`, `test_record_id`, `comprehension_record_id`, `unverified_items`, `risks`, `findings`, `changed_paths`, `no_file_changes` |

`changed_paths` and `no_file_changes` remain mutually exclusive. A single-repository Task uses
repository-relative paths. A multi-repository Task uses
`<repository-key>::<repository-relative-path>`.

Completed developer-run verification is a `source="user"` check with `command_count=0` and
`full_suite=false`. Put only work nobody has run yet in `manual_handoff_items`.

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
    "unresolved_questions": [],
    "changed_paths": [],
    "no_file_changes": true
  }
}
```

For DeepSeek, use `host="deepseek"` and the qualified tool name
`mcp__dev_flow__<submission_tool>`. All other fields remain the same.
