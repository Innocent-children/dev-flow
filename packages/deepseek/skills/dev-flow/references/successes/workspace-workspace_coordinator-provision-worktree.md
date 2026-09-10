# workspace_coordinator: provision-worktree

Implementation: `packages/deepseek/lib/workspace-tool.mjs` — `registerWorkspaceCoordinator`.

Complete result from the adapter implementation, executed in a temporary Git fixture.
Host session creation, handoff completion and Core terminal reads are supplied test observations,
not live Host calls. Paths, generated identities, digests and timestamps use stable example values;
all fields and their references are retained and compared.

Resolved request:

<!-- example:resolved-workspace workspace_coordinator provision-worktree -->
```json
{
  "operation": "provision",
  "profile": "web",
  "repositories": [
    {
      "base_branch": "main",
      "carry_changes": true,
      "remote_name": "",
      "repository_key": "primary",
      "source_repository_path": "/work/project",
      "source_type": "local",
      "target_branch": "feature/endpoint-field",
      "workspace_mode": "dedicated_worktree"
    }
  ],
  "request": "Return the requested endpoint field and preserve the confirmed local content."
}
```

Complete response:

<!-- example:workspace-success workspace_coordinator provision-worktree -->
```json
{
  "launch_id": "00000000-0000-4000-8000-000000000001",
  "relaunch": {
    "arguments": [
      "--profile",
      "web",
      "/dev-flow resume-worktree launch=00000000-0000-4000-8000-000000000001\nContinue the confirmed request exactly as assessed:\nReturn the requested endpoint field and preserve the confirmed local content."
    ],
    "command": "dsh",
    "cwd": "/example/.dev-flow-worktrees/00000000-0000-4000-8000-000000000001/primary"
  },
  "request_digest": "0000000000000000000000000000000000000000000000000000000000000001",
  "source_dirty_paths": {
    "primary": [
      "notes.txt"
    ]
  },
  "source_dirty_paths_truncated": {
    "primary": false
  },
  "status": "relaunch_required",
  "workspace_root": "/example/.dev-flow-worktrees/00000000-0000-4000-8000-000000000001/primary"
}
```
