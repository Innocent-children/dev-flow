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
| `008-refactor-to-development-process-graph` | Product Feature | Planned | Replace new-task linear workflow with developer-visible process graph |

## Current Product Transition

`0.3.0` and Features 001–007 remain historical truth. Feature 008 is the only approved specification
for changing new-task workflow semantics from Core Contract 0.1 to the development-process graph.

Until Feature 008 completes:

- existing runtime behavior remains Core Contract 0.1;
- no new capability may be added to the released linear workflow;
- Feature 008 does not carry that workflow or its task data into the graph runtime;
- no implementation may infer the Feature 008 graph from this manifest alone;
- Feature 008 must pass clarify/checklist/analyze before production code changes.

Feature 008 is not release authority. Version alignment, npm publication, Tag creation, GitHub
Release mutation, and final distributed-artifact support claims require a later Release Change.

## Repository Boundaries

| Area | Paths |
| --- | --- |
| Governance | `.specify/memory/`, `.specify/templates/`, `AGENTS.md`, `docs/SPEC-KIT-WORKFLOW.md` |
| Feature evidence | `specs/` |
| Core | `cmd/dev-flow/`, `internal/`, `protocol/fixtures/` |
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
