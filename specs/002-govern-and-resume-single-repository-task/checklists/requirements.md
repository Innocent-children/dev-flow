# Requirements Quality Checklist: Govern and Resume a Single-Repository Task

**Purpose**: Verify that the Core workflow, persistence, repository, recovery, and MCP requirements
are complete, bounded, and free of duplicate workflow authority.

**Created**: 2026-08-14

**Feature**: `../spec.md`

**Review Ownership**: Reviewer-owned requirements artifact. `[x]` means requirements quality is
satisfied, not that code exists.

## Product Boundary

- [ ] CHK001 The Core is clearly separated from Codex and DeepSeek package work.
- [ ] CHK002 The task model, transition table, and result envelope each have one authoritative definition.
- [ ] CHK003 Git mutation, shell execution, test execution, networking, and host setup are excluded.
- [ ] CHK004 Single-repository and single-active-task limits are explicit.
- [ ] CHK005 Contract revision and cross-host handoff are explicitly deferred.

## Workflow

- [ ] CHK006 The normal and exceptional state sets are closed.
- [ ] CHK007 Every forward transition has a defined action.
- [ ] CHK008 Every rework transition is explicit and requires a reason.
- [ ] CHK009 There is no second task-type or fast-path state machine.
- [ ] CHK010 Terminal behavior and claim release are unambiguous.
- [ ] CHK011 Blocker creation and resolution are testable.

## Contract and Evidence

- [ ] CHK012 Task contract fields and bounds are specified.
- [ ] CHK013 Verification budget behavior is specified for automatic, full-suite, and manual checks.
- [ ] CHK014 Evidence source classes cannot be confused.
- [ ] CHK015 Evidence storage excludes arbitrary command output and source content.
- [ ] CHK016 Final outcome content is measurable.
- [ ] CHK017 Public payloads reject unknown fields.

## Persistence and Concurrency

- [ ] CHK018 Current snapshot authority versus event audit role is clear.
- [ ] CHK019 Repository claim and task mutation transaction boundaries are explicit.
- [ ] CHK020 Revision and action conflicts have no partial-write ambiguity.
- [ ] CHK021 Unsupported future schema behavior is safe.
- [ ] CHK022 Multi-process races have deterministic acceptance criteria.
- [ ] CHK023 SQLite dependency is CGo-free and bounded.

## Recovery

- [ ] CHK024 All five recovery classifications have observable definitions.
- [ ] CHK025 Lost response handling requires read-before-retry.
- [ ] CHK026 Repository drift is checked at action apply.
- [ ] CHK027 Partial and conflicting cases lead to a concrete blocker.
- [ ] CHK028 Recovery cannot mutate Git.
- [ ] CHK029 The last-operation record is sufficient without becoming event sourcing.

## MCP

- [ ] CHK030 Exactly six tools are named and justified.
- [ ] CHK031 Tool schemas and one result envelope are the sole public contract.
- [ ] CHK032 STDIO-only behavior is explicit.
- [ ] CHK033 Stable domain errors are separated from internal errors.
- [ ] CHK034 Logs and diagnostics exclude sensitive content.
- [ ] CHK035 MCP wire protocol version is not duplicated as a product state version.

## Testability and Simplicity

- [ ] CHK036 Each user story has an independent journey.
- [ ] CHK037 Every success criterion is observable and bounded.
- [ ] CHK038 Tests do not require real Codex or DeepSeek hosts.
- [ ] CHK039 No Web UI, daemon, generic execution engine, or policy framework is implied.
- [ ] CHK040 Direct dependencies remain within the Constitution budget.
- [ ] CHK041 No unresolved clarification marker remains.
- [ ] CHK042 Spec, data model, MCP contracts, state machine, plan, and tasks use the same names.
