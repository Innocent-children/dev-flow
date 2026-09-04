# Continue After an Interruption: Dev Flow in Two Minutes

[中文](DEMO.md) | [English](DEMO_en.md)

This page uses one interruption scenario to show how Dev Flow retains task boundaries and remaining
work. It demonstrates one important capability, not the product's complete value. See
[Architecture](ARCHITECTURE_en.md) and the [Command Reference](COMMANDS_en.md) for exact nodes,
commands, and MCP tools.

## 1. The user requests work and chooses whether to enter Dev Flow

A developer asks Codex:

```text
Add a failed-login attempt limit. Keep the change inside the authentication module and run only the
targeted tests needed for this behavior.
```

The Host first inspects candidate implementation, callers, tests, and Git state read-only, reports a
change level, known impact, unknowns, and a recommendation, then stops. No Core call, Task, or Git
write exists yet. After the developer chooses Dev Flow, they confirm a remote, base branch, and new
target branch. The Host fetches the exact ref, freezes the base commit, and creates a clean dedicated
worktree without copying staged, unstaged, or untracked source-checkout content. Core creates the
local Task only after target verification and retains the request, scope, acceptance, WorkspaceOrigin,
and method profile. No final verification budget is frozen before analysis.

## 2. Implementation completes and testing begins

At TASKS, after requirements, design, impact, and existing tests are understood, Codex retains this
targeted authentication test, its rationale, one expected automatic command, no expected full suite,
and no expected test-file change. After implementation enters `TEST`, the Task shows:

```text
Task: auth-rate-limit
State: TEST
Revision: 5
Completed: implementation
Remaining: targeted auth test
```

This information lives in local Task state, not only in chat history.

## 3. The session is compacted or the Host restarts

Without durable state, the next session can only inspect the repository and partial chat, then guess
whether implementation finished, whether the test already ran, or whether verification should expand.

Dev Flow does not reconstruct progress from chat. The next session returns to the exact Task worktree
and explicitly resumes. Core observes identity, history, and content before returning the current node,
revision, scope, and remaining verification:

```text
Before restart
Task: auth-rate-limit
State: TEST
Revision: 5
Completed: implementation
Remaining: targeted auth test

After restart
Task: auth-rate-limit
State: TEST
Revision: 5
Next: run the remaining targeted auth test
```

This text is a simplified view of the user story, not a verbatim transcript from one Host. The
important behavior is that both sides of the restart refer to the same Task, worktree instance, stage,
and remaining work. A recreated path or same-named branch cannot impersonate the original instance;
the Task becomes workspace-unavailable until the original is restored or explicitly abandoned.

## 4. The next session runs the remaining verification

The agent runs the remaining targeted authentication test. It does not rescan and invent a new plan,
or broaden verification into a full regression without reason. If capacity is insufficient, only a
concrete increase backed by a new impact, risk, failure, or verification gap is retained before more
commands run. Every full suite requires a fresh explanation of why focused checks do not suffice and
which risk it covers; spare capacity is not a reason. A failed test returns the Task to implementation.
A passing test moves to developer comprehension.

Core derives the Task surface from the fixed base commit, current commits, index, worktree, and
untracked content. A normal linear commit on the task branch preserves changed paths, and committing
identical content does not invalidate the test. A real content change, branch switch, rewind, or
history rewrite is handled before substantive work continues.

The comprehension check asks whether the current implementation can be explained and maintained.
Ordinary post-change review covers only the diff, actual impact, and acceptance needs; fixing a
finding causes only related targeted review. If refactoring changes the repository, the Task returns
through `TEST` without automatically restarting a repository-wide audit.

## 5. Comprehension and delivery complete

When test and comprehension records both match the current implementation, the Task enters delivery
and can reach `DONE`. If requirements, scope, or implementation materially change first, stale
downstream records do not stand in for current results.

## A shorter Recovery scenario

Another interruption can occur while a Dev Flow Action is being submitted: the Host sent a mutation,
but its response was lost or truncated. The Adapter does not immediately submit it again. It reads the
current Task and Recovery state using the Task ID and Action ID, then follows the result to continue,
recover, block, or retry safely.

This applies only to Actions Dev Flow can identify and retain. It does not mean Dev Flow can recover
arbitrary Host file writes, shell commands, or external-system side effects.

## What current records demonstrate

The entries below are independent paths. Each demonstrates only the stated scope.

| Record | Scope demonstrated |
| --- | --- |
| [PR #8 Codex graph acceptance](https://github.com/Innocent-children/dev-flow/pull/8) | A real Codex journey covers restart, refactoring, retesting, comprehension, delivery, and Core `DONE` |
| [Support Matrix](SUPPORT-MATRIX_en.md) | Stable registry packages and Host environments with final lifecycle records |

Different journeys demonstrate different capabilities; do not describe them as one run proving the
entire product. Source tests are also not final public-artifact support. See
[Project Status](PROJECT-STATUS_en.md) for stable, source-only, and unverified status.

## Try the stable entry

```bash
npm install -g @imotong/dev-flow@latest
dev-flow
```

After installation, use Codex's `$dev-flow-codex:dev-flow` or DeepSeek Harness's `/dev-flow`
selector. See the [Codex guide](CODEX_en.md), [DeepSeek guide](DEEPSEEK_en.md), and
[Command Reference](COMMANDS_en.md) for Host differences and complete commands.
