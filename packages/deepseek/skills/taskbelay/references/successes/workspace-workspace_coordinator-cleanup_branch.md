# workspace_coordinator: cleanup_branch

Implementation: `packages/deepseek/lib/workspace-tool.mjs` — `registerWorkspaceCoordinator`.

Complete result from the adapter implementation, executed in a temporary Git fixture.
Host session creation, handoff completion and Core terminal reads are supplied test observations,
not live Host calls. Paths, generated identities, digests and timestamps use stable example values;
all fields and their references are retained and compared.

Resolved request:

<!-- example:resolved-workspace workspace_coordinator cleanup_branch -->
```json
{
  "launch_id": "00000000-0000-4000-8000-000000000001",
  "operation": "cleanup_branch",
  "repository_key": "primary",
  "revision": 9,
  "source_repository_path": "/work/project",
  "task_id": "task-example"
}
```

Complete response:

<!-- example:workspace-success workspace_coordinator cleanup_branch -->
```json
{
  "changed": true,
  "launch_id": "00000000-0000-4000-8000-000000000001",
  "repository_key": "primary",
  "status": "branch_removed"
}
```
