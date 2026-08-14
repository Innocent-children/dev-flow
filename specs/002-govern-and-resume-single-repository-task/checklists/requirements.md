# Requirements Quality Checklist: Govern and Resume a Single-Repository Task

**Purpose**: Verify that the Core workflow, persistence, repository, recovery, and MCP requirements
are complete, bounded, and free of duplicate workflow authority.

**Created**: 2026-08-14

**Feature**: `../spec.md`

**Review Ownership**: Reviewer-owned requirements artifact. `[x]` means requirements quality is
satisfied, not that code exists.

## Product Boundary

- [x] CHK001 The Core is clearly separated from Codex and DeepSeek package work.
- [x] CHK002 The task model, transition table, and result envelope each have one authoritative definition.
- [x] CHK003 Git mutation, shell execution, test execution, networking, and host setup are excluded.
- [x] CHK004 Single-repository and single-active-task limits are explicit.
- [x] CHK005 Contract revision and cross-host handoff are explicitly deferred.

## Workflow

- [x] CHK006 The normal and exceptional state sets are closed.
- [x] CHK007 Every forward transition has a defined action.
- [x] CHK008 Every rework transition is explicit and requires a reason.
- [x] CHK009 There is no second task-type or fast-path state machine.
- [x] CHK010 Terminal behavior and claim release are unambiguous.
- [x] CHK011 Blocker creation and resolution are testable.

## Contract and Evidence

- [x] CHK012 Task contract fields and bounds are specified.
- [x] CHK013 Verification budget behavior is specified for automatic, full-suite, and manual checks.
- [x] CHK014 Evidence source classes cannot be confused.
- [x] CHK015 Evidence storage excludes arbitrary command output and source content.
- [x] CHK016 Final outcome content is measurable.
- [x] CHK017 Public payloads reject unknown fields.

## Persistence and Concurrency

- [x] CHK018 Current snapshot authority versus event audit role is clear.
- [x] CHK019 Repository claim and task mutation transaction boundaries are explicit.
- [x] CHK020 Revision and action conflicts have no partial-write ambiguity.
- [x] CHK021 Unsupported future schema behavior is safe.
- [x] CHK022 Multi-process races have deterministic acceptance criteria.
- [x] CHK023 SQLite dependency is CGo-free and bounded.

## Recovery

- [x] CHK024 All five recovery classifications have observable definitions.
- [x] CHK025 Lost response handling requires read-before-retry.
- [x] CHK026 Repository drift is checked at action apply.
- [x] CHK027 Partial and conflicting cases lead to a concrete blocker.
- [x] CHK028 Recovery cannot mutate Git.
- [x] CHK029 The last-operation record is sufficient without becoming event sourcing.

## MCP

- [x] CHK030 Exactly six tools are named and justified.
- [x] CHK031 Tool schemas and one result envelope are the sole public contract.
- [x] CHK032 STDIO-only behavior is explicit.
- [x] CHK033 Stable domain errors are separated from internal errors.
- [x] CHK034 Logs and diagnostics exclude sensitive content.
- [x] CHK035 MCP wire protocol version is not duplicated as a product state version.

## Testability and Simplicity

- [x] CHK036 Each user story has an independent journey.
- [x] CHK037 Every success criterion is observable and bounded.
- [x] CHK038 Tests do not require real Codex or DeepSeek hosts.
- [x] CHK039 No Web UI, daemon, generic execution engine, or policy framework is implied.
- [x] CHK040 Direct dependencies remain within the Constitution budget.
- [x] CHK041 No unresolved clarification marker remains.
- [x] CHK042 Spec, data model, MCP contracts, state machine, plan, and tasks use the same names.

## Foundational Clarification Quality

- [x] CHK043 Read operations are explicitly prevented from changing revision, events, phase, action,
  blocker, or persisted repository binding.
- [x] CHK044 Repository-binding rules distinguish implementation worktree changes from identity,
  branch, HEAD, and unauthorized-phase drift without claiming process-level attribution.
- [x] CHK045 Unborn repositories have one supported branch/HEAD representation and no unsupported
  error alias.
- [x] CHK046 Core Limits 0.1 provides one authoritative numeric table and requires one Go constant
  source without a configuration framework.
- [x] CHK047 The MCP SDK dependency is deferred to its actual Phase 7 implementation task.
- [x] CHK048 Unknown-field rejection is assigned to Store codec and MCP input boundaries rather
  than generic Domain JSON parsing.
- [x] CHK049 Phase 2 includes SQLite and Git observation, while final full validation is defined as
  one non-duplicated `pnpm run validate` execution.
- [x] CHK050 Observation time is excluded from stable repository digests and blocker resolution is
  limited to its stored binding condition and `resume_phase`.
