# dev-flow-codex

[中文](https://github.com/Innocent-children/dev-flow/blob/main/packages/codex/README.md) |
[English](https://github.com/Innocent-children/dev-flow/blob/main/docs/CODEX_en.md)

`dev-flow-codex` gives Codex one durable Core Task in a dedicated worktree. New requests are assessed
before Core is contacted; selected requests start from a developer-confirmed source/base/target/carry, and
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
`$HOME/.dev-flow/data` or `%LOCALAPPDATA%\dev-flow\data`.

## Approve the plan before implementation

Review the requirements and acceptance criteria, design and impact, then discuss the complete work, expected-file and verification plan. Implementation begins after explicit approval; selecting Dev Flow and workspace parameters does not approve the plan. Waiting remains in task planning. Revisions or expanded file scope require approval of the revised plan; resuming the same draft needs no resave. Prefer exact files and explain directory ranges.

## Assess and start a Task

Codex retains explicit choices and authorizations that remain valid for the current request and assessment. When no decision or required input is outstanding, it continues without an acknowledgment pause for progress updates or Skill-rule explanations. When input is needed, it asks the concrete question in the same response; development mode, worktree parameters, comprehension confirmation, separate operation authorization, and blockers keep their respective rules.

Repository discovery follows current user instructions and applicable `AGENTS.md`. When a project
index is required, Codex reads it, candidate project documentation, and relevant code/configuration
within existing permissions to establish the complete proposed scope before confirming and
provisioning each repository. Scope is fixed after Task creation. These instructions take precedence
over the `host_preferences.codex.codebase_memory` default when selecting code-discovery tools.

Codex may select the Skill for a bounded development request. This exact conversation selector forces
selection but does not skip assessment:

```text
$dev-flow-codex:dev-flow Fix idempotency in the order-creation endpoint and run targeted tests.
```

For every new request—including an exact selector and each item in a parallel batch—Codex first performs
read-only code and Git discovery. It reports `small|standard|large|uncertain`, observed repositories,
candidate components and paths, public-contract/state/Host flags, verification shape, unknowns, a
recommendation, and reasons. It waits when a developer choice is still required. Before the developer chooses Dev Flow there is no Dev Flow
tool call, Task, claim, Git write, provisioning receipt, or child dispatch. A changed request,
canonical root, HEAD, or status invalidates the assessment.

After choosing Dev Flow, the developer selects a local or remote source, base and target branches,
and whether to carry local staged, unstaged and non-ignored untracked content. Local preparation
works offline. The Host freezes the selected commit and snapshot, creates the dedicated worktree,
and applies confirmed contents while preserving the source checkout.

In Codex App, managed-worktree and snapshot behavior remains Host-owned. The coordinator creates one
task from the frozen base commit and records one launch; queued, timed-out, or uncertain creation is
read from that launch rather than dispatched again. The child verifies HEAD, creates/switches to the
confirmed target branch, applies the selected snapshot and verifies worktree identity, then calls Core. Codex CLI uses
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

Codex plans verification after requirements, design, impact and existing tests have been understood. The plan records necessary checks, reasons, initial command capacity, full-suite expectations and expected test-code changes. Focused checks come first.

Before exceeding capacity, the Host records a concrete new impact, risk, failure or gap and only the necessary increase. Existing checks can receive capacity for remaining work or reruns. An increase creates no passed result. Every full-suite run needs a fresh justification; spare capacity or a previous full-suite run is insufficient.

Test-code changes should protect stable behavior, public interfaces, important failures or actual regressions. Post-change review covers the diff, causal impact and acceptance needs; fixes receive related rechecks. Explicit review is read-only and stops after findings until repair is separately authorized. Unrelated historical issues stay outside ordinary post-change review.

See the [Command Reference](COMMANDS_en.md) for submission fields.

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
- A shared-directory sub-agent cannot replace a dedicated Host worktree; `ACTIVE_TASK_CONFLICT` stops creation for the developer to resolve the existing Task.

See [Product](PRODUCT_en.md), [Architecture](ARCHITECTURE_en.md), [WebUI](WEBUI_en.md), and
[Project Status](PROJECT-STATUS_en.md).

## Desktop task entry

The desktop pet uses a local development package for macOS arm64 or Windows 10/11 x64 and reads the saved Task state from the configured Adapter’s Core. It opens the selected Task in WebUI; it does not indicate live Host activity or completion percentages. Regular npm packages omit the macOS native app. See the [desktop pet guide](DESKTOP-PETS_en.md) for installation, controls, updates and appearances.

## Completion and recovery

Every planned work item must be complete before testing. Delivery links each acceptance criterion to corresponding completed work and passed current checks. Developer comprehension remains a separate confirmation. If a submission result is uncertain, the Adapter reads the retained Core operation before recovery or retry. See the [Command Reference](COMMANDS_en.md) for integration details.

Codex retains the complete tool response before checking `ok` and reading success data; explicit rejections follow the returned error and handling instruction, and local caching or presentation errors do not change the original response.

## File submission

The Adapter collects and classifies changed files before submitting node results. Missing files receive a bounded correction instruction; workspace or history failures follow Core recovery. These preparation steps are performed by Codex. See [artifact collection and submission](ARTIFACTS_en.md).

## Carried content

Confirmed local content belongs to the Task scope. Codex plans preservation checks separately from new development and compares preserved contents with the launch snapshot. Preserving a file does not certify its existing business behavior. Unexplained paths still require a scope decision. See [worktree sources](WORKTREE-SOURCES_en.md).


## Skill interaction reference

Core interaction instructions and complete examples for Codex and DeepSeek are maintained in `skills/dev-flow/core/` and rendered into each package by the build scripts. Each Host documents its actual authorization, workspace preparation and tool calls. Execution uses the current Action, installed interface and real user decisions. Node submissions, result handling, blocker recovery and verification use the same content, and both rendered example sets pass through the same Core validation.

[Codex Skill](../packages/codex/plugin/skills/dev-flow/SKILL.md)
