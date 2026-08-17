# Research: Recover Uncertain Actions and Repository Drift

## Decision 1 — Feature 004 is not a dependency

**Decision**: Implement Feature 005 after the merged Codex product from Feature 003. Keep Feature 004
deferred and outside the writable/test scope.

**Rationale**: Feature 005 does not alter public Core semantics. The Constitution requires two-host
parity when shared semantics change, not before every internal test-hardening change. Waiting for an
unavailable Harness capability would add no recovery proof.

**Alternatives considered**:

- Wait for both hosts: rejected because it indefinitely blocks Core hardening.
- Implement DeepSeek fixtures inside 005: rejected because it silently resumes Feature 004.
- Remove DeepSeek from the long-term product: rejected; it remains a deferred product.

## Decision 2 — Accept local STDIO result loss as the threat model

**Decision**: Treat process termination, caller cancellation, discarded return values, and partial
response writes as the bounded threat model.

**Rationale**: A mutation can commit before the caller receives a complete envelope. The existing
Constitution already prohibits retry before authoritative read-back. This is sufficient concrete
risk for deterministic proof without inventing another recovery branch.

**Alternatives considered**:

- Require a naturally occurring production incident: rejected because duplicate mutation risk
  should be proven before public release.
- Build an exhaustive crash scheduler: rejected as disproportionate.
- Use only mocks: rejected for the post-commit case; a real SQLite/reopen journey is required.

## Decision 3 — Do not add production fault injection

**Decision**: Simulate boundaries with test-local wrappers, discarded results, failing writers, and
the existing subprocess pattern.

**Rationale**: Production flags and hooks create security, compatibility, and maintenance surface.
The relevant invariants can be proven without them.

**Alternatives considered**:

- Environment-controlled failpoints: rejected because they become production API.
- Build-tagged production files: rejected because they split behavior and complicate release
  verification.
- Generic dependency interception framework: rejected because only a few named tests need it.

## Decision 4 — Preserve Core Contract 0.1

**Decision**: No public MCP, state, recovery-class, stable-error, repository-claim, or SQLite-schema
change is authorized.

**Rationale**: Feature 002 already defines the required model. Feature 005 should reveal and correct
internal invariant gaps, not redesign recovery while one host is deferred.

**Alternatives considered**:

- Add `recover_operation` MCP tool: rejected; reads plus explicit existing apply are sufficient.
- Persist a general operation journal: rejected; `LastOperation` and task events already provide the
  bounded proof.
- Add a sixth recovery class: rejected; uncertain evidence must map conservatively to an existing
  class.

## Decision 5 — Use exact expected evidence only

**Decision**: `completed_but_unrecorded` remains available only when the current action defines
closed, exact, bounded evidence that fresh repository observation satisfies.

**Rationale**: Similarity or model prose cannot prove a mutation and would make adoption unsafe.

**Alternatives considered**:

- Model judgment: rejected as nondeterministic.
- User assertion alone: rejected as unbound evidence.
- Broad diff hashing: rejected unless already part of the action's bounded expected evidence.

## Decision 6 — No persistence migration

**Decision**: Reuse `Task.LastOperation`, `TaskEvent`, recovery assessment, binding, and blocker
fields exactly as stored by Feature 002.

**Rationale**: The feature proves behavior at transaction and transport boundaries. It does not need
new durable state.

**Alternatives considered**:

- Persist every attempted operation: rejected as a new journal and schema.
- Persist failure-injection records: rejected because they are tests, not product data.
- Replay events to reconstruct state: rejected; task snapshot remains runtime authority.

## Decision 7 — Deterministic evidence is sufficient

**Decision**: No additional real Codex or DeepSeek host journey is required for Feature 005.

**Rationale**: Feature 003 already proves the real Codex lifecycle. Feature 005 changes Core-internal
proof, and the named failure boundaries can be exercised more precisely below the host.

**Alternatives considered**:

- Deliberately crash a live Codex session: rejected as unstable and weaker than exact boundary tests.
- Count fixture smoke as native evidence: rejected as inaccurate.
- Add a platform matrix: rejected because no platform-support claim changes.

## Implementation-Time Baseline Record

The User Story 1 checkpoint started from the current `origin/main` after `git fetch origin` and
`git pull --ff-only origin main` both completed successfully.

| Item | Recorded value |
|---|---|
| Baseline `main` | `a2ba8bd5de9c87aaf758bff51a02ae120f60c7f7` |
| Feature 003 merge commit | `a2ba8bd5de9c87aaf758bff51a02ae120f60c7f7` (`Merge branch 'codex/feature-003-codex-explicit-dev-flow'`) |
| Core version | root `VERSION` = `0.1.0` |
| Core fixture aggregate digest | `8c27bcf6be0e4e5a4bf294c67cbda8cdf281b1b2b2c53fff16206db2828dede7` across 22 shared fixtures |
| Codex package version | `0.1.0` |
| Platform | Darwin 27.0.0 arm64 |
| Go | `go1.26.6 darwin/arm64` |
| Node.js | `v24.18.0` |
| pnpm | `11.21.0` |
| Baseline targeted result | Eight required commands passed; see the command summary in `README.md` |

Baseline commands also confirmed a clean worktree, branch `main`, the expected `origin` remote,
the Feature 003 acceptance record, and the complete Feature 005 package. Feature 004 remains
deferred and is not an implementation or acceptance dependency for Feature 005.

## Implementation Finding — Existing Production Semantics Hold

**Status**: Implementation complete through T038; final root validation and Spec Kit gates pending.

The three user-story checkpoints passed against the existing production implementation. Lost-result
and duplicate behavior, all five reconciliation classes, exact adoption, read-only observations,
blockers, complete binding drift, aliases, repository replacement, the two-handle race, and restart
did not expose a Core, Application, Recovery, Repository, Store, or MCP Go production defect.

The focused Codex static test did expose a documentation ambiguity. The Skill now states that
missing, malformed, cancelled, truncated, and transport-failed apply results share one
read-before-retry path; retains the exact arguments from one fresh action and dispatch; uses only
the existing seven-member probe with exact payload or JSON `null`; separates a complete `ok=false`
domain error; and never branches on Core recovery classifications. This is caller-contract
clarification, not new recovery authority.

The proof sources are deliberately narrow: test-local pre-commit failure, post-commit discarded
result, pre-serialization discard, bounded partial writer, SQLite close/reopen, two-handle
deterministic race, temporary Git fixture mutation, and Codex Skill static contract. Root repository
validation is the remaining separate evidence label. They do not demonstrate a real Codex crash,
power loss, network interruption, DeepSeek execution, or a released artifact.

The actual result preserves Core Contract 0.1, six tools, five recovery classes, stable errors,
repository claims, blockers, and SQLite schema version 1. `packages/deepseek/` has zero diff. No
additional real Codex Host Journey, DeepSeek Harness, production failpoint, migration, dependency,
Feature 006 work, tag, release, or npm publication was introduced.
