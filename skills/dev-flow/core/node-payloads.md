# Action submissions

Implementation: `internal/mcp/schemas.go` — `actionSubmissionSchema`;
`internal/workflow/submission_schema.go` — `ActionSubmissionSchema`;
`internal/workflow/action_schema.go` — `SubmissionNodeResultSchema`;
`internal/application/submit_action.go` — `SubmitAction`.

## Common submission procedure

1. Start from the complete fresh Action after handling recovery/blocker/outcome. Use its
   `submission_tool`, `task_id`, `action_id`, method steps and returned transitions.
2. Perform the current node work under its allowed effects. Record actual facts and user decisions.
   Required method steps must be completed by the selected capability or ordinary equivalent work.
3. [Collect and prepare artifacts](artifacts.md) for this Action. Keep every collected entry,
   classify purpose, and use the prepared result directly. Make no further repository writes before
   submission; recollect after a change.
4. Read the live input schema for that exact tool. Select a returned transition matching actual facts
   and its reason rule. Check all required/allowed members, types, arrays, enums and method-step keys.
5. Submit the complete JSON input once. Use [response handling](tool-results.md#submission-response-handling)
   to retain the full response and inspect `ok` before accessing success fields.

The common top-level members are exactly `host`, `task_id`, `action_id`, `transition_id`, `summary`,
`reason`, `artifacts`, `method_results`, `node_result`. `host` is {{host}}. Artifacts have required
`other_process` and a required `current` only when the tool exposes it. Entries have only path/digest/
summary. Method results have exactly the returned step IDs, each with capability/summary; empty
capability denotes completed ordinary work. Core fills roles, method order/status, revisions,
process/issuance identity and its normalized internal payload. These are absent from Host input.

The examples below use one illustrative endpoint task and show every current ordinary transition.
They are alternatives selected from an actual Action, not an execution script or permission to take
an edge. Empty artifact arrays mean preparation found no process files for that sample. Replace them
with the complete actual prepared output. Findings are empty for problem_class none and concrete for
problem edges. Example identities, checks and verdicts cannot be reused as real results.

## Node references

| Current node | Tool and examples |
| --- | --- |
| `REQUIREMENTS` | [`dev_flow_submit_requirements`](nodes/requirements.md) |
| `DESIGN` | [`dev_flow_submit_design`](nodes/design.md) |
| `TASKS` | [`dev_flow_submit_tasks`](nodes/tasks.md) |
| `IMPLEMENT` | [`dev_flow_submit_implementation`](nodes/implementation.md) |
| `TEST` | [`dev_flow_submit_test`](nodes/test.md) |
| `COMPREHENSION_REVIEW` | [`dev_flow_submit_comprehension`](nodes/comprehension.md) |
| `REFACTOR` | [`dev_flow_submit_refactor`](nodes/refactor.md) |
| `DELIVERY` | [`dev_flow_submit_delivery`](nodes/delivery.md) |

## Success and failure result formats

Every ordinary success uses `{"ok":true,"request_id":"…","tool":"…","result":<complete Task>}`.
The next Action is `result.current_action`, not `result.task.current_action`. A terminal success has
`result.current_action:null`. After TEST, a repetition blocker can replace the expected destination;
read the actual result. The [result reference](tool-results.md) defines complete-error and uncertain-
operation handling. Examples in each node state their expected next node, and Core decides whether
its current guards allow it.

The checkable examples enumerate existing contracts for maintenance; the runtime always selects from
the fresh Action. No example adds a transition, changes Scope, grants Git authority or supplies a human
verdict. Source contracts and examples are checked together by `internal/mcp/skill_examples_test.go`.
