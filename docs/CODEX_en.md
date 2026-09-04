# dev-flow-codex

[中文](https://github.com/Innocent-children/dev-flow/blob/main/packages/codex/README.md) |
[English](https://github.com/Innocent-children/dev-flow/blob/main/docs/CODEX_en.md)

`dev-flow-codex` gives Codex one durable Core Task in a dedicated worktree. New requests are assessed
before Core is contacted; selected requests start from a developer-confirmed remote/base/target, and
Core derives the current change surface from read-only Git.

## Support and installation

Stable support remains defined by the [Support Matrix](SUPPORT-MATRIX_en.md). Current source contains
exact `darwin-arm64` and `win32-x64` runtimes; the package requires Node.js `>=24` and Codex
`>=0.147.0`. Windows Server, 32-bit/ARM64 Windows, Intel Mac, and cross-pairs such as
`darwin-x64` or `win32-arm64` are outside current source support. Source capability does not by
itself expand npm `@latest` support.

```bash
npm install -g @imotong/dev-flow@latest
dev-flow
```

Native diagnosis and recovery remain available:

```bash
npm install -g dev-flow-codex@latest
dev-flow-codex setup
dev-flow-codex status --json
dev-flow-codex --version
```

After setup, use Codex `/hooks` to inspect and trust the packaged hook. Until then, the supported
`apply_patch` prewrite check is inactive. See the [Command Reference](COMMANDS_en.md#codex) for the
complete parser surface.

When absent, setup creates `$HOME/.dev-flow/config.json` on macOS or
`%USERPROFILE%\.dev-flow\config.json` on Windows. Default Task data is
`$HOME/Library/Application Support/dev-flow/data` or `%LOCALAPPDATA%\dev-flow\data`.

## Assess and start a Task

Codex may select the Skill for a bounded development request. This exact conversation selector forces
selection but does not skip assessment:

```text
$dev-flow-codex:dev-flow Fix idempotency in the order-creation endpoint and run targeted tests.
```

For every new request—including an exact selector and each item in a parallel batch—Codex first performs
read-only code and Git discovery. It reports `small|standard|large|uncertain`, observed repositories,
candidate components and paths, public-contract/state/Host flags, verification shape, unknowns, a
recommendation, and reasons. Then it stops. Before the developer chooses Dev Flow there is no Dev Flow
tool call, Task, claim, Git write, provisioning receipt, or child dispatch. A changed request,
canonical root, HEAD, or status invalidates the assessment.

After the developer chooses Dev Flow, Codex shows every repository's remote, base branch, new target
branch, and bounded source-checkout dirtiness. The confirmation authorizes one exact fetch and launch.
The Host freezes the fetched commit and creates a dedicated worktree. Staged, unstaged, and untracked
source content is never copied.

In Codex App, managed-worktree and snapshot behavior remains Host-owned. The coordinator creates one
task from the selected remote ref and records one launch; queued, timed-out, or uncertain creation is
read from that launch rather than dispatched again. The child verifies HEAD, creates/switches to the
confirmed target branch, verifies clean state and worktree identity, then calls Core. Codex CLI uses
the parser-supported `codex -C <worktree> [--add-dir <additional-worktree>] -- <prompt>` relaunch descriptor. It never uses an on-missing
default-branch fallback.

Only after all participating roots pass provisioning and Host authorization does one Core Task open in
`REQUIREMENTS`. It retains no final verification budget before analysis. `plain`, `spec-kit`, or
`openspec` is immutable after creation.

## Resume, scope, and Git history

An explicit resume returns to the exact worktree instance already bound to the Task. It skips assessment,
branch selection, and replacement-worktree creation. A recreated path or same-named branch cannot
impersonate the original worktree-specific Git directory. A missing/replaced instance reports workspace
unavailability; restore it or explicitly abandon the Task.

Resume restores the current node, revision, scope, remaining verification, blocker, and Recovery
state. If an Action response was lost or truncated, the Adapter reads Core's retained operation before
recovering or retrying; it never repeats the original submission from memory. Core also retains the
three latest verification attempts and pauses on the third exact repeated failure/result or the same
changed-path-and-failure loop across consecutive Implementation revisions. Only an explicit developer
decision allows another attempt.

## Verification effort and post-change review

Codex creates the initial `verification_plan` only at TASKS, after reading requirements, design, work
decomposition, causal impact, and the existing test structure. It records intended checks and their
rationales, expected automatic commands, whether a full suite is expected, and whether test-code
changes are expected. A small change starts with the closest targeted check; spare capacity does not
justify widening to package, module, or repository scope.

Exhausted capacity does not end the Task. Before any extra command, Codex uses the current TEST
Action's `verification_budget_increased` transition with a real `new_impact`, `new_risk`,
`verification_failure`, or `verification_gap`, and adds only the checks, commands, or permissions
needed now. Core retains the reason and previous/resulting budgets, then stays in TEST. “For
completeness”, “increase confidence”, “to be safe”, and remaining capacity are not valid reasons.

Before every full suite, Codex freshly checks broad impact, whether targeted/package checks suffice,
the exact risk the suite adds coverage for, and whether repository instructions require it at this
checkpoint. The current reason is recorded as `full_suite_reason`; a small-fix rerun cannot inherit an
earlier reason automatically.

Test-code changes require lasting value: stable product behavior, a public contract, an important
failure path, or an observed regression. A one-time README word rule gets one text search. Ordinary
post-change review covers only the diff, direct/indirect causal impact, and acceptance needs. After a
review fix, Codex rechecks that finding and related targeted regressions, not the whole repository.
An explicit code review is read-only and stops after all findings are delivered until repair is
separately authorized.

The trusted hook runs `dev-flow-codex hook pre-tool-use`, which forwards the parsed targets through
`dev-flow-codex host-check pre-file-write` to the packaged Core. It checks supported `apply_patch`
targets against the current Task Plan before writing. An expected additional-repository path proceeds
only when that root is already in immutable Scope and authorized through Codex `--add-dir`.
For an unplanned path the developer chooses `allow_once`, `expand_scope`, or reject/restore with a reason.
Other tools and shell commands may write first; Core observes them before the next action. There is no
"ignore external change" choice inside a dedicated Task worktree. A disabled, untrusted, or unavailable
hook must not be described as reliable interception; when an invoked child check fails, that write stops.

Core derives the current Task surface from the frozen base, commits, index, worktree, and untracked
state. A normal linear commit on the task branch preserves current paths. An exact-content commit keeps
Test and Comprehension valid; a content change invalidates them. Branch switch, detach, rewind, rewrite,
or worktree replacement produces a specific blocker or unavailable result before substantive work.

## Handoff and terminal worktrees

Same-machine relocation starts with Core `dev_flow_prepare_task_relocation`, which retains source bindings,
claims, base, content, surface, and resume node. Codex performs one Host handoff. Destination paths and
the retained relocation ID are then verified before Core atomically replaces all bindings and claims.
A lost handoff response is read from Host/receipt state and is never blindly repeated.

One Task may contain one primary repository plus at most seven explicitly declared additional roots.
Every root must be provisioned and authorized before the one Core open. A selected parallel batch gives
each item its own Host task, target branch, worktree, and Core Task; it never creates a parent Task or
uses a shared-directory sub-agent.

DONE and CANCELLED release Core claims only. They do not commit, push, open a pull request, delete a
branch, or delete a worktree. Worktree cleanup and branch cleanup need separate current developer
authorization; active, dirty, unpushed, unknown-owner, or uncertain resources remain.
CLI cleanup is invoked only after the Adapter has read a fresh terminal Core Task and obtained the
separate user decision. The helper independently verifies receipt surface, repository group, and a
clean dedicated worktree; worktree removal retains the branch, while the later branch decision uses
non-force `git branch -d` and retains an unmerged branch. `terminalCleanupDecision` marks an unpushed
branch for review before that separate decision. If the exact
worktree is gone, `dev_flow_abandon_task` keeps the last known binding and releases claims without Git access.

## Inspect and remove

```bash
dev-flow status --host codex
dev-flow-codex status --json
dev-flow webui start
```

```bash
dev-flow-codex remove
npm uninstall -g dev-flow-codex
```

Removal stops the matching WebUI and removes only package-owned registration/receipt state. Task data
and Git repositories remain. Permanent Task-data cleanup uses the separately confirmed
`dev-flow factory-reset` flow.

## Boundaries

- Codex and the developer authorize repositories and Host/Git operations; Dev Flow does not widen the sandbox.
- Core observes Git read-only and never fetches, creates worktrees/branches, commits, merges, rebases, pushes, tags, or publishes.
- A worktree is a source-change ownership boundary, not a process, network, credential, port, database, or container sandbox.
- A multi-repository Task opens only after every root is independently provisioned and authorized; partial isolation is rejected.
- A shared-directory sub-agent cannot replace a dedicated Host worktree and no `ACTIVE_TASK_CONFLICT` post-open move remains.

See [Product](PRODUCT_en.md), [Architecture](ARCHITECTURE_en.md), [WebUI](WEBUI_en.md), and
[Project Status](PROJECT-STATUS_en.md).
