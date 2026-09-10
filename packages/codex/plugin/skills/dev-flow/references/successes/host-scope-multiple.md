# scope: multiple

Implementation: `packages/codex/bin/dev-flow-codex.mjs` — `runHostLaunchCommand`.

Complete result from the adapter implementation, executed in a temporary Git fixture.
Host session creation, handoff completion and Core terminal reads are supplied test observations,
not live Host calls. Paths, generated identities, digests and timestamps use stable example values;
all fields and their references are retained and compared.

Resolved request:

<!-- example:resolved-host scope multiple -->
```json
{
  "launch_id": "launch-example",
  "primary_repository_key": "api",
  "repository_keys": [
    "api",
    "web"
  ]
}
```

Complete response:

<!-- example:host-success scope multiple -->
```json
{
  "additional_repositories": [
    {
      "key": "web",
      "repository_path": "/example/web",
      "workspace_origin": {
        "base_branch": "main",
        "base_commit": "0000000000000000000000000000000000000001",
        "carry_changes": false,
        "mode": "dedicated_worktree",
        "provisioning_receipt_id": "codex-0000000000000000000000000000000000000000000000000000000000000001",
        "remote_name": "origin",
        "source_type": "remote",
        "task_branch": "codex/web"
      }
    }
  ],
  "primary_repository_key": "api",
  "repository_path": "/example/api",
  "workspace_origin": {
    "base_branch": "main",
    "base_commit": "0000000000000000000000000000000000000001",
    "carry_changes": false,
    "mode": "dedicated_worktree",
    "provisioning_receipt_id": "codex-0000000000000000000000000000000000000000000000000000000000000002",
    "remote_name": "origin",
    "source_type": "remote",
    "task_branch": "codex/api"
  }
}
```
