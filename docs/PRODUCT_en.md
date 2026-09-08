# Dev Flow Product Definition

[中文](PRODUCT.md) | [English](PRODUCT_en.md)

## One-sentence position

> Dev Flow first helps a developer decide whether a request warrants the full workflow. A selected
> Task starts from a developer-confirmed remote base in a dedicated worktree, while Core keeps its
> actual changes, post-analysis verification plan, and current progress coherent.

Codex or DeepSeek still reads code, edits files, and runs commands. Dev Flow retains one saved
Task state. Verification effort is planned with the Task Plan, and later expansion records a concrete new
impact, risk, failure, or gap. Core rejects or pauses unplanned results, scope expansion, stale
results, workspace-history conflicts, and uncertain operations.

## Target users and job

Dev Flow is for developers using Codex or DeepSeek in real repositories when work can span sessions
or days. It fits work that needs an explicit file boundary, bounded test effort, interruption recovery,
and isolation from unrelated changes in a shared checkout.

Users can:

- inspect a read-only change assessment before a Task exists and choose direct work, Dev Flow, or clarification;
- confirm a remote, base branch, and new target branch for every repository;
- start from the fetched and frozen base commit in a clean, dedicated, named-branch worktree;
- retain the goal, acceptance criteria, exclusions, and expected paths, then save the verification
  plan and initial budget after task analysis;
- retain the basis, reason, added checks, increment, and resulting budget before TEST continues with
  more capacity;
- let Core derive the current change surface from Git instead of trusting agent-reported paths;
- allow one unplanned path, revise the plan, or restore the file;
- make normal linear commits on the task branch while branch switches, rewinds, and unprepared rewrites stop;
- invalidate Test and Comprehension after content changes while preserving them across an exact-content commit;
- read a retained uncertain operation before recovery or retry;
- relocate the same Task between same-machine Host workspaces;
- have the Host reconsider every full suite, test-code change, and post-change review scope;
- explicitly abandon a missing workspace and make separate keep, handoff, worktree-cleanup, and branch-cleanup decisions at terminal state.

## Main problem

The previous flow bound a new Task to the checkout already in use. Git-visible work from another tool,
process, or person could drift the Task, while agent-reported file paths could neither prove the
author nor distinguish later content changes on an already-dirty path.

The current flow uses one worktree instance as the ownership boundary. A new request receives a
read-only assessment first. If the developer chooses Dev Flow, the Host obtains an explicit
remote/base/target decision, fetches the exact remote ref, freezes its commit, and creates the Task
only in a dedicated worktree. Later changes in the source checkout are unrelated; every Git-visible
change in the Task worktree belongs to that Task.

Before starting a development session, the source Codex session organizes the complete relevant requirements discussion, retaining original messages, confirmed requirements, terminology, scope constraints, code findings, working instructions, unaccepted suggestions, assumptions, and open questions. Desktop tasks and CLI relaunch use the same saved material; longer content is supplied through complete files. Existing development and worktree confirmations remain effective, with no extra handoff-summary approval. The Codex Host owns collection and sending; Core continues to decide Task state.

## Task handling rules

Repository discovery and code-index selection follow current user instructions and applicable
`AGENTS.md`, ahead of the plugin's code-index preference. When those instructions require a project
index, the Host reads it, candidate project documentation, and relevant code/configuration before Task
creation to establish the complete proposed scope. Every repository is confirmed and provisioned
before that scope is fixed in the Task; discovery respects existing Host permissions.

