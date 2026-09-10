# Dev Flow for DeepSeek Harness

This is the DSH adapter for the shared Dev Flow Core interaction references. The Host performs
repository work and authorized workspace operations; Core owns Task identity/state, current Action,
legal transitions, repository observation, blockers, recovery and terminal outcomes.

Implementation: `packages/deepseek/lib/index.mjs` — `activateDeepSeekIntegration`;
`internal/workflow/standard_process.go` — `StandardProcess`.

## Planning discussion and approval

Show the requirements and acceptance criteria, then the design, tradeoffs and impact, then the complete
work/file/verification plan. Discuss the user's feedback and reuse explicit answers that still cover
the same content. Selecting Dev Flow and workspace parameters does not approve an unseen plan.
Save the draft through `tasks_plan_saved`, stay in TASKS while waiting, and use `tasks_ready` only after
an explicit user approval tied to the saved current content and plan revision. Core owns that guard
and its persisted confirmation. A changed plan or expanded file scope needs a new saved plan and
confirmation. Follow [TASKS](references/nodes/tasks.md) for complete inputs. Before any write mechanism,
compare intended files with the approved scope; directory ranges require a visible purpose and reason.

## Route the request

| Current request | Read and perform |
| --- | --- |
| New development request, including /dev-flow | [Assessment and launch](references/admission.md). Assess read-only before a Dev Flow choice and the exact workspace confirmation; default to a new branch in the current directory. |
| Exact resume-worktree launch message | [Choose first launch or recovery](references/admission.md#first-launch-or-task-recovery). Use the ready descriptor for local launch or consume for a first dedicated launch; an existing or uncertain Core Task takes the resume path even when the old launch message is reused. |
| Explicit existing Task resume or uncertain Core creation | Start in the original worktree instance, include /dev-flow in the current direct user turn, and [resume Core](references/admission.md#first-launch-or-task-recovery) without consume or creation fields. |
| Current Action | [Common submissions](references/node-payloads.md) and only the current node reference. |
| Rejection, lost result or blocker | [Core results and recovery](references/tool-results.md) before more repository work. |
| Cancel, abandon or clean up | [Host lifecycle](references/host-lifecycle.md), with each operation's current identity and authorization. |
| Explanation, status question or design discussion | Answer or perform the authorized read; create no Task. Explicit code review stays read-only and stops after findings until a later repair request. |

Implementation: `packages/deepseek/lib/workspace-coordinator.mjs` — `authorizeWorkspaceExecution`;
`packages/deepseek/lib/authorization.mjs` — `authorizeDevFlowExecution`.

## Current user turn and Host transport

DSH may select the Skill implicitly for assessment. Every Core call nevertheless requires a
whitespace-bounded /dev-flow in the current direct user message, enforced by the adapter guard.
A previous user turn, assistant message or Skill injection cannot supply it. Workspace operations
add the exact current-turn confirmation strings in [admission](references/admission.md) and
[lifecycle](references/host-lifecycle.md). Explain the guard's missing input and ask for that concrete
message; retain previously settled requirements and choices instead of reopening the discussion.

Use qualified DSH names: `mcp__dev_flow__` plus the raw tool name returned by Core. All complete
shared examples use host deepseek in this package. Follow [DSH transport](references/transport.md)
for invocation and complete response handling; Codex functions.exec/store and host-launch commands
are not DSH interfaces.

Implementation: `packages/deepseek/lib/tool-names.mjs` — `DEV_FLOW_QUALIFIED_TOOL_NAMES`;
`packages/deepseek/lib/authorization.mjs` — `deriveCurrentTurn`, `hasDirectUserSelector`.

## Execute the current Action

1. After receipt consumption or admission of an existing Task resume, first perform the
   [server handshake](references/tool-results.md#server-handshake), then open/resume Core.
2. Retain the complete response. Handle recovery_assessment.next_advice, blocker and outcome before
   performing an Action. Open/read use result.task; next-action uses result.action; a submission
   returns the Task directly in result. A saved get_task read is not a fresh workspace guard.
3. Keep the complete Action identity, purpose, conditions, allowed effects, required records, method
   steps, transitions, payload contract and issuance digests together. A shortened display does not
   erase a fully retained original result.
4. Complete current authorized work and method steps. Use [method profiles](references/method-profiles.md),
   [file preparation](references/artifacts.md) and [verification](references/verification.md).
5. Select from the actual returned transitions, prepare the complete input from current facts, compare
   it with the live schema and submit once through the qualified current submission_tool.
6. Continue from the complete returned Action/outcome or its recovery instruction. Stop repository
   work on BLOCKED or a terminal result. User decisions such as comprehension remain actual user answers.

Implementation: `internal/application/next_action.go` — `GetNextAction`;
`internal/application/submit_action.go` — `SubmitAction`;
`internal/mcp/output_schemas.go` — `outputDescription`.

## Workspace, profile and authorization

Workspace Root is fixed by DSH session startup. Every participating repository must remain within
that canonical root and the current Host permissions. Provisioning returns a separate relaunch
rather than widening the running session. Scope is fixed after Task creation; a recreated directory
or same-named branch does not replace an original worktree instance.

Follow current user/repository instructions for discovery, including required project indexes.
Otherwise use the returned host_preferences.deepseek.codebase_memory preference with actually visible
tools. Missing/incomplete indexing receives one notice and immediate Host-search fallback. The Skill
does not install or repair an index, change permissions or use index results as Task state.

Use explicit plain/spec-kit/openspec intent, otherwise plain, and preserve an existing Task's profile.
Capability output describes method work; only a valid Core submission advances the Task.
Continue authorized work when no required input remains. Progress updates need no acknowledgment.

Implementation: `packages/deepseek/lib/authorization.mjs` — `authorizeRepositoryScope`;
`packages/deepseek/lib/workspace-coordinator.mjs` — `createWorkspaceCoordinator`;
`internal/mcp/schemas.go` — `buildCatalog`.

## References and examples

The Core references are generated from `skills/dev-flow/core/` and shared with Codex. Implementation
paths identify development source, not a requirement to inspect installed source before every call.
Use live schemas and this Host's actual interfaces. Example IDs, paths, digests, results and verdicts
are sample values; replace them only with the specified current values. Output projections do not
replace the complete original response.

| Reference | Use |
| --- | --- |
| [admission.md](references/admission.md) | Assessment, current-turn confirmation, provision and consume |
| [transport.md](references/transport.md) | DSH qualified tools, wrappers and result retention |
| [tool-results.md](references/tool-results.md) | All Core reads, errors, recovery and lifecycle operations |
| [node-payloads.md](references/node-payloads.md) | Eight node tools and every current ordinary transition |
| [artifacts.md](references/artifacts.md) | Installed artifact script and DSH file-write gate |
| [artifact-contract.md](references/artifact-contract.md) | Shared collect/prepare inputs, outputs and content rules |
| [verification.md](references/verification.md) | Shared verification plan, budget and actual results |
| [method-profiles.md](references/method-profiles.md) | Rendering current method steps with visible capabilities |
| [host-lifecycle.md](references/host-lifecycle.md) | Cleanup confirmations, Host limitations and diagnosis |
