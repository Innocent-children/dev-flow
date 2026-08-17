# Data Model: Recovery Hardening

Feature 005 introduces no persisted entity and no SQLite migration. This document records the
existing authorities that the new tests exercise and the non-persisted test scenario vocabulary.

## Existing Persistent Authorities

### Task

Relevant retained fields:

- `id`
- `revision`
- `phase`
- `origin_host`
- immutable contract
- current action
- repository identity and binding
- retained evidence
- `last_operation`
- optional blocker
- terminal outcome

**Invariant**: A successful mutation changes Task, matching TaskEvent, and repository claim in one
transaction. An uncertain caller result does not change what committed.

### LastOperation

Relevant fields:

- request identity
- operation ID
- action ID
- Core-derived canonical payload digest
- from revision
- to revision
- committed time
- resulting task/action projection

**Invariant**: It proves only the latest committed mutation and is compared only with an exact
caller-supplied `OperationProbe`.

### TaskEvent

Audit projection of the same accepted mutation.

**Invariant**: Feature 005 checks event cardinality and identity but does not make runtime reads
depend on replaying events.

### RepositoryBinding

Components:

- canonical worktree root
- Git common-directory identity
- branch or detached state
- HEAD commit or unborn state
- tracked-status digest
- bounded untracked-status digest
- overall binding digest

**Invariant**: Equality or an action-specific closed relation is evaluated from fresh observation.
Returning to the same HEAD alone is not equality.

### RecoveryBlocker

Relevant fields:

- blocker code
- Core-derived cause
- recorded resume phase
- issuance binding
- observed binding digest
- closed machine resolution condition
- human-readable resolution text

**Invariant**: Human-readable text is never parsed as authority. Resolution returns only to the
recorded phase and exact permitted binding.

## Existing Transient Authority

### OperationProbe

Caller-retained fields:

- task ID
- operation ID
- action ID
- expected/from revision
- canonical request payload or fields from which Core derives the digest

**Validation**:

- all identity components must refer to the same original request;
- a caller cannot supply an authoritative payload digest;
- a missing probe makes no completion claim.

### RecoveryAssessment

Exactly one class:

```text
not_started
completed_and_recorded
completed_but_unrecorded
partially_completed
conflicting
```

Includes bounded facts and digests needed to explain the class. It is produced by a read and is not
persisted by that read.

## Test-Only Model

### FailureScenario

Not a production type and never persisted.

| Field | Values |
|---|---|
| `boundary` | `pre_commit`, `post_commit_discard`, `pre_serialization`, `partial_write`, `restart` |
| `operation_probe` | exact pre-dispatch probe |
| `repository_change` | none or one bounded fixture change |
| `writer_limit` | optional byte count for a test-local failing writer |
| `expected_class` | one existing recovery class |
| `expected_revision_delta` | `0` or `1` |
| `expected_event_delta` | `0` or `1` |
| `evidence_label` | deterministic boundary label |

**Invariant**: The test scenario cannot be selected through production inputs or environment.

## State and Write Matrix

| Scenario | Task write | Event write | Claim/binding write | Recovery result |
|---|---:|---:|---:|---|
| Pre-commit failure | 0 | 0 | 0 | `not_started` after exact read |
| Committed, result discarded | 1 | 1 | as normal mutation | `completed_and_recorded` |
| Exact unrecorded host work, read | 0 | 0 | 0 | `completed_but_unrecorded` |
| Exact unrecorded host work, recovery apply | 1 | 1 | as existing contract | normal recorded result |
| Partial/conflicting read | 0 | 0 | 0 | respective class |
| Exact current partial/conflicting recovery apply | existing blocker write only | 1 if contract requires | existing contract | `BLOCKED` |
| Stale/superseded recovery apply | 0 | 0 | 0 | existing conflict error |
| Duplicate committed recovery submission | 0 | 0 | 0 | stable committed read-back |
| Two-handle race | one winner | one winner event | one winner | loser gets existing stale/revision result |

## Schema Decision

- SQLite schema version: unchanged.
- MCP JSON schemas: unchanged.
- Protocol fixture schema/digests: unchanged unless only nonsemantic fixture metadata is regenerated
  by an existing required process.
- No migration, journal table, attempt table, or fault table is authorized.