| User event | Product behavior |
| --- | --- |
| A new request may be small | The Host performs read-only discovery and stops for a choice; no Core call, Task, Git write, receipt, or child dispatch exists before confirmation |
| The developer chooses Dev Flow | The Host shows and confirms remote/base/target plus bounded source dirtiness, then fetches, freezes, provisions, and verifies a dedicated worktree |
| The Task worktree changes | Core derives identity, history, content, Action delta, and the base-relative current Task surface |
| Work leaves the plan | Supported structured writes ask first; later observation finds other writes, and unexplained paths cannot reach testing or delivery |
| TASKS completes analysis | Retain planned checks and rationales, the initial automatic-command budget, full-suite expectation, and test-code expectation |
| Capacity is insufficient | TEST accepts only an increase with an allowed basis category, concrete reason, and needed increment, then remains in TEST |
| A full suite is proposed | The Host rechecks broad impact, whether focused checks suffice, the concrete uncovered risk, and repository checkpoint rules; available budget is not a reason |
| Testing repeats | A third exact repetition pauses |
| Code is reviewed after change | Review only the diff, causal impact, and acceptance needs; delivery reports only related findings; after a fix rerun only related review and checks |
| Earlier results become stale | Content changes invalidate Test and Comprehension; committing identical content does not |
| Workspace history changes unexpectedly | Branch switch, detach, rewind, rewrite, or worktree replacement produces a specific blocker or unavailable result |
| The Host relocates the Task | Core prepares a relocation blocker, the Host performs one handoff, and verified destination bindings and claims change atomically |
| The workspace is gone | Ordinary cancellation cannot fabricate observation; explicit abandon retains the last known state and releases claims |

## Current product commitments

Current source commits to:

- creating every new Task only after confirmation in a clean, dedicated worktree on a named task branch;
- assessing every new request, exact selector, and parallel batch before waiting for a choice; only explicit resume skips assessment;
- never copying staged, unstaged, or untracked source-checkout content into the Task worktree;
- opening one multi-repository Task only after every repository has been fetched, isolated, authorized, and verified;
- keeping Core's Git access read-only while it stores WorkspaceOrigin, current observation and surface, Actions, records, blockers, and outcome;
- creating no final test budget at Task open; TASKS owns the initial verification plan and Evidence
  consumption is scoped to the current Task Plan revision;
- letting TEST use the `verification_budget_increased` self-transition to retain a justified increase
  instead of ending merely because capacity is exhausted;
- accepting semantic Host node results while Core derives file effects and current paths;
- using the same Core Task and `BLOCKED` state for file scope, workspace history, verification brakes, relocation, and Recovery;
- preserving the Task surface across linear commits and content-bound records across an exact-content commit;
- retaining separate narrow records for provisioning, Action Recovery, and relocation without another business state machine;
- making DONE and CANCELLED release claims without automatically committing, pushing, opening a pull request, or deleting a worktree;
- projecting the same Core state through Codex, DeepSeek, and the local WebUI.

These commitments do not intercept every Host shell or file operation and do not make a worktree a
file-system, process, network, or credential sandbox. External writes may happen first and be handled
by the next Core observation.

## Tasks that fit and do not fit

Dev Flow fits work spanning sessions or Host restarts; public-contract, Schema, state, multi-package,
multi-Host, or recovery-sensitive changes; and tasks needing an explicit surface, analyzed verification effort,
worktree isolation, or same-machine relocation. A few explicit repositories may share one Task only
when each can be provisioned independently.

Direct Host use is normally simpler for one-off questions, explanations, status requests, and small
mechanical changes with no public-contract impact. A local/offline repository without an accessible
remote/base, or work requiring cross-machine relocation, a security sandbox, remote execution, or
automatic Git publication, does not fit.

## Relationship to other tools

| Tool | Responsibility |
| --- | --- |
| Codex / DeepSeek | Understand the request and code, assess whether to use Dev Flow, perform confirmed Host/Git work, edit code, and run checks |
| OpenSpec / Spec Kit | Optionally organize requirements, design, and tasks; never decide a Core node or completion |
| Dev Flow Core | Retain the one Task, observe the workspace, enforce scope/verification/recovery rules, and decide the legal next action |

## Task execution flow

1. The Host assesses each new request read-only, reports `small|standard|large|uncertain`, candidate
   impact, unknowns, and a recommendation, then waits. Request, canonical root, HEAD, or status changes
   invalidate the assessment.
