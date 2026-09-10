# workspace_coordinator: consume

Implementation: `packages/deepseek/lib/workspace-tool.mjs` — `registerWorkspaceCoordinator`.

Complete result from the adapter implementation, executed in a temporary Git fixture.
Host session creation, handoff completion and Core terminal reads are supplied test observations,
not live Host calls. Paths, generated identities, digests and timestamps use stable example values;
all fields and their references are retained and compared.

Resolved request:

<!-- example:resolved-workspace workspace_coordinator consume -->
```json
{
  "launch_id": "00000000-0000-4000-8000-000000000001",
  "operation": "consume"
}
```

Complete response:

<!-- example:workspace-success workspace_coordinator consume -->
```json
{
  "launch_id": "00000000-0000-4000-8000-000000000001",
  "open_task": {
    "additional_repositories": [],
    "primary_repository_key": "primary",
    "repository_path": "/example/.dev-flow-worktrees/00000000-0000-4000-8000-000000000001/primary",
    "workspace_origin": {
      "base_branch": "main",
      "base_commit": "0000000000000000000000000000000000000001",
      "carry_changes": true,
      "mode": "dedicated_worktree",
      "provisioning_receipt_id": "00000000-0000-4000-8000-000000000001",
      "remote_name": "",
      "source_type": "local",
      "task_branch": "feature/endpoint-field"
    }
  },
  "request_digest": "0000000000000000000000000000000000000000000000000000000000000001",
  "status": "consumed",
  "workspace_root": "/example/.dev-flow-worktrees/00000000-0000-4000-8000-000000000001/primary"
}
```
