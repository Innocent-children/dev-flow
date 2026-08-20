# Dev Flow Governance and Spec Kit Manifest

This file indexes governance assets and Feature packages. It is not a source allowlist, npm package
manifest, release manifest, or proof that every listed capability is currently published.

## Governance Authority

Read governance in this order:

1. `.specify/memory/constitution.md`
2. `docs/SPEC-KIT-WORKFLOW.md`
3. `AGENTS.md`
4. the active Feature's `README.md`, `spec.md`, `plan.md`, `contracts/`, and `tasks.md`

The repository contains one root `.specify/` project. Completed historical Feature packages are
frozen delivery evidence and are not bulk-rewritten when templates change.

## Spec Kit Templates

```text
.specify/templates/
├── constitution-template.md
├── feature-readme-template.md
├── spec-template.md
├── plan-template.md
├── checklist-template.md
└── tasks-template.md
```

New Product, shared-contract, persistence, Host Adapter, and Release changes follow
`docs/SPEC-KIT-WORKFLOW.md`.

## Feature Registry

| Feature | Type | Status | Product Role |
| --- | --- | --- | --- |
| `001-bootstrap-monorepo` | Product foundation | Historical | Root project, module/workspace, governance, bounded CI |
| `002-govern-and-resume-single-repository-task` | Product Feature | Historical | Core Contract 0.1, SQLite, six MCP tools, released linear workflow |
| `003-codex-explicit-dev-flow` | Host Product Feature | Historical | Explicit Codex Plugin/Skill/MCP product and native acceptance |
| `004-deepseek-explicit-dev-flow` | Host Product Feature | Deferred | Future DeepSeek product; not current support |
| `005-recover-uncertain-actions-and-drift` | Product Feature | Historical | Read-before-retry and repository-drift recovery hardening |
| `006-publish-codex-installable-product` | Release Feature | Historical | Deterministic/public Codex release machinery and first release evidence |
| `007-close-open-task-contract` | Corrective/Product Feature | Historical | Complete open-task contract and published `0.3.0` evidence |
| `008-refactor-to-development-process-graph` | Product Feature | Complete | Development process graph, composite source-local acceptance, final validation, and zero-gap convergence complete; publication remains separate |
| `009-publish-codex-0.4.0` | Release Change | Implementing | Align current identity, add one-command publication, and release the Feature 008 graph as Codex `0.4.0` |

## Current Source Authority

`0.3.0` and Features 001–007 remain historical truth. Feature 008 is the approved product
specification for the current graph; Feature 009 is the release authority for current version
`0.4.0`. The source authority is distributed as follows:

| Responsibility | Authority |
| --- | --- |
| `standard-development@1` nodes, 29 edges, guards and digest | `internal/workflow/standard_process.go`, `internal/workflow/definitions.go` |
| ProcessTask, TaskIntent and versioned baselines | `internal/domain/task_v2.go`, `internal/domain/baselines.go` |
| Schema 2 bootstrap, strict snapshot-v2 codec and Store preflight | `internal/store/migrations.go`, `internal/store/codec.go`, `internal/store/sqlite.go` |
| Five-class graph Recovery and blocker reconciliation | `internal/recovery/`, `internal/application/` |
| Core Contract 0.2 six-tool schemas and projections | `internal/mcp/` |
| Explicit Codex Adapter and current Skill | `packages/codex/plugin/skills/dev-flow/SKILL.md` |
| Method-profile rendering reference | `packages/codex/plugin/skills/dev-flow/references/method-profiles.md` |
| Schema-bound Codex node-payload construction reference | `packages/codex/plugin/skills/dev-flow/references/node-payloads.md` |
| Historical/current/Host parity/Recovery fixtures | `protocol/fixtures/` |
| Deterministic contract and Journey evidence | `tests/contract/`, `tests/journeys/` |
| Feature scope, contracts and checkpoints | `specs/008-refactor-to-development-process-graph/` |
| `0.4.0` identity, manifest and publication contract | `specs/009-publish-codex-0.4.0/` |

Current source supports only fresh Schema 2 `standard-development@1` tasks. It contains no
historical-task runtime, migration, snapshot-v1 decoder or legacy process. Feature 008 completed
source-local acceptance by combining Attempt 3 native graph-flow evidence with no-Codex deterministic
lifecycle evidence bound to the same exact unpublished artifact. Final repository validation and
zero-gap analyze/converge passed.

Feature 009 authorizes version alignment, npm publication, Tag creation, GitHub Release mutation,
official artifact construction and the final macOS arm64 Codex installation claim. Its exact
publication evidence is recorded only after the production one-command release completes.

## Repository Boundaries

| Area | Paths |
| --- | --- |
| Governance | `.specify/memory/`, `.specify/templates/`, `AGENTS.md`, `docs/SPEC-KIT-WORKFLOW.md` |
| Feature evidence | `specs/` |
| Core | `cmd/dev-flow/`, `internal/domain/`, `internal/workflow/`, `internal/recovery/`, `internal/repository/`, `internal/store/`, `internal/application/`, `internal/mcp/` |
| Shared protocol fixtures | `protocol/fixtures/` |
| Host products | `packages/codex/`, `packages/deepseek/` |
| Contract and journey tests | `tests/contract/`, `tests/journeys/` |
| Maintainer release tooling | `release/`, `scripts/` |

## Feature Package Standard

Every new complete Feature package contains:

```text
specs/<NNN-feature-name>/
├── README.md
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
├── checklists/requirements.md
└── tasks.md
```

A file may state `N/A` with a reason, but it must not be silently omitted.
