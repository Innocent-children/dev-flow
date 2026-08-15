---
name: dev-flow
description: Govern one explicit repository task through the dev-flow Core Contract 0.1.
disable-model-invocation: true
user-invocable: true
---

# Explicit dev-flow

Run this Skill only when the user selected the exact token `/dev-flow`. Do not infer invocation
from an ordinary request, an empty or conversational message, or repository context alone.

Before calling Core, require one substantive new requirement or an explicit resume request, one
current existing Git worktree, and exactly one repository. Reject non-Git, ambiguous, or
multi-repository scope without creating or selecting a task. Repository inspection remains
read-only except for the implementation work that the user and Core action explicitly authorize.

## Handshake and tool boundary

Call `dev_flow_server_info` first and require Core Contract 0.1, local STDIO, `supported_hosts` to
contain the exact value `deepseek`, and exactly these six raw tools:

1. `dev_flow_server_info`
2. `dev_flow_open_task`
3. `dev_flow_get_task`
4. `dev_flow_get_next_action`
5. `dev_flow_apply_action`
6. `dev_flow_cancel_task`

Harness may expose a server-qualified public name, but never substitute a raw schema, add a seventh
tool, or reinterpret a Core error. Stop on an incompatible server or catalog.

For this bundle, invoke the corresponding Harness public tools in the same order:
`mcp__dev_flow__dev_flow_server_info`, `mcp__dev_flow__dev_flow_open_task`,
`mcp__dev_flow__dev_flow_get_task`, `mcp__dev_flow__dev_flow_get_next_action`,
`mcp__dev_flow__dev_flow_apply_action`, and `mcp__dev_flow__dev_flow_cancel_task`. The prefix is a
Harness namespace only; request and response schemas remain the raw Core schemas above.

For explicit resume, call `dev_flow_open_task` with the canonical repository and `host=deepseek`
without `new_task`. For a new task, provide only a bounded contract derived from the user's request
and repository instructions. Core owns task selection, conflicts, claims, and every workflow
transition.

## Complete authority loop

Use only a fresh Core result whose complete canonical JSON has been recovered and parsed. Display
text, a preview, a spill notice, a pruned result, malformed JSON, or inaccessible content is not
authority. Until a stable direct-result gate records an exact complete retrieval path, stop on any
incomplete representation; do not guess missing fields or introduce an adapter projection.

For each nonterminal action:

- read the current task and next action again;
- preserve task ID, revision, action ID, repository binding, allowed effects, evidence rules, and
  the returned payload schema exactly;
- perform only the authorized work using normal host capabilities;
- count automated checks against the returned verification budget and distinguish automated,
  manual, simulated, pre-release-native, stable-native, skipped, and unverified evidence;
- retain the original request and action values before the single mutation call; and
- continue only from the next fresh Core result.

If mutation delivery is missing, cancelled, truncated, spilled without complete retrieval, or
otherwise uncertain, read back before any retry using the Core-defined task/next-action operation
probe. Never blindly replay the mutation or invent a recovery classification. Stop on Core-owned
blockers, conflicts, cancellation, or an exhausted verification budget.

Report completion only when complete fresh authority contains the Core-owned outcome `DONE`.
Transport closure, successful host work, or adapter judgment is never completion.

Keep startup and transport diagnostics bounded and non-secret. A missing/incompatible Core or a
closed transport stops the run; it never authorizes another executable, a remote endpoint, or a
workflow retry.
