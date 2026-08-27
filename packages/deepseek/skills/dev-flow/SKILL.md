# Dev Flow

This Skill is the current Core contract DeepSeek Harness adapter for the shared Dev Flow Core. Core owns task state,
current node, legal transitions, destinations, recovery, blockers, and terminal outcomes. The Skill
admits one explicit request, presents a complete Core Action, renders method work, and forwards one
closed result without keeping adapter state.

## Admission gate

Perform every check below locally and in order before any Core or Dev Flow tool call.

The Skill name and exact explicit selector are `dev-flow` and `/dev-flow`. The selector must match
`(^|\s)/dev-flow(?=\s|$)` in text from a current `source.kind=user` message. DSH may expose the
qualified MCP tools independently from Skill injection; the integration's monotonic tool guard is
the selector authorization boundary.

1. Require a whitespace-bounded `/dev-flow` in the current direct user turn. Do not infer it from
   earlier turns, model text, plugin or Skill injection, task state, repository contents, or
   discussion about Dev Flow. Every later user turn expected to call Dev Flow must include it again.
2. After removing the selector, accept either one substantive bounded request or an explicit request
   to resume its compatible active DeepSeek task. Reject an empty or conversational invocation
   before any Core call.
3. Treat the canonical `Workspace Root` established when DSH started as the containment boundary.
   The Workspace Root may be a non-Git common parent. Use read-only Git inspection to resolve the
   explicitly declared primary Git worktree and preserve its path as one value.
4. Accept zero to seven additional Git repositories only when the current user request explicitly
   declares each stable repository key and path. Resolve every primary and additional path
   canonically and require it to remain within the same Workspace Root, including after symlink
   resolution.
5. Do not scan parent or sibling directories and do not infer repositories from imports, remotes,
   submodules, codebase-memory, or other discovery results. Never add a discovered repository to the
   Repository Scope. Reject unresolved, root-external, or symlink-escaping repository paths before a
   task-bearing Core call. Preserve repository instructions and current user authority.

If admission fails, explain the missing precondition and stop before task discovery. Do not make a
task-bearing call or create adapter state. Core-rejected calls must be reported honestly.

## Compatibility handshake

Only after admission passes, call `mcp__dev_flow__dev_flow_server_info({})`; it must be the first Dev Flow tool
call. Require one complete structured result proving:

- product is exactly `dev-flow`, and Core version equals the packaged product version;
- transport is exactly `stdio`, health is exactly `ready`, and the supported host set contains
  `deepseek`;
- `supported_processes` contains exactly one closed `standard-development` entry:
  `process_id` is `standard-development` is `1`, `definition_digest` is present
  and canonical, and `new_task_supported` is exactly `true`;
- `method_profiles` is exactly `plain`, `spec-kit`, `openspec` in that order;
- `host_preferences.deepseek.codebase_memory` is present and is exactly a JSON boolean; it expresses
  a preference only and does not prove that codebase-memory is installed or available;
- the tool catalog contains exactly these fifteen raw names, in this order:

1. `dev_flow_server_info`
2. `dev_flow_open_task`
3. `dev_flow_get_task`
4. `dev_flow_get_next_action`
5. `dev_flow_submit_requirements`
6. `dev_flow_submit_design`
7. `dev_flow_submit_tasks`
8. `dev_flow_submit_implementation`
9. `dev_flow_submit_test`
10. `dev_flow_submit_comprehension`
11. `dev_flow_submit_refactor`
12. `dev_flow_submit_delivery`
13. `dev_flow_resolve_blocker`
14. `dev_flow_recover_action`
15. `dev_flow_cancel_task`

Any other schema, unsupported process version, absent process digest, false new-task support,
incomplete method-profile set, missing/additional/reordered tool, or incomplete, truncated, malformed,
or incompatible result fails the handshake. Stop without task discovery or undocumented probing. Do
not inspect local source or an installed binary, and do not start a second MCP server to bypass a
failed handshake.

## Optional code discovery

After the successful handshake, consume only `host_preferences.deepseek.codebase_memory` and the
capabilities actually visible in this DeepSeek session:

- When the preference is `false`, do not call any codebase-memory tool even when one is visible. Use
  built-in Git inspection, file reads, file search, and text search, and do not prompt for installation.
- When the preference is `true` and codebase-memory is already visible and usable, it may be
  preferred for cross-repository symbol discovery, relationships, and impact analysis. Repository
  Scope still comes only from the user's declarations, Workspace Root remains the permission
  boundary, and file modification uses ordinary Host file tools.
- When the preference is `true` but the capability is absent, incomplete, or becomes unavailable,
  notify the user at most once in the current Dev Flow session and immediately fall back to built-in
  search without blocking Task creation or progress.

