# Standard Apply Payload Contract

The common six-member envelope remains `transition_id`, `summary`, `reason`, `artifacts`,
`method_evidence`, `node_result`.

## Node-result mutation members

REQUIREMENTS, DESIGN, TASKS, TEST, COMPREHENSION_REVIEW and DELIVERY add required `changed_paths` and
`no_file_changes`. IMPLEMENT and REFACTOR keep the same existing fields and invariant. Unknown members remain
rejected. `artifacts[]` stays evidence/baseline material, not the complete mutation list.

## Allowed-effect check

A non-empty envelope is valid only when the persisted Action allows the matching repository write effect.
The Host cannot add an effect or classify drift.

## Affected nodes and unchanged graph

| Node | Write effect | Outgoing transitions |
| --- | --- | --- |
| REQUIREMENTS | `edit_process_artifacts` | `requirements_ready→DESIGN` |
| DESIGN | `edit_process_artifacts` | `design_ready→TASKS`, `design_requires_requirements→REQUIREMENTS` |
| TASKS | `edit_process_artifacts` | `tasks_ready→IMPLEMENT`, `tasks_require_design→DESIGN`, `tasks_require_requirements→REQUIREMENTS` |
| IMPLEMENT | both edit effects | existing four IMPLEMENT transitions |
| TEST | `edit_process_artifacts` | existing four TEST transitions |
| COMPREHENSION_REVIEW | `edit_process_artifacts` | existing six comprehension transitions |
| REFACTOR | both edit effects | existing three REFACTOR transitions |
| DELIVERY | `edit_process_artifacts` | existing six DELIVERY transitions |

Purposes, entry/completion conditions, evidence, semantic steps, transition guards/reasons and terminal
behavior remain unchanged.

## Error semantics

- Malformed/XOR-invalid/path-invalid envelope: `INVALID_ARGUMENT`.
- Stale revision: `REVISION_CONFLICT`.
- Stale Action/source/submitted binding: `ACTION_STALE`.
- Unsupported process definition: `PROCESS_UNSUPPORTED`.
- Contradictory repository observation: `REPOSITORY_DRIFT` with existing recovery identity.

All rejections precede Store mutation.
