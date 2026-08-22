# Implementation Plan: [FEATURE]

**Branch**: `[###-feature-name]` | **Date**: [DATE] | **Spec**: [relative link]

**Change Type**: [Governance | Product Feature | Corrective Change]

**Input**: Feature specification from `specs/[###-feature-name]/spec.md`

## Summary

[Primary user capability and the selected technical approach in two or three paragraphs.]

## Current System Baseline *(mandatory)*

Describe the exact current behavior and authoritative files before proposing changes.

| Surface | Current Authority | Current Behavior | Feature Impact |
| --- | --- | --- | --- |
| Domain | `[path]` | [behavior] | [change/unchanged] |
| Workflow/Process | `[path]` | [behavior] | [change/unchanged] |
| Persistence | `[path]` | [behavior] | [change/unchanged] |
| MCP | `[path]` | [behavior] | [change/unchanged] |
| Host Adapter | `[path]` | [behavior] | [change/unchanged] |

## Technical Context

**Language/Version**: [exact governed range]

**Primary Dependencies**: [existing dependencies; mark new dependency explicitly]

**Storage**: [Current SQLite layout or N/A]

**Transport/Public Surface**: [MCP/CLI/package or N/A]

**Testing**: [targeted packages, contract fixtures, final validation]

**Target Platform**: [supported implementation platform]

**Performance Goals**: [only observable goals relevant to this feature]

**Constraints**: [security, size, selected data disposition, read-only Git, tool count, etc.]

**Scale/Scope**: [one repo/one task/bounded graph/etc.]

## Constitution Check

*GATE: Pass before research and repeat after design.*

| Principle / Constraint | Status | Evidence / Design Response |
| --- | --- | --- |
| Single Core authority | [PASS/FAIL] | [response] |
| Bounded state graph | [PASS/FAIL/N/A] | [response] |
| Comprehensibility gate | [PASS/FAIL/N/A] | [response] |
| Method tools are guidance | [PASS/FAIL/N/A] | [response] |
| Recovery before retry | [PASS/FAIL/N/A] | [response] |
| Read-only Git | [PASS/FAIL] | [response] |
| Evidence-bounded testing | [PASS/FAIL] | [response] |
| Proven simplicity | [PASS/FAIL] | [response] |
| Release separation | [PASS/FAIL] | [response] |
| Host fixture parity | [PASS/FAIL/N/A] | [response] |

Any FAIL blocks tasks and implementation.

## Design

### Process and Domain Model

[Exact new entities, ownership, invariants, process/node/transition design, and any supported data-generation split.]

### Public Contract

[Tool count, current schema fields, errors, forbidden input, result envelope.]

### Persistence Transition

[Current bootstrap/layout, selected existing-data disposition, current task behavior,
unsupported/future data behavior, reset authority, zero-write proof, and transaction boundary.]

### Recovery and Concurrency

[How revision/action identity, uncertain mutation classification, CAS, blocker, and duplicate
prevention remain correct.]

### Method Profiles and Host Adapters

[Core semantic steps, profile mapping, adapter responsibilities, missing-tool behavior, parity.]

### Documentation and Product Definition

[Which user-facing and architecture documents change during implementation.]

## Project Structure

### Feature Documentation

```text
specs/[###-feature-name]/
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

### Source Changes

List only real repository paths. Do not include generic Web/mobile examples.

```text
internal/domain/
internal/workflow/
internal/application/
internal/recovery/
internal/store/
internal/mcp/
protocol/fixtures/
tests/contract/
packages/codex/
docs/
```

**Structure Decision**: [Why these existing boundaries are retained or deliberately changed.]

## Test Strategy and Budget

| Checkpoint | Required Checks | Explicitly Excluded |
| --- | --- | --- |
| Foundation | [targeted checks] | [full suite/native journey/etc.] |
| User Story 1 | [checks] | [excluded] |
| User Story N | [checks] | [excluded] |
| Final | [one full validation and any real-host gate] | [unsupported matrices] |

State the maximum number of repository-wide validations and real-host journeys.

## Rollout and Persistence Boundary

[Feature merge behavior, old-data disposition, feature flag if any, bootstrap/reset ordering.
Publication is a later standalone release command after the feature is complete and does not create a
release Feature.]

## Complexity Tracking

> Fill only for approved Constitution exceptions.

| Violation | Why Needed | Simpler Alternative Rejected Because | Approval |
| --- | --- | --- | --- |
| [exception] | [need] | [reason] | [owner/date] |
