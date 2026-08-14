# Data Model: Govern and Resume a Single-Repository Task

## Enumerations

### Host

```text
codex
deepseek
```

### Phase

```text
INTAKE
ASSESS
PLAN
IMPLEMENT
VERIFY
REVIEW
HANDOFF
DONE
BLOCKED
CANCELLED
```

### ActionKind

```text
ASSESS_TASK
PLAN_CHANGE
IMPLEMENT_CHANGE
VERIFY_CHANGE
REVIEW_CHANGE
PREPARE_HANDOFF
RESOLVE_BLOCKER
```

### ActionResult

`ActionResult` is the closed result vocabulary defined authoritatively in
`contracts/state-machine.md`. This data model does not duplicate its members or legal combinations.

### EvidenceSource

```text
automated
user
static
host_observed
```

### RecoveryClassification

```text
not_started
completed_and_recorded
completed_but_unrecorded
partially_completed
conflicting
```

### VerificationLevel

```text
minimal
targeted
full
```

### TerminalStatus

```text
completed
cancelled
```

All counts, byte sizes, and durations below refer to the single Core Limits 0.1 table in
`spec.md`. Domain values are typed; arbitrary JSON objects are not Domain entities.

## Contract

| Field | Type | Rules |
|---|---|---|
| goal | string | non-empty, within Core Limits 0.1 |
| scope | string[] | within Core Limits 0.1, no normalized duplicates |
| out_of_scope | string[] | within Core Limits 0.1, no normalized duplicates |
| acceptance_criteria | string[] | non-empty, within Core Limits 0.1, independently checkable, no normalized duplicates |
| verification_budget | VerificationBudget | required |

### VerificationBudget

| Field | Type | Rules |
|---|---|---|
| level | enum | `minimal`, `targeted`, or `full` |
| max_automatic_commands | integer | 0–20 |
| allow_full_suite | boolean | full-suite evidence requires true |
| allow_manual_handoff | boolean | user evidence requires true |

## RepositoryBinding

| Field | Type | Rules |
|---|---|---|
| canonical_root | string | normalized absolute worktree root within Core Limits 0.1 |
| git_common_dir_digest | SHA-256 | identity aid; raw private path not returned publicly |
| repository_identity | SHA-256 | digest of canonical worktree root and Git common-directory identity |
| branch | string or null | null only when detached; an unborn repository records the branch Git reports |
| detached | boolean | consistent with branch |
| head | full object ID or null | null for unborn repository |
| unborn | boolean | consistent with head |
| worktree_fingerprint | SHA-256 | hash of bounded porcelain observation |
| observed_at | timestamp | UTC |
| binding_digest | SHA-256 | digest of the normalized binding |

The public result may return canonical root only when required by the host tool contract. Logs never
include it. `observed_at` records freshness but is excluded from both `worktree_fingerprint` and
`binding_digest`, so repeated identical observations produce the same digests.

An apply carries the original action's binding digest and the Core observes again before commit.
Only `IMPLEMENT_CHANGE` may ordinarily accept a different worktree fingerprint; it persists the fresh
observation for the next revision only when repository identity, Git common-directory identity,
branch/detached state, and HEAD/unborn state remain exact. Other action kinds require the entire
fresh binding to match, except that `RESOLVE_BLOCKER` may accept a new binding only under the stored
blocker's concrete condition and may return only to its stored `resume_phase`. The observation is
authoritative for binding review but does not prove which external process made a file change.

## Task

| Field | Type | Rules |
|---|---|---|
| task_id | UUID/string ID | generated once |
| origin_host | Host | immutable |
| contract | Contract | immutable |
| repository | RepositoryBinding | updated only after accepted action/recovery |
| phase | Phase | authoritative |
| resume_phase | Phase or null | present only when BLOCKED |
| current_action | Action or null | null for terminal state |
| blocker | Blocker or null | present only when BLOCKED |
| last_operation | LastOperation or null | bounded |
| evidence | EvidenceSummary[] | retained within Core Limits 0.1 |
| outcome | Outcome or null | present only for terminal state |
| revision | uint64 | starts at 1; increments once per mutation |
| created_at | timestamp | immutable |
| updated_at | timestamp | mutation time |
| completed_at | timestamp or null | terminal only |

## Action

| Field | Type | Rules |
|---|---|---|
| action_id | UUID/string ID | stable until task changes |
| kind | ActionKind | consistent with phase |
| task_id | ID | exact task |
| revision | uint64 | exact task revision |
| repository_binding_digest | SHA-256 | exact observed repository |
| allowed_effects | string[] | closed values defined per action |
| required_evidence | EvidenceRequirement[] | closed contract |
| payload_contract | Phase | closed source-phase discriminator; no arbitrary JSON map |
| guidance | string | concise host-neutral direction within Core Limits 0.1 |
| issued_at | timestamp | not used to expire an otherwise current action |