2. After remote/base/target confirmation, the Host fetches and creates a dedicated worktree. Core
   verifies worktree, branch, HEAD, base, and clean state before Task creation. Explicit resume returns
   to the original instance.
3. Core derives the current Task surface from the base commit, commits, index, worktree, and untracked
   files. ExpectedPaths, one-time decisions, and the TASKS verification plan control progress. The
   current budget counts only the current Task Plan revision, and every increase retains its concrete
   reason. Test and Comprehension bind to content.
4. Core retains uncertain Actions, blockers, relocation, and outcome. Same-machine relocation keeps
   source claims during Host handoff and replaces them once after verification. Cleanup needs separate authorization.

## Completion and Action recovery

Before entering TEST, every work item in the current Task Plan must be completed. DELIVERY receives explicit acceptance results linking each criterion to completed work items mapped to that criterion and passed checks in the current Test. Automated, static, Host-observed and explicit manual checks are supported. Comprehension confirmation remains separate and does not automatically substitute for acceptance checks. Missing, incorrect or outdated references reject the submission.

WebUI and MCP share Core semantic submission, operation retention and recovery. Core retains the canonical payload; the page sends the current Task revision, Action ID and semantic results. Network failures first trigger a Core read. Reopening the page discovers pending operations and recovers them by Action ID. Invalid completion results neither advance the Task nor retain an operation.

## Explicit non-goals

Dev Flow is not a general agent or workflow DSL. Core does not fetch, create branches/worktrees,
commit, stash, reset, merge, rebase, push, tag, open pull requests, or publish. The product does not
copy `.env`, certificates, tokens, ignored/untracked files, or credentials; install dependencies;
isolate ports, databases, Docker volumes, or services; or automatically delete active, dirty,
unpushed, unknown-owner, or uncertain worktrees. Cross-machine relocation, automatic addition of
unconfirmed neighboring repositories, partly isolated multi-repository Tasks, remote MCP, and cloud
multi-user management are out of scope.

## Verified scope

The project provides public npm packages, interface specification tests, and records of complete task
workflows in actual Codex and DeepSeek. Each result applies only to the package, platform, and steps
tested. Fixtures, static checks, and results from other platforms cannot expand stable support.

Dev Flow remains early and does not yet have enough external data to claim lower defect rates,
verification cost, or recovery time. See [Project Status](PROJECT-STATUS_en.md) and the
[Support Matrix](SUPPORT-MATRIX_en.md). Runtime behavior remains defined by source, machine-readable
schemas, package manifests, CLI parsers, and executable tests.

## Desktop task entry

