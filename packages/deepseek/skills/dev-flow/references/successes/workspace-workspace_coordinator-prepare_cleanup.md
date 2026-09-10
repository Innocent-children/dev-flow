# workspace_coordinator: prepare_cleanup

Implementation: `packages/deepseek/lib/workspace-tool.mjs` — `registerWorkspaceCoordinator`.

Complete result from the adapter implementation, executed in a temporary Git fixture.
Host session creation, handoff completion and Core terminal reads are supplied test observations,
not live Host calls. Paths, generated identities, digests and timestamps use stable example values;
all fields and their references are retained and compared.

Resolved request:

<!-- example:resolved-workspace workspace_coordinator prepare_cleanup -->
```json
{
  "launch_id": "00000000-0000-4000-8000-000000000001",
  "operation": "prepare_cleanup",
  "repository_key": "primary",
  "revision": 9,
  "source_repository_path": "/work/project",
  "task_id": "task-example"
}
```

Complete response:

<!-- example:workspace-success workspace_coordinator prepare_cleanup -->
```json
{
  "changed": false,
  "launch_id": "00000000-0000-4000-8000-000000000001",
  "relaunch": {
    "arguments": [
      "--profile",
      "web",
      "/dev-flow resume-cleanup launch=00000000-0000-4000-8000-000000000001 repository=primary task=task-example revision=9\nThe receipt-owned source checkout is now the fixed DSH Workspace Root.\nAsk the developer to send exactly: /dev-flow cleanup-worktree launch=00000000-0000-4000-8000-000000000001 repository=primary task=task-example revision=9\nDo not delete the worktree or branch in this relaunch turn."
    ],
    "command": "dsh",
    "cwd": "/work/project"
  },
  "repository_key": "primary",
  "status": "cleanup_relaunch_required"
}
```
