# TaskBelay for DeepSeek Harness

DSH performs repository work and authorized workspace operations. Go Core owns Task state, Actions,
transitions, verification, blockers and recovery.

## Current-turn authorization

DSH may select this Skill implicitly for assessment. **Every Core call requires a whitespace-bounded
`/taskbelay` in the current direct user message.** Earlier turns, assistant messages and Skill injection
cannot supply it. Workspace operations also require their exact confirmation text. Ask only for the
missing input and retain settled requirements and choices; see [DSH transport](references/transport.md).

## Choose the entry

| Request or saved state | Next step |
| --- | --- |
| New development request, including `/taskbelay` | [Assess and prepare](references/admission.md); default to a new branch in the current directory after TaskBelay selection. |
| `resume-worktree` launch or an uncertain Core open | [Choose first launch or Task recovery](references/admission.md#first-launch-or-task-recovery). An existing/uncertain Task resumes without `consume` or creation fields. |
| Explicit Task resume | Return to the original workspace with the current selector, then [connect/resume](references/connection.md). |
| Current Action | Follow [Action execution](references/node-payloads.md) and only the current node guide. |
| Rejection, missing result or blocker | Read [response handling](references/tool-results.md) and its linked recovery procedure. |
| Cancellation, abandonment, cleanup or installation diagnosis | Read [Host lifecycle](references/host-lifecycle.md). Automatic DSH relocation is unavailable. |
| Explanation, status question or design discussion | Answer or perform the authorized read; create no Task. Explicit review stays read-only until a later repair request. |

## Execute and continue

After provision/first-launch consumption or on resume, perform the
[server handshake](references/connection.md#server-handshake) before other Core calls. Invoke the
visible `mcp__taskbelay__` tool plus Core's raw name through the DSH transport. The handshake takes
`{}`; other Core tools use `host:"deepseek"`.
Retain complete responses and handle errors, recovery, blockers and outcome before the full Action.
Codex orchestration helpers and host-launch commands are not DSH interfaces.

The [Action procedure](references/node-payloads.md) covers planning discussion, saved-plan approval,
method steps and submission. Use the packaged [artifact helper and write gate](references/artifacts.md)
and [verification rules](references/verification.md). Approvals, checks and comprehension verdicts
must come from actual work or user answers. Continue authorized work when no required input remains;
progress updates need no acknowledgment.

## Workspace and methods

All repositories must remain within the canonical Workspace Root fixed at DSH startup and current
Host permissions. Provisioning can return a relaunch; it cannot widen this session. Confirm Scope
before creation and preserve original workspace identity on resume. Follow user/repository discovery
rules, including required indexes; otherwise use `host_preferences.deepseek.codebase_memory` with
visible tools. Missing/incomplete indexing gets one notice and immediate Host-search fallback,
without installing or repairing an index.

Use explicit `plain`/`spec-kit`/`openspec` intent, otherwise `plain`, and preserve an existing profile.
[Method profiles](references/method-profiles.md) describe how to perform the current steps; only Core
submissions advance Task state. DONE/CANCELLED preserves Git data and does not authorize publication
or cleanup; follow the lifecycle guide and its exact current-turn confirmations.

Implementation: `packages/deepseek/lib/index.mjs` — `activateDeepSeekIntegration`;
`packages/deepseek/lib/authorization.mjs` — `authorizeTaskBelayExecution`;
`packages/deepseek/lib/workspace-coordinator.mjs` — `authorizeWorkspaceExecution`.
