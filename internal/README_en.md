# Shared Go Core

[中文](README.md) | [English](README_en.md)

`internal/` contains the Host-independent Dev Flow Go Core. It manages Tasks, the state graph, MCP,
SQLite, Recovery, and read-only Git observation. Codex and DeepSeek packages use the same Core to
provide consistent process behavior.

## Package ownership

| Package | Responsibility |
| --- | --- |
| `domain` | `ProcessTask`, TaskIntent, baselines, records, evidence, outcome, and limits |
| `workflow` | `standard-development`, node contracts, 29 transitions, payloads, and invalidation |
| `application` | Open/read/submit/recover/cancel use cases and component coordination |
| `store` | SQLite bootstrap, strict snapshot, CAS, events, claims, and read-only preflight |
| `repository` | Canonical repository identity and bounded read-only Git observation |
| `recovery` | Five-class reconciliation, retry advice, blockers, and resume |
| `mcp` | Fifteen-tool local STDIO contract, Action-kind-specific submission schemas, and Result Envelope |
| `webui` | Loopback HTTP adapter, embedded assets, session protection, shared runtime receipt, and lifecycle |
| `version` | Core product version from `CORE_VERSION` or build injection |

## Authority boundary

Core alone owns:

- Task identity, immutable intent, and method profile;
- process definition/digest, current node, resume node, and legal transitions;
- requirements/design/task-plan baselines and their invalidation;
- repository claim keyed by physical worktree identity, revision CAS, current action, and evidence;
- Recovery classification, blocker, and terminal outcome.

A Host Adapter performs user-authorized repository work and submits the result. Core observes Git
read-only, performs no Git mutation, and exposes no generic shell.

Linked worktrees share `GitCommonDirDigest` as the logical repository group projected by Control
Center, but each has a `RepositoryIdentity` that includes its canonical root. Store claims only the
latter exclusively, so different worktrees in one group may each run a Task while one worktree still
holds only one active Task.

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

## Targeted validation

Prefer package-specific tests for a local change:

```bash
go test ./internal/workflow
go test ./internal/recovery
go test ./internal/store
go test ./internal/mcp
go test ./internal/webui
```

Cross-layer contract and journey checks live under `tests/contract/` and `tests/journeys/`. Run
full repository validation only when the active Task or final checkpoint authorizes it:

```bash
pnpm run validate
```

Source code, machine-readable schemas, and executable tests define current behavior.
