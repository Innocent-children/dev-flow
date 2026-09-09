---
name: dev-flow
description: "Assess bounded Codex software development requests before choosing direct work or Dev Flow, then provision confirmed Dev Flow Tasks in dedicated Git worktrees. It may be selected implicitly or explicitly with $dev-flow-codex:dev-flow; the selector never skips assessment. Explicit Task resume and receipt-backed confirmed bootstrap bypass duplicate assessment."
---

# Dev Flow for Codex

Codex performs repository work and authorized Host operations. Go Core owns the Task, current
Action, legal transitions, repository observation, blockers, recovery and terminal outcome.

Implementation: `internal/workflow/standard_process.go` — `StandardProcess`;
`internal/mcp/schemas.go` — `ToolCatalog`;
`packages/codex/lib/lifecycle.mjs` — `CODEX_MCP_INSTRUCTIONS`.

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
| New development request, including the exact selector | [Assessment and launch](references/admission.md). Assess read-only, retain valid user choices, then prepare the confirmed worktrees. |
| Bootstrap carrying a saved launch/repository identity | [Receipt bootstrap](references/admission.md#bootstrap). Read surface/phase, distinguish first initialization from provisioned-worktree continuation, then determine whether Core creation or resume applies. |
| Explicit resume identifying an existing Task | [Core connection and reads](references/tool-results.md#open-or-resume-a-task). Return to the original worktree instance and resume without creation fields. |
| Current Action work | [Action submissions](references/node-payloads.md). Read only the current node section and the common submission procedure. |
| Missing result, rejection or blocker | [Result handling and recovery](references/tool-results.md). Resolve the returned condition before more work. |
| Relocation, cancellation, abandonment or cleanup | [Host and Task lifecycle](references/host-lifecycle.md). Use the saved identities and the operation's authorization. |
| Explanation, status question or design discussion | Answer or perform the requested read. These requests create no Task. Explicit code review remains read-only and ends after findings until a later repair request. |

A dependent sequence toward one result is one request. For explicitly requested independent parallel
items, assess each and obtain the item/branch choices before dispatch. Each selected item has its own
Host task, worktree and Core Task; shared-directory agents do not provide worktree isolation.
`ACTIVE_TASK_CONFLICT` stops creation for resolution of the existing Task.

Implementation: `packages/codex/lib/task-admission.mjs` — `validateSuitabilityAssessment`;
`packages/codex/lib/task-launch.mjs` — `prepareTaskLaunch`, `buildOpenTaskRepositoryScope`.

## User decisions

Continue when the current work is authorized and no required input is missing. Reuse explicit choices
and authorizations that still apply. Progress updates and explanations of these instructions require
no acknowledgment. Ask the concrete missing question; a generic “continue” cannot supply a missing
mode, source/base/target/carry choice or comprehension verdict.

The conversation selector is `$dev-flow-codex:dev-flow`; it selects assessment and is not Git or Task
creation permission. The installed policy also permits implicit selection. Before a new Task, the user
chooses direct development, Dev Flow or clarification. A direct choice leaves no Dev Flow Task,
receipt, claim or Git mutation. Detailed input examples are in [admission](references/admission.md).

Implementation: `packages/codex/plugin/skills/dev-flow/agents/openai.yaml`;
`packages/codex/lib/lifecycle.mjs` — `CODEX_MCP_INSTRUCTIONS`;
`packages/codex/lib/task-launch.mjs` — `validatePrepareInput`.

## Execute one Core Action

1. After verified provisioning, or when resuming the original Task, perform the
   [server handshake](references/tool-results.md#server-handshake) before other Core calls.
2. Read the complete result. Handle blocker/outcome and any `recovery_assessment.next_advice` first.
   An open result carries `result.task.current_action`; next-action lookup carries `result.action`;
   an ordinary submission returns `result.current_action`. A saved `get_task` is not a fresh workspace
   guard. Use [result handling](references/tool-results.md) for all paths and examples.
3. Keep the complete Action together: identity, revision, process/digests, node purpose, entry and
   completion conditions, effects, required records, method steps, transitions, payload contract,
   guidance and issuance time. Missing original data stops execution; a shortened display does not
   discard data already retained in full.
4. Perform only current authorized work. For method capabilities, read the current row of
   [method profiles](references/method-profiles.md). For files and checks, follow
   [artifacts and verification](references/artifacts.md).
5. Select a transition from the fresh Action using actual node facts and its condition/reason rule.
   Follow the [submission procedure](references/node-payloads.md#common-submission-procedure): collect,
   classify and prepare files, construct the complete input, check the live schema, submit once.
6. Retain the full response before reading success-only fields. Continue from the returned Action or
   the operation-specific recovery instruction. Stop repository work on BLOCKED or a terminal outcome.

Implementation: `internal/application/next_action.go` — `GetNextAction`;
`internal/application/submit_action.go` — `SubmitAction`;
`internal/mcp/output_schemas.go` — `outputDescription`, `outputActionSchema`.

## Repository and method boundaries

Resolve candidate repositories from the user request and applicable repository instructions,
including required project indexes. Confirm every participating repository before provisioning;
Core Scope is immutable after creation. Check that every root needed for an operation remains within
Codex's authorized directories. A missing permission stops that operation for the Task.

Use the current user and repository instructions for code discovery. Otherwise consume
`host_preferences.codex.codebase_memory`: use an already usable index when preferred, or ordinary
Host search. An absent/incomplete index receives at most one notice and immediate fallback; the
Skill does not install or repair it. Discovery never changes Task bindings or permissions.

Select `plain`, `spec-kit` or `openspec` from explicit intent; otherwise select `plain`. Keep the
profile returned by an existing Task. Method artifacts and capability output describe completed
work; only a successful Core submission advances the Task.

Implementation: `packages/codex/lib/lifecycle.mjs` — `CODEX_MCP_INSTRUCTIONS`;
`internal/mcp/schemas.go` — `buildCatalog`;
`internal/application/open_task.go`;
`internal/workflow/standard_process.go` — `StandardProcess`.

## Reference and example conventions

Core references are generated from `skills/dev-flow/core/` for both Hosts. Shared semantic rules and
examples are maintained there; Codex transport and Host operations remain in this package.


Each interaction reference names its implementation and gives inputs, value sources, result paths,
next steps and principal failures. Source paths are relative to the Dev Flow development repository;
they are maintenance pointers, not a requirement to inspect installed source during ordinary work.
Use the installed command help and live MCP schemas. Report an actual reference/schema disagreement
before mutation.

JSON examples illustrate complete inputs. Example paths, IDs, digests, branch names, records and
summaries are sample values, never default authority. Replace them with the specified current values.
Output projections are explicitly labeled and do not replace the original complete result.
Examples for mutations are used only after their stated authorization and prerequisites.

| Resource | When to read |
| --- | --- |
| [admission.md](references/admission.md) | Assessment, prepare, managed dispatch, CLI launch and complete repository scope |
| [task-handoff.md](references/task-handoff.md) | Collecting the original discussion before a new Host session |
| [transport.md](references/transport.md) | Codex tool invocation and complete response retention |
| [artifact-contract.md](references/artifact-contract.md) | Shared file preparation and content rules |
| [verification.md](references/verification.md) | Shared verification plan and accounting |
| [tool-results.md](references/tool-results.md) | MCP connection, reads, result envelopes, corrections, blockers and Action recovery |
| [node-payloads.md](references/node-payloads.md) | Current node submission, including all eight tools and return examples |
| [artifacts.md](references/artifacts.md) | File preparation, Hook messages, carried content and verification accounting |
| [method-profiles.md](references/method-profiles.md) | Rendering the current Action's semantic method steps |
| [host-lifecycle.md](references/host-lifecycle.md) | Relocation, terminal operations, cleanup and installation diagnosis |
