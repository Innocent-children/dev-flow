---
name: dev-flow
description: "Assess bounded Codex software development requests before choosing direct work or Dev Flow, then provision confirmed Dev Flow Tasks in dedicated Git worktrees. It may be selected implicitly or explicitly with $dev-flow-codex:dev-flow; the selector never skips assessment. Explicit Task resume and receipt-backed confirmed bootstrap bypass duplicate assessment."
---

# Dev Flow

This Skill is the current Core contract Codex adapter for the shared Dev Flow Core. Core owns Task state,
the current node, legal transitions, repository observation, recovery, blockers, and terminal outcomes.
The Host owns suitability assessment, confirmed Git provisioning, Codex task creation, Handoff, and
cleanup. A narrow Host receipt makes those operations recoverable without becoming a second Task cursor.

## Request routing

Route the current request before any Dev Flow Core call or Git mutation:

- A receipt-backed bootstrap names an already confirmed launch created by the coordinator. It is not a
  new user request: consume and verify that exact receipt/worktree, then continue to handshake and
  Task creation without repeating assessment or confirmation. A missing, conflicting, failed, or
  uncertain receipt stops before Core.
- An explicit resume names or unambiguously identifies an existing Task. It is the only route that
  skips new-request suitability assessment, profile selection, and provisioning. Resume the Task in
  its original worktree instance; a missing or replaced instance is `WORKSPACE_UNAVAILABLE`.
- A parallel batch names two or more independent development items. Assess every item first, then let
  the user choose the items that use Dev Flow and confirm a unique target branch for each selected
  item. No child dispatch occurs before that confirmation. Each selected item gets one Host task, one
  dedicated worktree, and one Core Task; there is no parent Core Task and a shared-directory sub-agent
  is not isolation.
- Every other substantive development request is a new request. An exact selector still follows the
  assessment and confirmation route; it is not authority to fetch, create a branch or worktree, or
  call Core.

A request with several dependent steps toward one result remains one request. Explanation, status,
design discussion, ordinary questions, and ambiguous intent create no Task. `ACTIVE_TASK_CONFLICT`
never authorizes post-conflict relocation or a replacement dispatch.

## User interaction

Continue authorized work when no user decision or required input is outstanding. Progress updates,
assessment presentation, and explanations of Skill rules do not create acknowledgment checkpoints.
When input is required, ask the concrete unresolved question in the same response; a statement that
work has paused is not a substitute for that question. Retain explicit choices and authorizations
that remain valid for the current request and assessment. Ask only for missing or invalidated input.
A generic “continue” does not supply an unresolved development-mode choice, provisioning parameter,
comprehension verdict, or separate authorization required for an operation. Core blockers, uncertain
operations, and the read-only review checkpoint retain their existing stopping rules.

## Admission gate

For every new user request, perform a read-only suitability assessment before any Dev Flow tool call,
fetch, branch/worktree creation, file edit, build, test, dependency installation, or receipt write.

The Skill resource/base name is `dev-flow`; the installed Skill full name is `dev-flow-codex:dev-flow`.
The only exact explicit selector is `$dev-flow-codex:dev-flow`; it selects this assessment Skill for
the current turn. The Host may also select it implicitly for a development request.
Bare `$dev-flow`, a wrong plugin namespace, or a wrong Skill base name is not an explicit selector.
A missing selector is valid only when the Host selected this Skill implicitly for a task-bearing
development request. Codex may expose this plugin's MCP tools independently from Skill injection;
this Skill does not claim selector-bound tool visibility or authorization.

1. Resolve candidate repositories from the current user request and applicable `AGENTS.md`
   instructions. When those instructions require project-index discovery, read the index and each
   candidate's project documentation, then inspect relevant code and configuration to establish the
   complete proposed Repository Scope. Keep discovery read-only and within existing Host permissions.
   Otherwise use the repositories declared by the user. Canonicalize each candidate with read-only
   Git inspection, preserving spaces, Unicode, symlinks, and subdirectory invocation as one argv value.
   Every proposed repository must pass the provisioning confirmation below before Task creation;
   index results alone do not authorize provisioning or change an existing Task's immutable Scope.
2. Read the entire relevant requirements discussion, including early requirements, later additions,
   corrections, and explicitly accepted proposals. A final “start development” message refers to that
   discussion. Read repository instructions, directly relevant product/technical documents,
   candidate implementation symbols, callers, tests, configuration, package manifests, HEAD, and
   status. Existing code indexes may help; an unavailable or incomplete index falls back to file and
   text search and becomes an `unknowns` item when it limits the result.
3. Bind the assessment to the exact request digest and, for every canonical repository root, its HEAD
   and status digest. Candidate paths are a discovered lower bound, never a promised final file list.
4. Produce exactly these fields:

```text
change_level: small | standard | large | uncertain
observed_repositories
candidate_components
candidate_paths
public_contract_flags
persistence_or_state_flags
host_or_platform_flags
verification_shape
unknowns
recommendation: direct | dev_flow | clarify
reasons
anchor: request_digest + repository root/HEAD/status digests
```

5. Use `small` only for one repository, one responsibility, a clear success condition, concentrated
   implementation/callers/tests, no public API/CLI/MCP/Schema/persistence/state-graph/Host/platform/
   security change, a few targeted checks, and no material unknown. Public contracts, persistence,
   state graphs, multiple repositories, multiple Hosts/platforms, security, concurrency, recovery,
   or real Host Journeys cannot be `small`. Missing entry points, impact, or verification makes the
   result `uncertain` and the recommendation `clarify`.
