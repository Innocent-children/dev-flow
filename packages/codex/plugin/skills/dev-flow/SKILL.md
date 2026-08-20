---
name: dev-flow
description: "Explicit-only Dev Flow entry point for Codex. Use only when the current user turn contains $dev-flow-codex:dev-flow; never select this Skill implicitly."
---

# Dev Flow

This Skill is the Contract 0.2 Codex adapter for the shared Dev Flow Core. Core owns task state,
current node, legal transitions, destinations, recovery, blockers, and terminal outcomes. The Skill
admits one explicit request, presents a complete Core Action, renders method work, and forwards one
closed result without keeping adapter state.

## Admission gate

Perform every check below locally and in order before any Core or Dev Flow tool call.

The Skill resource/base name is `dev-flow`; the installed Skill full name is `dev-flow-codex:dev-flow`.
The only exact explicit selector is `$dev-flow-codex:dev-flow`.
Bare `$dev-flow` is not an alias and does not select this installed Skill. A wrong plugin namespace,
a wrong Skill base name, or a missing selector also does not select it. Codex may expose this
plugin's MCP tools independently from Skill injection; this Skill does not claim selector-bound tool
visibility or authorization.

1. Require the exact standalone `$dev-flow-codex:dev-flow` selector in the current user turn. Do not
   infer it from earlier turns, repository contents, or discussion about Dev Flow. Without it, do not
   activate this Skill or make a task-bearing Dev Flow call. Never activate implicitly.
2. After removing the selector, accept either one substantive bounded request for the current
   repository or an explicit request to resume its compatible active Codex task. Reject an empty or
   conversational invocation before any Core call.
3. Use read-only Git inspection to resolve one current Git worktree and its canonical root. Preserve
   spaces, Unicode, symlinks, and subdirectory invocation as one path value; do not concatenate a
   shell command.
4. Reject work requiring another repository, multiple repositories, or an unresolved repository.
   Preserve repository instructions and current user authority when checking whether the work is
   permitted.

If admission fails, explain the missing precondition and stop before Skill-owned task discovery. Do
not complete a task-bearing call or create adapter state. Host-exposed read-only or Core-rejected
calls are not activation and must be reported honestly.

## Compatibility handshake

Only after admission passes, call `dev_flow_server_info({})`; it must be the first Dev Flow tool
call. Require one complete structured result proving:

- product is exactly `dev-flow`, and Core version equals the packaged product version;
- `schema_version` is exactly `2` and `core_limits_version` is exactly `0.2`;
- transport is exactly `stdio`, health is exactly `ready`, and the supported host set contains
  `codex`;
- `supported_processes` contains exactly one closed `standard-development@1` entry:
  `process_id` is `standard-development`, `process_version` is `1`, `definition_digest` is present
  and canonical, and `new_task_supported` is exactly `true`;
- `method_profiles` is exactly `plain`, `spec-kit`, `openspec` in that order;
- the tool catalog contains exactly these six raw names, in this order:

1. `dev_flow_server_info`
2. `dev_flow_open_task`
3. `dev_flow_get_task`
4. `dev_flow_get_next_action`
5. `dev_flow_apply_action`
6. `dev_flow_cancel_task`

Any other schema, unsupported process version, absent process digest, false new-task support,
incomplete method-profile set, missing/additional/reordered tool, or incomplete, truncated, malformed,
or incompatible result fails the handshake. Stop without task discovery or undocumented probing. Do
not inspect local source or an installed binary, and do not start a second MCP server to bypass a
failed handshake.

## Task discovery

After the handshake, call `dev_flow_open_task` with `host=codex` and the canonical current worktree.

- For an explicit resume, omit `new_task` or send `new_task=null`. Do not resend a guessed intent or
  select another profile; accept the immutable profile returned by Core.
- For a new request, select one profile from explicit current user intent. An explicit `plain`,
  `spec-kit`, or `openspec` request selects that exact profile. An explicit request to use Spec Kit
  selects `spec-kit`; an explicit request to use OpenSpec selects `openspec`; otherwise use the
  conservative `plain` profile.
