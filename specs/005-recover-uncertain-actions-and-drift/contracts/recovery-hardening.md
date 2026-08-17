# Contract: Recovery Hardening Without Public Expansion

## Purpose

This contract defines the Feature 005 acceptance boundary. It is subordinate to Core Contract 0.1
and does not replace the MCP tools, result envelope, state machine, recovery classes, or persistence
model.

## Public Surface Freeze

The following remain unchanged:

1. `dev_flow_server_info`
2. `dev_flow_open_task`
3. `dev_flow_get_task`
4. `dev_flow_get_next_action`
5. `dev_flow_apply_action`
6. `dev_flow_cancel_task`

No new input field exists solely for fault injection or retry. No new state or recovery class is
introduced.

## Uncertain Mutation Rule

Before dispatching a mutation, a thin caller retains the closed identity needed to construct the
exact `OperationProbe`.

When the caller does not receive one complete valid Core result—because of cancellation, malformed
or truncated output, process exit, or transport failure—it MUST:

1. stop mutation dispatch;
2. reconnect or reread through an existing read tool;
3. supply the exact probe;
4. obey the Core recovery result;
5. retry only when Core reports `not_started` and the action/revision remain current.

The caller MUST NOT infer success from:

- a partial JSON prefix;
- human-readable text;
- repository similarity;
- the absence of an error line;
- a tool-call start event;
- a stale task snapshot.

## Boundary Matrix

| Boundary | Deterministic setup | Required observation |
|---|---|---|
| Pre-commit | Test-local dependency returns before transaction commit | no revision/event; exact read is `not_started` |
| Post-commit discard | Real mutation commits; caller discards return | one revision/event; exact read is `completed_and_recorded` |
| Pre-serialization | Application result exists but MCP encoding is not completed | committed state remains authoritative |
| Partial response | Test writer accepts prefix and fails | no caller success; exact read decides |
| Restart | Close Core/store and reopen same database | task/action/last-operation identity persists |
| Duplicate recovery submit | Repeat exact committed recovery operation | zero additional writes |
| Concurrent submit | Two handles use same revision/action | at most one commit |

## Reconciliation Rules

- Exact expected evidence may produce `completed_but_unrecorded`.
- Partial evidence produces `partially_completed`.
- Contradictory identity/effects produce `conflicting`.
- Insufficient evidence uses the more conservative existing class.
- Reads never create blockers.
- Only explicit recovery apply may adopt exact evidence or create/retain a blocker.
- Recovery apply re-observes the repository before writing.
- A stale source cannot mutate a current task.

## Repository Rules

Core observation is read-only. The complete binding includes canonical root, common Git directory,
branch/detached state, HEAD/unborn state, tracked digest, and bounded untracked digest.

Path aliases to the same supported worktree share one claim. A replaced repository at the same
filesystem path is a different identity and cannot inherit the task.

## Host Scope

Feature 005 verifies the merged Codex Skill's uncertain-result behavior. It does not execute or
modify DeepSeek Harness. Because this contract freezes the public Core surface, the deferred host is
not required for acceptance.

A proposed public difference invalidates this contract and requires an amended feature with
two-host fixture impact explicitly reviewed.