6. Show the assessment. If the choice is unresolved, ask the user to choose direct development,
   Dev Flow, or clarification and wait for that answer before calling Core, creating a receipt,
   or dispatching a child. Apply an explicit choice already valid for this assessment immediately;
   no separate acknowledgment or “confirm to continue” turn is needed.

If the user chooses direct development, leave Dev Flow with zero Dev Flow calls, Tasks, claims,
receipts, fetches, branches, or worktrees. If the user chooses Dev Flow, re-read the request, HEAD,
and status; any anchor change invalidates the assessment and requires a new assessment and choice.

## Host command discovery

Use `dev-flow-codex host-launch --help` to discover operations and
`dev-flow-codex host-launch <operation> --help` to read the complete input Schema, field sources,
output fields and next step. These queries read no stdin, resolve no installation paths, and write
no Git, receipt or Core data. Use this installed contract before constructing helper arguments;
source inspection is not part of ordinary Task creation. `host-launch inspect` returns the complete
`assessment_anchor`; preserve its exact request string and all repository entries for `prepare`.

Use `dev-flow-codex artifacts --help` for file-collection command discovery and
`dev-flow-codex artifacts collect --help` or `dev-flow-codex artifacts prepare --help` for JSON
examples, field sources, outputs and the next step. Help returns before reading stdin or opening
the runtime. Copy actual Task/Action identities and the complete collected values into the request.

Set a custom `DEV_FLOW_DATA_DIR` in the environment that starts Codex. The Plugin forwards that
variable to its MCP server; artifact commands and the hook use the same Host environment.
The directory must already exist and use a canonical absolute path. A changed launch environment
takes effect in a new Codex session.

## Provisioning confirmation

After a still-current Dev Flow choice, ask for each repository, in this order:

1. `source_type`: local or remote. Never infer remote from the presence of `origin`.
2. `base_branch`: show local branches for a local source; ask for `remote_name` and its branch for a remote source.
3. For a local source, explicitly ask `carry_changes`: whether to copy staged, unstaged and non-ignored
   untracked files. Show the source checkout and its dirty paths. Preserve the source checkout and
   staged/unstaged separation. Ignored files are excluded. Changes are applied to the selected branch;
   an application conflict stops provisioning and retains the destination for inspection.
   Remote sources always use `carry_changes=false`; local sources use `remote_name=""`.
4. Confirm the new `target_branch`, showing the complete selection and `repository_key`.

Ask only for missing choices; retain explicit choices already supplied in this request. Do not fetch,
capture content, dispatch, or create a worktree before all choices are explicit. No omitted field has a default.

After confirmation:

1. Validate each target with `git check-ref-format --branch`; reject local, selected-remote, or
   worktree-occupied conflicts. Prepare the sender handoff described below and supply its absolute
   `handoff_file` to `host-launch prepare`. The helper saves the full material and the narrow
   provisioning receipt before the first Git write.
2. For a remote source, fetch only `refs/heads/<base>:refs/remotes/<remote>/<base>` with closed argv,
   no pull and no prune. For a local source, resolve `refs/heads/<base>` without network access.
   Freeze `base_commit`. If carrying local changes, capture their Git snapshot without changing the
   source index, HEAD or stash list. The receipt records `snapshot_commit`; preparation uses
   `confirmed -> resolving -> prepared`. Failure leaves no Core Task.
3. For a managed Codex worktree, call `host-launch dispatch-start` with `launch_id`,
   `repository_key`, and `project_id`. It saves the complete `host_request` in
   `receipt.operation_status.host_request` and enters `dispatch_prepared`; it grants no creation call.
   Redirect every host-launch command's complete stdout to a private file outside assessed repositories,
   check the exit code, and parse the file with filesystem APIs. Never JSON.parse a tool's displayed
   stdout: display limits may truncate it. Retain the full parsed object in the tool orchestration
   context and forward `host_request` directly; do not reconstruct it from a preview.
   Read back `status` or repeat `dispatch-start` to retrieve the exact saved request.
   Call `dispatch-call` with the current `dispatch_attempt_id` immediately before `create_thread`.
   Only that invocation's `should_dispatch=true` permits one creation call. Save and parse its full
   JSON output before calling the Host. Create with the exact retained request, including the
   frozen `base_commit`, `target.environment.type="worktree"`,
   prompt and launch/repository title; omit `onMissing`.
   Record the complete Host response with `dispatch-result`.
   If interrupted before `create_thread`, stop the previous caller and inspect the actual call sequence.
   Only proven non-invocation permits `dispatch-recover` with `host_call_not_made=true`,
   `previous_caller_stopped=true`, the current attempt ID and a specific reason. Empty Host IDs alone
   are insufficient. Recovery retains the request and returns a new attempt ID for `dispatch-call`.
   If the call happened or its outcome is unknown, inspect the known Host ID; otherwise list Host tasks
   and archived tasks using the saved launch/repository title as a search hint, and read candidate tasks'
   complete initial prompts. Titles may be normalized or renamed, so use the launch/repository values
   in the saved prompt to find candidates. Pass actual `thread_id` and complete `initial_prompt` pairs
   to `dispatch-reconcile`. It records exactly one prompt match; zero matches, incomplete listing,
   unavailable inspection or multiple matches never authorize creation. A `clientThreadId` is a queued
   marker, not a `threadId`; after an unknown result, never dispatch again.
   Retained original creation responses can still be saved with `dispatch-result`.