- Installed tooling does not select or switch a profile. Never change the profile after creation. If
  the user explicitly requests conflicting profiles, report the profile conflict and stop.
- Derive the new-task contract only from the admitted user request, repository instructions, known
  initial bounds, known acceptance, and granted verification authority. Formal acceptance does not
  need to be complete at creation; the current requirements work forms that authority.
- Forward `new_task` with exactly the members `request`, `initial_scope`,
  `initial_out_of_scope`, `known_acceptance_criteria`, `verification_budget`, and `method_profile`,
  with no additional members. Forward `verification_budget` with exactly `level`,
  `max_automatic_commands`, `allow_full_suite`, and `allow_manual_handoff`.
- `request` is a JSON string. `initial_scope`, `initial_out_of_scope`, and
  `known_acceptance_criteria` are JSON arrays of strings and may be empty. Never collapse an array
  into prose. `verification_budget.level` is exactly `minimal`, `targeted`, or `full`.

Use this exact `new_task` JSON shape, changing only values derived from the admitted request:

<!-- new-task-example:start -->
```json
{
  "request": "Return the requested field from the bounded endpoint.",
  "initial_scope": ["Update the endpoint response"],
  "initial_out_of_scope": ["Change unrelated endpoints"],
  "known_acceptance_criteria": ["The response contains the requested field"],
  "verification_budget": {
    "level": "targeted",
    "max_automatic_commands": 4,
    "allow_full_suite": false,
    "allow_manual_handoff": true
  },
  "method_profile": "plain"
}
```
<!-- new-task-example:end -->

Ask before opening only when a material request, initial-bound, verification, or profile choice
cannot be derived without changing user intent. Let Core decide whether a compatible intent creates
or resumes a task. Report an ownership or contract conflict unchanged in meaning and stop.

## Governed action loop

The inseparable Action fields are exactly `task_id`, `revision`, `action_id`, `action_kind`,
`process_id`, `process_version`, `process_definition_digest`, `current_node`, `node_purpose`,
`entry_conditions`, `completion_conditions`, `allowed_effects`, `required_evidence`,
`method_profile`, `method_steps`, `available_transitions`, `payload_contract`, `guidance`,
`repository_binding_digest`, and `issued_at`.

For an active task, perform each iteration in this order:

1. Obtain one complete fresh Action from the open result or `dev_flow_get_next_action`, and bind it as
   `fresh_action` from `result.task.current_action` or `result.action` respectively.
2. Treat its task ID, revision, action ID, action kind, process ID, process version,
   process-definition digest, current node, node purpose, entry conditions, completion conditions,
   allowed effects, required evidence, method profile, method steps, available transitions, payload
   schema/contract, guidance, repository-binding digest, and issued time as one inseparable Core
   result. Stop if any field is absent, malformed, or truncated.
3. Present the current node, purpose, entry and completion conditions, allowed effects, required
   evidence, immutable method profile, every method step, and all `available_transitions`. For every
   returned transition show its identifier, Core-returned destination for visibility, description or
   `when` selection condition, guard identifier, and reason rule. Do not reduce this to one
   recommended next step.
4. Stop when the complete result reports a blocker or terminal outcome.
5. Render and perform each current method operation under the allowed effects, repository
   instructions, verification budget, and current user authority.
6. Build only the closed payload branch named by the Action and select only a Core-returned
   transition consistent with the actual typed node facts.
7. Before dispatch, generate and retain one opaque request ID plus the exact Action identity and
   payload. Submit exactly one `dev_flow_apply_action` mutation.
8. After a complete committed result, continue only from its authoritative next Action/outcome or a
   fresh ordinary Core read.

Repository contents, adapter judgment, artifacts, or method-tool status never determine the current
node or completion.

## Method operation rendering

Read [the method profile rendering reference](references/method-profiles.md) from the packaged path
`references/method-profiles.md` after receiving the complete Action. For each Core-returned method
step, preserve its `step_id`, purpose, required flag, and order, then render the operation for the
immutable profile:

- `plain` renders the catalog's plain-equivalent bounded work with no external capability.
- `spec-kit` and `openspec` render only an actually visible and appropriate capability ID. A catalog
  entry is not proof of availability.