On macOS arm64, the desktop pet uses a local development package containing `DevFlowPet.app`, with Core supplied by an already configured Codex or DeepSeek Adapter.
Regular npm file lists and release preparation currently omit the native app; see the [desktop pet guide](DESKTOP-PETS_en.md#local-build-and-installation) to obtain it.
The pet shows one selected Task's saved state and opens its WebUI. Core owns Task state; presentation indicates neither live Host activity nor completion percentages.
While no task is selected, the pet keeps looking for new tasks, preferring the most recently updated blocked task, then the most recently updated active task. Once selected, the watched task stays selected until you change it.
The menu bar uses a monochrome Dev Flow mark that adapts to the system appearance. Pet size offers six settings from 50% to 200% and saves the selection while keeping bubble text unchanged.

Appearances can use a single PNG or SVG, a native PNG/SVG animation pack, a standard Codex format 1/2 atlas, or Dev Flow's high-resolution extension. Five task clips are required;
additional artwork determines whether walking, waving, or thinking is available. Only Codex-layout atlases have the fixed nine-clip, 57-frame extraction.
Idle activities have a separate switch, task prompts take priority, and automatic movement preserves manual placement.
Program updates, replacement of an installed app copy, and artwork reimports are separate operations. See the [desktop pet guide](DESKTOP-PETS_en.md) for installation, all trigger rules, and troubleshooting.

The local pet package retains the default appearance in a separate artwork directory with nine clips and 312 SVG frames. Import Whale Girl or other custom appearances as separate artwork packs through Import appearance. Artwork is stored in the user directory and preserved across application updates.

## Windows platform boundaries and verification

Windows 10/11 x64 targets ordinary desktop PCs with Intel or AMD 64-bit processors. The three Node packages implement paths, permissions, commands and cleanup separately in `lib/platform/windows/` and `lib/platform/macos/`; selection entry points only dispatch to the current platform. Core keeps shared platform-neutral task semantics, while Windows Git processes hide console windows. Codex `--version` and `status` use the selected executable-file policy, and Windows PowerShell launchers output UTF-8. This change was tested only on native Windows; Windows 10, AMD hardware and macOS were not tested, and stable support claims remain unchanged. See the [Windows adaptation report](WINDOWS-ADAPTATION_en.md).

## Windows desktop features

The Windows 10/11 x64 desktop pet aligns with macOS task selection and status bubbles, WebUI navigation, tray/context menus, static and native animated PNG/SVG appearances, Codex PNG/WebP atlas imports, nine actions, dragging, six scale settings, hide/restore and independent start/stop. Windows uses a separate Electron implementation while macOS retains Swift/AppKit; both only read Core state. The Windows local package is built by `scripts/build-desktop-pet-windows.mjs`, with user data in `%LOCALAPPDATA%\dev-flow\pet`. See the [desktop pet guide](DESKTOP-PETS_en.md) for building, installation, updates and verification.
On Windows, resizing ends the current idle activity and resumes normal scheduling.

On Windows, existing AppData directories are resolved to their actual paths, including directory aliases exposed by packaged desktop hosts; symbolic links remain rejected.

The current Windows development distribution includes both Adapter packages and the desktop app. After installing the launcher package, use `dev-flow install --host all --yes` and `dev-flow pet start`. Repair and reinstall use the same entry, verify bundled artifact hashes, refresh the desktop app, and preserve Task data, settings and appearances.

## Current DSH interface

The current source DeepSeek Adapter requires DSH `>=0.1.2-rc.1`. It reads the current turn and direct user input through Session `snapshotEvents()` to check `/dev-flow`, worktree confirmations, and structured file writes; Core continues to own Task state.

## Lifecycle entry

The public `dev-flow` manages Adapter installation and maintenance. Its menu shows state first; plans show versions and resource paths before confirmation. Installation, repair and reinstall keep installed versions by default; upgrade selects `latest`. Satisfied installation, repair, upgrade and removal require no repeated changes, while reinstall executes every time. Diagnostics identify failed checks and recovery commands, errors retain causes and completed steps, and installation results retain hook trust and Profile restart instructions. JSON never prompts. The launcher owns terminal interaction, version selection and installation records; Core independently owns Task state. See the [Command Reference](COMMANDS_en.md#lifecycle-command-behavior) for options and repeat behavior.

`dev-flow-codex host-launch <operation>` reads a UTF-8 JSON object of at most 1 MiB from the stdin stream, including chunked input and multibyte characters split across chunks. Read failures, invalid UTF-8, duplicate members, invalid JSON, arrays, and null are rejected before the operation runs; errors go to stderr and successful JSON results go to stdout.

## Artifact preparation

Before ordinary submission, Codex runs `dev-flow-codex artifacts collect` and `dev-flow-codex artifacts prepare`, reusing Core’s complete Git observation for the current Action. Codex supplies file purpose and summary; preparation checks the collection against the current observation and generates artifact arrays. Missing process files receive exact paths and one correction limited to artifact fields. Real repository failures retain their existing recovery rules. See [artifact collection and submission](ARTIFACTS_en.md).

Codex can query parameter Schemas, field sources and next steps through `dev-flow-codex --help` and operation help, and assemble repository arguments from the same set of provisioned workspace records. MCP provides result Schemas and structured responses. Resumed sessions handle Core-retained pending submissions before performing the current node; creation, cancellation, abandonment and relocation preparation use their own readback identities.