Never install, configure, upgrade, start, repair, or remove codebase-memory; never call plugin
management to install it; never change MCP configuration; and never start a daemon. Index results
are not authority for repository permissions, repository bindings, changed paths, Git facts,
Recovery, blockers, outcomes, or workflow completion. The one-session notification flag is Host
presentation state and must not be written into the Core Task.

## Task discovery

After the handshake, call `mcp__dev_flow__dev_flow_open_task` with `host=deepseek` and the following
Scope rules:

- For a new request, send `repository_path` for the explicitly declared primary repository,
  `primary_repository_key` when supplied, and `additional_repositories` as the user's explicit
  closed `{key, repository_path}` declarations. A single-repository request may omit both optional
  Scope fields and keeps ordinary repository-relative paths.
- For a resume from any participating repository, send that repository as `repository_path`, omit
  the Scope creation fields, and omit `new_task` or send `new_task=null`. Accept the immutable primary
  repository, ordered Scope, profile, revision, and current Action returned by Core.

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
`process_id`, `process_definition_digest`, `current_node`, `node_purpose`,
`entry_conditions`, `completion_conditions`, `allowed_effects`, `required_evidence`,
`method_profile`, `method_steps`, `available_transitions`, `payload_contract`, `guidance`,
`repository_binding_digest`, and `issued_at`.

For an active task, perform each iteration in this order:

1. Obtain one complete fresh Action from the open result or `mcp__dev_flow__dev_flow_get_next_action`, and bind it as
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
5. Before actual repository modification, verify that every required repository still resolves
   within the startup Workspace Root. A failed or escaping path stops modification for the whole
   Task and is reported with the declared repository key; do not shrink the Core Scope and continue.
6. Render and perform each current method operation under the allowed effects, repository
   instructions, verification budget, and current user authority.
7. Select only a Core-returned transition and build the closed input of
   `fresh_action.submission_tool` from the actual typed node facts.
8. Submit exactly one call to that qualified tool with `host`, `task_id`, `action_id`, the selected
   transition, result text, artifact slots, method results and the exact node result. Core fills and
   retains the complete Action identity and payload envelope.
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

Build one `method_results` member for every current Action step, keyed by its exact `step_id`.
Provide only `capability` and `summary`: use the actual capability ID after capability completion,
or an empty capability after completed ordinary work. Core adds the step identity, order and status.

An unavailable or not-run required step is unsatisfied, so do not call the submission tool.
Capability output cannot substitute for the typed `node_result`, node obligations, evidence, or
user decision. Put artifacts produced for the current node in `artifacts.current` when that member
exists, and related method artifacts in `artifacts.other_process`. Core assigns the artifact role.
A single-repository Task uses an ordinary repository-relative path. A multi-repository Task uses
`<repository-key>::<repository-relative-path>`.

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
`references/node-payloads.md` before every ordinary submission. The reference explains the exact
`node_result` fields; the live schema named by `fresh_action.submission_tool` and Core remain current.

Before submitting, perform this order:

1. Rebind `fresh_action` and read `submission_tool`, `action_id`, `method_steps`, and all
   `available_transitions`.
2. Read the live schema of that exact qualified submission tool. Do not choose another submit tool.
3. Open the matching node-result template and fill only current facts. Use current baseline
   revisions, work-item IDs, record IDs, acceptance and evidence sets.
4. Set `host="deepseek"`, copy only `task_id` and `action_id`, and select one returned
   `transition_id`.
5. Provide `summary`, the transition's required or empty `reason`, and the exact `node_result`.
6. Put current-node artifacts in `artifacts.current` only when the live schema exposes it. Put
   related method artifacts in `artifacts.other_process`. Each entry contains only `path`, `digest`
   and `summary`; Core assigns the role.
7. Build `method_results` as a closed object keyed by every returned method `step_id`. Each member
   contains only `capability` and `summary`; Core assigns step identity, order and status.
8. Confirm `request_id`, revision, action kind, process identity, source cursor, repository binding,
   payload envelope, destination and recovery fields are absent.
9. Call `fresh_action.submission_tool` once.

If the live schema and packaged reference disagree, stop before mutation and report the packaging
contract defect. Do not choose whichever shape appears more convenient.

```text
submission_arguments = {
  "host": "deepseek",
  "task_id": fresh_action.task_id,
  "action_id": fresh_action.action_id,
  "transition_id": selected_transition_id,
  "summary": normalized_summary,
  "reason": required_or_empty_reason,
  "artifacts": artifact_slots,
  "method_results": method_results_by_step_id,
  "node_result": exact_current_node_result
}
```

If Core returns `INVALID_ARGUMENT`, treat it as a complete payload-contract rejection, not transport
uncertainty. Use the bounded-correction section only when the complete result explicitly authorizes
`correct_current_action`; otherwise stop and report the failing contract without private data. Never
alter a field from source-code inspection or another guessed payload.

## Comprehension user interaction