- If a capability is unavailable or unknown, report that state and show the exact plain-equivalent
  work. Never automatically install a tool or silently substitute another tool.
- A tool invocation is not semantic completion. Record evidence only after the work and expected
  result actually complete.

Build exactly one `MethodEvidence` item for every current Action step, in the same order:

- actual capability completion uses `status=completed` and the actual capability ID;
- completed ordinary work uses `status=plain_fallback` and an empty capability;
- incomplete work uses `status=unavailable` or `status=not_run` honestly.

An unavailable or not-run required step is unsatisfied, so do not call `dev_flow_apply_action`.
Capability output cannot substitute for the typed `node_result`, node obligations, evidence, or
user decision. Artifact references contain only an observed role, repository-relative path, digest,
and summary.

Existing authorized spec, plan, or tasks artifacts should be reviewed, revised, or amended as
needed, not regenerated or rerun mechanically because a semantic step appears. Resolve the active
Feature from explicit repository context, never only from the branch name. Checklist state,
analysis output, implementation completion, proposal state, verification state, sync, or archive
state does not advance Core.

## Transition selection

Select only from `fresh_action.available_transitions`. Match the actual current typed `node_result`,
the Core-returned description or selection condition, current `problem_class`, any explicit user
decision, and the returned reason rule. Submit the matching transition identifier; Core validates
the facts and owns/derives the destination.

Never infer an edge from a fixed stage sequence, artifact checkbox, AI belief, profile, method-tool
result, or capability status. A checkbox or method tool cannot advance, select, or complete Core.
Never submit a transition absent from the fresh Action and never maintain a copied transition list.

## Closed forwarding contract

Use the same `fresh_action` already bound from `result.task.current_action` or `result.action`; do
not construct another Action view.

Read [the node payload construction reference](references/node-payloads.md) from the packaged path
`references/node-payloads.md` before every ordinary apply. The reference is construction guidance;
the fresh Action, live `dev_flow_apply_action` `inputSchema`, and Core remain authoritative.

Before calling `dev_flow_apply_action`, perform this order exactly:

`fresh_action.payload_contract` identifies the payload branch that must agree with the live schema
and packaged template.

1. Rebind the complete `fresh_action` and read its `action_kind`, `current_node`, `payload_contract`,
   `method_steps`, and all `available_transitions`.
2. Read the live `dev_flow_apply_action` `inputSchema`; under `allOf`, choose the `oneOf` payload
   branch whose `action_kind.const` matches the current action kind and source node.
3. Open the corresponding marked template in `references/node-payloads.md`.
4. Preserve the template's complete common envelope and `node_result` wrapper; replace only dynamic
   values with facts from the current Task, Action, user decision, repository work, and actual check.
5. Use current baseline revisions, work-item IDs, record IDs, acceptance, and evidence sets; never
   guess or reuse stale values.
6. Confirm all six common payload members exist and no seventh member exists.
7. Confirm every branch-specific required `node_result` key exists and arrays remain arrays.
8. Confirm every ArtifactReference role belongs to the live closed enum. Never convert a
   `required_evidence` kind such as `repository_observation` into an artifact role. Use
   `"artifacts": []` when no real repository-relative process artifact exists.
9. Confirm MethodEvidence exactly matches current Action steps in ID, order, and count. Completed
   `plain` work uses `plain_fallback` with an empty capability.
10. Confirm the selected transition is present in the fresh Action and its reason rule matches.
11. Confirm `destination`, `next_node`, `next_cursor`, caller classification, repository facts,
    payload digest, raw output, and unknown members are absent.
12. Map the mutation top-level identity from that same fresh Action.
13. Retain the exact request and call `dev_flow_apply_action` once.

If the live schema and packaged reference disagree, stop before mutation and report the packaging
contract defect. Do not choose whichever shape appears more convenient.

Do not derive payload keys from `required_evidence`. Do not search the repository or installed
package, inspect a binary or log, or start another MCP server to recover a schema. The selected
payload contains exactly `transition_id`, `summary`, `reason`, `artifacts`, `method_evidence`, and
`node_result`; put `problem_class` exactly where that node branch's actual schema requires it. Keep
arrays as arrays and the payload as an object. Do not add unknown fields, caller classification,
caller digest, authoritative repository facts, command/output/configuration data, `destination`,
`next_node`, or `next_cursor`, and do not wrap the whole request in an outer `payload`.

