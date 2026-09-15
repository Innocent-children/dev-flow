---
name: dev-flow
description: Assess development requests, then execute and resume complete Dev Flow tasks in Claude Code with Core-owned state.
---

# Dev Flow for Claude Code

Use /dev-flow-claude:dev-flow to request assessment. This selector does not authorize Git changes or approve an unseen implementation plan.

Claude owns code work and explicitly authorized workspace/session operations. Core owns the only Task, Action, process graph, guards, verification, recovery and terminal outcome.

For new development requests, read [admission](references/admission.md). Assess read-only and show impact, unknowns and verification. Obtain the missing direct/Dev Flow/clarification choice. Reuse valid user answers. Default to a new branch in the current directory after obtaining the target branch and any initial-change decision. Support current_branch and dedicated_worktree when selected. Confirm every repository before preparation, at most the current Core limit of eight. Never create a partial Core Task.

For explicit Task resume, return to its original workspace instance and read [Core results](references/tool-results.md). Do not rerun preparation or create another Task. For a saved launch, inspect the receipt and workspace identity before creation/resume. A requested Claude session is not proof that Core creation occurred.

After provisioning, perform the server handshake first. Require claude support and current process/Schema. Call only actually visible tools as described in [transport](references/transport.md). Retain complete results; inspect ok before success members, then recovery, blockers, terminal outcome and the entire Action. Do not replace missing data with a summary.

Show requirements, design and complete work/file/verification plan. Save tasks_plan_saved and wait in TASKS for explicit approval of those saved digests and revision. Use tasks_ready only with that user verdict. Selecting Dev Flow or a branch does not approve the plan. Expanded scope requires an updated saved plan and confirmation.

Execute only the current Action, using [node submissions](references/node-payloads.md), [method profiles](references/method-profiles.md), [artifacts](references/artifacts.md) and [verification](references/verification.md). Core controls allowed transitions and test budget. Collect/prepare artifacts through the packaged helper before every submission. Report actual outcomes and sources; do not fabricate checks or user understanding.

Write/Edit/NotebookEdit are protected by the trusted PreToolUse hook. It parses paths and calls Core. Do not bypass a denial or disabled gate using another tool. Bash and external writes are observed later; no claim of universal interception is made. Claude permissions remain in effect even if Core permits the path.

Follow [lifecycle](references/host-lifecycle.md) for installation, relocation, cancellation, recovery and cleanup. DONE/CANCELLED never imply commit, push, publication or deletion. Local workspaces remain in place. Dedicated worktree and branch cleanup require separate explicit authorization.

Follow current user instructions and applicable CLAUDE.md/AGENTS.md. Code indexes are optional: use existing requested tools, otherwise ordinary file/text search; never install an index automatically.

Implementation: packages/claude/lib/workspace.mjs, packages/claude/bin/dev-flow-claude.mjs, packages/claude/plugin/hooks/pre-tool-use.mjs; shared Core instructions are generated from skills/dev-flow/core/.

