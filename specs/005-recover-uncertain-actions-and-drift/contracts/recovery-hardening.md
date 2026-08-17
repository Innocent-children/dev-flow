# Contract: Recovery Hardening Without Public Expansion

## Purpose

This contract defines the Feature 005 acceptance boundary. It is subordinate to Core Contract 0.1
and does not replace the MCP tools, result envelope, state machine, recovery classes, or persistence
model.

**Status**: Implementation complete through T038; final root validation and Spec Kit gates pending.

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

Before dispatching `dev_flow_apply_action`, a thin caller retains the original `request_id`,
`task_id`, `source_phase`, action `revision`, `action_id`, `action_kind`, issuance
`repository_binding_digest`, and exact closed payload from one fresh action and the same apply
dispatch. It never derives those values from an incomplete response.

The existing closed `operation_probe` has exactly these members:

```json
{
  "operation_id": "<original apply request_id>",
  "source_phase": "<original source phase>",
  "expected_revision": 3,
  "action_id": "<original action id>",
  "action_kind": "<original action kind>",
  "repository_binding_digest": "<original issuance binding digest>",
  "payload": {}
}
```

`operation_id` is never the read request ID. `payload` is the exact original closed payload or JSON
`null` if it was not completely retained. The caller never reconstructs it from partial output,
repository text, or model memory, and never supplies `payload_digest` or another member.

When the caller does not receive one complete valid Core result—missing, malformed, cancelled,
truncated, or transport-failed—it MUST:

1. stop mutation dispatch;
2. call `dev_flow_get_task` with the original task ID and exact probe;
3. call `dev_flow_get_next_action` only when the current action/outcome is needed, using the same
   exact probe if both reads carry one;
4. reject a stale pre-dispatch Task snapshot as read-back;
5. obey only a complete fresh Core recovery assessment and advice;
6. retry or recover only when Core explicitly reports it safe.

If any required identity is unavailable, the caller sends neither a fabricated nor partial probe,
does not assume `not_started`, stops, reports that mutation state cannot be proved, and does not
automatically retry. A complete structured `ok=false` is a Core domain result rather than transport
uncertainty; `retry_safe=false` plus `action=none` stops without another next-action or apply call.
The caller does not implement or branch on the five-class recovery decision table.

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

## Delivered Contract Evidence — 2026-08-17

T001–T033 passed against unchanged Core, Application, Recovery, Repository, Store, and MCP Go
production code. The Codex Skill static contract is the only caller-contract clarification; the
public MCP surface, result schemas, five classes, stable errors, blockers, claims, and SQLite schema
version 1 remain unchanged. `packages/deepseek/` has zero diff.

Evidence labels are limited to test-local pre-commit failure, post-commit discarded result,
pre-serialization discard, bounded partial writer, SQLite close/reopen, two-handle deterministic
race, temporary Git fixture mutation, Codex Skill static contract, and root repository validation.
No extra real host Journey, Feature 006, migration, production failpoint, dependency, or publication
is included.
