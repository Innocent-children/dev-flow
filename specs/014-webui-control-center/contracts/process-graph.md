# Process Graph Contract

## Sources

- Definition: `workflow.ResolveDefinition(task.Process)`.
- Actual traversals: TaskEvent in ascending revision.
- Current node and Blocked resume: current ProcessTask.
- Current legal transitions: current Action `AvailableTransitions`.
- Future reachability: traversal of the resolved definition from the current node.

## Projection

```json
{
  "process":{"process_id":"standard-development","definition_digest":"<sha256>"},
  "task_revision":5,
  "current_node":"TEST",
  "resume_node":null,
  "nodes":[{"node_id":"TEST","kind":"normal","purpose":"..."}],
  "transitions":[{"transition_id":"tests_passed","source":"TEST","destination":"COMPREHENSION_REVIEW"}],
  "traversals":[{"revision":4,"source":"IMPLEMENT","destination":"TEST","transition_id":"implementation_ready_for_test","reason":"","created_at":"<UTC>"}],
  "current_legal_transition_ids":["tests_passed","tests_failed_implementation"],
  "future_node_ids":["IMPLEMENT","COMPREHENSION_REVIEW","REFACTOR","DELIVERY","DONE"],
  "future_transition_ids":["tests_passed","tests_failed_implementation"],
  "blocked_relation":null
}
```

## Rules

- Definition arrays preserve Core order; traversals preserve revision order and repeated events.
- Reachability uses a visited set and terminates for cyclic definitions.
- Reachable means structurally possible; it does not assert that a Guard passes.
- Cancellation is an exceptional traversal to `CANCELLED`; `BLOCKED` carries its resume relation.
- Unknown definition or inconsistent event ordering returns safe-stop and disables mutation.
- `DONE` and `CANCELLED` have no current Action or legal transition.
- The projection is read-only and is never persisted.