4. The child consumes the receipt before any Core call, verifies the same Git common group, a new
   worktree Git directory, exact frozen HEAD, and clean status, then creates and switches to the
   confirmed target branch. The helper then applies the saved snapshot with staged state preserved.
   Core verifies the confirmed source and accepts initial changes only for local `carry_changes=true`.
5. A Codex CLI surface without Host task creation uses the receipt-backed `cli-provision` helper and
   the returned closed relaunch descriptor: executable `codex`, `-C` for the primary worktree, one
   `--add-dir` per additional worktree, and the saved-material bootstrap prompt. `cli-provision` takes
   `launch_id`, `repository_key`, `additional_worktree_paths`, and `source_repository_path`; send the
   returned arguments unchanged. Do not invent a shell string.
6. All repositories must be isolated, writable, and verified before one Core Task is opened. If the
   Host cannot isolate every root, reject the entire Dev Flow request; do not keep shared additional
   repositories or shrink Scope. Build the open call from one receipt-backed repository-scope
   descriptor so every entry belongs to the same confirmed launch and request. Call
   `host-launch scope` with `launch_id`, every confirmed `repository_keys` entry and
   `primary_repository_key`; forward its complete result as the repository fields of `dev_flow_open_task`.
   Reuse the first `prepare` result's `receipt.launch_id` for additional repositories. A new launch ID
   per independent development item remains appropriate for a parallel batch.

Only a `provisioned` receipt can supply the exact Host-facing workspace origin:

```json
{
  "mode": "dedicated_worktree",
  "source_type": "remote",
  "carry_changes": false,
  "remote_name": "origin",
  "base_branch": "main",
  "base_commit": "<complete frozen commit>",
  "task_branch": "codex/example",
  "provisioning_receipt_id": "<stable receipt identity>"
}
```

Core computes and verifies the source repository group, canonical worktree root, and worktree Git-dir
identity from local Git. Host text never substitutes for those facts. Setup that changes tracked
files, dirty submodules, failed LFS checkout, missing authorization, partial multi-repository setup,
or an uncertain Host result stops before Core Task creation. Keep uncertain resources for inspection;
never force, prune, retry dispatch, copy secrets, or copy source checkout changes.

## Sender requirements handoff

Before launching a new Codex session, read [the sender handoff format](references/task-handoff.md).
During read-only assessment, assemble its content in context from the whole relevant discussion.
After the existing provisioning confirmation, write the JSON draft outside every assessed repository
and pass its absolute path as `handoff_file`. Material requirement changes invalidate the assessment
as usual. Branch confirmation and “start development” do not approve every assistant suggestion or
certify a summary as complete; do not add a separate handoff-approval question.

- Capture all current user requirements, acceptance examples, terminology, scope, exclusions,
  constraints, code findings, and session-specific working instructions. Carry the latest corrections
  into the current requirements and keep superseded statements in the original discussion only.
- Link each confirmed requirement to the actual user message that requested it or explicitly accepted
  the cited assistant proposal. Keep unaccepted suggestions, assumptions, and unresolved questions in
  their own fields. Never treat a worktree/branch confirmation as acceptance of feature proposals.
- Retain the relevant original user and assistant messages in order, including significant early
  messages and the last additions. Preserve their wording and whitespace. Use actual accessible
  messages; mark unavailable history in `open_questions` instead of reconstructing it from memory or
  presenting a conversation summary as original text. Exclude unrelated discussion, credentials, and
  automatically injected instruction blocks from retained discussion; those blocks are not user-authored
  requirement messages. Preserve actual user messages discussing or changing a rule relevant to this task.
- Record investigated repository paths and the observed commit/dirty context with code findings;
  put unverified interpretations in `assumptions`. `work_requirements` carries session-specific working
  instructions and authorizations, including method-profile choice and the scope of Git authorization.
- Let the destination Codex session load its applicable global and repository `AGENTS.md` instructions
  through normal discovery. Do not copy or summarize automatically discoverable instruction files into
  any handoff field or bootstrap prompt. A new worktree alone does not make global rules unavailable
  when the destination uses the same `CODEX_HOME`.
- When an applicable rule cannot be discovered at the destination, record its source path, applicable
  scope, and the concrete discovery gap. Reference the source file when the destination can read it;
  otherwise retain only the necessary task-relevant instructions, excluding credentials. Keep this
  supplement in `work_requirements`. Unverified availability belongs in `open_questions`; do not
  duplicate entire files as a precaution. The receiver applies supplements within their stated scope
  alongside its normally loaded instructions. See the sender reference for collection examples.
- Judge completeness by coverage of the discussion, not a target word count. `prepare` retains both
  structured JSON and a full Markdown document outside the source checkout. Both launch paths render
  that saved material directly. Longer content uses the complete document path instead of truncation.
- Send `host_request.prompt` or the CLI relaunch arguments exactly as returned. Do not write a second
  “shorter equivalent” prompt. The overview is navigation; the complete handoff carries the details.

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
- the tool catalog contains exactly these seventeen raw names, regardless of order:

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
13. `dev_flow_prepare_task_relocation`
14. `dev_flow_resolve_blocker`
15. `dev_flow_recover_action`
16. `dev_flow_cancel_task`
17. `dev_flow_abandon_task`

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

