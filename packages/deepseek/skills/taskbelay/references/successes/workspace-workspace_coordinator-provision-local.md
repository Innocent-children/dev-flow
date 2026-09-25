# workspace_coordinator: provision-local

Implementation: `packages/deepseek/lib/workspace-tool.mjs` — `registerWorkspaceCoordinator`.

Complete result from the adapter implementation, executed in a temporary Git fixture.
Host session creation, handoff completion and Core terminal reads are supplied test observations,
not live Host calls. Paths, generated identities, digests and timestamps use stable example values;
all fields and their references are retained and compared.

Resolved request:

<!-- example:resolved-workspace workspace_coordinator provision-local -->
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
      "workspace_mode": "new_branch"
    }
  ],
  "request": "Return the requested endpoint field and preserve the confirmed local content."
}
```

Complete response:

<!-- example:workspace-success workspace_coordinator provision-local -->
```json
{
  "launch_id": "00000000-0000-4000-8000-000000000001",
  "open_task": {
    "additional_repositories": [],
    "primary_repository_key": "primary",
    "repository_path": "/work/project",
    "workspace_origin": {
      "base_branch": "main",
      "base_commit": "0000000000000000000000000000000000000001",
      "carry_changes": true,
      "mode": "new_branch",
      "provisioning_receipt_id": "00000000-0000-4000-8000-000000000001",
      "remote_name": "",
      "source_type": "local",
      "task_branch": "feature/endpoint-field"
    }
  },
  "request_digest": "0000000000000000000000000000000000000000000000000000000000000001",
  "status": "ready",
  "workspace_root": "/work/project"
}
```
