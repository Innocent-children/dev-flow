# Worktree sources and local changes

[中文](WORKTREE-SOURCES.md) | [English](WORKTREE-SOURCES_en.md)

## Use case

Developers choose a local or remote starting branch and whether to include uncommitted local content.
Before creating a worktree, the Host asks for the source, base branch, content choice and target branch.
Explicit choices already supplied for this request remain valid.

## Available data and responsibilities

The Host reads local branches, remotes, source HEAD, staged, unstaged and untracked paths and presents
the choices. The Host creates Git resources and copies content. Core checks worktree identity, source,
branch, HEAD and actual changes read-only, then creates the Task.

`source_type` is required and accepts `local` or `remote`; `carry_changes` is a required boolean.
Local sources use an empty `remote_name` and a local `base_branch`. Remote sources require a valid remote
name and `carry_changes=false`. `target_branch` names the new task branch. Missing choices have no defaults.

## Behavior rules

1. Preparation starts only after the choices are explicit. Remote sources fetch the exact ref; local
   sources resolve `refs/heads/<base>` without network access.
2. The Host retains `base_commit` and creates the dedicated worktree from that commit. Codex managed
   dispatch also uses this frozen commit.
3. When carrying local changes, the Host creates Git snapshot objects and retains `snapshot_commit`.
   The snapshot preserves staged and unstaged layers and includes non-ignored untracked files.
   The source checkout, source index, HEAD and `refs/stash` remain unchanged.
4. The Host applies the snapshot on the new branch with staging state restored. When another local
   branch is selected, Git applies the changes to it. Conflicts or file collisions stop Core Task
   creation and retain the destination worktree and failed receipt for inspection.
5. Core checks the dedicated worktree, named branch, frozen commit and source ref. Initial changes
   are allowed only for local `carry_changes=true`; other choices require a clean worktree. Carried
   content belongs to the Task surface and remains subject to scope and verification rules.
6. Each repository retains its own choices; all repositories must be prepared before one multi-repository
   Task opens. Recovery reads the original receipt. Uncertain results never repeat creation or snapshot
   application. Later source edits do not alter captured content.

Snapshot preparation rejects unresolved conflicts and submodule changes. Ignored files are excluded.
DeepSeek assisted cleanup retains local-source branches for separate user inspection and handling;
local creation does not gain a remote dependency.

## Launch records and Task state

Host receipts add `source_type`, `carry_changes` and `snapshot_commit`, and retain the starting point as
`base_commit`. Preparation follows `confirmed -> resolving -> prepared`, then the existing dispatch and
worktree provisioning phases. Failures and uncertain results retain `failed` and `uncertain`. These
are Host operation records, not additional Core process nodes.

`WorkspaceOrigin` and CLI/MCP/WebUI projections include `source_type` and `carry_changes`. Core continues
to own identity, recovery and process rules. The current `standard-development` definition digest, nodes,
outgoing edges, guards, Actions and verification requirements are unchanged. Only Task admission now
allows explicitly selected local content. `tasks.snapshot` retains the new origin fields.

## Expected result and impact

Local repositories can start Tasks offline, with uncommitted content copied only by user choice. An
application failure preserves the source checkout and does not report a successful Task. Carried content
counts toward the Task surface; it is not completed work or a passed verification result.

## Acceptance checks

- Codex `task-launch.test.mjs`: temporary Git repositories cover remote creation, both offline local
  content choices, staged separation, untracked files, ignored-file exclusion, source preservation,
  frozen snapshots, different base branches, managed bootstrap and conflict retention.
- DeepSeek `workspace-coordinator.test.mjs`: explicit choices, offline creation, binary untracked content
  and consume after relaunch.
- Core `workspace_observer_test.go`: local admission without a remote, required carry authorization for
  initial changes, rejection of remote carry, and retained actual Task surface.
- Package, CLI/MCP input and storage checks cover the new fields and packaged snapshot modules.

These checks use native temporary repositories and Host helpers. Managed dispatch uses simulated Host
creation results; they do not establish an actual Codex desktop or DSH session end-to-end run and do
not extend support claims for other platforms.

## Non-goals

This change adds no Core Git writes, automatic commits or publication, historical-data compatibility,
cross-machine copying, ignored-file copying or submodule-content copying.

## Codex planning and preservation checks

When Codex carries local changes, it records their preservation in REQUIREMENTS and reconciles the complete `current_changed_paths` with `expected_paths` and retained process artifacts in TASKS. New development and preservation receive separate work and checks; an empty current-Action file collection cannot replace the complete Task path comparison. Preservation checks compare the launch snapshot and do not certify existing behavior as tested. Existing file-scope blockers continue through the current Core choices and transitions.
