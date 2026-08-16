# Contract: `$dev-flow-codex:dev-flow` Codex Skill 0.1

## Authority

The `dev-flow` Skill is host guidance, not a workflow engine. Core Contract 0.1 is the sole authority for task identity, state, revision, repository binding, current action, allowed effects, payload schema, required evidence, recovery, conflict, blocker, and terminal outcome.

This contract names the interaction sequence needed by Codex but intentionally does not reproduce Core's state machine, action-payload catalog, error table, or completion rules.

## Invocation contract

Codex CLI 0.147 reads `policy.allow_implicit_invocation: false` from the Skill's
`agents/openai.yaml`, so the Skill is not injected implicitly by default. This policy is not placed
in `SKILL.md` frontmatter. Codex CLI 0.147 namespaces an installed plugin Skill as
`<plugin-name>:<skill-base-name>`; for plugin `dev-flow-codex` and Skill base name `dev-flow`, the
only exact explicit selector is `$dev-flow-codex:dev-flow`. Bare `$dev-flow` does not select this
installed plugin Skill.

Accepted explicit intents are:

- `$dev-flow-codex:dev-flow` plus one substantive, bounded requirement for the current Git worktree; or
- `$dev-flow-codex:dev-flow` plus an explicit request to resume the compatible active Codex task for the current Git worktree.

Before any Core call, the Skill verifies:

1. the exact explicit selector is present in the current turn;
2. the request is substantive or is an explicit resume request, not empty/conversational text;
3. one current Git worktree can be resolved with read-only Git inspection;
4. the requested work is bounded to that one repository;
5. repository instructions and current user authority permit the requested kind of work.

If any check fails, the Skill explains the missing precondition and stops. It makes no call to any of the six Dev Flow tools, creates no adapter state, edits no repository instruction, and attempts no implicit fallback. An ordinary request without `$dev-flow-codex:dev-flow`, bare `$dev-flow`, or another namespace/base selector creates zero Dev Flow tasks and is outside this Skill's execution path; host-level MCP initialization or tool discovery is not a Skill tool call.

Paths with spaces, Unicode, symlinks, or a subdirectory working directory are canonicalized by read-only repository discovery and passed as one argv/value; they are never shell-concatenated. A request spanning another repository is rejected before task creation.

## Compatibility handshake

After local preconditions and before task discovery, the Skill calls:

```text
dev_flow_server_info({})
```

It requires the complete structured response to identify:

- product `dev-flow`;
- Core version equal to the packaged product version;
- schema version corresponding to Core Contract 0.1;
- STDIO transport and ready health;
- `codex` in the supported-host set;
- exactly the six frozen tool names, with no alias or additional tool.

An incomplete, truncated, incompatible, or malformed handshake stops the invocation. The Skill reports the observed mismatch and does not probe for undocumented tools.

## Task discovery

The Skill calls `dev_flow_open_task` with `host=codex` and the canonical current worktree.

- For an explicit resume request, it omits `new_task` and lets Core select the unique compatible active task.
- For a new substantive requirement, it supplies a bounded task contract derived only from the user's request, repository instructions, stated exclusions, observable acceptance criteria, and verification authority.
- If a material goal, scope, acceptance, or verification choice cannot be derived without changing user intent, the Skill asks before opening the task.
- Repeating the exact compatible contract may resume according to Core; the Skill does not merge or choose among task records.

The complete `dev_flow_open_task` result determines whether Core created or resumed the task. A Core ownership or contract conflict is reported unchanged in meaning and stops the invocation.

## Governed action loop

For an active task, each loop iteration follows this order:

1. Obtain the complete authoritative current action through the `open_task` result or `dev_flow_get_next_action`.
2. Preserve the Core-returned task ID, revision, action ID/kind, repository-binding digest, allowed effects, required evidence, payload schema, guidance, blocker, and outcome as one inseparable result.
3. If Core reports a blocker or terminal outcome, stop as described below.
4. Perform only the work authorized by that current action, using ordinary Codex repository tools under the repository instructions and the user's authority.
5. Count verification commands and label evidence sources by how they actually ran.
6. Construct only the payload requested by Core's closed schema. Do not add aliases, commands, environment dumps, inferred status, or undocumented recovery fields.
7. Before dispatch, create and retain an opaque request ID together with the exact submitted identity and payload.
8. Call `dev_flow_apply_action` with the exact retained identity and closed payload.
9. After a complete successful mutation result, continue only from its returned authoritative next action/outcome or perform one fresh Core read before more work.

The Skill never embeds a phase sequence, maps an action kind to a locally owned transition, reinterprets an error code, or declares completion from repository contents or Codex's own judgment.

## Closed forwarding contract

For every mutation, the Skill forwards:

- `host=codex`;
- the task ID and revision from the same fresh Core result;
- the exact action ID, action kind, and repository-binding digest from that result;
- one caller-generated request ID retained before dispatch;
- a payload containing only members allowed by the returned payload schema;
- `recovery_apply` only when a fresh Core recovery assessment/advice requires the exact Core-defined form.

