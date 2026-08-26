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
| `application` | Open/read/apply/cancel use cases and component coordination |
| `store` | SQLite bootstrap, strict snapshot, CAS, events, claims, and read-only preflight |
| `repository` | Canonical repository identity and bounded read-only Git observation |
| `recovery` | Five-class reconciliation, retry advice, blockers, and resume |
| `mcp` | Six-tool local STDIO contract, closed schemas, and Result Envelope |
| `webui` | Loopback HTTP adapter, embedded assets, session protection, shared runtime receipt, and lifecycle |
| `version` | Core product version from `CORE_VERSION` or build injection |

## Authority boundary

Core alone owns:

- Task identity, immutable intent, and method profile;
- process definition/digest, current node, resume node, and legal transitions;
- requirements/design/task-plan baselines and their invalidation;
- repository claim, revision CAS, current action, and evidence;
- Recovery classification, blocker, and terminal outcome.

A Host Adapter performs user-authorized repository work and submits the result. Core observes Git
read-only, performs no Git mutation, and exposes no generic shell.

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

Store accepts only the current SQLite Schema and strict snapshot. Incompatible or pre-graph data returns
`SCHEMA_UNSUPPORTED` before write capability is exposed, with zero writes. `dev-flow webui reset` uses a target-bound
plan and exclusive database access to clean only confirmed Task database/sidecars. The browser has no reset mutation.
Bilingual display preference exists only in frontend local site storage and does not enter Core or Task state.

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
