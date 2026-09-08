# Shared Go Core

[中文](README.md) | [English](README_en.md)

`internal/` contains the Host-independent Dev Flow Go Core. It manages Tasks, the state graph, MCP,
SQLite, Recovery, and read-only Git observation. Codex and DeepSeek packages use the same Core to
provide consistent process behavior.

## Package ownership

| Package | Responsibility |
| --- | --- |
| `domain` | `ProcessTask`, worktree origins/bindings, requirements/design/task-plan baselines, operation and verification records, blockers, outcomes, and limits |
| `workflow` | `standard-development`, node rules, 30 transitions, the TASKS verification plan, payloads, and invalidation |
| `application` | Open/resume/read/submit/recover/relocate/cancel/abandon use cases and component coordination |
| `store` | SQLite bootstrap, strict snapshot, CAS, events, claims, and read-only preflight |
| `repository` | Read-only queries of dedicated-worktree identity, history, content, and task changes, with query limits |
| `recovery` | Classification of operation results into five cases, retry advice, blockers, and resume |
| `mcp` | Seventeen-tool local STDIO contract, Action-kind-specific submission schemas, and Result Envelope |
| `webui` | Loopback HTTP adapter, embedded assets, session protection, shared runtime receipt, and lifecycle |
| `version` | Core product version from `CORE_VERSION` or build injection |

## Core responsibilities

Core alone owns:

- Task identity, immutable intent, and method profile;
- process definition/digest, current node, resume node, and legal transitions;
- requirements/design/task-plan baselines and their invalidation;
- repository claim keyed by worktree-instance identity, revision CAS, current action, and verification records;
- immutable WorkspaceOrigin, current Task surface, and Action issuance identity/history/content;
- Recovery classification, blocker, and terminal outcome.

A Host Adapter performs developer-confirmed fetch, branch, worktree, handoff, and ordinary repository
work and submits semantic results. Core derives the surface from Git, observes read-only, performs no
Git mutation, and exposes no generic shell.

Linked worktrees share `SourceRepositoryGroupDigest`, while canonical root plus the worktree-specific
Git directory gives every instance a distinct `WorktreeInstanceDigest`. Store claims the latter, so
different worktrees in one group may each run a Task while one instance holds only one active Task.

## Runtime structure

```text
cmd/dev-flow
    ├── internal/mcp
    └── internal/webui ── embedded React assets
    ↓
internal/application
    ├── internal/workflow
    ├── internal/recovery
    ├── internal/repository
    └── internal/store
            ↓
        local SQLite
```

Store implements one current SQLite Schema and strict snapshot. Any non-current Schema returns generic
`SCHEMA_UNSUPPORTED`. Bilingual display preference exists only in frontend local site storage and does
not enter Core or Task state. Operating-system process, receipt, and signal behavior lives in `darwin`
and `windows` build-tag files; Domain, Workflow, Application, and Recovery contain no platform decision.

`domain/completion.go` validates the complete work-item set and acceptance references to current checks. WebUI and MCP share Application semantic submission and retained-operation recovery; WebUI detail exposes `pending_action_id` so recovery survives reopening the page.

## Targeted validation

Prefer package-specific tests for a local change:

```bash
go test ./internal/workflow
go test ./internal/recovery
go test ./internal/store
go test ./internal/mcp
go test ./internal/webui
```

Cross-component interface checks and end-to-end tests live under `tests/contract/` and `tests/journeys/`. Run
full repository validation only when the active Task or final checkpoint authorizes it:

```bash
pnpm run validate
```

Source code, machine-readable schemas, and executable tests define current behavior.

## Windows Git processes

Windows 10/11 x64 targets ordinary desktop PCs with Intel or AMD 64-bit processors. The three Node packages implement paths, permissions, commands and cleanup separately in `lib/platform/windows/` and `lib/platform/macos/`; selection entry points only dispatch to the current platform. Core keeps shared platform-neutral task semantics, while Windows Git processes hide console windows. Codex `--version` and `status` use the selected executable-file policy, and Windows PowerShell launchers output UTF-8. This change was tested only on native Windows; Windows 10, AMD hardware and macOS were not tested, and stable support claims remain unchanged. See the [Windows adaptation report](../docs/WINDOWS-ADAPTATION_en.md).
