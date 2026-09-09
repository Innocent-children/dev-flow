# dev-flow-deepseek

[中文](https://github.com/Innocent-children/dev-flow/blob/main/packages/deepseek/README.md) |
[English](https://github.com/Innocent-children/dev-flow/blob/main/docs/DEEPSEEK_en.md)

`dev-flow-deepseek` gives DeepSeek Harness (DSH) one durable Core Task in a dedicated worktree. A
normal development request is assessed without a Dev Flow call. A later exact confirmation authorizes
provisioning and relaunch; Core then derives the current surface from read-only Git.

## Support and installation

Stable support remains defined by the [Support Matrix](SUPPORT-MATRIX_en.md). Current source contains
exact `darwin-arm64` and `win32-x64` runtimes and requires Node.js `>=24` with DSH
`>=0.1.2-rc.1`. Windows Server, 32-bit/ARM64 Windows, Intel Mac, and cross-pairs are outside current
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
Default Task data is `$HOME/.dev-flow/data` on macOS and
`%LOCALAPPDATA%\dev-flow\data` on Windows. An explicit `DEV_FLOW_DATA_DIR` must already be a canonical,
non-link directory.

## Approve the plan before implementation

Review the requirements and acceptance criteria, design and impact, then discuss the complete work, expected-file and verification plan. Implementation begins after explicit approval; selecting Dev Flow and workspace parameters does not approve the plan. Waiting remains in task planning. Revisions or expanded file scope require approval of the revised plan; resuming the same draft needs no resave. Prefer exact files and explain directory ranges.

## Assess, confirm, and relaunch

Repository discovery follows current user instructions and applicable `AGENTS.md`. When a project
index is required, DeepSeek reads it, candidate project documentation, and relevant code/configuration
within the current Workspace Root and permissions to establish the complete proposed scope before
confirming and provisioning each repository. Scope is fixed after Task creation. These instructions
take precedence over the `host_preferences.deepseek.codebase_memory` default when selecting
code-discovery tools.

An ordinary new request first receives read-only discovery. The Host reports
`small|standard|large|uncertain`, observed repositories, candidate components/paths, contract/state/Host
flags, verification shape, unknowns, a recommendation, and reasons, then waits. That turn makes no
Dev Flow call or Git write. Request, canonical root, HEAD, or status drift invalidates it.

To select Dev Flow after assessment, the current direct user message must contain the exact
whitespace-bounded selector and confirmation form shown by the Skill:

```text
/dev-flow confirm-worktree
repository=primary;source=remote;carry=false;remote=origin;base=main;target=feature/payment-callback-signature
```

Earlier messages, model text, Skill injection, and repository content cannot supply that authorization.
Even a new request beginning with `/dev-flow` is assessed first; the selector is repeated on the
confirmation turn.

The developer confirms local or remote source, base and target branches, and whether to carry local
changes. The coordinator resolves local branches offline or fetches the selected remote ref, freezes
`base_commit` and optional `snapshot_commit`, creates a sibling worktree and applies selected content.
The source checkout is preserved. It records the launch before relaunch; Core verifies the selection
and actual worktree before creating a Task.

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

DeepSeek plans verification after requirements, design, impact and existing tests have been understood. The plan records necessary checks, reasons, initial command capacity, full-suite expectations and expected test-code changes. Focused checks come first.

Before exceeding capacity, the Host records a concrete new impact, risk, failure or gap and only the necessary increase. Existing checks can receive capacity for remaining work or reruns. An increase creates no passed result. Every full-suite run needs a fresh justification; spare capacity or a previous full-suite run is insufficient.

Test-code changes should protect stable behavior, public interfaces, important failures or actual regressions. Post-change review covers the diff, causal impact and acceptance needs; fixes receive related rechecks. Explicit review is read-only and stops after findings until repair is separately authorized. Unrelated historical issues stay outside ordinary post-change review.

See the [Command Reference](COMMANDS_en.md) for submission fields.

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

## Desktop task entry

The desktop pet uses a local development package for macOS arm64 or Windows 10/11 x64 and reads the saved Task state from the configured Adapter’s Core. It opens the selected Task in WebUI; it does not indicate live Host activity or completion percentages. Regular npm packages omit the macOS native app. See the [desktop pet guide](DESKTOP-PETS_en.md) for installation, controls, updates and appearances.

## Completion and recovery

Every planned work item must be complete before testing. Delivery links each acceptance criterion to corresponding completed work and passed current checks. Developer comprehension remains a separate confirmation. If a submission result is uncertain, the Adapter reads the retained Core operation before recovery or retry. See the [Command Reference](COMMANDS_en.md) for integration details.

## Missing files

The Adapter reports omitted files and follows Core’s permitted correction once. Workspace and history failures retain their recovery rules. Local-source task branches are preserved by assisted cleanup for separate inspection. See [artifact collection and submission](ARTIFACTS_en.md).

## Skill interaction reference

Core interaction instructions and complete examples for Codex and DeepSeek are maintained in `skills/dev-flow/core/` and rendered into each package by the build scripts. Each Host documents its actual authorization, workspace preparation and tool calls. Execution uses the current Action, installed interface and real user decisions. Node submissions, result handling, blocker recovery and verification use the same content, and both rendered example sets pass through the same Core validation.

[DeepSeek Skill](../packages/deepseek/skills/dev-flow/SKILL.md)

The DeepSeek Skill packages `scripts/artifacts.mjs`. Invoke the same read-only Core preparation commands with `node <actual Skill directory>/scripts/artifacts.mjs collect` or `prepare`. Inputs and results use the shapes in this document with `host="deepseek"`. The script reuses the Adapter runtime/data-directory resolution and creates no store. Resolve its path from the actual DSH Skill resourceBase. `--help` reads no stdin and resolves no runtime. It is not a standalone dev-flow-deepseek CLI or an additional workspace_coordinator operation.