After the successful handshake for a provisioned or resumed Task, consume only
`host_preferences.codex.codebase_memory` and the capabilities actually visible in this Codex session.
Current user instructions and applicable `AGENTS.md` instructions take precedence over this default
preference when choosing code-discovery tools. Use the preference rules below only when those
instructions do not select a discovery method. The pre-Core suitability assessment may use an index
already visible to the Host and otherwise falls back immediately.

- When the preference is `false`, use Codex Git inspection, file reads, file search, and text search,
  and do not prompt for installation.
- When the preference is `true` and codebase-memory is already visible and usable, it may be
  preferred for symbol discovery, relationships, and impact analysis within the confirmed Task Scope.

Whether selected by user instructions, `AGENTS.md`, or the preference, an absent, incomplete, or
unavailable index triggers at most one notice in the current Dev Flow session and an immediate
fallback to built-in search without blocking Task creation or progress. Repository Scope remains
the complete set confirmed before provisioning and retained by Core; actual file modifications use
ordinary Codex file tools.

Never install, configure, upgrade, start, repair, or remove codebase-memory; never call plugin
management to install it; never change MCP configuration; and never start a daemon. Index results
are not authority for repository bindings, changed paths, Git facts, Recovery, blockers, outcomes,
or workflow completion. The one-session notification flag is Host presentation state and must not
be written into the Core Task.

## Task discovery

After provisioning and the handshake, call `dev_flow_open_task` with `host=codex`, `repository_path`
equal to the verified task worktree, and the following Scope rules:

- For a new single-repository request, send the primary top-level `workspace_origin` beside
  `repository_path`. For a new multi-repository request, send `primary_repository_key`, the primary
  top-level `workspace_origin`, and each closed additional entry as exactly
  `{key, repository_path, workspace_origin}`. Use only values from the matching provisioned receipts
  and compare the complete call with the live schema.
- For an explicit resume, return to the original worktree instance and send that participating
  repository as `repository_path`. Omit `workspace_origin`, all Scope creation fields, and `new_task`
  (or send `new_task=null`). Accept the immutable primary repository, ordered Scope, origin, profile,
  revision, and current Action returned by Core; do not resend guessed intent or select another
  profile. Never recreate a missing path or select a same-named branch as a substitute.
- For a new request, select one profile from explicit current user intent. An explicit `plain`,
  `spec-kit`, or `openspec` request selects that exact profile. An explicit request to use Spec Kit
  selects `spec-kit`; an explicit request to use OpenSpec selects `openspec`; otherwise use the
  conservative `plain` profile.
- Installed tooling does not select or switch a profile. Never change the profile after creation. If
  the user explicitly requests conflicting profiles, report the profile conflict and stop.
- Derive the new-task contract only from the admitted user request, repository instructions, known
  initial bounds, and known acceptance. Formal acceptance does not need to be complete at creation;
  the current requirements work forms that authority. Do not choose a verification budget during
  Task creation: requirements, design, impact, work breakdown, and existing tests have not been
  analyzed yet.
- Forward `new_task` with exactly the members `request`, `initial_scope`,
  `initial_out_of_scope`, `known_acceptance_criteria`, and `method_profile`, with no additional
  members. A creation-time `verification_budget` is an obsolete contract member and must not be sent.
- `request` is a JSON string. `initial_scope`, `initial_out_of_scope`, and
  `known_acceptance_criteria` are JSON arrays of strings and may be empty. Never collapse an array
  into prose.

Use this exact `new_task` JSON shape, changing only values derived from the admitted request:

<!-- new-task-example:start -->
```json
{
  "request": "Return the requested field from the bounded endpoint.",
  "initial_scope": ["Update the endpoint response"],
  "initial_out_of_scope": ["Change unrelated endpoints"],
  "known_acceptance_criteria": ["The response contains the requested field"],
  "method_profile": "plain"
}
```
<!-- new-task-example:end -->

After a successful open, give at most one concise status containing the Task identity, revision,
current node, task branch, and worktree path. Handle any returned `recovery_assessment` before
beginning the current node, including on a fresh-session resume. A new-task
`ACTIVE_TASK_CONFLICT`, `WORKTREE_PROVISIONING_REQUIRED`, ownership error, or other domain error is a
safe stop. It never starts relocation or another Host task.

## Governed action loop

The inseparable Action fields are exactly `task_id`, `revision`, `action_id`, `action_kind`, `submission_tool`,
`process_id`, `process_definition_digest`, `current_node`, `node_purpose`,
`entry_conditions`, `completion_conditions`, `allowed_effects`, `required_evidence`,
`method_profile`, `method_steps`, `available_transitions`, `payload_contract`, `guidance`,
`repository_binding_digest`, `issuance_identity_digest`, `issuance_history_digest`,
`issuance_content_digest`, and `issued_at`.

For an active task, perform each iteration in this order:

1. Read [the tool-result and recovery reference](references/tool-results.md) when interpreting a
   result. First process any `recovery_assessment.next_advice`, including on an explicit resume;
   pending recovery takes precedence over the returned Action. Otherwise obtain a complete fresh
   Action from the open result or `dev_flow_get_next_action`, and bind it as `fresh_action` from
   `result.task.current_action` or `result.action` respectively. A successful submission returns the
   Task directly, so its next Action is `result.current_action`. Handle a workspace blocker or
   terminal outcome before repository work. Ordinary `get_task` is a saved-state read, not a fresh
   workspace guard.
