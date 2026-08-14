<!--
Sync Impact Report
- Version change: template/unratified → 1.0.0
- Added principles:
  - I. Self-Contained Product Scope
  - II. Single Workflow Authority
  - III. One State Machine, Bounded Surface
  - IV. Thin Host Adapters
  - V. Recovery Before Retry
  - VI. Read-Only Repository Boundary
  - VII. Evidence-Bounded Testing
  - VIII. Proven Simplicity
  - IX. Vertical-Slice Specifications
  - X. Two-Host Contract Parity
- Added sections:
  - Product and Technology Constraints
  - Development Workflow and Quality Gates
- Removed sections: none
- Deferred items: none
-->
# Dev Flow Constitution

## Core Principles

### I. Self-Contained Product Scope

Specifications, plans, tasks, tests, and documentation MUST describe the current product through
repository-visible behavior and observable acceptance criteria. Background context that does not
change implementation, interfaces, persisted data, verification, or release behavior MUST NOT
create requirements, scripts, tests, or CI gates. Every implementation task MUST trace to an active
requirement or an approved engineering constraint.

Rationale: product artifacts should tell contributors what the system is and what must be proven,
without turning unrelated context into permanent maintenance work.

### II. Single Workflow Authority

The Go core MUST be the sole authority for task state, workflow transitions, next-action selection,
repository claims, recovery classification, and terminal outcomes. MCP, CLI, Codex, and DeepSeek
surfaces are adapters over that authority. No adapter, Skill, proxy, package script, or host prompt
may independently define or persist workflow truth.

Rationale: two authorities inevitably drift and make recovery unsafe.

### III. One State Machine, Bounded Surface

The product MUST have one normal workflow shared by all task types. Task differences MUST be
expressed through contracts, obligations, and verification budgets rather than parallel state
machines. Before product version 1.0:

- normal workflow states MUST NOT exceed eight, excluding `BLOCKED` and `CANCELLED`;
- public MCP tools MUST NOT exceed six without a Constitution amendment;
- the core MUST expose one task representation and one result envelope;
- a second workflow catalog, user-defined workflow DSL, or hidden fast path is prohibited.

Rationale: parallel workflow families multiply transition, recovery, verification, and
compatibility paths without necessarily adding user value.

### IV. Thin Host Adapters

`dev-flow-codex` and `dev-flow-deepseek` MUST contain only host registration, invocation guidance,
required result projection, lifecycle glue, and package-specific verification. They MUST NOT
contain task persistence, transition rules, completion rules, repository claim logic, or recovery
decisions. Host UX may differ; product semantics MUST not.

Rationale: host differences belong at the edge, while workflow behavior belongs in the shared core.

### V. Recovery Before Retry

Every mutation MUST carry a revision and action identity. When a mutation response is missing,
cancelled, truncated, or uncertain, the caller MUST read the authoritative task and observe the
repository before deciding whether another mutation is safe. Blind mutation replay is prohibited.
Recovery MUST classify reality as one of:

- `not_started`;
- `completed_and_recorded`;
- `completed_but_unrecorded`;
- `partially_completed`;
- `conflicting`.

Rationale: resumability is a product capability only when it prevents duplicate or contradictory
side effects.

### VI. Read-Only Repository Boundary

The core MAY inspect an existing Git repository and calculate a bounded fingerprint. It MUST NOT
create, switch, repair, reset, clean, stash, commit, merge, rebase, push, tag, publish, or delete Git
state. The core MUST NOT expose a generic shell tool. Host agents perform authorized development
work with their normal tools outside the MCP authority.

Rationale: Dev Flow governs the development process; it does not replace Git or become an ambient
execution engine.

### VII. Evidence-Bounded Testing

Every task MUST carry a verification budget. Automated checks MUST be directly connected to the
active specification, changed surface, or recovery risk. A full suite, platform matrix, stress test,
fuzz test, or real-host journey requires an explicit requirement or release gate. Fake, simulated,
static, and user-performed evidence MUST be labeled accurately and MUST NOT be promoted into
stronger evidence.

Rationale: excessive testing is a cost and can obscure product value just as much as insufficient
testing.

### VIII. Proven Simplicity

New abstraction or configuration requires demonstrated need:

- no generic interface before two real implementations require it, except the minimal storage and
  repository-observation ports needed to isolate infrastructure;
- no configurable policy before three real tasks demonstrate the same variation;
- no new recovery branch before a concrete failure or accepted threat model requires it;
- no direct production dependency unless standard-library implementation is unreasonable and the
  dependency removes more complexity than it introduces;
