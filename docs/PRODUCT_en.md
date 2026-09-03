# Dev Flow Product Definition

[中文](PRODUCT.md) | [English](PRODUCT_en.md)

## One-sentence position

> Dev Flow first helps a developer decide whether a request warrants the full workflow. A selected
> Task starts from a developer-confirmed remote base in a dedicated worktree, while Core keeps its
> actual change surface, verification limit, and current progress coherent.

Codex or DeepSeek still reads code, edits files, and runs commands. Dev Flow retains one authoritative
Task and pauses when scope widens, verification exceeds its budget, results become stale, workspace
history conflicts, or an operation result is uncertain.

## Target users and job

Dev Flow is for developers using Codex or DeepSeek in real repositories when work can span sessions
or days. It fits work that needs an explicit file boundary, bounded test effort, interruption recovery,
and isolation from unrelated changes in a shared checkout.

Users can:

- inspect a read-only change assessment before a Task exists and choose direct work, Dev Flow, or clarification;
- confirm a remote, base branch, and new target branch for every repository;
- start from the fetched and frozen base commit in a clean, dedicated, named-branch worktree;
- retain the goal, acceptance criteria, exclusions, expected paths, and verification budget;
- let Core derive the current change surface from Git instead of trusting agent-reported paths;
- allow one unplanned path, revise the plan, or restore the file;
- make normal linear commits on the task branch while branch switches, rewinds, and unprepared rewrites stop;
- invalidate Test and Comprehension after content changes while preserving them across an exact-content commit;
- read a retained uncertain operation before recovery or retry;
- relocate the same Task between same-machine Host workspaces;
- explicitly abandon a missing workspace and make separate keep, handoff, worktree-cleanup, and branch-cleanup decisions at terminal state.

## Primary failure scenario

The previous flow bound a new Task to the checkout already in use. Git-visible work from another tool,
process, or person could drift the Task, while agent-reported file paths could neither prove the
author nor distinguish later content changes on an already-dirty path.

The current flow uses one worktree instance as the ownership boundary. A new request receives a
read-only assessment first. If the developer chooses Dev Flow, the Host obtains an explicit
remote/base/target decision, fetches the exact remote ref, freezes its commit, and creates the Task
only in a dedicated worktree. Later changes in the source checkout are unrelated; every Git-visible
change in the Task worktree belongs to that Task.

## How the product intervenes

| User event | Product behavior |
| --- | --- |
| A new request may be small | The Host performs read-only discovery and stops for a choice; no Core call, Task, Git write, receipt, or child dispatch exists before confirmation |
| The developer chooses Dev Flow | The Host shows and confirms remote/base/target plus bounded source dirtiness, then fetches, freezes, provisions, and verifies a dedicated worktree |
| The Task worktree changes | Core derives identity, history, content, Action delta, and the base-relative current Task surface |
| Work leaves the plan | Supported structured writes ask first; later observation finds other writes, and unexplained paths cannot reach testing or delivery |
| Testing widens or repeats | The verification budget limits automatic commands and full suites; a third exact repetition pauses |
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
multi-Host, or recovery-sensitive changes; and tasks needing an explicit surface, verification budget,
worktree isolation, or same-machine relocation. A few explicit repositories may share one Task only
when each can be provisioned independently.

Direct Host use is normally simpler for one-off questions, explanations, status requests, and small
mechanical changes with no public-contract impact. A local/offline repository without an accessible
remote/base, or work requiring cross-machine relocation, a security sandbox, remote execution, or
automatic Git publication, does not fit.

## Relationship to other tools

| Tool | Responsibility |
| --- | --- |
| Codex / DeepSeek | Understand the request and code, assess admission, perform confirmed Host/Git work, edit code, and run checks |
| OpenSpec / Spec Kit | Optionally organize requirements, design, and tasks; never decide a Core node or completion |
| Dev Flow Core | Retain the one Task, observe the workspace, enforce scope/verification/recovery rules, and decide the legal next action |

## Capability layers

1. The Host assesses each new request read-only, reports `small|standard|large|uncertain`, candidate
   impact, unknowns, and a recommendation, then waits. Request, canonical root, HEAD, or status changes
   invalidate the assessment.
2. After remote/base/target confirmation, the Host fetches and creates a dedicated worktree. Core
   verifies worktree, branch, HEAD, base, and clean state before Task creation. Explicit resume returns
   to the original instance.
3. Core derives the current Task surface from the base commit, commits, index, worktree, and untracked
   files. ExpectedPaths, one-time decisions, and the verification budget control progress. Test and
   Comprehension bind to content.
4. Core retains uncertain Actions, blockers, relocation, and outcome. Same-machine relocation keeps
   source claims during Host handoff and replaces them once after verification. Cleanup needs separate authorization.

## Explicit non-goals

Dev Flow is not a general agent or workflow DSL. Core does not fetch, create branches/worktrees,
commit, stash, reset, merge, rebase, push, tag, open pull requests, or publish. The product does not
copy `.env`, certificates, tokens, ignored/untracked files, or credentials; install dependencies;
isolate ports, databases, Docker volumes, or services; or automatically delete active, dirty,
unpushed, unknown-owner, or uncertain worktrees. Cross-machine relocation, neighboring-repository
discovery, partly isolated multi-repository Tasks, remote MCP, and cloud multi-user management are out of scope.

## Current evidence boundary

The project has public npm packages, source contract tests, and real Codex and DeepSeek Host journeys.
Each record proves only its package, platform, and process slice. Fixtures, static checks, and evidence
from another platform do not expand stable support.

Dev Flow remains early and does not yet have enough external data to claim lower defect rates,
verification cost, or recovery time. See [Project Status](PROJECT-STATUS_en.md) and the
[Support Matrix](SUPPORT-MATRIX_en.md). Runtime behavior remains defined by source, machine-readable
schemas, package manifests, CLI parsers, and executable tests.