2. Treat its task ID, revision, action ID, action kind, submission tool, process ID,
   process-definition digest, current node, node purpose, entry conditions, completion conditions,
   allowed effects, required evidence, method profile, method steps, available transitions, payload
   schema/contract, guidance, repository-binding digest, issuance identity/history/content digests,
   and issued time as one inseparable Core
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
7. Select only a Core-returned transition and build the closed input of
   `fresh_action.submission_tool` from the actual typed semantic node facts. Do not add Host-declared
   file-effect members; Core re-observes Git, computes the Action delta, and derives the complete
   current Task surface relative to the frozen base commit.
8. Submit exactly one call to that tool with `host`, `task_id`, `action_id`, the selected transition,
   result text, artifact slots, method results and the exact node result. Core fills and retains the
   complete Action identity and payload envelope.
9. After a complete committed result, continue only from its authoritative next Action/outcome or a
   fresh ordinary Core read.

Repository contents, adapter judgment, artifacts, or method-tool status never determine the current
node or completion.

## Planning confirmed carried content

For a local launch with `carry_changes=true`, the copied files already belong to the Task surface.
At REQUIREMENTS, capture preservation of that confirmed content as an explicit requirement and
acceptance check, alongside the new development work. Retain the initial Core `current_changed_paths`
and the receipt-backed snapshot comparison needed to distinguish carried content from later edits.

At TASKS, compare the complete current Task's `current_changed_paths` with the union of the planned
`expected_paths` and retained process artifacts. `artifacts collect` reports the current Action delta;
an empty collection does not mean that the Task has no carried changes. Assign every confirmed carried
path to the relevant development work item or a bounded preservation work item with concrete paths,
the preservation acceptance index, and a read-only content comparison. Use the existing carry
confirmation as authority to retain those files. New or unexplained paths still require their own
scope decision; a whole-repository wildcard is not a substitute for this reconciliation.

Complete preservation by comparing the carried content that the current work does not intentionally
change with the retained launch snapshot. Report preservation separately from implemented behavior
and its tests. A copied file is not completed implementation or a passed test of its existing behavior.
Keep verification proportional to the new work and its actual dependencies.

When replanning an existing Task after `expand_scope`, use the fresh Core requirements, current paths,
and saved launch facts. If the preservation requirement is missing, use the returned transition to
REQUIREMENTS before rebuilding the plan. A Task already in BLOCKED follows the existing blocker
resolution contract; this planning rule does not resolve it automatically.

## File-scope write brake

The packaged Codex `PreToolUse` hook checks every `apply_patch` target before the tool executes when
the current worktree participates in an active Dev Flow Task. Core compares repository-qualified
targets with the union of `expected_paths` across the current Task Plan. A path in any explicitly
declared and Codex-authorized repository is ordinary in-scope work even when that repository is not
the session working directory.

When Core returns a file-scope blocker, stop repository work, show every retained path and the
developer-readable reason for the proposed write, and ask for exactly one choice:

- `allow_once` permits only the same prepared write intent and path set in the newly issued source
  Action;
- `expand_scope` returns to TASKS so the Task Plan is revised; use the existing TASKS transition to
  REQUIREMENTS only when the semantic requirement scope also changes;
- `reject` / restore keeps the current Task Plan and returns to the source node only after every
  rejected path has actually been restored to the retained content.

After the developer supplies one choice and a non-empty reason, call `dev_flow_resolve_blocker` with
`host`, `task_id`, `action_id`, `choice`, and `reason`. For recovery and automatic-verification
blockers, omit `choice` and `reason`. Continue only from the returned Action. Never infer a choice,
reuse an `allow_once` decision for a different patch, expand Repository Scope, or retry a rejected
path.

The hook covers `apply_patch`; it is not a filesystem or shell sandbox. Bash, external processes,
and specialized tool paths may write before Core observes them. Core therefore checks the current
Task surface before progressing, and every visible change in the dedicated worktree belongs to the
Task. If the packaged hook is disabled, untrusted or unavailable, report that prewrite
checking is unavailable and stop the supported write rather than describing prompt compliance as
interception.

## Automatic verification brake

When a committed TEST result moves the Task to `BLOCKED` with blocker cause
`repeated_verification_failure`, `unchanged_verification_result`, or
`unchanged_test_implementation_loop`, stop repository work and report the exact blocker message,
required resolution, and resume node. Do not call `dev_flow_resolve_blocker` automatically.

Ask the developer to choose a different implementation or design path, explicitly allow one more
attempt, or cancel the Task. An explicit choice to continue or try another approach authorizes one
call to `dev_flow_resolve_blocker` with the current Task and blocked Action IDs. Continue only from
the returned Action. Core keeps the recent attempts, so the next exact repetition may block again.

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

Before every ordinary submission, run the packaged read-only artifact preparation commands:

1. Run `dev-flow-codex artifacts collect` with exactly `{host:"codex",task_id,action_id}` as
   JSON on stdin, using the fresh Action identities. Require exit code 0 and a complete `ok=true`
   result. Store the JSON outside all Task worktrees; read the complete file if tool output is
   truncated. The returned collection includes every Core-observed Action delta, including hidden,
   staged, unstaged, untracked and already committed changes. `git status --short` is not a manifest.
2. Preserve the returned collection and every entry. Edit only each entry's `slot` and `summary`.
   Use `current` for the current node's process documents, `other_process` for related method files,
   and `product` for product changes only at IMPLEMENT or REFACTOR. Inspect file purpose before
   classification; never classify all remaining paths as process files automatically. OpenSpec
   initialization configuration, change metadata and generated README files require classification
   just like authored proposal/spec files. An unexplained or forbidden change stops preparation.
