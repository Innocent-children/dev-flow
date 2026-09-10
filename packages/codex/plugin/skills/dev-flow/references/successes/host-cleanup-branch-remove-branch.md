# cleanup-branch: remove-branch

Implementation: `packages/codex/bin/dev-flow-codex.mjs` — `runHostLaunchCommand`.

Complete result from the adapter implementation, executed in a temporary Git fixture.
Host session creation, handoff completion and Core terminal reads are supplied test observations,
not live Host calls. Paths, generated identities, digests and timestamps use stable example values;
all fields and their references are retained and compared.

Resolved request:

<!-- example:resolved-host cleanup-branch remove-branch -->
```json
{
  "authorized": true,
  "launch_id": "launch-example",
  "repository_key": "primary",
  "source_repository_path": "/work/project",
  "terminal": true
}
```

Complete response:

<!-- example:host-success cleanup-branch remove-branch -->
```json
{
  "changed": true,
  "receipt": {
    "admission": {
      "assessment": {
        "anchor": {
          "repositories": [
            {
              "canonical_root": "/work/project",
              "dirty_paths": [],
              "dirty_paths_truncated": false,
              "head": "0000000000000000000000000000000000000001",
              "repository_key": "primary",
              "status_digest": "0000000000000000000000000000000000000000000000000000000000000001"
            }
          ],
          "request_digest": "0000000000000000000000000000000000000000000000000000000000000002"
        },
        "candidate_components": [
          "Endpoint response"
        ],
        "candidate_paths": [
          "src/endpoint.js"
        ],
        "change_level": "standard",
        "host_or_platform_flags": [],
        "observed_repositories": [
          "/work/project"
        ],
        "persistence_or_state_flags": [],
        "public_contract_flags": [
          "Response field changes"
        ],
        "reasons": [
          "The response is a public contract."
        ],
        "recommendation": "dev_flow",
        "unknowns": [],
        "verification_shape": [
          "Endpoint response check"
        ]
      },
      "user_choice": {
        "mode": "dev_flow",
        "source": "user",
        "summary": "The user selected Dev Flow after reading the assessment."
      }
    },
    "base_branch": "main",
    "base_commit": "0000000000000000000000000000000000000001",
    "carry_changes": false,
    "created_at": "2026-09-10T00:00:00.000Z",
    "handoff_digest": "0000000000000000000000000000000000000000000000000000000000000003",
    "host": "codex",
    "launch_id": "launch-example",
    "operation_status": {
      "branch_cleanup": "completed",
      "dispatch_attempt_id": null,
      "dispatch_recovery_reason": null,
      "host_client_thread_id": null,
      "host_operation_id": null,
      "host_operation_revision": null,
      "host_request": null,
      "host_thread_id": null,
      "phase": "branch_removed",
      "relocation_id": null,
      "surface": "cli_worktree",
      "worktree_cleanup": "completed"
    },
    "remote_name": "origin",
    "repository_key": "primary",
    "request_digest": "0000000000000000000000000000000000000000000000000000000000000002",
    "snapshot_commit": null,
    "source_repository_identity": "0000000000000000000000000000000000000000000000000000000000000004",
    "source_type": "remote",
    "target_branch": "codex/endpoint-field",
    "workspace_mode": "dedicated_worktree",
    "worktree_path": "/work/tasks/endpoint-field"
  },
  "receipt_path": "/example/support/provisioning/codex/launch-example/primary.json",
  "uncertain": false
}
```
