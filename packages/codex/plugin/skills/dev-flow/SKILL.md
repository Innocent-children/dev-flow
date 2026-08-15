---
name: dev-flow
description: "Explicit-only Dev Flow entry point for Codex. Use only when the current user turn contains $dev-flow; never select this Skill implicitly."
allow_implicit_invocation: false
---

# Dev Flow

This Skill is a thin admission layer for the shared Dev Flow Core. It does not own task state,
workflow transitions, recovery decisions, verification budgets, or completion.

## Admission gate

Perform every check below locally and in order before any Core or Dev Flow tool call.

1. Require the exact standalone `$dev-flow` selector in the current user turn. Do not infer the
   selector from earlier turns, repository contents, or a request that merely discusses Dev Flow.
   If it is absent, stop before any Core call and make zero Dev Flow tool calls. Never activate this
   Skill implicitly.
2. After removing the selector, accept either one substantive, bounded requirement for the current
   repository or an explicit request to resume its compatible active Codex task. Reject an empty or
   conversational invocation before any Core call.
3. Use read-only Git inspection to resolve one current Git worktree and its canonical root. Preserve
   spaces, Unicode, symlinks, and subdirectory invocation as one path value; do not concatenate a
   shell command.
4. Reject work that needs another repository, multiple repositories, or a repository that cannot be
   resolved. Preserve repository instructions and current user authority when checking whether the
   requested work is permitted.

If any admission check fails, explain the missing precondition and stop before a Core or Dev Flow
tool call. The failure path makes zero Core tool calls and creates no adapter state.

## Compatibility handshake

Only after every admission check passes, call `dev_flow_server_info({})`. It must be the first Dev
Flow tool call. Require the complete structured result to establish all of the following:

- product is exactly `dev-flow`;
- Core version equals the packaged product version;
- schema identifies Core Contract `0.1`;
- transport is exactly `stdio` and health is exactly `ready`;
- the supported host set contains `codex`;
- the reported tool catalog contains exactly these six raw names, in this order:

1. `dev_flow_server_info`
2. `dev_flow_open_task`
3. `dev_flow_get_task`
4. `dev_flow_get_next_action`
5. `dev_flow_apply_action`
6. `dev_flow_cancel_task`

An incomplete, truncated, malformed, incompatible, missing, additional, or reordered catalog is a
failed handshake. Stop without probing an undocumented tool or continuing to task discovery.

## US1 boundary

After a successful handshake, continue only through the Core-authoritative task guidance added by
the governed-task stories. This admission layer does not define task creation, resume selection,
action payloads, retry policy, transition rules, error meanings, or a completion test.