Unknown fields, stale identities, reconstructed payloads, and locally inferred recovery flags are forbidden. When a Core action requires context disambiguation, the Skill obtains it through the ordinary Core read described by Contract 0.1 rather than guessing.

## Recovery-before-retry contract

A mutation is uncertain if its response is missing, cancelled, malformed, truncated, or otherwise cannot be consumed as one complete structured result.

For an uncertain mutation the Skill:

1. does not immediately repeat `dev_flow_apply_action`;
2. retains the original request ID, action identity, and exact payload when available;
3. calls `dev_flow_get_task` and `dev_flow_get_next_action` before deciding what happened;
4. includes the exact Core-defined operation probe only when all required original values are retained;
5. uses the fresh Core task/action and recovery assessment/advice as the sole decision source;
6. retries or applies recovery only when that fresh result says it is safe and only with the identity/form Core supplies;
7. stops and reports the authoritative blocker or recovery condition when safety cannot be established.

If the original values needed for a probe were lost, the Skill sends no fabricated probe. It performs ordinary reads and stops if Core does not provide a safe next action. A truncated UI preview is never completed from memory.

## Evidence and verification budget

- Ordinary Codex filesystem/editor/shell capabilities may be used only for the current Core-authorized action; the plugin adds no generic shell MCP tool.
- The Skill honors repository instructions and explicit user authority even when a broader action would be technically possible.
- Automatic verification commands are counted exactly against the Core task's verification budget.
- A prohibited full suite is not run. When automatic capacity is exhausted, remaining allowed work is presented as a manual handoff.
- Static inspection, fake-Core execution, user-performed evidence, and native automated evidence retain distinct labels.
- Evidence submitted to Core names actual sources and outcomes; skipped, unavailable, or failed checks are not relabelled as passed.

## Blocked and terminal behavior

When the complete fresh Core result reports:

- a blocked task, the Skill stops repository work and reports the authoritative blocker and unblock condition;
- `DONE`, it reports Core's exact terminal outcome and evidence summary;
- `CANCELLED`, it reports Core's exact cancellation outcome;
- a conflict, it reports the Core conflict without taking over, merging, or creating a replacement task.

The Skill does not continue merely because Codex believes the source change is complete, and it does not convert a blocker into success. Cancellation uses `dev_flow_cancel_task` only after explicit user authority and the current Core identity have been freshly established.

## Presentation contract

The Skill uses complete MCP structured results for decisions. User-facing summaries may be concise, but they preserve every outcome-bearing fact relevant to the next step: task identity, current revision, committed/not-committed status, blocker or recovery condition, verification evidence/limits, and terminal outcome. Raw private database locations are never requested or displayed.

If Codex exposes only a truncated preview and not the complete structured result, the Skill treats the operation as uncertain and follows recovery-before-retry. It never silently discards unknown result members or fills them from a local catalog.

Codex 0.147 may emit a terminal MCP item with `status=failed`. When that item still contains a
complete text/structured `ok=false` result with `error=null`, the result is a complete Core/tool error rather
than a transport ambiguity: the Skill consumes the Core envelope and follows its explicit stop or
recovery instruction. When the failed item has `result=null` and a typed error, no Core result exists
and the native journey stops fail-closed. A malformed `status=completed` result is neither form and
remains uncertain; a failed item whose complete envelope claims `ok=true` is also inconsistent. No failed event may be ignored, and no uncertain mutation may be retried before
the required `dev_flow_get_task` then `dev_flow_get_next_action` reads.
When a complete Core error is recovered and the journey later passes, the evidence binds that
failed apply item's safe role/index/tool/request-task/expected-revision/result digest and Core error/recovery projection to those exact
two later reads and the next apply mutation, including canonical task ID and non-regressing
read/read/apply revisions tied to journey lineage. Passing evidence accepts only Core `retry_safe=false` with
`read_task|read_next_action`; it never persists the raw result or recovery message.

## Testable examples

| Scenario | Required observable behavior |
|---|---|
| Ordinary coding prompt, no `$dev-flow-codex:dev-flow` | zero calls to the six Dev Flow tools and zero Dev Flow task creation |
| Bare `$dev-flow` or wrong plugin/Skill namespace | no installed Skill selection; zero Dev Flow calls/tasks |
| `$dev-flow-codex:dev-flow` with empty/conversational text | local precondition error; no task creation |
| `$dev-flow-codex:dev-flow` outside Git | repository precondition error; no task creation |
| New bounded request | handshake, one `host=codex` open, then only the returned action |
| Restart and explicit resume | handshake, open without a new contract, same Core task/revision lineage |
| Different contract or host claim | Core conflict reported; no merge/takeover |
| Closed payload contains an unknown member | adapter test fails before dispatch |
| Successful mutation | full result handled; returned action or one fresh read precedes more work |
| Lost mutation response | task read and next-action read precede any retry decision |
| Verification budget exhausted | no extra automatic command; honest manual handoff |
| Core blocker/terminal outcome | immediate stop with Core-owned condition/outcome |

Fake-Core tests may exercise these scenarios deterministically but are labelled simulated. The native Codex journey must independently prove plugin discovery, explicit invocation, real repository work, restart/resume, bounded evidence, and removal using the final artifact.
