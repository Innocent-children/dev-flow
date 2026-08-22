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

New Product, shared-contract, persistence, and Host Adapter changes follow
`docs/SPEC-KIT-WORKFLOW.md`. Version releases use the standalone release contract and do not create a
Feature.

## Feature Registry

| Feature | Type | Status | Product Role |
| --- | --- | --- | --- |
| `001-bootstrap-monorepo` | Product foundation | Historical | Root project, module/workspace, governance, bounded CI |
| `002-govern-and-resume-single-repository-task` | Product Feature | Historical | released linear Core contract, SQLite, six MCP tools, released linear workflow |
| `003-codex-explicit-dev-flow` | Host Product Feature | Historical | Explicit Codex Plugin/Skill/MCP product and native acceptance |
| `004-deepseek-explicit-dev-flow` | Host Product Feature | Superseded | Historical released linear contract DeepSeek planning; implementation authority moved to Feature 010 |
| `005-recover-uncertain-actions-and-drift` | Product Feature | Historical | Read-before-retry and repository-drift recovery hardening |
| `006-publish-codex-installable-product` | Release Feature | Historical | Deterministic/public Codex release machinery and first release evidence |
| `007-close-open-task-contract` | Corrective/Product Feature | Historical | Complete open-task contract and published `0.3.0` evidence |
| `008-refactor-to-development-process-graph` | Product Feature | Complete | Development process graph, composite source-local acceptance, final validation, and zero-gap convergence complete; publication remains separate |
| `009-publish-codex-0.4.0` | Release Change | Complete | Published and verified Feature 008 graph as Codex `0.4.0` with one-command and frozen-source recovery evidence |
| `010-deepseek-explicit-graph-host` | Host Product Feature | Complete | Source-local DeepSeek implementation and exact-artifact native acceptance complete; no public support or release authority |
| `011-simplify-product-version-governance` | Product Feature | Complete | Three independent product versions, current-only internal contracts, and Codex/Core release identity separation |

## Current Source Authority

`0.3.0`, `0.4.0`, and Features 001–009 remain historical truth. Feature 008 is the approved product
specification for the current graph; Feature 009 is historical `0.4.0` release evidence. The current
published Codex product is `0.5.0`. Feature 010 is the completed DeepSeek source implementation
authority and does not itself authorize a public DeepSeek version or release. Feature 011 governs
the independent Core/Codex/DeepSeek authorities and removal of internal versions. Current version
releases are governed by `.specify/memory/constitution.md`, `AGENTS.md`, `release/`, and the
standalone release command. The source authority is distributed as follows:

| Responsibility | Authority |
| --- | --- |
| `standard-development` nodes, 29 edges, guards and digest | `internal/workflow/standard_process.go`, `internal/workflow/definitions.go` |
| ProcessTask, TaskIntent and revisioned baselines | `internal/domain/task.go`, `internal/domain/baselines.go` |
| Current SQLite bootstrap, strict snapshot codec and Store preflight | `internal/store/migrations.go`, `internal/store/codec.go`, `internal/store/sqlite.go` |
| Five-class graph Recovery and blocker reconciliation | `internal/recovery/`, `internal/application/` |
| current Core contract six-tool schemas and projections | `internal/mcp/` |
| Explicit Codex Adapter and current Skill | `packages/codex/plugin/skills/dev-flow/SKILL.md` |
| Method-profile rendering reference | `packages/codex/plugin/skills/dev-flow/references/method-profiles.md` |
| Schema-bound Codex node-payload construction reference | `packages/codex/plugin/skills/dev-flow/references/node-payloads.md` |
| Historical/current/Host parity/Recovery fixtures | `protocol/fixtures/` |
| Deterministic contract and Journey evidence | `tests/contract/`, `tests/journeys/` |
| Feature scope, contracts and checkpoints | `specs/008-refactor-to-development-process-graph/` |
| Current manifest and publication contract | `release/`, `scripts/release-codex.mjs` |
| Historical `0.4.0` identity and release evidence | `specs/009-publish-codex-0.4.0/` |
| Completed DeepSeek source implementation scope and contracts | `specs/010-deepseek-explicit-graph-host/` |
| Current product version governance and release identity | `specs/011-simplify-product-version-governance/`, `docs/VERSIONING.md` |
| Current product support claims | `docs/SUPPORT-MATRIX.md` |

Current source supports only fresh current SQLite format `standard-development` tasks. It contains no
historical-task runtime, migration, legacy snapshot decoder or legacy process. Feature 008 completed
source-local acceptance by combining Attempt 3 native graph-flow evidence with no-Codex deterministic
lifecycle evidence bound to the same exact unpublished artifact. Final repository validation and
zero-gap analyze/converge passed.

Version alignment, npm publication, Tag creation, GitHub Release mutation, official artifact
construction and a final public installation claim require the selected standalone release mode and
exact command confirmation. Feature 009 records the completed `0.4.0` publication; the current
Codex `0.5.0` public identities are independent of Feature 010.

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
