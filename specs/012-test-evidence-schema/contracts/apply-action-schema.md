# Contract: Action-specific Apply Input Schema

`dev_flow_apply_action` exposes a top-level `oneOf` containing exactly nine closed object branches:

```text
COMPLETE_REQUIREMENTS
COMPLETE_DESIGN
COMPLETE_TASKS
COMPLETE_IMPLEMENTATION
COMPLETE_TEST
COMPLETE_COMPREHENSION_REVIEW
COMPLETE_REFACTOR
COMPLETE_DELIVERY
RESOLVE_BLOCKER
```

Every branch requires the existing eleven ordinary top-level members and carries optional nullable recovery_apply.
`action_kind` is const and payload is the corresponding concrete payload. Unknown members are rejected.

The wire request, recovery identity, field names and payload shapes remain unchanged.

