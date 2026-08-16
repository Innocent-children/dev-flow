# Dev Flow Codex Skill Contract

## Authority

The `dev-flow` Skill is host guidance, not a workflow engine. Core Contract 0.1 alone owns task
identity, state, revision, repository binding, current action, allowed effects, payload schema,
required evidence, recovery, conflicts, blockers, and terminal outcomes.

The Skill never persists task state, implements transitions, or decides completion.

## Invocation

The installed Codex 0.147 identity is:

```text
$dev-flow-codex:dev-flow
```

The base name remains `dev-flow`, but bare `$dev-flow`, a wrong namespace/base, a missing selector,
and implicit invocation are not accepted. They make zero Dev Flow calls and create zero tasks.

Before the first tool call, the Skill requires:

- a substantive requirement;
- a current Git worktree;
- work confined to that repository;
- repository instructions and user authority that permit the requested work.

Failure stops before task discovery.

## Handshake

The first Dev Flow call is `dev_flow_server_info`. The complete result must identify the compatible
Core contract and exactly the six tool names. Missing, malformed, incompatible, or additional
surface stops the invocation.

## Task Loop

1. Call `dev_flow_open_task` with `host=codex` and the current repository.
2. Use the complete returned task/current action as one authoritative unit.
3. Stop immediately for Core conflicts, blockers, `DONE`, or `CANCELLED`.
4. Perform only the allowed repository effects for the current action.
5. Submit `dev_flow_apply_action` with honest evidence labels and verification counts.
6. Continue from the returned next action or perform one fresh read.

After a missing, cancelled, malformed, truncated, or uncertain mutation result, call
`dev_flow_get_task` and then `dev_flow_get_next_action` before considering a retry.

After host restart, reopen the compatible Codex-owned task; do not merge, take over, or create a
replacement for an incompatible claim.

## Core Domain Error vs Transport Error

A Codex 0.147 terminal MCP item may be:

- `status=completed` with a complete structured/text-parity Core result;
- `status=failed` with a complete structured/text-parity Core `ok=false` result;
- `status=failed` with no complete result and a typed host transport error.

The second form remains a Core domain result and its recovery/stop guidance is authoritative. The
third form has no Core authority and stops fail-closed. A malformed completed result is neither
form.

The current checkpoint verifies only these host shapes. Detailed diagnostic precedence, complete
envelope closure, failed-event recovery binding, and aggregate/session fact parity remain the four
explicit pending HIGH regression cases and are not claimed as solved.

## Evidence and Terminal Reporting

- Automated, manual, fake, static, and user-observed checks keep distinct labels.
- Verification commands must not exceed the current Core budget.
- Free-form agent prose or a completed host process never substitutes for Core `DONE`.
- User-facing reporting preserves task/revision, blocker/recovery condition, evidence limits, and
  terminal outcome without exposing private data paths.

## Removal

The Skill owns no lifecycle deletion. The package's explicit removal command removes product-owned
registration only and preserves Core task data.

## Verification Layers

- Skill contract tests own explicit selection and handshake guidance.
- Fake-Core tests own deterministic task-loop and recovery behavior.
- Three sanitized Codex fixtures own host terminal shape.
- Repeatable smoke owns process wiring only.
- One final acceptance journey owns the real-host end-to-end merge gate.

None of the deterministic layers may claim real-host success.