Map every mutation top-level field from the same fresh Action:

- caller-generated opaque identity -> top-level `request_id`;
- exact value `codex` -> top-level `host`;
- `fresh_action.task_id` -> top-level `task_id`;
- `fresh_action.revision` -> top-level `revision`;
- `fresh_action.action_id` -> top-level `action_id`;
- `fresh_action.action_kind` -> top-level `action_kind`;
- `fresh_action.process_id` -> top-level `process_id`;
- `fresh_action.process_version` -> top-level `process_version`;
- `fresh_action.process_definition_digest` -> top-level `process_definition_digest`;
- `fresh_action.current_node` -> top-level `source_cursor`;
- `fresh_action.repository_binding_digest` -> top-level `repository_binding_digest`;
- the selected closed payload -> top-level `payload`.

```text
apply_arguments = {
  "request_id": caller_request_id,
  "host": "codex",
  "task_id": fresh_action.task_id,
  "revision": fresh_action.revision,
  "action_id": fresh_action.action_id,
  "action_kind": fresh_action.action_kind,
  "process_id": fresh_action.process_id,
  "process_version": fresh_action.process_version,
  "process_definition_digest": fresh_action.process_definition_digest,
  "source_cursor": fresh_action.current_node,
  "repository_binding_digest": fresh_action.repository_binding_digest,
  "payload": payload_for_selected_schema_branch
}
```

`revision` remains an integer, not a string. `payload` remains an object, not a string. Do not wrap
that request inside an outer `payload` object. For an ordinary mutation, omit `recovery_apply` or
send `recovery_apply=null`.

If Core returns `INVALID_ARGUMENT`, treat it as a complete payload-contract rejection. Stop the
current mutation, report the failing action/payload contract without private data, and do not delete
fields, submit a second candidate payload for the same Action, automatically retry, or treat the
result as transport uncertainty.

## Comprehension user interaction

At `COMPREHENSION_REVIEW`, present a bounded explanation of current requirements, design, and major
code paths; list unnecessary abstractions and maintenance risks; explicitly ask whether the
developer can explain and maintain the result; and wait for an explicit user answer or verdict.

Use that answer and only the fresh Core transitions to form a candidate transition and matching
typed facts. `comprehension_passed` requires explicit current user confirmation. AI must not answer,
self-confirm, or infer that the user understands. Neither Spec Kit nor OpenSpec can own or replace
the verdict.

## SCHEMA_UNSUPPORTED

When Core returns `SCHEMA_UNSUPPORTED`, explain that the selected data directory contains pre-graph
or otherwise incompatible data and that Core did not modify or delete the old data. The user must
act explicitly outside Core by choosing a fresh `DEV_FLOW_DATA_DIR`, manually archiving the old
directory, manually renaming it, or manually deleting it.

Stop current task discovery and do not continue open/create, automatically retry, reset, convert,
migrate, install a migration tool, or create a substitute task. Never run delete, move, truncate, or
reset operations for the user. Do not search for a local data directory or database path, and do not
display, reveal, or expose a private path or location. Report only the stable error code and bounded
guidance: never include a `HOME` value, username, result-envelope data path, raw SQLite error, or raw
Git error. After the user completes an explicit external choice, they may invoke the exact Skill
selector again; no background handling is promised.

## Recovery-before-retry contract

A mutation result is uncertain when it is missing, cancelled, malformed, truncated, or
transport-failed instead of returning one complete structured result. Do not immediately repeat
`dev_flow_apply_action` and do not infer the result from repository state or worktree contents.

Before calling `dev_flow_apply_action`, retain the original `request_id`, `task_id`, `process_id`,
`process_version`, `process_definition_digest`, `source_cursor`, `revision`, `action_id`,
`action_kind`, `repository_binding_digest`, and exact closed `payload` from the same fresh action and
the same apply dispatch. Never derive or reconstruct them from an incomplete response or partial
output.

