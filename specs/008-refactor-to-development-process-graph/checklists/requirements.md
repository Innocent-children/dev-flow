# Requirements Quality Checklist: Refactor to a Development Process Graph

**Purpose**: Verify that Feature 008 is complete, bounded, internally consistent, and ready for
cross-artifact analysis before implementation.

**Created**: 2026-08-18

**Feature**: [`spec.md`](../spec.md)

**Review Ownership**: Reviewer-owned. Implementation must not change these markers.

**Marker Semantics**: `[x]` means the specification-quality criterion was reviewed and satisfied. It
does not mean implementation or runtime evidence exists.

## Problem and User Value

- [x] CHK001 The problem is stated as a developer process-navigation and AI-complexity problem, not
  as a preferred implementation.
- [x] CHK002 User Story 1 independently proves current-node navigation.
- [x] CHK003 User Story 2 independently proves iterative test/comprehension/refactor behavior.
- [x] CHK004 User Story 3 independently proves method-profile guidance without a second authority.
- [x] CHK005 User Story 4 independently proves fresh Schema 2 bootstrap and zero-write rejection of pre-graph data.
- [x] CHK006 Acceptance scenarios use observable Given/When/Then behavior.
- [x] CHK007 Edge cases cover incomplete requirements, stale evidence, invalid transitions, tool
  absence, uncertainty, concurrency, and future/corrupt storage.

## Scope and Non-Goals

- [x] CHK008 The Feature changes product behavior but explicitly excludes release/publication.
- [x] CHK009 The Feature excludes a configurable graph/DSL, graph editor, plugin system, and multiple
  process presets.
- [x] CHK010 The Feature excludes new MCP tools, Git mutation, shell execution, remote transport,
  Web UI, multi-repository, and cross-host takeover.
- [x] CHK011 Historical Features 001–007 and public 0.3.0 evidence remain frozen.
- [x] CHK012 DeepSeek fixture parity is separated from DeepSeek product support.
- [x] CHK013 Assumptions do not add hidden platform, release, or method-tool installation
  requirements.

## State Graph

- [x] CHK014 Process ID, version, absence of a compatibility process, and digest algorithm are explicit.
- [x] CHK015 The standard node vocabulary is closed and bounded.
- [x] CHK016 Every normal node has a purpose, entry conditions, completion conditions, allowed
  effects, required evidence, action kind, payload contract, and method steps.
- [x] CHK017 Every normal node lists its complete outgoing transition set.
- [x] CHK018 All 29 normal transitions have stable IDs, source, destination, guard, and reason rule.
- [x] CHK019 `BLOCKED`, `CANCELLED`, and `DONE` semantics are separate from normal transition
  selection.
- [x] CHK020 Caller destination, next node, guard result, and adapter-selected transition are
  explicitly forbidden.
- [x] CHK021 Test success cannot skip comprehension review.
- [x] CHK022 Refactor cannot skip retesting.
- [x] CHK023 Backward transitions invalidate stale downstream authorities.
- [x] CHK024 Delivery requires current requirements, test, comprehension, evidence, and repository
  identity.

## Comprehensibility

- [x] CHK025 Comprehension review is distinct from automated/static code review.
- [x] CHK026 `comprehension_passed` requires explicit current user evidence.
- [x] CHK027 AI explanation alone cannot assert that the developer understands the change.
- [x] CHK028 The remediation choices distinguish code complexity, design complexity, implementation
  defect, verification insufficiency, and requirement ambiguity.

## Requirements and Baselines

- [x] CHK029 Immutable original TaskIntent is distinguished from versioned requirements authority.
- [x] CHK030 A new task can start before acceptance criteria are complete.
- [x] CHK031 Requirements/design/task-plan baseline dependencies and revisions are explicit.
- [x] CHK032 Baseline invalidation and bounded history retention are explicit.
- [x] CHK033 Outcome acceptance binds to the latest requirements baseline.

## Public Contract and Method Profiles

- [x] CHK034 The exact six-tool catalog is retained.
- [x] CHK035 Core Contract schema 2 inputs, outputs, payload envelope, identity fields, and errors are
  defined.
- [x] CHK036 Standard payload branches are closed and transition-aware.
- [x] CHK037 Recovery probe semantics are updated from phase-only to process/source cursor.
- [x] CHK038 `plain`, `spec-kit`, and `openspec` are closed immutable task profiles.
- [x] CHK039 Core semantic method steps are separated from Host command spelling.
- [x] CHK040 Method capability absence, plain fallback, and honest evidence are explicit.
- [x] CHK041 Method documents/checkbox/archive state cannot mutate Core independently.
- [x] CHK042 Spec Kit and OpenSpec mappings cover every normal node without pretending each node has
  a native tool command.

## Persistence Generation, Explicit Reset, and Recovery

- [x] CHK043 Fresh Schema 2 bootstrap statements, metadata, constraints, indexes, and digest rules are specified.
- [x] CHK044 Schema 1/pre-graph databases are rejected before task decoding with a zero-write manifest requirement.
- [x] CHK045 Exactly one strict snapshot-version-2 codec and exact row/snapshot metadata agreement are defined; no v1 or dual-codec route exists.
- [x] CHK046 `legacy-linear`, old-task continuation, migration, import/export, and conversion are explicitly unsupported.
- [x] CHK047 Future/unsupported schema, snapshot, process, malformed row, partial bootstrap, and digest mismatch all safe-stop with zero writes; no old-binary journey is required.
- [x] CHK048 Five-class recovery, operation identity, read-before-retry, CAS, and at-most-once
  behavior remain defined.
- [x] CHK049 Bootstrap/rejection/normal mutation/event/claim transaction boundaries are explicit.
- [x] CHK050 Removal/uninstall retain supported Schema 2 task data and never automatically delete unsupported old data.

## Plan and Verification

- [x] CHK051 The plan names exact current files and selected source boundaries.
- [x] CHK052 Constitution Check passes before and after design.
- [x] CHK053 Research records major decisions and rejected alternatives.
- [x] CHK054 Data model defines entities, enums, relationships, lifecycle, limits, and invalidation.
- [x] CHK055 Quickstart is required to demonstrate primary, loop, profile, restart, fresh bootstrap, and old-data rejection
  journeys.
- [x] CHK056 Tasks must trace to FR/SC/contracts and stop at user-story checkpoints.
- [x] CHK057 Repository-wide validation is capped at one final invocation.
- [x] CHK058 Real Codex journey is capped at one; old-binary and legacy-task journeys are explicitly zero.
- [x] CHK059 Unsupported platform/Host and real Spec Kit/OpenSpec installation matrices are excluded.
- [x] CHK060 Feature completion cannot modify version/npm/Tag/GitHub Release.

## Review Result

**Unresolved findings**: None at requirements-quality review.

**Decision**: Ready for `$speckit-analyze`; Feature status remains `Planned` until cross-artifact
analysis is run and blocking findings are resolved.

**Reviewer**: OpenAI GPT-5.6 Pro

**Reviewed at**: 2026-08-18
