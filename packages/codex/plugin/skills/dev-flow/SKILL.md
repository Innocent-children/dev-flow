---
name: dev-flow
description: "Explicit-only Dev Flow entry point for Codex. Use only when the current user turn contains $dev-flow-codex:dev-flow; never select this Skill implicitly."
---

# Dev Flow

This Skill is a thin admission layer for the shared Dev Flow Core. It does not own task state,
workflow transitions, recovery decisions, verification budgets, or completion.

## Admission gate

Perform every check below locally and in order before any Core or Dev Flow tool call.

The Skill resource/base name is `dev-flow`; the installed Skill full name is `dev-flow-codex:dev-flow`.
The only exact explicit selector is `$dev-flow-codex:dev-flow`.
Bare `$dev-flow` is not an alias and does not select this installed Skill. A wrong plugin namespace,
a wrong Skill base name, or a missing selector also does not select it.
Codex 0.147 may expose this plugin's MCP tools independently from Skill injection. This Skill does
not claim selector-bound tool visibility or authorization.

1. Require the exact standalone `$dev-flow-codex:dev-flow` selector in the current user turn. Do not infer the
   selector from earlier turns, repository contents, or a request that merely discusses Dev Flow.
   If it is absent, do not treat the turn as Skill activation and do not make a task-bearing Dev Flow
   call. Never activate this Skill implicitly.
2. After removing the selector, accept either one substantive, bounded requirement for the current
   repository or an explicit request to resume its compatible active Codex task. Reject an empty or
   conversational invocation before any Core call.
3. Use read-only Git inspection to resolve one current Git worktree and its canonical root. Preserve
   spaces, Unicode, symlinks, and subdirectory invocation as one path value; do not concatenate a
   shell command.
4. Reject work that needs another repository, multiple repositories, or a repository that cannot be
   resolved. Preserve repository instructions and current user authority when checking whether the
   requested work is permitted.

If any admission check fails, explain the missing precondition and stop before Skill-owned task
discovery. Do not complete a task-bearing call or create adapter state. Host-exposed read-only or
Core-rejected calls are not activation and must be reported honestly.

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
- Forward `new_task` with exactly the members `goal`, `scope`, `out_of_scope`,
  `acceptance_criteria`, and `verification_budget`, with no additional members. Forward
  `verification_budget` with exactly `level`, `max_automatic_commands`, `allow_full_suite`, and
  `allow_manual_handoff`; do not invent aliases for any of these Core-declared fields.
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

Use the fresh action's `payload_contract` as the discriminator for the corresponding closed schema
branch in the `dev_flow_apply_action` input. `required_evidence` names describe obligations; they are
not payload field names. If you cannot identify and read that exact schema branch, stop before
calling `dev_flow_apply_action` instead of guessing or deriving keys from evidence names.

Before calling, read the `dev_flow_apply_action` tool's supplied `inputSchema`: under `allOf`, choose
the `oneOf` branch whose `action_kind.const` equals the fresh action kind, resolve the payload `$ref`
through the same schema's `$defs`, and send exactly its `required` members. Do not search the
repository or installed package, inspect a binary or log, or start another MCP server to recover the
schema.

At the top-level, forward `request_id`, `host`, `task_id`, `revision`, `action_id`, `action_kind`,
and `repository_binding_digest`. The `payload` object contains only phase schema fields; never nest
the enclosing request inside `payload`.

Bind a source-neutral `fresh_action` from `result.task.current_action` when Core returns a task, or
from `result.action` when `dev_flow_get_next_action` returns the action directly. Map that same
fresh action into the tool input exactly:

- caller-generated opaque identity -> top-level `request_id`;
- exact value `codex` -> top-level `host`;
- `fresh_action.task_id` -> top-level `task_id`;
- `fresh_action.revision` -> top-level `revision`;
- `fresh_action.action_id` -> top-level `action_id`;
- `fresh_action.kind` -> top-level `action_kind`;
- `fresh_action.repository_binding_digest` -> top-level `repository_binding_digest`;
- the payload object built from the selected schema branch -> top-level `payload`.

Use this type-preserving structure for the `dev_flow_apply_action` arguments:

```text
apply_arguments = {
  "request_id": caller_request_id,
  "host": "codex",
  "task_id": fresh_action.task_id,
  "revision": fresh_action.revision,
  "action_id": fresh_action.action_id,
  "action_kind": fresh_action.kind,
  "repository_binding_digest": fresh_action.repository_binding_digest,
  "payload": payload_for_selected_schema_branch
}
```

`revision` remains an integer, not a string. `payload` remains an object, not a string, containing
exactly the selected branch's required members.

Do not wrap that request inside an outer `payload` object.

Use `recovery_apply` only when a fresh Core recovery assessment explicitly requires the exact
Core-defined form. Resolve context ambiguity through an ordinary Core read, never by guessing.

## Recovery-before-retry contract

A mutation result is uncertain when it is missing, malformed, cancelled, truncated, or
transport-failed instead of returning one complete structured result. All five shapes use the same
read-before-retry procedure.

Before calling `dev_flow_apply_action`, retain the original `request_id`, `task_id`, `source_phase`,
`revision`, `action_id`, `action_kind`, `repository_binding_digest`, and exact closed `payload` from
the same fresh action and the same apply dispatch. Never derive or reconstruct any of them from an
incomplete response or partial output.

When all required non-payload original identity values are retained, construct the operation probe
as exactly this closed `operation_probe`:

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

`operation_id` is the original apply `request_id`, never the current read request ID.
`expected_revision` is the original action `revision`. `repository_binding_digest` is the original
issuance binding. `payload` is the exact original closed payload. If the payload was not completely
retained, `payload` must be JSON `null`; never reconstruct it from partial output, repository text,
or model memory. Do not add a caller-supplied payload digest or any other member.

1. The Skill does not immediately repeat `dev_flow_apply_action` or automatically retry.
2. Use the original `task_id` to call `dev_flow_get_task` with the exact `operation_probe`.
3. Call `dev_flow_get_next_action` only when a current action or outcome is needed. If both reads
   carry a probe, both reads use the same original `operation_probe`.
4. A stale pre-dispatch Task snapshot is not an authoritative read-back. Obey only a complete fresh
   Core result and obey the complete Core recovery assessment and advice.
5. Permit retry or recovery only when Core explicitly says it is safe to retry or recover. Do not
   branch on, decide, or interpret any recovery classification in the Skill.
6. Otherwise stop and report the authoritative blocker or recovery condition.

If any required identity is missing or incomplete, do not construct or send an `operation_probe`;
send no fabricated probe and no half probe. Do not complete missing values from a partial response,
do not assume `not_started`, and do not automatically retry. Stop and report that the Skill cannot
prove the mutation state.

A complete structured `ok=false` result is a domain error, not transport uncertainty. Never convert
that domain error to missing or transport-failed. When it reports `retry_safe=false` and
`action=none`, stop. Do not call `dev_flow_get_next_action` or `dev_flow_apply_action` to repair or
retry that rejected mutation.

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