- no public feature may be added “for future hosts” or “for future workflows.”

Any violation MUST be documented in the plan's Complexity Tracking table and approved before
implementation.

Rationale: simplicity is an enforceable budget, not an aesthetic preference.

### IX. Vertical-Slice Specifications

Each feature specification MUST be self-contained and produce one independently demonstrable
capability. It MUST include explicit non-goals, measurable success criteria, and a bounded test plan.
A feature MUST NOT combine core architecture, both host integrations, release infrastructure, and
future extensibility unless the user journey itself requires all of them. Implementation MUST
proceed one task phase or one user story at a time and stop at each checkpoint.

Rationale: small vertical slices expose product mistakes before they become architecture.

### X. Two-Host Contract Parity

Any change to public task semantics, MCP schemas, error codes, result envelopes, or state
transitions MUST be validated against both Codex and DeepSeek contract fixtures before merge.
Host-specific features may be released independently only when they do not alter shared semantics.
An adapter MUST NOT patch around a core contract mismatch.

Rationale: the Monorepo exists to maintain one product across two hosts, not merely colocate two
projects.

## Product and Technology Constraints

- The core implementation language is Go.
- The first persistent store is one local SQLite database accessed through a CGo-free driver.
- The first transport is local STDIO MCP only.
- The first product journey supports one existing Git repository and one active task per canonical
  repository root.
- The two distributable products are `dev-flow-codex` and `dev-flow-deepseek`.
- Spec Kit is a repository development tool only; it MUST NOT become a runtime dependency or a
  user-facing Dev Flow feature. Repository setup and updates use the latest stable Spec Kit release.
- Development tools and third-party libraries MUST be governed by minimum versions or compatible
  major-version ranges. Exact resolved versions belong in lockfiles and release evidence, not in
  compatibility rejection rules.
- The repository contains one root `.specify/` project and one Constitution.
- Before the first stable release, the project MUST NOT implement data import/export,
  multi-repository tasks, cross-host automatic takeover, Web UI, remote MCP, authentication,
  telemetry, agent orchestration, Git mutation, or a plugin framework.
- Product version, package versions, embedded core version, and Git release tag MUST remain aligned
  during the `0.x` line unless a later approved specification defines decoupling.

## Development Workflow and Quality Gates

Every production feature follows:

1. `specify`
2. `clarify`
3. `plan`
4. `checklist`
5. `tasks`
6. `analyze`
7. staged `implement`
8. `converge`

A prepared feature package may start at `clarify`; existing artifacts MUST NOT be regenerated
without an explicit amendment decision.

Before implementation:

- all requirement checklist items must be reviewed;
- no unresolved clarification marker may remain;
- the Constitution Check must pass before and after design;
- every task must name exact files or directories;
- tasks must be grouped into independently testable user-story phases.

Before merge:

- required targeted tests pass;
- public contract fixtures pass;
- no unauthorized scope appears in the diff;
- documentation reflects the delivered behavior;
- unsupported platforms and unverified host journeys remain explicitly unverified;
- `$speckit-converge` finds no acceptance-criteria gap, or appends a bounded remaining task.

Before release:

- both product packages are built from one source identity;
- each claimed host journey is exercised in the real host;
- package contents and bundled core identity are verified;
- no release side effect occurs from an ordinary pull-request workflow.

## Governance

This Constitution supersedes conflicting plans, tasks, prompts, conventions, and implementation
preferences.

- **Authority**: Principles I–X are binding gates. A conflicting specification, plan, or task MUST
  be changed; the Constitution MUST NOT be weakened merely to unblock implementation.
- **Amendments**: An amendment requires a dedicated documentation change with rationale, impact on
  active specs, data implications, and explicit maintainer approval.
- **Versioning**: Constitution versions follow SemVer. MAJOR removes or redefines a binding
  principle; MINOR adds a principle or materially expands governance; PATCH clarifies without
  changing meaning.
- **Compliance review**: Every feature plan MUST include a Constitution Check. Every review MUST
  call out any complexity-budget exception. Unjustified exceptions block merge.
- **Specification locality**: Requirements and tasks MUST be justified by the current repository
  artifacts and observable acceptance criteria. Unrecorded assumptions do not authorize product
  work.

**Version**: 1.0.0 | **Ratified**: 2026-08-14 | **Last Amended**: 2026-08-14
