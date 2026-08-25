# Contract: Lifecycle Result

## Closed JSON Shape

```json
{
  "operation_id": "opaque-or-null",
  "operation": "status",
  "status": "ready",
  "changed": false,
  "targets": [
    {
      "host": "codex",
      "profile": null,
      "package_version": "0.7.0",
      "core_version": "0.6.0",
      "state": "ready"
    }
  ],
  "data": {
    "policy": "preserve",
    "configuration": "preserved",
    "default_data": "preserved",
    "explicit_data": []
  },
  "completed_actions": [],
  "failed_action": null,
  "restart_requirements": [],
  "confirmation": null,
  "next_step": null
}
```

Unknown top-level fields are forbidden.

## Status

```text
ready
absent
partial
restart_required
incompatible
conflicted
confirmation_required
declined
failed
```

`changed=true` requires at least one completed persistent action. `failed_action` is non-null only for `failed` or
`partial`. `next_step` is null on verified success and exactly one bounded action on non-success.

## Confirmation Projection

When confirmation is required:

```json
{
  "class": "reset",
  "plan_id": "opaque-plan-id",
  "token": "user-visible-one-time-token",
  "expires_at": "RFC3339",
  "impacts": ["Remove all known Adapters", "Move current Task data to Trash"]
}
```

The persisted plan stores only the token digest. An expired or observed-state-mismatched token has zero mutation.

## Error Projection

Results never include raw environment dumps, npm auth, private file contents, child stdout/stderr, Task data or
repository contents. Human stderr may contain a bounded diagnostic summary; JSON `next_step` remains the single
recovery instruction.
