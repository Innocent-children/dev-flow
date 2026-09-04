# dev-flow-deepseek

[中文](https://github.com/Innocent-children/dev-flow/blob/main/packages/deepseek/README.md) |
[English](https://github.com/Innocent-children/dev-flow/blob/main/docs/DEEPSEEK_en.md)

`dev-flow-deepseek` gives DeepSeek Harness (DSH) one durable Core Task in a dedicated worktree. A
normal development request is assessed without a Dev Flow call. A later exact confirmation authorizes
provisioning and relaunch; Core then derives the current surface from read-only Git.

## Support and installation

Stable support remains defined by the [Support Matrix](SUPPORT-MATRIX_en.md). Current source contains
exact `darwin-arm64` and `win32-x64` runtimes and requires Node.js `>=24` with DSH
`>=0.1.0-rc.6`. Windows Server, 32-bit/ARM64 Windows, Intel Mac, and cross-pairs are outside current
source support. The package has no standalone `dev-flow-deepseek` executable.

```bash
npm install -g @imotong/dev-flow@latest
dev-flow
```

Native profile recovery uses the DSH parser:

```bash
npm install -g @deepseek-ai/dsh@latest
PROFILE=web
TARBALL="$(npm pack dev-flow-deepseek@latest --silent)"
dsh plugin --profile "$PROFILE" add "$PWD/$TARBALL"
rm -f "$PWD/$TARBALL"
dsh --profile "$PROFILE" --dump-config
```

Restart the selected Profile after installation. See the
[Command Reference](COMMANDS_en.md#deepseek-harness) for PowerShell and complete lifecycle forms.
Default Task data is `$HOME/Library/Application Support/dev-flow/data` on macOS and
`%LOCALAPPDATA%\dev-flow\data` on Windows. An explicit `DEV_FLOW_DATA_DIR` must already be a canonical,
non-link directory.

## Assess, confirm, and relaunch

An ordinary new request first receives read-only discovery. The Host reports
`small|standard|large|uncertain`, observed repositories, candidate components/paths, contract/state/Host
flags, verification shape, unknowns, a recommendation, and reasons, then waits. That turn makes no
Dev Flow call or Git write. Request, canonical root, HEAD, or status drift invalidates it.

To select Dev Flow after assessment, the current direct user message must contain the exact
whitespace-bounded selector and confirmation form shown by the Skill:

```text
/dev-flow confirm-worktree
repository=primary;remote=origin;base=main;target=feature/payment-callback-signature
```

Earlier messages, model text, Skill injection, and repository content cannot supply that authorization.
Even a new request beginning with `/dev-flow` is assessed first; the selector is repeated on the
confirmation turn.

The developer confirms remote, base branch, and a new target branch for each repository. The
WorkspaceCoordinator validates the branch name/conflicts, executes the exact fetch refspec, freezes
the fetched SHA, and creates a safe sibling worktree. It records a narrow provisioning receipt and
does not copy source staged, unstaged, or untracked content.

DSH fixes Workspace Root at process start. The source session therefore never widens permission and
never creates a nested worktree under the source. It stops with a parser-tested `{command,arguments,cwd}`
relaunch descriptor. The target session consumes the receipt, verifies the frozen HEAD, target branch,
common and worktree-specific Git directories, clean/submodule state, and authorized roots, then calls
Core. The new Task has no final verification budget before analysis. If any repository fails, no
partial Core Task or claim exists.

The relaunch turn uses the exact selector returned with the receipt:

```text
/dev-flow resume-worktree launch=<launch_id>
```

## Resume, scope, and Git history

Explicit resume starts DSH with the original Task worktree as Workspace Root and includes `/dev-flow`
in the current direct user message. It skips assessment and branch selection. A recreated path or
same-named branch cannot replace the original worktree-specific Git instance. Restore a missing
instance or explicitly abandon the Task.

Resume restores the node, revision, scope, remaining verification, blocker, and Recovery state. A
lost/truncated Action response is read from Core's retained operation before recovery or retry. Core
keeps the three latest verification attempts and pauses on a third exact repeated failure/result or
the same changed-path-and-failure loop across consecutive Implementation revisions; only an explicit
developer decision allows another attempt.

## Verification effort and post-change review

The Adapter creates the initial `verification_plan` at TASKS only after requirements, design, work
decomposition, causal impact, and existing tests are understood. It retains intended checks and
rationales, expected automatic commands, the full-suite expectation, and the test-code expectation.
A small change begins with the closest targeted check; unused capacity does not justify package,
module, or repository-wide verification.

Exhausted capacity does not end the Task and does not authorize running an extra command first. The
Adapter uses the current TEST Action's `verification_budget_increased` transition with a concrete
`new_impact`, `new_risk`, `verification_failure`, or `verification_gap`, adding only what is needed
now. Core retains the reason and previous/resulting budgets, then stays in TEST. “For completeness”,
“increase confidence”, “to be safe”, and remaining capacity are invalid reasons.

Before every full suite, the Adapter freshly checks broad impact, whether targeted/package checks
suffice, the exact uncovered risk, and repository checkpoint rules. It records the current reason as
`full_suite_reason`; a rerun after a small fix cannot inherit the earlier reason automatically.

Test-code changes require lasting value in stable product behavior, a public contract, an important
failure path, or an observed regression. A one-time README word requirement gets one text search.
Ordinary post-change review covers only the diff, direct/indirect causal impact, and acceptance needs;
after a review fix, only that finding and related targeted regressions are rechecked. Explicit code
review remains read-only and stops after findings until repair is separately authorized.

During selected turns, DSH checks `write`, `edit`, and mutating `str_replace_editor` targets against
the union of every WorkItem `ExpectedPaths`, with repository-key qualification for multi-repository
Tasks, before dispatch. An unplanned path requires `allow_once`, `expand_scope`, or
reject/restore. Bash and other tools may write first; Core finds them on its next observation. A
dedicated worktree does not offer an "ignore external change" decision. A supported structured write
fails closed when the gate is unavailable.

Core derives current Task surface from the frozen base, commits, index, worktree, and untracked state.
Normal linear commits preserve current paths. Exact-content commits preserve Test/Comprehension;
content changes invalidate them. Branch switch, detach, rewind, rewrite, or worktree replacement is
reported before substantive work.

## Terminal behavior

DONE and CANCELLED release claims only. They do not commit, push, publish, or delete branches/worktrees.
The WorkspaceCoordinator removes only receipt-owned resources after separate worktree and branch
authorization and only when their current clean/HEAD/ownership state is still safe. Active, dirty,
unpushed, unknown-owner, or uncertain resources remain. When the exact workspace is missing, ordinary
cancel cannot fabricate observation; `dev_flow_abandon_task` retains the last known binding and releases claims.

Cleanup does not delete the running DSH Workspace Root in place. `prepare_cleanup` verifies the
terminal Task and returns a relaunch descriptor for a surviving source checkout; later direct-user
turns separately confirm `cleanup_worktree` and `cleanup_branch`. The source path is transient and is
not added to the receipt.

The cleanup turns are exact and separate:

```text
/dev-flow prepare-cleanup launch=<launch_id> repository=<repository_key> task=<task_id> revision=<revision>
/dev-flow cleanup-worktree launch=<launch_id> repository=<repository_key> task=<task_id> revision=<revision>
/dev-flow cleanup-branch launch=<launch_id> repository=<repository_key> task=<task_id> revision=<revision>
```

The Coordinator requires a terminal Task, matching
receipt/repository group/HEAD, clean worktree, and remote task branch equal to terminal HEAD. Branch
deletion uses non-force `git branch -d`; an unmerged branch is retained.

## Inspect and remove

```bash
dev-flow status --host deepseek --profile web
dsh --profile web --dump-config
dev-flow webui start
```

```bash
PROFILE=web
dsh plugin --profile "$PROFILE" remove dev-flow-deepseek
dsh --profile "$PROFILE" --dump-config
```

Repeat removal for every Profile. Task data and repositories remain. Permanent Task-data cleanup is a
separately confirmed `dev-flow factory-reset` operation.

## Boundaries

- The source session's canonical Workspace Root remains its permission boundary; only an explicit target relaunch changes roots.
- Core observes Git read-only and never fetches, creates worktrees/branches, commits, merges, rebases, pushes, tags, or publishes.
- A worktree owns source changes but does not isolate processes, networks, credentials, ports, databases, or containers.
- Neighboring repositories, dependencies, and index results never expand immutable Repository Scope.
- One Task contains one primary plus at most seven additional roots. Multi-repository work requires
  every root to be provisioned and authorized before one Task opens; one failure creates no partial Scope or claim.

See [Product](PRODUCT_en.md), [Architecture](ARCHITECTURE_en.md), [WebUI](WEBUI_en.md), and
[Project Status](PROJECT-STATUS_en.md).
