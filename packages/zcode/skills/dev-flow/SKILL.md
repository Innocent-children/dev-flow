---
name: dev-flow
description: Assess development requests, then execute and resume complete Dev Flow tasks in ZCode with Core-owned state.
---

# Dev Flow for ZCode

Use this Skill from ZCode's `/` menu under Skills, or when the user explicitly requests Dev Flow. Invocation requests assessment; it does not approve an unseen implementation plan or authorize unconfirmed Git changes.

ZCode owns code work and authorized workspace operations. Core owns the only Task, Action, process graph, allowed transitions, verification, blockers, recovery and terminal outcome.

For a new development request, read [admission](references/admission.md). Assess read-only and show impact, unknowns and verification. Obtain only missing decisions about direct development, Dev Flow or clarification; preserve valid user choices and permissions. After Dev Flow selection, default to a new branch in the current directory. Confirm its target branch and whether initial changes belong to the Task. Support current_branch and dedicated_worktree when selected. Confirm every repository before preparation, within Core's current limit of eight; never create a partial Core Task.

For explicit Task resume, return to its original workspace instance and read [Core results](references/tool-results.md). Do not prepare another workspace or create another Task. For a retained launch, check its receipt, actual workspace identity and any saved task_id first. Opening a ZCode workspace is not evidence that Core creation succeeded.

After provisioning, discover the actual MCP tools and perform server_info first. Require zcode support and the current process/Schema. Follow [transport](references/transport.md): retain complete responses, inspect ok before success members, then recovery, blockers, terminal outcome and the entire Action. Never replace missing result fields with a summary or invent a tool name from a different Host.

Show requirements, design and the complete work/file/verification plan. Save tasks_plan_saved and wait in TASKS for explicit approval covering those saved digests and the current plan revision. Use tasks_ready only with that user verdict. Selecting Dev Flow or a branch does not approve an unseen plan. A changed plan or expanded scope requires updated saved content and approval.

Execute only the current Action. Read [node submissions](references/node-payloads.md), [method profiles](references/method-profiles.md), [artifacts](references/artifacts.md) and [verification](references/verification.md). Collect/prepare artifacts through the packaged helper before every submission. Core determines transitions and verification budget; report actual checks, their sources and unavailable checks without fabricating outcomes or user understanding.

The enabled plugin's trusted PreToolUse Hook checks Write and Edit paths with Core. Do not bypass a denial or missing Hook using another tool. Shell and external writes are observed later; this is not universal interception. ZCode's permissions remain in effect when Core allows a path. Hook configuration is captured at session startup, so verify plugin or Hook changes in a new session.

Follow [lifecycle](references/host-lifecycle.md) for installation, relocation, cancellation, recovery and cleanup. Follow [handoff](references/task-handoff.md) when another ZCode workspace/session must continue. The Adapter returns UI instructions, never an invented session-launch CLI or a false successful launch. Preserve original requirements and corrections in the retained handoff.

DONE/CANCELLED does not imply commit, push, publication or deletion. Local directories and branches remain. Dedicated worktree deletion and branch deletion require separate user authorization after actual Core termination.

Follow current user instructions and the applicable repository rules. Code indexes are optional: use requested available tools or ordinary file/text search; do not install an index automatically.

Implementation: `packages/zcode/lib/workspace.mjs`, `packages/zcode/bin/dev-flow-zcode.mjs`, `packages/zcode/hooks/pre-tool-use.mjs`. Shared Core references are generated from skills/dev-flow/core/.
