---
name: dev-flow
description: "Use Dev Flow for bounded Codex software development tasks: implementation, bug fixes, refactoring, targeted testing, and development delivery. It may be selected implicitly for those tasks or explicitly with $dev-flow-codex:dev-flow. Do not create a Dev Flow Task for explanation-only, status-only, design discussion, ordinary questions, or ambiguous requests."
---

# Dev Flow

This Skill is the current Core contract Codex adapter for the shared Dev Flow Core. Core owns task state,
current node, legal transitions, destinations, recovery, blockers, and terminal outcomes. The Skill
admits one implicit or explicit request, silently validates normal startup results, renders method work, and
forwards one closed result without keeping adapter state.

## Admission gate

Perform every check below locally and in order before any Core or Dev Flow tool call.

The Skill resource/base name is `dev-flow`; the installed Skill full name is `dev-flow-codex:dev-flow`.
The only exact explicit selector is `$dev-flow-codex:dev-flow`; it force-selects this Skill for the
current user turn. The Host may also select this Skill implicitly when the current request is a
bounded implementation, bug fix, refactoring, targeted testing, or development delivery task.
Bare `$dev-flow`, a wrong plugin namespace, or a wrong Skill base name is not an explicit selector.
A missing selector is valid only when the Host selected this Skill implicitly for a task-bearing
development request. Codex may expose this plugin's MCP tools independently from Skill injection;
this Skill does not claim selector-bound tool visibility or authorization.

1. Accept either Host implicit selection for a task-bearing development request or the exact standalone
   `$dev-flow-codex:dev-flow` selector in the current user turn. Do not infer an explicit selection from
   earlier turns, repository contents, discussion about Dev Flow, bare `$dev-flow`, or another namespace.
2. Both activation paths use this same admission gate. After removing an explicit selector when present,
   accept either one substantive bounded request or an explicit resume request for its compatible active
   Codex task. Reject an empty or conversational invocation before any Core call. Explanation-only,
   status-only, design discussion, ordinary questions, and ambiguous requests are non-task-bearing: if
   the Host loaded this Skill for one, do not create or resume a Dev Flow Task and return to ordinary
   conversation or clarify the intent.
3. Use read-only Git inspection to resolve the current Git worktree and its canonical root as the
   primary repository. Preserve spaces, Unicode, symlinks, and subdirectory invocation as one path
   value; do not concatenate a shell command.
4. Accept zero to seven additional repositories only when the current user request explicitly
   declares each stable repository key and path. Each additional repository must already be within
   an additional writable root authorized for the current Codex session. Use the Host's existing
   capabilities and actual file-tool results to enforce this boundary; do not read or parse global
   Codex configuration to infer writable roots.
5. Do not scan parent or sibling directories and do not infer repositories from imports, remotes,
   submodules, codebase-memory, or other discovery results. Never add a discovered repository to the
   Repository Scope. Reject an unresolved repository or an additional repository whose current
   writable authorization cannot be established. Preserve repository instructions and user authority
   when checking whether the work is permitted.

If admission fails, explain the missing precondition and stop before Skill-owned task discovery. Do
not complete a task-bearing call or create adapter state. Host-exposed read-only or Core-rejected
calls are not activation and must be reported honestly.

Successful admission is internal startup work. Do not narrate the selector, Git-root, repository,
profile-default, or authorization checklist; continue directly to the compatibility handshake.

## Compatibility handshake

Only after admission passes, call `dev_flow_server_info({})`; it must be the first Dev Flow tool
call. Require one complete structured result proving:

- product is exactly `dev-flow`, and Core version is present and canonical. Core and the Codex
  package are independently versioned products, so their versions are not required to be equal;
- transport is exactly `stdio`, health is exactly `ready`, and the supported host set contains
  `codex`;
- `supported_processes` contains exactly one closed `standard-development` entry:
  `process_id` is `standard-development`, `definition_digest` is present and canonical, and
  `new_task_supported` is exactly `true`;
- `method_profiles` contains exactly `plain`, `spec-kit`, and `openspec`, regardless of order;
- `host_preferences.codex.codebase_memory` is present and is exactly a JSON boolean; it expresses a
  preference only and does not prove that codebase-memory is installed or available;