3. Run `dev-flow-codex artifacts prepare` with exactly `{host:"codex",collection:<classified result>}`
   as JSON on stdin. Core reobserves all Task repositories, checks the same Task/Action/revision and
   observation, rejects missing, duplicate, altered or unclassified entries, and generates the
   `artifacts` object. A changed observation requires a new collection and classification.
   Missing/classification errors are corrected in the collection before preparing again. For
   `ACTION_STALE`, `WORKSPACE_HISTORY_CONFLICT` or `REPOSITORY_DRIFT`, read the next Core Action and
   follow its workspace decision. `WORKSPACE_UNAVAILABLE` follows the existing workspace rule.
4. Use the successful `result` directly as `artifacts` in the submission draft; do not retype its
   paths or digests. Separately verified unchanged document references may be appended in an allowed
   slot. Keep every generated entry. Complete the live-schema gate below and submit without further
   repository writes; if files change, collect and prepare again. Preparation does not advance the
   Task or authorize a transition; Core still checks repository effects during submission.

These commands require the existing Task database and the packaged Core. They create no Task,
blocker, operation, Git change or workflow cursor. Report unavailable commands honestly and stop
submission; do not replace collection with a hand-written file list.

Use the same `fresh_action` obtained through the tool-result reference: `result.task.current_action`
for open/read, `result.action` for next-action lookup, or `result.current_action` after a committed
submission. Process any recovery assessment before binding it.

Read [the node payload construction reference](references/node-payloads.md) from the packaged path
`references/node-payloads.md` before every ordinary submission. The reference explains the exact
`node_result` fields; the live schema named by `fresh_action.submission_tool` and Core remain current.

Before submitting, perform this order:

1. Rebind `fresh_action` and read `submission_tool`, `action_id`, `method_steps`, and all
   `available_transitions`.
2. Read the live schema of that exact submission tool. Do not choose another submit tool from the
   catalog.
3. Open the matching node-result template and fill only Host-owned current facts. Use current
   work-item IDs where the live contract requests them. Do not copy `requirements_revision`,
   `design_revision`, or `task_plan_revision`; Core fills those revisions, Test/Comprehension record IDs
   and aggregate evidence IDs from the current Task. Before entering TEST, complete every planned work item.
   For Delivery, explicitly submit every acceptance criterion with its completed `work_item_ids` and
   passed current Test `evidence_ids`; each work item must map to that criterion in the current plan.
   Keep comprehension confirmation separate from acceptance checks.
4. Set `host="codex"`, copy only `task_id` and `action_id`, and select one returned `transition_id`.
5. Provide `summary`, the transition's required or empty `reason`, and the exact `node_result`.
6. Use the prepared artifact object. Put current-node artifacts in `artifacts.current` only when the live schema exposes it. Put
   related method artifacts in `artifacts.other_process`. Each entry contains only `path`, `digest`
   and `summary`; Core assigns the role.
7. Build `method_results` as a closed object keyed by every returned method `step_id`. Each member
   contains only `capability` and `summary`; Core assigns step identity, order and status.
8. Compare the complete draft with the live schema member by member. Check every required and
   allowed member at each object level; every scalar, array, object and null type; every array item;
   every enum and const; and the exact `method_results` keys. Never infer a type from a field name,
   the packaged reference, a previous node or an earlier tool call.
9. Confirm `request_id`, revision, action kind, process identity, source cursor, repository binding,
   issuance workspace digests, payload envelope, destination and recovery fields are absent.
10. Call `fresh_action.submission_tool` once.

Step 8 is the submission schema conformance gate. It is mandatory even for a one-line repository
change. Do not call the submission tool until the complete draft passes it. If the live schema is
unavailable, incomplete or cannot be matched exactly, stop before mutation instead of guessing.

If the live schema and packaged reference disagree, stop before mutation and report the packaging
contract defect. Do not choose whichever shape appears more convenient.