When all required original identity values are retained, construct exactly this closed
`operation_probe`:

```json
{
  "operation_id": "<original apply request_id>",
  "process_id": "standard-development",
  "process_version": 1,
  "process_definition_digest": "<original process definition digest>",
  "source_cursor": "<original source cursor>",
  "expected_revision": 3,
  "action_id": "<original action id>",
  "action_kind": "<original action kind>",
  "repository_binding_digest": "<original issuance binding digest>",
  "payload": {}
}
```

`operation_id` is the original apply `request_id`, never a read request ID.
`expected_revision` is the original action `revision`. `repository_binding_digest` is the original
issuance binding. `payload` is the exact original closed payload; when it was not completely
retained, send JSON `null`. Never reconstruct it from partial output, repository text, or model
memory.

Use the original `task_id` to call `dev_flow_get_task` with that exact probe. A stale pre-dispatch
Task snapshot is not an authoritative read-back. Require one complete `recovery_assessment` with the
original graph operation identity, binding relations, operation evidence, optional committed proof,
retry flag, `next_advice`, optional unblock condition, and observation time. Stop if it is absent,
truncated, malformed, or refers to another operation.

Do not implement or branch on the five-class decision table. Obey only Core's complete
`next_advice`:

- `retry_current_action`: retry the ordinary current action only when Core also returns
  `action_retry_safe=true` and the authoritative task still exposes the exact original action;
- `submit_recovery_apply`: submit the retained original top-level operation identity and payload,
  adding exactly `recovery_apply={"operation_id":<original request_id>,"source_cursor":<original
  source_cursor>}`; do not add a new recovery operation ID, destination, or classification;
- `read_next_action`: read the authoritative next action and continue only from that result;
- `resolve_blocker`: stop ordinary work and handle only the Core-returned current
  `RESOLVE_BLOCKER` action;
- `stop_for_repository_drift`: report the bounded drift condition and stop.

Never infer that an unlisted action is safe. A recovery read itself cannot create a blocker or adopt
work. Only a Core-requested explicit recovery apply may do so, and its result becomes the next
authority.

If any required identity is missing or incomplete, do not construct or send an `operation_probe`;
send no fabricated or half probe. Do not fill missing values from a partial response, do not assume
`not_started`, and do not automatically retry. Stop and report that the Skill cannot prove the
mutation state.

Do not branch, decide, or interpret any recovery classification and do not guess from repository
state. Core owns classification, effect proof, blocker eligibility, and mutation directives.

A complete structured `ok=false` result is an authoritative domain error, not transport
uncertainty. Never convert or treat that domain error as missing or transport failure. Obey Core's
`code`, `message`, `recovery.retry_safe`, `recovery.action`, and `recovery.message`. When it reports
`retry_safe=false` and `action=none`, stop; do not call `dev_flow_get_next_action` or
`dev_flow_apply_action`.

## Evidence and verification budget

- Count verification commands exactly against Core's immutable budget.
- Do not run a prohibited full suite. When automatic capacity is exhausted, report the remaining
  permitted work as manual handoff without claiming it ran.
- Preserve repository instructions and explicit user authority.
- Keep static inspection, simulated Core execution, user-performed evidence, and native automated
  evidence distinctly labelled.
- Submit actual sources and outcomes. Never relabel failed, skipped, or unavailable work as passed.

## Blocked and terminal behavior

Stop repository work when Core returns authoritative `BLOCKED`, `DONE`, `CANCELLED`, an ownership or
contract conflict, or another safe-stop. Report Core's blocker and condition, terminal outcome,
evidence summary, cancellation, or conflict without replacing or merging a task. Use
`dev_flow_cancel_task` only after explicit user authority and a fresh current Core identity.

Codex's belief that work is complete does not override Core, and a blocker is not success.

## Presentation contract

Use complete structured Core results for every decision. A concise user summary still preserves task
identity, revision, current node, whether a mutation committed, method capability/fallback status,
verification evidence and limits, every blocker or recovery condition, and the terminal outcome.
Never request or display private database locations.

Treat a truncated preview as uncertainty and follow the recovery-before-retry contract. Never fill
missing data from a local catalog or discard outcome-bearing fields.