- the tool catalog contains exactly these six raw names, regardless of order:

1. `dev_flow_server_info`
2. `dev_flow_open_task`
3. `dev_flow_get_task`
4. `dev_flow_get_next_action`
5. `dev_flow_apply_action`
6. `dev_flow_cancel_task`

Package resources, the bundled Core executable and version, Codex compatibility, and registration
ownership are setup-time checks owned by `dev-flow-codex setup`; do not repeat them by inspecting the
installed package or executable during each Skill invocation.

An unsupported process, absent process digest, false new-task support, incomplete method-profile set,
missing or additional tool, or incomplete, truncated, malformed, or incompatible result fails the
handshake. On success, do not display or explain the handshake checklist, versions, process digest,
profiles, or tool catalog; continue immediately to task discovery. On failure, report only the
specific blocking condition and one actionable next step. For installation or compatibility failures,
direct the user to rerun `dev-flow-codex setup`. Stop without task discovery or undocumented probing.
Do not inspect local source or an installed binary, and do not start a second MCP server to bypass a
failed handshake.

## Optional code discovery

After the successful handshake, consume only `host_preferences.codex.codebase_memory` and the
capabilities actually visible in this Codex session:

- When the preference is `false`, do not call any codebase-memory tool even when one is visible. Use
  Codex Git inspection, file reads, file search, and text search, and do not prompt for installation.
- When the preference is `true` and codebase-memory is already visible and usable, it may be
  preferred for cross-repository symbol discovery, relationships, and impact analysis. Repository
  Scope still comes only from the user's explicit declarations, and actual file modifications still
  use ordinary Codex file tools.
- When the preference is `true` but the capability is absent, incomplete, or becomes unavailable,
  notify the user at most once in the current Dev Flow session and immediately fall back to built-in
  search without blocking Task creation or progress.

Never install, configure, upgrade, start, repair, or remove codebase-memory; never call plugin
management to install it; never change MCP configuration; and never start a daemon. Index results
are not authority for repository bindings, changed paths, Git facts, Recovery, blockers, outcomes,
or workflow completion. The one-session notification flag is Host presentation state and must not
be written into the Core Task.

## Task discovery

After the handshake, call `dev_flow_open_task` with `host=codex`, `repository_path` equal to the
canonical current worktree, and the following Scope rules:

- For a new multi-repository request, send `primary_repository_key` when explicitly supplied and
  send `additional_repositories` as the user's explicit closed `{key, repository_path}` declarations.
  Do not synthesize keys or paths. For a new single-repository request, omit both optional Scope
  fields and retain the ordinary repository-relative path behavior.
- For an explicit resume from the primary or an additional repository, send that participating
  repository as `repository_path`, omit the Scope creation fields, and omit `new_task` or send
  `new_task=null`. Accept the immutable primary repository, ordered Scope, profile, revision, and
  current Action returned by Core.

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
or resumes a task. Report an ownership or contract conflict unchanged in meaning and stop. After a
successful open, give at most one concise status containing the Task identity, revision, and current
node, then begin the node's substantive repository work without reciting startup checks.

## Governed action loop

The inseparable Action fields are exactly `task_id`, `revision`, `action_id`, `action_kind`,
`process_id`, `process_definition_digest`, `current_node`, `node_purpose`,
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
3. Validate the complete Action internally. During normal work, give only a concise current-node
   status and proceed; do not dump entry conditions, completion conditions, allowed effects, required
   evidence, method steps, payload details, or all `available_transitions`. Surface a contract field
   only when it requires a user decision, limits requested authority, or explains a blocker. Keep the
   complete Action bound for transition selection and forwarding even when it is not displayed.
4. Stop when the complete result reports a blocker or terminal outcome.
5. Before any actual repository modification, confirm that Codex can still access every repository
   required by that operation within the current authorized directory boundary. If access to a
   declared repository fails, stop modification for the whole Task, identify the declared repository
   key whose permission failed, and report a permission failure rather than missing code. Do not
   change sandbox mode, add a writable root, enable danger-full-access, edit Codex configuration,
   remove the repository from Core Scope, or shrink the Scope and continue.
6. Render and perform each current method operation under the allowed effects, repository
   instructions, verification budget, and current user authority.