```text
submission_arguments = {
  "host": "codex",
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
`correct_current_action`; otherwise stop and report the failing contract without private data.

## Comprehension user interaction

At `COMPREHENSION_REVIEW`, present a bounded explanation of current requirements, design, and major
code paths; list unnecessary abstractions and maintenance risks; explicitly ask whether the
developer can explain and maintain the result; and wait for an explicit user answer or verdict.

Use that answer and only the fresh Core transitions to form a candidate transition and matching
typed facts. `comprehension_passed` requires explicit current user confirmation. AI must not answer,
self-confirm, or infer that the user understands. Neither Spec Kit nor OpenSpec can own or replace
the verdict.

## Recovery-before-retry contract

These rules cover ordinary Action submissions, blocker resolution and Action recovery. Creation,
cancellation, abandonment and relocation preparation use the separate readback rules in
[the tool-result reference](references/tool-results.md).

An Action submission result is uncertain when it is missing, cancelled, malformed, truncated, or
transport-failed instead of returning one complete structured result. Do not immediately repeat
the submission tool and do not infer the result from repository state or worktree contents.

For a response lost in this session, retain the `task_id` and `action_id` used for the call.
For a fresh-session resume, take the Task ID from the complete Core result and the saved Action ID
from `recovery_assessment.operation.action_id`. Do not substitute `current_action_id`, which may
already refer to a different Action. Core retains the complete normalized
Action identity and payload before the Task transition. Call `dev_flow_get_task` with ordinary
`host` and `task_id`; do not construct `operation_probe` and do not reconstruct any payload.
Require one complete `recovery_assessment`. Stop if it is absent, truncated, malformed, or refers to
another Action.

Do not implement or branch on the five-class decision table. Obey only Core's complete
`next_advice`:

- `retry_current_action`: re-perform the current Action's allowed repository work from the fresh Task
  and Action, then call `dev_flow_recover_action` with exactly `host`, the retained `task_id`, and the
  retained `action_id`; Core reuses the saved result, so do not rebuild it;
- `submit_recovery_apply`: call `dev_flow_recover_action` with those same three fields immediately;
- `read_next_action`: use the complete guarded Action already returned by open/next-action lookup;
  if the advice came from saved-state `get_task`, obtain one guarded `get_next_action` result. A
  repeated completed assessment does not require another lookup; continue from the returned Action;
- `resolve_blocker`: call `dev_flow_resolve_blocker` with the current blocked Action's `task_id` and
  `action_id` after the required repository condition has been restored;
- `stop_for_repository_drift`: report the retained workspace/history condition and stop.

Never infer that an unlisted action is safe. A recovery read itself cannot create a blocker or adopt
work. If neither the original submission nor a complete Core recovery assessment provides the
Task and saved Action identities, stop; do not rebuild them from partial output.

Do not branch, decide, or interpret any recovery classification and do not guess from repository
state. Core owns classification, effect proof, blocker eligibility, and mutation directives.

A complete structured `ok=false` result is an authoritative domain error, not transport
uncertainty. Never convert or treat that domain error as missing or transport failure. Obey Core's
`code`, `message`, `recovery.retry_safe`, `recovery.action`, and `recovery.message`. When it reports
`retry_safe=false` and `action=none`, stop; do not submit or recover the Action.

## Bounded correction of the current action

For `artifact_manifest_incomplete`, `error.repository_paths` lists the omitted repository files;
`recovery.allowed_paths` lists the submission fields that may change. Collect again, inspect and
classify every file, prepare the artifact object, then apply only the authorized artifact changes.
Use the same Action and submission tool once only when the complete error permits
`correct_current_action`. Keep the semantic node result, transition and method conclusions unchanged.
A repository path is not permission to treat product code as a process document. A second failed
submission stops. Real repository drift and uncertain writes retain their existing recovery rules.

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

Before the corrected call, reread the live schema of the same submission tool, rebuild the complete
draft with changes limited to `recovery.allowed_paths`, and repeat the submission schema conformance
gate. A correction is not an exception to the live-schema check, and the returned error message does
not define the corrected member's type.

A `required_member_missing` failure lists exactly the member Core could not find. Fill it from the
facts the current node work already established. When the missing member needs a new user decision,
such as a user confirmation that has not been obtained yet, stop and request that input instead of
generating it.

Stop immediately when the second submission also fails. Do not submit a third candidate payload;
report only the exact `path`, `rule`, and that the bounded correction still failed. Never report
either submitted field value.

Never treat these as correctable: an uncertain mutation result, a possible store commit, a missing or
truncated response, a stale action identity, repository drift, an absent or inaccurate
`allowed_paths`, or `INTERNAL_ERROR`. Those keep `retry_safe=false` and require the
recovery-before-retry contract.

## Evidence and verification budget

At TASKS, only after reading the current requirements and design, decomposing the work, identifying
the expected paths and impact, and inspecting the existing test structure, create the initial
`verification_plan`. It records the checks currently intended, a concrete rationale for each check,
the expected automatic-command budget, whether a full suite is expected, and whether adding or
changing test code is expected. Use the smallest level and command count that cover the analyzed
change. The Task creation request carries no final budget.

Before every automatic check, compare it with the current plan, current diff, causal impact,
acceptance criteria, an observed failure, or a real regression. A small local change selects the
closest targeted check first; remaining capacity is not authority to widen to package, module, or
repository scope. Stop adding checks once current acceptance and actual impact are sufficiently
verified.

When current capacity is insufficient, do not stop merely because the number is exhausted and do not
run the extra command first. Re-read the Task and current TEST Action, then use the returned
`verification_budget_increased` transition with exactly one closed basis (`new_impact`, `new_risk`,
`verification_failure`, or `verification_gap`), the checks requiring more capacity and their rationales, only the
additional commands or permissions actually needed, and a concrete reason. Core remains in TEST and
returns a new Action after it records the adjustment. Reasons such as “for completeness”, “increase
confidence”, “to be safe”, or a restatement that budget remains are not specific and do not authorize
an increase. A rejected adjustment leaves the previous budget current.

`additional_checks` may name a check already in the current plan or a previous budget adjustment,
as well as a newly needed check. Keep the existing name when funding the same check, and explain the
specific extra execution or remaining work in its rationale. Each name occurs once within this
adjustment. An increase records capacity and reasons; it does not record a passed check.

Before every full-suite command, including a rerun after a small fix, freshly determine all four:

1. whether the current change has broad causal impact;
2. why targeted or package-level checks are insufficient;
3. which concrete remaining risk the full suite covers;
4. whether repository instructions require it at this exact checkpoint.

Budget permission alone is never a reason. If the answers do not justify the suite, run the closest
targeted check. If they do, record the current, concrete explanation as `full_suite_reason`; never
reuse an earlier reason automatically after another edit.

Before adding or modifying test code, decide whether it protects stable product behavior, a public
contract, an important failure path, or an observed regression. Prefer an existing test location
with the matching responsibility. Add a new test file only when the test has an independent lasting
responsibility. A one-time edit instruction or transient prose detail normally receives a one-time
check. For example, “README must not contain this word” uses one text search and creates no permanent
test file or full-suite run.

Count and submit actual commands and outcomes. Keep static inspection, simulated Core execution,
user-performed evidence, and native automated evidence distinct. `source=automated` uses
`command_count` 1 to 20. Non-full checks send an empty `full_suite_reason`; a full suite sends the
fresh concrete reason above. `source=user`, `source=static`, and `source=host_observed` use
`command_count=0`, `full_suite=false`, and an empty `full_suite_reason`. A check already completed by
the user belongs in `checks`; `manual_handoff_items` contains only work nobody has run.

## Bounded post-change review

For ordinary implementation work, review only the current diff, callers, dependencies and runtime
paths that the change directly or indirectly affects, and the material needed to confirm current
acceptance. Do not restart a repository-wide audit after each edit. Expand the review only when the
new area has a stated causal path from the current change.

Fix only defects introduced by the current change or exposed in another location because of that
change. Report findings only when they have that causal relationship; keep unrelated historical
issues outside the review, Task work, and delivery summary.

After fixing a review finding, re-check only that finding, related regressions, the affected
acceptance criteria, and the matching targeted checks. The fix never restarts a broad audit. End the
Task when current acceptance, planned verification, justified increases, and this bounded review are
complete, while reporting unrun checks and remaining current-design risks honestly.

When the developer explicitly requests code review, code audit, or a repository-wide audit, the
review phase is read-only. Complete the requested review, report every finding with scope and impact,
then stop and wait for an explicit later repair request. Do not edit, format, generate a patch, or
move directly from review into repair.

## Blocked and terminal behavior

Stop repository work when Core returns authoritative `BLOCKED`, `DONE`, `CANCELLED`, an ownership or
contract conflict, or another safe-stop. Report Core's exact condition without replacing the Task.

- Planned-path changes proceed normally. An unplanned current path uses the retained file-scope
  choices; there is no “external change, ignore it” option inside a dedicated Task worktree.
- A linear commit on the same task branch is normal. A branch switch, detached HEAD, rewind, or
  unprepared rewrite uses the Core workspace-history blocker. Never automatically rebase or merge.
- A missing or replaced worktree is `WORKSPACE_UNAVAILABLE` and cannot be resolved by recreating the
  directory. Restore the original instance or, after explicit user authority, call
  `dev_flow_abandon_task` with exact host, Task ID, revision, and a non-empty reason.
- Ordinary cancellation uses `dev_flow_cancel_task` only after explicit user authority and a fresh
  identity; it must still observe the worktree. Abandonment is only for an unavailable workspace.

## Task relocation and Codex Handoff

Relocation is Core-owned preparation followed by one Host-owned Handoff:

1. After explicit user authority, call `dev_flow_prepare_task_relocation` once with exact host, Task
   ID, and revision. Retain its relocation
   ID, source binding, base commit, content digest, task surface, and resume node.
2. From a coordinator other than the thread being moved, persist `handoff_dispatching` in the Host
   receipt before one `handoff_thread` call. The calling thread cannot move itself. A returned Host
   operation ID is polled with Host status; a missing response reads the receipt and Host status and
   is never dispatched again.
3. After Host success, the destination session calls `dev_flow_resolve_blocker` with the exact
   `relocation_id` and `relocation_destinations:[{key,repository_path}]`. Core verifies the
   same Git common group, frozen base, equivalent Task surface, and absence of claim conflicts before
   atomically replacing bindings and claims.
4. Any failure preserves the old binding and claims. Relocation is same-machine only and never
   implies merge, rebase, commit, push, or cross-machine data transfer.

`ACTIVE_TASK_CONFLICT` is not relocation preparation and never triggers Handoff.

For a workspace-history blocker, use only the live-schema
`history_resolution:{choice:"accept_current_history",reason}` after the user-authorized Git operation
has completed and Core can observe the requested history. Do not reuse relocation fields.

## Terminal worktree presentation and cleanup

`DONE` and `CANCELLED` release Core claims only. They never commit, push, create a pull request,
Handoff, delete a worktree, or delete a branch. Present source/base/base commit, task branch/current
HEAD, worktree path, clean or dirty state, current changed paths, completed verification, and the
available keep/review/Handoff/cleanup actions.

Automatic cleanup is always false. An active, dirty, unpushed, or uncertain worktree is preserved.
Worktree deletion and branch deletion require two separate current user authorizations. Managed
worktree snapshot/Handoff/cleanup belongs to the Codex Host; do not replace it with `git worktree`
shell commands. For a CLI-provisioned worktree, use the receipt-owned cleanup helpers: mark the
attempt before mutation, remove only the exact clean terminal worktree without force, and delete the
branch separately with ordinary safe Git refusal preserved. An uncertain cleanup is inspected and
never blindly retried.

A terminal Host-only Handoff may move or present the finished Codex worktree after separate user
authorization. It does not call Core relocation preparation or mutate a terminal Task.

Codex's belief that work is complete does not override Core, and a blocker is not success.

## Presentation contract

Use complete structured Core results for every decision. A concise user summary still preserves task
identity, revision, current node, whether a mutation committed, method capability/fallback status,
verification evidence and limits, every blocker or recovery condition, and the terminal outcome.
Never request or display private database locations.

Treat a truncated preview as uncertainty and follow the recovery-before-retry contract. Never fill
missing data from a local catalog or discard outcome-bearing fields.
