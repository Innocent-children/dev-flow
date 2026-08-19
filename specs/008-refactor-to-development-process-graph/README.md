# Feature 008: Refactor to a Development Process Graph

## Status

- **Feature**: `008-refactor-to-development-process-graph`
- **Status**: Implementing
- **Change Type**: Product Feature
- **Created**: 2026-08-18
- **Baseline**: `main` at `29885cd4d0b97ad03bbe09876168e48db371a048`
- **Current Product Contract**: Core Contract 0.1 / product `0.3.0`
- **Target Product Contract**: Core Contract 0.2 / `standard-development@1`
- **Release Authority**: Not authorized

## Purpose

Refactor Dev Flow from a mostly linear AI-task workflow into a developer-visible development-process
graph. The developer must always be able to read the current node, understand what the node requires,
see every legal next node, and choose a Core-declared transition after producing the required
evidence.

The target process makes requirements, design, task decomposition, implementation, testing,
developer comprehension, refactoring, and delivery explicit. Spec Kit and OpenSpec become selectable
method profiles that help perform node work without owning task state or transitions.

## Authority

Read in this order:

1. [Dev Flow Constitution](../../.specify/memory/constitution.md)
2. [Spec Kit workflow and documentation standard](../../docs/SPEC-KIT-WORKFLOW.md)
3. [Feature specification](spec.md)
4. [Implementation plan](plan.md)
5. [Research decisions](research.md)
6. [Data model](data-model.md)
7. [Normative contracts](contracts/)
8. [Implementation tasks](tasks.md)

`contracts/` is normative for exact identifiers, fields, transitions, storage boundaries, and zero-write
behavior. A diagram or example never overrides a contract table.

## Scope

- Introduce one built-in process definition, `standard-development@1`, for all newly created tasks.
- Expose the current node's complete contract and legal outgoing transitions through the existing
  six MCP tools.
- Replace caller-selected result aliases with an explicit Core-declared `transition_id`.
- Add versioned requirements, design, task-plan, test, comprehension, and delivery authorities while
  preserving an immutable original task intent.
- Add `plain`, `spec-kit`, and `openspec` method profiles.
- Make developer comprehension a mandatory gate before delivery.
- Require any repository-changing refactor to return through `TEST`.
- Establish Schema 2 as a fresh persistence generation with one strict graph-task codec.
- Reject every Schema 1/pre-graph database with zero writes; require an explicit fresh data directory
  or user-controlled archive/rename/delete before graph use.
- Do not implement `legacy-linear@1`, snapshot-v1 decoding, dual task projections, task migration, or
  historical-task continuation.
- Preserve revision CAS, action identity, repository binding, evidence budgets, repository claims,
  five-class recovery, and read-before-retry.

## Non-Goals

- No user-defined graph, YAML/JSON process DSL, graph editor, process marketplace, or plugin system.
- No parallel branches, concurrent nodes, subtasks, multi-repository task, or cross-host takeover.
- No Web UI, HTTP/SSE transport, remote MCP, telemetry, authentication, or generic shell tool.
- No automatic execution of Spec Kit or OpenSpec by the Go Core.
- No new public MCP tool.
- No Git mutation by Core.
- No rewriting or renaming historical Features 001–007.
- No product version change, npm publication, Tag, GitHub Release, or distributed-artifact journey.
- No DeepSeek product implementation or support claim.

## Dependencies and Persistence Boundary

Feature 008 depends on the completed Core Contract 0.1 source, Codex product, recovery hardening, and
published `0.3.0` baseline only as the implementation starting point. It does **not** depend on or
preserve the Core Contract 0.1 persisted task format.

Core Contract 0.2 accepts only a fresh or exact Schema 2 data directory. Every Schema 1/pre-graph
database is rejected as `SCHEMA_UNSUPPORTED` before task decoding and with zero writes. The user must
explicitly select a fresh data directory or archive, rename, or delete the old data outside Core.
There is no migration, historical-task read/resume/cancel/complete path, legacy process, v1 codec,
conversion, import/export bridge, or downgrade route.

Core, `dev-flow-codex setup`, package update/removal, and npm uninstall must never delete, truncate,
rename, replace, or convert unsupported old data automatically. A later Release Change is responsible
for communicating this breaking storage boundary and shipping the matching Core and Host Adapter.

## Activation

```bash
export SPECIFY_INIT_DIR="$PWD"
export SPECIFY_FEATURE_DIRECTORY="$PWD/specs/008-refactor-to-development-process-graph"
```

The Git branch does not select the active Feature.

## Workflow Gate

Contract-freeze review completed on 2026-08-19: clarification found no acceptance-impacting open
question, the requirements checklist passed 60/60 items, and analyze found no CRITICAL, HIGH, or
acceptance-impacting MEDIUM issue. Feature 008 remains a non-release Product Feature.

Before production code changes:

1. run `$speckit-clarify` against this prepared package;
2. resolve every unchecked item in `checklists/requirements.md`;
3. run `$speckit-analyze`;
4. resolve every CRITICAL/HIGH and every acceptance-impacting MEDIUM finding;
5. update this Feature from `Planned` to `Ready`;
6. implement only one phase or user-story checkpoint at a time.

Do not rerun `specify`, `plan`, or `tasks` to regenerate this package unless an explicit amendment is
approved.

## Checkpoints

| Checkpoint | Exit Condition | Initial Status |
| --- | --- | --- |
| Contract freeze | All graph, MCP, method-profile, and persistence contracts are internally consistent | Complete — T001–T006 |
| Foundation | Standard process definition, current Task model, fresh Schema 2 bootstrap, strict v2 codec, and old-data rejection pass targeted tests | Complete — T007–T034; targeted domain/workflow/store tests pass |
| User Story 1 | New task exposes current node contract and all legal next transitions | Complete — T035–T045; Journey A passes |
| User Story 2 | Test/rework/comprehension/refactor loops are enforced and independently demonstrated | Pending |
| User Story 3 | `plain`, `spec-kit`, and `openspec` guidance is rendered without adapter-owned state | Pending |
| User Story 4 | Fresh storage bootstrap, Schema 1 zero-write rejection, current-task recovery, and future-schema safety pass | Pending |
| Final feature gate | One repository validation and one local-artifact Codex journey pass | Pending |

## Release Boundary

Feature 008 may prepare source and local test artifacts only. It must not change `VERSION`, package
versions, npm state, Git Tags, GitHub Releases, or public support tables. Publication requires a
separate reviewed Release Change after Feature 008 is complete.
