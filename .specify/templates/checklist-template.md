# Requirements Quality Checklist: [FEATURE NAME]

**Purpose**: Determine whether the feature package is clear, complete, internally consistent,
bounded, and testable before implementation.

**Created**: [DATE]

**Feature**: [`spec.md`](../spec.md)

**Review Ownership**: Reviewer-owned. `$speckit-implement` MUST NOT change these markers.

**Marker Semantics**: `[x]` means the requirement-quality criterion was reviewed and satisfied. It
does not mean code exists or a test passed.

## Problem and User Value

- [ ] CHK001 The problem statement describes an observable developer/user problem rather than a
  preferred implementation.
- [ ] CHK002 Every user story delivers independently demonstrable value at its checkpoint.
- [ ] CHK003 Priorities reflect user value and dependency reality.
- [ ] CHK004 Acceptance scenarios use concrete Given/When/Then outcomes.
- [ ] CHK005 Edge cases include invalid input, interruption, persistence transition, and zero-write failure
  behavior where applicable.

## Scope and Non-Goals

- [ ] CHK006 Every functional requirement is individually testable and uses stable terminology.
- [ ] CHK007 Non-goals exclude release work, unsupported platforms/hosts, speculative abstractions,
  and unrelated cleanup.
- [ ] CHK008 Assumptions do not silently create requirements.
- [ ] CHK009 No requirement exists only in `plan.md`, `tasks.md`, a prompt, or a test fixture.
- [ ] CHK010 Product behavior and release/publication behavior are separated.

## State Graph *(required for process changes; otherwise mark N/A with reason)*

- [ ] CHK011 Process ID, version, and definition-digest rule are explicit.
- [ ] CHK012 Every affected node has purpose, entry assumptions, completion conditions, allowed
  effects, required evidence, and semantic method steps.
- [ ] CHK013 Every affected node lists its complete outgoing transition set.
- [ ] CHK014 Every transition has a stable ID, destination, guard, and reason rule.
- [ ] CHK015 Forward, rework, backward, blocked, cancelled, and terminal behavior are unambiguous.
- [ ] CHK016 Forbidden transitions and adapter-selected destinations are explicitly rejected.
- [ ] CHK017 Repository-changing transitions invalidate stale test/comprehension evidence as needed.
- [ ] CHK018 Comprehension review and refactor-to-test behavior are objectively verifiable.

## Data, Persistence Transition, and Recovery

- [ ] CHK019 Entities, revision authority, relationships, and aggregate bounds are defined.
- [ ] CHK020 Existing persisted data has exactly one declared disposition: migrate, retain-read-only, reject-and-reset, or N/A.
- [ ] CHK021 Unsupported/current-future data behavior is explicit; old-binary or historical-runtime support is required only when the user explicitly requests it.
- [ ] CHK022 Migration/rejection/bootstrap failures and malformed records are zero-write and never trigger automatic deletion.
- [ ] CHK023 Revision, action identity, operation identity, and read-before-retry behavior remain
  defined for every mutation.
- [ ] CHK024 Recovery classifications are not duplicated or re-decided by adapters.
- [ ] CHK025 Terminal outcome criteria bind to the latest authoritative requirements baseline.

## Public and Host Contracts

- [ ] CHK026 Public tool names/count, input/output changes, closed fields, and stable errors are exact.
- [ ] CHK027 Core and Host Adapter responsibilities are separated.
- [ ] CHK028 Codex and DeepSeek fixtures cover shared semantics without promoting an unimplemented
  host to product support.
- [ ] CHK029 Method profiles provide guidance without owning task state or transitions.
- [ ] CHK030 Missing method tooling and profile fallback behavior are explicit.

## Plan and Tasks

- [ ] CHK031 The plan names the exact current files and selected design.
- [ ] CHK032 Constitution Check passes before and after design.
- [ ] CHK033 Rejected alternatives explain why the simpler or more generic option was not selected.
- [ ] CHK034 Every task names exact paths and traces to a requirement, success criterion, or contract.
- [ ] CHK035 Targeted, repository-wide, native, simulated, and user evidence are kept distinct.
- [ ] CHK036 The test budget caps full validation and real-host journeys.
- [ ] CHK037 No task can publish, tag, or release unless this is a Release Change.

## Review Result

**Unresolved findings**: [None or exact CHK IDs]

**Decision**: [Ready for analyze | Return to clarify/plan/tasks]

**Reviewer**: [Name/agent]

**Reviewed at**: [DATE]
