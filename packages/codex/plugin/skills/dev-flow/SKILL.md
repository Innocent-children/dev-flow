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

## Task discovery

After the handshake, call `dev_flow_open_task` with `host=codex` and the canonical current
worktree.

- For an explicit resume request, omit `new_task` and let Core select the unique compatible active
  Codex task.
- For a new substantive request, provide a bounded contract derived only from the current user
  request, repository instructions, stated exclusions, observable acceptance criteria, and the
  granted verification authority.
- Ask before opening a new task if a material goal, scope, acceptance, or verification choice
  cannot be derived without changing user intent.
- Let Core decide whether an exactly compatible contract creates or resumes a task. Never choose,
  merge, or take over task records locally.

The complete open result is authoritative. Report a Core ownership or contract conflict unchanged
in meaning and stop.

## Governed action loop

For an active task, perform each iteration in this order:

1. Obtain one complete, fresh action from the open result or `dev_flow_get_next_action`.
2. Treat the returned task ID, revision, action ID, action kind, repository-binding digest, allowed
   effects, required evidence, payload schema, guidance, blocker, and outcome as one inseparable
   Core result.
3. Stop when that result reports a blocker or terminal outcome.
4. Perform only the current action's allowed effects, under the repository instructions and
   current user authority.
5. Count verification commands and label evidence by how it actually ran.
6. Build only the closed payload requested by the returned payload schema.
7. Before dispatch, generate and retain an opaque request ID with the exact identity and payload.
8. Submit exactly one mutation through `dev_flow_apply_action` using that retained material.
9. After a complete successful mutation, continue only from the returned authoritative next action
   or outcome, or make one fresh Core read before doing more work.

Do not infer a transition, reinterpret an error, or decide completion from repository contents or
host judgment.

## Closed forwarding contract

For every mutation, forward `host=codex`; the task ID and revision from the same fresh result; the
exact action ID, action kind, and repository-binding digest; one caller-generated request ID; and a
closed payload containing only fields allowed by Core's returned schema. Do not add unknown fields,
aliases, command logs, environment dumps, inferred status, or locally invented recovery flags.

Use `recovery_apply` only when a fresh Core recovery assessment explicitly requires the exact
Core-defined form. Resolve context ambiguity through an ordinary Core read, never by guessing.

## Recovery-before-retry contract

A mutation is uncertain when its response is missing, cancelled, malformed, truncated, or cannot
otherwise be consumed as one complete structured result. In that case:

1. The Skill does not immediately repeat `dev_flow_apply_action`.
2. Retain the original request ID, action identity, and exact payload when they remain available.
3. Call `dev_flow_get_task` and then `dev_flow_get_next_action` before deciding what happened.
4. Include an exact Core-defined operation probe only when every required original value is
   retained.
5. Treat the fresh Core task, action, recovery assessment, and advice as the sole decision source.
6. Retry or recover only when that fresh Core result says it is safe, using only the supplied
   identity and form.
7. Otherwise stop and report the authoritative blocker or recovery condition.

If values needed for an operation probe were lost, send no fabricated probe. Do not complete a
truncated preview from memory.

## Evidence and verification budget

- Count verification commands exactly against Core's budget.
- Do not run a prohibited full suite. When automatic capacity is exhausted, present the remaining
  allowed work as a manual handoff.
- Preserve repository instructions and explicit user authority even when broader work is possible.
- Keep static inspection, simulated Core execution, user-performed evidence, and native automated
  evidence distinctly labelled.
- Submit actual evidence sources and outcomes. Never relabel a failed, skipped, or unavailable
  check as passed.

## Blocked and terminal behavior

Stop repository work when Core returns an authoritative blocker, ownership or contract conflict,
`DONE`, or `CANCELLED`. Report Core's blocker and unblock condition, exact terminal outcome and
evidence summary, cancellation, or conflict without replacing or merging a task. Use
`dev_flow_cancel_task` only after explicit user authority and a fresh current Core identity.

Codex's belief that source work is complete does not override Core, and a blocker is not success.

## Presentation contract

Use complete structured Core results for every decision. A concise user summary must still preserve
task identity, current revision, whether a mutation committed, any blocker or recovery condition,
verification evidence and limits, and the terminal outcome. Never request or display private
database locations.

If only a truncated preview is available, treat the operation as uncertain and follow the recovery
contract. Do not fill missing data from a local catalog or silently discard outcome-bearing fields.
