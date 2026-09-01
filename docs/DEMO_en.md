# Continue After an Interruption: Dev Flow in Two Minutes

[中文](DEMO.md) | [English](DEMO_en.md)

This page explains Dev Flow's primary value through one concrete failure scenario. It is not the full
protocol reference; see [Architecture](ARCHITECTURE_en.md) and the
[Command Reference](COMMANDS_en.md) for exact nodes, commands, and MCP tools.

## 1. The user requests a bounded task

A developer asks Codex:

```text
Add a failed-login attempt limit. Keep the change inside the authentication module and run only the
targeted tests needed for this behavior.
```

Dev Flow creates a local Task and retains the request, scope, acceptance criteria, and verification
budget. Codex still reads code, edits files, and runs commands.

## 2. Implementation completes and testing begins

Codex completes implementation and enters `TEST`. The current Task records implementation as complete
with one targeted authentication test remaining:

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

Dev Flow does not reconstruct progress from chat. The next session opens the same Task and recovers
the current node, revision, scope, and remaining verification:

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
important behavior is that both sides of the restart refer to the same Task, stage, and remaining
work.

## 4. The next session runs the remaining verification

The agent runs the remaining targeted authentication test. It does not rescan and invent a new plan,
or broaden verification into a full regression without reason. A failed test returns the Task to the
corresponding implementation work. A passing test moves to developer comprehension.

The comprehension check asks whether the current implementation can be explained and maintained. If
refactoring changes the repository, the Task returns through `TEST`.

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
| [Codex multi-repository Attempt 7](../tests/journeys/codex/evidence/feature-001-multi-repository-attempt-7.json) | Two independent Codex sessions resume the same Core Task from an additional repository; revision, Action, binding, and Scope remain unchanged |
| [DeepSeek multi-repository Attempt 5](../tests/journeys/deepseek/evidence/feature-001-multi-repository-attempt-5.json) | A real DSH journey completes multi-repository changes, restart recovery, one targeted verification, comprehension, and `DONE` |
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