7. Build only the closed payload branch named by the Action and select only a Core-returned
   transition consistent with the actual typed node facts.
8. Before dispatch, generate and retain one opaque request ID plus the exact Action identity and
   payload. Submit exactly one `dev_flow_apply_action` mutation.
9. After a complete committed result, continue only from its authoritative next Action/outcome or a
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
user decision. Artifact references contain only an observed role, contract path, digest, and
summary. A single-repository Task uses an ordinary repository-relative path. A multi-repository Task
uses `<repository-key>::<repository-relative-path>`.

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
2. Read the live `dev_flow_apply_action` `inputSchema`. It is one closed object: `action_kind` is a
   top-level `enum` of every action kind and `payload` is a closed object whose `node_result`
   declares the union of every node result member. The schema does not narrow `payload` by
   `action_kind`, so select the branch from `fresh_action.action_kind` plus
   `fresh_action.payload_contract` and send only that branch's members.
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
  "process_definition_digest": fresh_action.process_definition_digest,
  "source_cursor": fresh_action.current_node,
  "repository_binding_digest": fresh_action.repository_binding_digest,
  "payload": payload_for_selected_schema_branch
}
```

`revision` remains an integer, not a string. `payload` remains an object, not a string. Do not wrap
that request inside an outer `payload` object. For an ordinary mutation, omit `recovery_apply` or
send `recovery_apply=null`.

If Core returns `INVALID_ARGUMENT`, treat it as a complete payload-contract rejection, not transport
uncertainty. Use the bounded-correction section only when the complete result explicitly authorizes
`correct_current_action`; otherwise stop and report the failing contract without private data. Never
alter a field from source-code inspection or another guessed payload.

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
`process_definition_digest`, `source_cursor`, `revision`, `action_id`,
`action_kind`, `repository_binding_digest`, and exact closed `payload` from the same fresh action and
the same apply dispatch. Never derive or reconstruct them from an incomplete response or partial
output.

When all required original identity values are retained, construct exactly this closed
`operation_probe`:

```json
{
  "operation_id": "<original apply request_id>",
  "process_id": "standard-development",
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

## Bounded correction of the current action

A complete structured domain error may carry field-level detail. `error.details[]` names the exact
failing member as `path`, a closed `rule`, and a fixed non-sensitive `message`. A refused transition
may instead carry `error.guard` with the Core `guard_id` and the same failure shape.

Submit exactly one corrected payload for the same Action only when every condition holds:

1. the original result is a complete structured Core domain error;
2. `recovery.action` is `correct_current_action`;
3. `recovery.retry_safe` is `true`;
4. Task revision, action ID, process identity, source cursor, and repository binding are unchanged;
5. the corrected request uses a new `request_id`;
6. only members listed in `recovery.allowed_paths` change;
7. the corrected value follows directly from the returned `rule`, with no source-code guessing;
8. every other payload byte keeps the same meaning.

Stop immediately when the second submission also fails. Do not submit a third candidate payload;
report only the exact `path`, `rule`, and that the bounded correction still failed. Never report
either submitted field value.

Never treat these as correctable: an uncertain mutation result, a possible store commit, a missing or
truncated response, a stale action identity, repository drift, an absent or inaccurate
`allowed_paths`, or `INTERNAL_ERROR`. Those keep `retry_safe=false` and require the
recovery-before-retry contract.

## Evidence and verification budget

- Count verification commands exactly against Core's immutable budget.
- Do not run a prohibited full suite. When automatic capacity is exhausted, report the remaining
  permitted work as manual handoff without claiming it ran.
- Preserve repository instructions and explicit user authority.
- Keep static inspection, simulated Core execution, user-performed evidence, and native automated
  evidence distinctly labelled.
- Submit actual sources and outcomes. Never relabel failed, skipped, or unavailable work as passed.
- `source=automated` uses `command_count` 1 to 20 and may set `full_suite` when the budget allows it.
- `source=user`, `source=static`, and `source=host_observed` use `command_count=0` and
  `full_suite=false`. Shell commands a person ran by hand belong in that check's `summary`; they
  never consume the automatic command budget.
- A verification the user already completed belongs in `checks` with `source=user`. Remove it from
  `manual_handoff_items`; that list keeps only work nobody has executed yet.

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
