<!--
Sync Impact Report
- Version change: unversioned template -> 1.0.0
- Added principles:
  - I. Go Core Single Authority
  - II. Hosts and Methods Are Adapters
  - III. Read-only Core, Authorized Host Mutations
  - IV. Incremental Architecture and Bounded Scope
  - V. Optional External Code Indexes
  - VI. Acceptance-bound Verification
  - VII. Product Features and Releases Are Separate
  - VIII. Specification Before Contractual Change
- Added sections: Engineering and Delivery Gates
- Removed sections: unresolved template placeholders
- Follow-up TODOs: none
-->
# Dev Flow Constitution

## Core Principles

### I. Go Core Single Authority

Go Core MUST be the sole authority for Task identity, process and state graph definitions, current
and resume nodes, Action identity and contract, revision, repository claim, Recovery classification,
Blocker, legal transitions, and terminal Outcome. These facts MUST be persisted and validated once
under Core ownership; no component MAY maintain a competing process cursor or authority.

### II. Hosts and Methods Are Adapters

Codex, DeepSeek, Spec Kit, OpenSpec, and code-indexing tools MUST remain execution methods or
assistive adapters. They MUST consume Core-returned actions and transitions, MUST NOT copy Core
state, and MUST NOT infer completion, destinations, Recovery results, blockers, or outcomes. Only a
valid Core action submission MAY advance a Task.

### III. Read-only Core, Authorized Host Mutations

Core MUST limit Git access to bounded, read-only observation needed for repository identity,
binding, and change facts. Core MUST NOT expose a generic shell or mutate Git state. Repository and
Git mutations MUST be performed by a Host within explicit user authorization and the current
Action's allowed effects.

### IV. Incremental Architecture and Bounded Scope

New functionality MUST extend the existing Core, adapter, contract, and storage boundaries with the
smallest direct change that satisfies approved requirements. Work MUST NOT include unrelated
refactoring or introduce frameworks, registries, DSLs, provider systems, or a second state machine
for speculative future needs. Any multi-repository capability MUST be authorized by an explicit,
bounded Product Feature before implementation. Reuse and readable direct code SHOULD be preferred
over new abstractions.

### V. Optional External Code Indexes

External code-indexing capabilities, including codebase-memory, MUST remain optional and MUST NOT be
installed automatically. When an index is unavailable, stale, incomplete, or fails, the Host MUST
report that limitation honestly and fall back to its built-in file and text search. Product behavior,
builds, tests, and workflow progression MUST NOT depend on an external index.

### VI. Acceptance-bound Verification

Every test or verification command MUST trace directly to an acceptance requirement, contract, or
documented regression. Targeted package-, contract-, storage-, or user-story-level checks SHOULD run
first. Work MUST NOT expand by default into a full regression matrix, stress testing, platform
matrix, speculative edge cases, or repeated real-Host Journeys; broader validation requires an
explicit Feature test budget or release contract. TDD MAY be used but MUST NOT be required.

### VII. Product Features and Releases Are Separate

Product Feature work MUST define, implement, and verify behavior without changing public product
versions or performing publication. A Product Feature MUST NOT publish npm packages, create or move
Git Tags, create or complete GitHub Releases, or make public release claims. Version alignment and
publication MUST use the standalone release contracts only after the relevant product work is
complete and the user has explicitly authorized the release.

### VIII. Specification Before Contractual Change

Changes to public contracts, persistence semantics, process behavior, or Host behavior MUST begin
with a bounded Spec Kit Product Feature before implementation. The Feature MUST define authorized
requirements and acceptance criteria, explicit non-goals, complete affected boundaries, exact old
data disposition, and a finite test budget. Its implementation tasks MUST trace to those requirements
or contracts and name the exact affected paths.

## Engineering and Delivery Gates

- Implementation MUST follow the active Feature selected by the repository's explicit selector;
  branch names, chat history, and nearby abstractions MUST NOT expand its authority.
- Product behavior MUST remain in executable code, closed machine-readable contracts, and tests;
  Feature documents and external tools MUST NOT become runtime, build, persistence, or release input.
- Material requirement or contract changes discovered during implementation MUST return to the
  specification workflow before code scope expands.
- Validation evidence MUST state which approved checks ran, which were unavailable, and which were
  intentionally outside the agreed test budget.

## Governance

This Constitution governs project-wide architecture and delivery practice. Feature specifications,
plans, tasks, implementation, and release work MUST demonstrate compliance at their relevant review
gate. A conflict MUST be resolved by amending the lower-authority artifact or this Constitution
before implementation continues; exceptions require an explicit constitutional amendment.

Amendments MUST include the changed rules, rationale, migration or compatibility impact when
applicable, approval by the project maintainer, and an updated Sync Impact Report. Versioning follows
semantic versioning: MAJOR for incompatible governance changes or principle removals, MINOR for new
principles or materially expanded obligations, and PATCH for non-semantic clarification. Compliance
SHOULD be reviewed when a Feature becomes ready, at each implementation checkpoint, and before any
release authorization.

**Version**: 1.0.0 | **Ratified**: 2026-08-23 | **Last Amended**: 2026-08-23