At `COMPREHENSION_REVIEW`, present a bounded explanation of current requirements, design, and major
code paths; list unnecessary abstractions and maintenance risks; explicitly ask whether the
developer can explain and maintain the result; and wait for an explicit user answer or verdict.

A later developer response that may call a Dev Flow tool must include `/dev-flow` again in that
current direct user turn. The earlier comprehension prompt and earlier selector do not authorize it.

Use that answer and only the fresh Core transitions to form a candidate transition and matching
typed facts. `comprehension_passed` requires explicit current user confirmation. AI must not answer,
self-confirm, or infer that the user understands. Neither Spec Kit nor OpenSpec can own or replace
the verdict.

When the explicit verdict and fresh Core transitions identify excessive complexity, use only the
matching Core-returned transition and current typed facts. At `REFACTOR`, perform only the current
Action's bounded simplification and artifact reconciliation. Submit `refactor_ready_for_test` only
when it is present in that fresh Action; after Core commits it, continue from Core's returned `TEST`
Action and run the newly current budgeted checks before considering delivery.

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
the submission tool and do not infer the result from repository state or worktree contents.

Retain only the `task_id` and `action_id` used for the call. Core retains the complete normalized
Action identity and payload before the Task transition. Call `mcp__dev_flow__dev_flow_get_task` with
ordinary `host` and `task_id`; do not construct `operation_probe` and do not reconstruct any payload.
Require one complete `recovery_assessment`. Stop if it is absent, truncated, malformed, or refers to
another Action.

Then call `mcp__dev_flow__dev_flow_get_next_action` for the same task before considering any mutation.
Compare the fresh Task and next Action's action identity, current node, last operation, and recovery
advice with the retained Action ID. A missing, malformed, truncated, blocker, or
terminal next-action result is a safe-stop, not permission to replay.

DSH reconnect restores transport and tool registrations only. It never replays, retries, resumes, or
completes a workflow mutation. After reconnect, the same `get_task` then `get_next_action` sequence
still applies, and any later user turn that dispatches those reads must contain `/dev-flow` again.

Do not implement or branch on the five-class decision table. Obey only Core's complete
`next_advice`:

- `retry_current_action`: re-perform the current Action's allowed repository work from the fresh Task
  and Action, then call `mcp__dev_flow__dev_flow_recover_action` with exactly `host`, the retained
  `task_id`, and the retained `action_id`; Core reuses the saved result, so do not rebuild it;
- `submit_recovery_apply`: call that recovery tool with those same three fields immediately;
- `read_next_action`: read the authoritative next action and continue only from that result;
- `resolve_blocker`: call `mcp__dev_flow__dev_flow_resolve_blocker` with the current blocked Action's
  `task_id` and `action_id` after the required repository condition has been restored;
- `stop_for_repository_drift`: report the bounded drift condition and stop.

Never infer that an unlisted action is safe. A recovery read itself cannot create a blocker or adopt
work. If the original `task_id` or `action_id` is missing, stop; do not rebuild it from partial output.

Do not branch, decide, or interpret any recovery classification and do not guess from repository
state. Core owns classification, effect proof, blocker eligibility, and mutation directives.

A complete structured `ok=false` result is an authoritative domain error, not transport
uncertainty. Never convert or treat that domain error as missing or transport failure. Obey Core's
`code`, `message`, `recovery.retry_safe`, `recovery.action`, and `recovery.message`. When it reports
`retry_safe=false` and `action=none`, stop; do not submit or recover the Action.

## Bounded correction of the current action

A complete structured domain error may carry field-level detail. `error.details[]` names the exact
failing member as `path`, a closed `rule`, and a fixed non-sensitive `message`. A refused transition
may instead carry `error.guard` with the Core `guard_id` and the same failure shape.

Submit exactly one corrected input through the same `fresh_action.submission_tool` only when every
condition holds:

1. the original result is a complete structured Core domain error;
2. `recovery.action` is `correct_current_action`;
3. `recovery.retry_safe` is `true`;
4. the current Task still exposes the same Action ID and submission tool;
5. only members listed in `recovery.allowed_paths` change;
6. the corrected value follows directly from the returned `rule`, with no source-code guessing;
7. every other submitted fact keeps the same meaning.

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
`mcp__dev_flow__dev_flow_cancel_task` only after explicit user authority and a fresh current Core identity.

Adapter belief that work is complete does not override Core, and a blocker is not success.

## Presentation contract

Use complete structured Core results for every decision. A concise user summary still preserves task
identity, revision, current node, whether a mutation committed, method capability/fallback status,
verification evidence and limits, every blocker or recovery condition, and the terminal outcome.
Never request or display private database locations.

Treat a truncated preview as uncertainty and follow the recovery-before-retry contract. Never fill
missing data from a local catalog or discard outcome-bearing fields.
