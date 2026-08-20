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

Phase 5D was the implementation hardening checkpoint before Recovery. Phase 7A supersedes that
temporary boundary: omitted/null Recovery fields retain ordinary behavior, while valid non-null
`operation_probe` and `recovery_apply` use the graph-native five-class route. The stable
`RECOVERY_UNAVAILABLE` code remains reserved, but supported `standard-development@1` recovery does
not return it.

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

The Phase 5D audit on 2026-08-19 reopened selected Phase 2–5 tasks and User Story 2 for contract and
runtime hardening. The hardening checks and `$speckit-converge` now have zero remaining gap;
`USER_STORY_2_CHECKPOINT_COMPLETE` is restored. Phase 6A–6C and User Story 3 are complete with zero
remaining convergence gap. Phase 7A–7C and User Story 4 are complete with zero remaining convergence
gap. Phase 8A is complete; the native Journey and final Feature gate in Phase 8B remain pending.

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
| User Story 1 | New task exposes current node contract and all legal next transitions | Stabilized / Complete — T035–T045; Phase 2–4 contract, Journey A, repository validation pass |
| User Story 2 | Test/rework/comprehension/refactor loops are enforced and independently demonstrated | Hardened / Complete — selected T010–T060 and T096–T104 complete; `USER_STORY_2_CHECKPOINT_COMPLETE` |
| Phase 5D | Contract and runtime hardening for completed Phase 2–5 | Complete — `FEATURE_008_PHASE_5D_HARDENING_COMPLETE`; Phase 6–8 unstarted |
| Phase 6A | Core semantic method steps, immutable profiles, MethodEvidence validation, and public projections | Complete — T061–T062; `FEATURE_008_PHASE_6A_CORE_METHOD_CONTRACT_CHECKPOINT_COMPLETE` |
| Phase 6B | Codex Skill and packaged method-profile rendering reference | Complete — T063–T067; `FEATURE_008_PHASE_6B_CODEX_METHOD_ADAPTER_CHECKPOINT_COMPLETE` |
| Phase 6C | Profile fixtures, simulated Codex Journey, and shared Host parity | Complete — T068–T072; `FEATURE_008_USER_STORY_3_CHECKPOINT_COMPLETE` |
| User Story 3 | `plain`, `spec-kit`, and `openspec` guidance is rendered without adapter-owned state | Complete — T061–T072; `USER_STORY_3_CHECKPOINT_COMPLETE` |
| Phase 7A | Graph operation identity, five-class reconciliation, repository effects, and graph-native blocker resolution | Complete — T073–T076 |
| Phase 7B | Real five-class/CAS/restart/storage-boundary journeys | Complete — T077–T080; `FEATURE_008_PHASE_7B_RECOVERY_RESTART_STORAGE_JOURNEYS_CHECKPOINT_COMPLETE` |
| Phase 7C | No-legacy, lifecycle retention, private-path redaction, and future/corrupt safe-stop evidence | Complete — T081–T085 |
| User Story 4 | Fresh storage bootstrap, Schema 1 zero-write rejection, current-task recovery, and future-schema safety pass | Complete — T073–T085; `USER_STORY_4_CHECKPOINT_COMPLETE` |
| Phase 8A | Documentation convergence, complete targeted regression, and one retained source-local unpublished Codex artifact | Complete — T086–T091; `FEATURE_008_PHASE_8A_DOCUMENTATION_AND_LOCAL_ARTIFACT_CHECKPOINT_COMPLETE` |
| Final feature gate | One repository validation and one local-artifact Codex journey pass | Pending |

## Phase 8A Artifact Evidence

The retained acceptance artifact is source-local, unpublished, commit-bound test evidence. It is
not the historical public `0.3.0` artifact, a registry artifact, a release candidate, or an official
Release asset.

```text
filename: dev-flow-codex-0.3.0.tgz
size: 4,378,118 bytes
sha256: 8ae2c41711fc88531bafed3985bb3038c520fc0fe546f0f1288f3c815af888c5
source commit: e0d32b07ea7ede62b2d01539bad8b8f52312bdb2
package/Core version: 0.3.0
platform: darwin-arm64
```

Builder and independent readback verified the closed package allowlist, executable detached Core,
Contract 0.2 `schema_version=2`, Core Limits `0.2`, exact `standard-development@1` definition digest,
all three method profiles, and the ordered six-tool ServerInfo catalog. The repository records no
local artifact path. T092 must use the separately retained local path and exact digest above.

## Phase 8B Native Attempt Budget

Native attempt 1 failed during the first `REQUIREMENTS` mutation because the submitted Journey
payload did not match the closed Contract 0.2 branch: a required-evidence kind was used as an
ArtifactReference role and the required `node_result` wrapper was flattened. Core correctly returned
`INVALID_ARGUMENT`; no product mutation passed, and the external failure evidence remains retained.

Native attempt 2 was explicitly authorized after deterministic payload-matrix correction and passed
its launch preflight. `requirements_ready` committed once, then the DESIGN payload omitted
`requirements_revision` and `complexity_justification` and added the unknown `complexity` member.
Core correctly returned `INVALID_ARGUMENT`; external failure evidence remains retained.

```text
attempt 1: failed and permanently retained
attempt 2: failed and permanently retained
successful native Journey required: 1
attempt 3: not authorized
Feature 008: incomplete
```

The corrective Phase 9 work hardens packaged node-payload construction and request binding and
prepares a new source-local artifact. It does not authorize attempt 3, add product graph behavior,
or satisfy T092.

## Release Boundary

Feature 008 may prepare source and local test artifacts only. It must not change `VERSION`, package
versions, npm state, Git Tags, GitHub Releases, or public support tables. Publication requires a
separate reviewed Release Change after Feature 008 is complete.
