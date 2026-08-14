# Implementation Plan: Govern and Resume a Single-Repository Task

**Branch**: `002-govern-and-resume-single-repository-task` | **Date**: 2026-08-14 |
**Spec**: `specs/002-govern-and-resume-single-repository-task/spec.md`

**Input**: Feature specification from
`/specs/002-govern-and-resume-single-repository-task/spec.md`

## Summary

Implement the host-independent Dev Flow Core as one Go binary with one normal state machine, one
SQLite database, one read-only Git observer, one application service, and exactly six STDIO MCP
tools. The Core persists immutable task contracts, stage actions, repository claims, evidence
summaries, revisions, blockers, and terminal outcomes. It supports restart resume and conservative
read-before-retry recovery without executing development commands or mutating Git.

## Technical Context

**Language/Version**: Go `>=1.26` with `go 1.26` as the language floor; CI uses the current stable Go toolchain.

**Primary Dependencies**:

- Phase 1–2: `modernc.org/sqlite` latest stable compatible v1 release;
- Phase 7, when MCP is actually implemented: `github.com/modelcontextprotocol/go-sdk` latest stable
  compatible v1 release, minimum v1.7.0;
- Go standard library.

The actual resolved versions are recorded in `go.mod` and `go.sum`; no runtime or test performs exact dependency-version equality checks.
The MCP SDK is not pinned early through a blank import, `tools.go`, or placeholder code. The complete
Feature 002 remains limited to these two direct production dependencies.

No CLI framework, state-machine framework, ORM, dependency injection framework, event bus, logging
framework, or JSON-schema framework is added.

**Storage**: One local SQLite database through `database/sql` and the CGo-free modernc driver.

**Testing**: Go unit tests, SQLite integration tests with temporary directories, Git observation
tests with temporary repositories, MCP contract tests, and one process-restart journey.

**Target Platform**: Core development and first evidence on macOS arm64; Linux CI for portable
tests. No Windows release claim.

**Project Type**: Local CLI/MCP server embedded later by two host packages.

**Performance Goals**:

- result payloads, Git command output, persisted aggregates, and time-bound external operations stay
  within Core Limits 0.1;
- this feature defines no hard latency acceptance gate; timing may be observed diagnostically but
  does not authorize benchmarks or timing-sensitive tests.

**Constraints**:

- STDIO only;
- no network;
- no CGo;
- no Git mutation;
- no shell/test execution;
- one repository per task;
- one active claim per canonical repository;
- exactly six MCP tools;
- one current-state authority;
- no data import/export or alternate task model.

**Scale/Scope**: Personal local use; tens to low hundreds of retained tasks; one active task per
repository; no daemon or concurrent background worker.

**Phase 1–2 Checkpoint**: Implement the package skeleton, closed Domain and Workflow, minimal Store
and RepositoryObserver ports, SQLite Schema 1/CAS foundations, and the read-only Git observer. Do
not implement Application use cases, recovery behavior, MCP, host products, installation, or
publication at this checkpoint.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Result | Evidence |
|---|---|---|
| I. Self-Contained Product Scope | PASS | Every component and test maps to the current Core specification |
| II. Single Workflow Authority | PASS | Application and Workflow Core are the sole state authority |
| III. One State Machine, Bounded Surface | PASS | 8 normal states, 2 exceptional states, exactly 6 tools |
| IV. Thin Host Adapters | PASS | Host products are outside this feature |
| V. Recovery Before Retry | PASS | Revision/action binding and five recovery classifications |
| VI. Read-Only Repository Boundary | PASS | Observer executes only bounded read commands |
| VII. Evidence-Bounded Testing | PASS | Core-local contract and integration journey only |
| VIII. Proven Simplicity | PASS | Two direct dependencies and no frameworks |
| IX. Vertical-Slice Specifications | PASS | Complete create→advance→restart→resume→done journey |
| X. Two-Host Contract Parity | PASS | Shared protocol fixtures are feature outputs |

Post-design re-check: PASS. The Store and RepositoryObserver interfaces are the two explicitly
permitted infrastructure ports. No additional abstraction is introduced.

## Project Structure

### Documentation (this feature)

```text
specs/002-govern-and-resume-single-repository-task/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── mcp-tools.md
│   ├── result-envelope.schema.json
│   └── state-machine.md
├── checklists/
│   └── requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
cmd/
└── dev-flow/
    ├── main.go
    └── main_test.go

internal/
├── domain/
│   ├── action.go
│   ├── blocker.go
│   ├── contract.go
│   ├── errors.go
│   ├── evidence.go
│   ├── outcome.go
│   ├── repository.go
│   ├── task.go
│   ├── validation.go
│   └── *_test.go
├── workflow/
│   ├── engine.go
│   ├── transitions.go
│   └── *_test.go
├── recovery/
│   ├── classify.go
│   ├── reconcile.go
│   └── *_test.go
├── repository/
│   ├── git_observer.go
│   ├── fingerprint.go
│   ├── paths.go
│   └── *_test.go
├── store/
│   ├── store.go
│   ├── sqlite.go
│   ├── migrations.go
│   ├── codec.go
│   └── *_test.go
├── application/
│   ├── service.go
│   ├── open_task.go
│   ├── get_task.go
│   ├── next_action.go
│   ├── apply_action.go
│   ├── cancel_task.go
│   └── *_test.go
└── mcp/
    ├── server.go
    ├── tools.go
    ├── schemas.go
    ├── results.go
    ├── logging.go
    └── *_test.go

protocol/
└── fixtures/
    ├── server-info.json
    ├── open-task.json
    ├── task.json
    ├── next-action.json
    ├── apply-success.json
    └── domain-error.json

tests/
├── contract/
│   ├── mcp_contract_test.go
│   └── fixture_contract_test.go
└── journeys/
    └── core_restart_test.go
```

**Structure Decision**: Domain, workflow, and recovery are independent of MCP and SQLite. The
application service coordinates two minimal infrastructure ports. The MCP adapter and CLI share
the same application service. Public fixtures live outside implementation packages so both future
host products can consume them.

## Complexity Tracking

No Constitution violation requires an exception.