Phase 2 implements only the phase-independent action metadata and pure blueprint construction. The
complete closed phase payload types belong to T040; the future MCP adapter derives JSON schemas at
its own boundary rather than storing `map[string]any` in Domain. `payload_contract` reuses the
action's source `Phase`, which keeps `REVIEW` and `HANDOFF` distinct even though both issue
`PREPARE_HANDOFF`.

## EvidenceSummary

| Field | Type | Rules |
|---|---|---|
| evidence_id | ID | generated on commit |
| source | EvidenceSource | required |
| name | string | stable logical name within Core Limits 0.1 |
| status | enum | `passed`, `failed`, `skipped`, `not_run`, `observed` |
| summary | string | within Core Limits 0.1; no raw source or full output |
| digest | SHA-256 | digest of normalized submitted evidence |
| command_count | integer | required for automated verification |
| full_suite | boolean | verification evidence only |
| recorded_at | timestamp | UTC |

## LastOperation

| Field | Type | Rules |
|---|---|---|
| operation_id | request/action identity | stable |
| action_id | ID | mutation action |
| from_revision | uint64 | expected revision |
| to_revision | uint64 | committed revision |
| payload_digest | SHA-256 | exact normalized payload |
| committed_at | timestamp | UTC |

Only committed operations are persisted. The caller's original action identity and payload digest,
combined with the committed task/event revision, prove a lost response without adding a second
`attempted` authority.

## Blocker

| Field | Type | Rules |
|---|---|---|
| blocker_id | ID | stable until resolved |
| code | stable string | e.g. repository drift/recovery conflict |
| message | string | non-sensitive and within Core Limits 0.1 |
| resume_phase | nonterminal Phase | phase to restore after resolution |
| observed_binding_digest | SHA-256 | current conflicting reality |
| required_resolution | string | concrete condition within Core Limits 0.1 |
| created_at | timestamp | UTC |

## Outcome

| Field | Type | Rules |
|---|---|---|
| status | enum | `completed` or `cancelled` |
| acceptance | OutcomeCriterion[] | one per contract criterion |
| automated_checks | EvidenceSummary[] | retained within Core Limits 0.1 |
| manual_checks | EvidenceSummary[] | retained within Core Limits 0.1 |
| unverified_items | string[] | explicit |
| risks | string[] | explicit |
| final_repository_binding_digest | SHA-256 | required |
| summary | string | within Core Limits 0.1 |
| completed_at | timestamp | UTC |

## TaskEvent

| Field | Type | Rules |
|---|---|---|
| event_id | ID | unique |
| task_id | ID | foreign key |
| revision | uint64 | unique per task |
| event_type | string enum | mutation type |
| phase_before | Phase | required |
| phase_after | Phase | required |
| action_id | ID or null | mutation identity |
| request_id | ID | request identity |
| payload_digest | SHA-256 | normalized payload |
| created_at | timestamp | UTC |

Events do not contain goal text, source content, raw output, or repository path.

## RepositoryClaim

| Field | Type | Rules |
|---|---|---|
| repository_identity | SHA-256 | unique active key |
| task_id | ID | unique active task |
| origin_host | Host | copied for diagnostics |
| claimed_at | timestamp | UTC |

Claim is deleted in the same transaction that reaches `DONE` or `CANCELLED`.

## Relational Schema

### tasks

- primary key `task_id`;
- unique active repository identity enforced through `repository_claims`;
- `revision` not null;
- JSON columns for bounded domain aggregates where relational querying is not needed;
- indexed by status, origin host, and updated time.

### task_events

- primary key `event_id`;
- unique `(task_id, revision)`;
- foreign key to tasks;
- bounded rows only.

### repository_claims

- primary key `repository_identity`;
- unique `task_id`;
- foreign key to tasks.

### schema_migrations

- primary key `version`;
- applied time and migration digest.

## JSON Codec Boundary

The Store persists typed aggregates as JSON only where relational querying is unnecessary. Its
codec rejects unknown fields and trailing JSON, enforces the persisted snapshot byte limit, then
constructs typed Domain values and invokes the single Task invariant entry point. Domain does not
parse generic JSON. The future MCP adapter applies its own closed-input decoding before Domain
dispatch.

## State Invariants

1. Terminal task has no current action, blocker, or repository claim.
2. `BLOCKED` task has blocker and resume phase.
3. Nonterminal nonblocked task has one current action.
4. Action revision equals task revision.
5. Action binding digest equals task repository binding digest.
6. Task revision equals latest event revision after a mutation.
7. Contract never changes.
8. Only one active claim exists for a repository identity.
9. Evidence count and bytes remain within fixed limits.
10. Outcome acceptance list covers every acceptance criterion exactly once.
11. A read may compare a fresh observation but never persists it or changes phase, revision, event,
    blocker, or action.
12. `IMPLEMENT_CHANGE` may update only the worktree portion of a binding; other ordinary apply paths
    require exact issuance-binding equality, while `RESOLVE_BLOCKER` is limited to its stored
    binding condition and `resume_phase`.
