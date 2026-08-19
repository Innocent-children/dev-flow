---
description: "Dev Flow feature implementation task template"
---

# Tasks: [FEATURE NAME]

**Input**: Complete feature package from `specs/[###-feature-name]/`

**Required before generation**:

- `README.md`
- `spec.md`
- `plan.md`
- `research.md`
- `data-model.md`
- `contracts/`
- `checklists/requirements.md`

**Organization rule**: Tasks are grouped first by shared foundations, then by independently
demonstrable user story, then by final cross-cutting validation. A task list is an execution contract,
not a brainstorming backlog.

## Task Format

Every task uses:

```text
- [ ] T### [P?] [US#?] Description in exact/path.ext per FR-###, SC-###, or contract clause.
```

Rules:

- `[P]` means the task can run in parallel because it touches different files and has no unmet
  dependency.
- `[US#]` is required for user-story work and omitted only for setup/foundation/final-gate work.
- Every task names exact files or directories.
- Every task has one objectively checkable result.
- Every implementation task traces to at least one requirement, success criterion, or contract.
- Verification belongs in the same phase as the behavior it proves.
- Repository-wide validation and real-host journeys appear only at an explicit final checkpoint.
- Product implementation tasks MUST NOT publish a package, create or move a Tag, or finalize a
  Release unless the active feature is a Release Change.
- Do not add generic cleanup, coverage expansion, future abstraction, or unrelated refactoring.

## Phase 1: Governance and Contract Freeze

**Goal**: Freeze the active feature's exact public behavior before production code changes.

- [ ] T001 Review and resolve every unchecked requirement-quality item in
  `specs/[###-feature-name]/checklists/requirements.md`.
- [ ] T002 Freeze the normative contracts in `specs/[###-feature-name]/contracts/` and record any
  approved clarification in `spec.md`, `plan.md`, and `tasks.md`.
- [ ] T003 Run `$speckit-analyze`; resolve every CRITICAL/HIGH and every acceptance-impacting MEDIUM
  finding before implementation.

**Checkpoint**: The feature is `Ready`; no production file has changed.

---

## Phase 2: Shared Foundations

**Goal**: Implement only the common domain, persistence, or contract prerequisites that block every
user story.

<!-- Replace all examples below with feature-specific tasks. -->

- [ ] T004 [P] Add the bounded shared domain model in `[exact/path]` per FR-###.
- [ ] T005 [P] Add contract fixtures in `[exact/path]` per `[contract section]`.
- [ ] T006 Implement persistence or application integration in `[exact/path]` per FR-S###.
- [ ] T007 Run only the foundation checks named in `plan.md`.

**Checkpoint**: Shared prerequisites pass; no user-story behavior is claimed yet.

---

## Phase 3: User Story 1 - [TITLE] (Priority: P1)

**Goal**: [User-visible capability.]

**Independent Test**: [One bounded journey that proves only this story.]

### Implementation

- [ ] T008 [P] [US1] [Exact result] in `[exact/path]` per FR-###.
- [ ] T009 [US1] [Exact result] in `[exact/path]` per FR-###.
- [ ] T010 [US1] Integrate the story through `[exact path/surface]` per `[contract section]`.

### Verification

- [ ] T011 [US1] Add or update the targeted contract/unit test in `[exact/path]` per SC-###.
- [ ] T012 [US1] Run `[exact bounded check]`; record the checkpoint result without running the full
  repository suite.

**Checkpoint**: User Story 1 is independently demonstrable. Stop unless the user authorized the next
story.

---

## Phase 4: User Story 2 - [TITLE] (Priority: P2)

**Goal**: [User-visible capability.]

**Independent Test**: [Bounded journey.]

### Implementation

- [ ] T013 [P] [US2] [Exact result] in `[exact/path]` per FR-###.
- [ ] T014 [US2] [Exact result] in `[exact/path]` per FR-###.

### Verification

- [ ] T015 [US2] Add or update the targeted test in `[exact/path]` per SC-###.
- [ ] T016 [US2] Run `[exact bounded check]`.

**Checkpoint**: User Story 2 is independently demonstrable.

---

## Phase N: Persistence Transition and Recovery

Include this phase whenever public contracts, persisted data, process nodes, transition semantics,
or uncertain mutations change.

- [ ] T0XX Implement the selected old-data disposition in `[exact/path]` per FR-S###.
- [ ] T0XX Prove the declared existing-data disposition in `[exact/path]` per SC-###.
- [ ] T0XX Prove unsupported/future data safe-stop with zero writes in `[exact/path]`.
- [ ] T0XX Prove uncertain mutation read-before-retry and duplicate prevention in `[exact/path]`.
- [ ] T0XX When `reject-and-reset` is selected, prove production source contains no historical runtime, decoder, dual projection, migration, or automatic reset path.
- [ ] T0XX Prove both supported-host contract fixtures remain semantically identical.

**Checkpoint**: Persistence-boundary and recovery claims are backed by the exact evidence class stated in
the feature.

---

## Final Phase: Documentation and Feature Gate

- [ ] T0XX Update only the current product and architecture documents named by `plan.md`.
- [ ] T0XX Run the feature's final targeted contract set.
- [ ] T0XX Run `pnpm run validate` exactly once when required by `plan.md`.
- [ ] T0XX Run the one authorized real-host journey only when the feature changes a real-host
  contract.
- [ ] T0XX Run `$speckit-converge`; append only concrete remaining acceptance gaps.
- [ ] T0XX Reconcile `README.md`, `spec.md`, and `tasks.md` status without changing product version or
  performing release work.

**Checkpoint**: Feature implementation is complete and ready for a separate Release Change when one
is authorized.

## Dependencies and Execution Order

Document the real dependency graph. Do not claim that all user stories are parallel by default.

```text
Governance/contract freeze
        ↓
Shared foundations
        ↓
US1 → US2 → ... only where actual dependencies require this order
        ↓
Persistence/recovery
        ↓
Final feature gate
```

## Test Budget

Copy the approved limits from `plan.md`:

| Scope | Maximum / Rule |
| --- | --- |
| Targeted package checks | [value] |
| Repository-wide validation | [value] |
| Real-host journeys | [value] |
| Unsupported platform matrices | [explicitly excluded] |

## Notes

- A checked task means its exact result and required evidence are complete.
- Checklist markers are reviewer-owned and are not implementation progress.
- Do not mark a task complete from static inspection when it requires runtime evidence.
- Do not promote fake, simulated, fixture, or user-performed evidence into native automated evidence.
- Stop at every checkpoint requested by the user.
