# Contract: Storage Generation 2 and Explicit Data Reset

## 1. Scope

This contract governs the persistence boundary for Feature 008:

- one fresh SQLite Schema 2 bootstrap;
- one strict snapshot-version-2 codec;
- rejection of every pre-graph database, including Schema 1 task data;
- explicit user-controlled archive, rename, or deletion before first use of the graph Core;
- future/corrupt schema and process safe-stop;
- task/event/claim atomicity for current-generation tasks;
- five-class uncertain-mutation recovery for current-generation tasks.

Feature 008 intentionally provides **no historical-task compatibility**. It does not authorize:

- Schema 1 → Schema 2 migration;
- `legacy-linear@1` or any other compatibility process;
- snapshot-version-1 decoding or encoding;
- old task projection, continuation, conversion, import, or export;
- automatic deletion or replacement of an existing data directory;
- downgrade from Schema 2.

Historical release documents and public artifact identities remain immutable evidence. Historical
runtime task data is outside the supported product contract after this breaking refactor.

## 2. Storage Generation and Schema Version

```go
const SchemaVersion = 2
const SnapshotVersion = 2
```

Schema 2 is a **new bootstrap baseline**, not “Migration 2” applied after Schema 1. A fresh database
contains exactly one accepted schema-history entry:

```text
version = 2
```

The stored digest must match the exact normalized Schema 2 bootstrap statement list compiled into the
binary. Any other history—including version `1`, `1,2`, a gap, an extra version, a reorder, or a
digest mismatch—returns `SCHEMA_UNSUPPORTED` before task access or mutation.

## 3. Fresh-Directory Precondition

The graph-based Core may initialize persistence only when the selected Dev Flow data directory is:

- an existing usable directory containing no Dev Flow database; or
- a directory containing an exact supported Schema 2 database.

When a Schema 1 database or any unsupported Dev Flow database is present, Core:

1. returns `SCHEMA_UNSUPPORTED`;
2. performs zero SQL, task, event, claim, file-content, rename, truncate, or delete mutations;
3. reports that pre-graph task data is unsupported by this build;
4. requires the user to explicitly choose a fresh data directory or manually archive/rename/delete
   the old data outside Core.

Core, package setup, package update, package removal, and npm uninstall MUST NOT automatically erase
or reset task data.

## 4. Schema 2 Bootstrap

On a fresh directory, Core creates the complete final schema in one serializable transaction. The
semantic table shapes are:

```sql
CREATE TABLE schema_migrations (
    version INTEGER PRIMARY KEY,
    applied_at TEXT NOT NULL,
    digest TEXT NOT NULL
);

CREATE TABLE tasks (
    task_id TEXT PRIMARY KEY,
    origin_host TEXT NOT NULL,
    process_id TEXT NOT NULL,
    process_version INTEGER NOT NULL CHECK (process_version >= 1),
    process_definition_digest TEXT NOT NULL,
    snapshot_version INTEGER NOT NULL CHECK (snapshot_version = 2),
    current_node TEXT NOT NULL,
    revision INTEGER NOT NULL CHECK (revision >= 1),
    repository_identity TEXT NOT NULL,
    snapshot BLOB NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX tasks_node_idx ON tasks (current_node);
CREATE INDEX tasks_origin_host_idx ON tasks (origin_host);
CREATE INDEX tasks_updated_at_idx ON tasks (updated_at);
CREATE INDEX tasks_process_idx
ON tasks (process_id, process_version, snapshot_version);

CREATE TABLE task_events (
    event_id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL,
    revision INTEGER NOT NULL CHECK (revision >= 1),
    event_type TEXT NOT NULL,
    source_node TEXT NOT NULL,
    destination_node TEXT NOT NULL,
    transition_id TEXT,
    transition_reason TEXT,
    action_id TEXT,
    request_id TEXT NOT NULL,
    payload_digest TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE (task_id, revision),
    FOREIGN KEY (task_id) REFERENCES tasks (task_id) ON DELETE RESTRICT
);

CREATE TABLE repository_claims (
    repository_identity TEXT PRIMARY KEY,
    task_id TEXT NOT NULL UNIQUE,
    origin_host TEXT NOT NULL,
    claimed_at TEXT NOT NULL,
    FOREIGN KEY (task_id) REFERENCES tasks (task_id) ON DELETE RESTRICT
);
```

The implementation may adjust SQL formatting or add a strictly required index, but the final
accepted schema, statement order, and digest are frozen before implementation. It MUST NOT execute
Schema 1 bootstrap statements first and MUST NOT contain `ALTER TABLE` compatibility logic.

After creating all tables and indexes, the same transaction inserts the Schema 2 history row. Any
statement, verification, digest insert, or commit failure rolls back the entire bootstrap.

## 5. Supported Row Metadata

Every supported task row has exactly:

```text
process_id                = standard-development
process_version           = 1
process_definition_digest = exact standard-development@1 digest
snapshot_version          = 2
current_node              = one closed standard node
```

Supported combination:

| Snapshot | Process | Create | Read | Mutate |
| ---: | --- | ---: | ---: | ---: |
| 2 | exact `standard-development@1` digest | Yes | Yes | Yes |
| any other snapshot | any | No | Safe-stop | No |
| 2 | unknown/future process or digest | No | Safe-stop | No |

Row metadata and decoded snapshot must agree exactly. A mismatch is corrupted or unsupported
storage; it is never treated as a migration opportunity.

## 6. Store-Open Preflight

After schema verification and before exposing a writable Store, Core performs bounded read-only
checks:

- schema history is exactly the supported Schema 2 baseline;
- every required table, column, constraint, and index exists;
- every distinct task row identifies the exact supported process and snapshot version;
- every task snapshot decodes and satisfies the complete node-authority and cross-record aggregate
  invariants from `data-model.md`;
- active nodes `REQUIREMENTS`, `DESIGN`, `TASKS`, `IMPLEMENT`, `TEST`,
  `COMPREHENSION_REVIEW`, `REFACTOR`, `DELIVERY`, and `BLOCKED` each have exactly one claim;
- terminal nodes `DONE` and `CANCELLED` have no claim;
- every claim references an existing active task and exactly matches its `repository_identity`,
  `task_id`, and `origin_host`;
- no task is referenced by more than one repository claim;
- no row/snapshot or task/claim mismatch is accepted.

Example metadata scan:

```sql
SELECT DISTINCT
  process_id,
  process_version,
  process_definition_digest,
  snapshot_version
FROM tasks;
```

Unsupported schema/process failures retain their closed codes. Any malformed authority, missing or
multiple active claim, terminal claim, orphan claim, duplicate task ownership, or
repository/task/host mismatch returns `STORAGE_UNAVAILABLE`. Preflight runs before write exposure,
does not repair/release/delete/create any claim or task, and leaves the database file and logical
Task/Event/Evidence/Claim/Schema manifest unchanged.

## 7. Strict Snapshot Version 2 Codec

There is exactly one persisted task DTO. It contains:

```text
task identity / host
TaskIntent
ProcessReference
current/resume node
current ProcessAction
blocker / LastOperation
RepositoryBinding
current semantic baselines and bounded baseline history
ImplementationRecord
TestRecord
ComprehensionAssessment
Evidence
ProcessOutcome
revision / timestamps
```

Decode rules:

- unknown fields, duplicate members, trailing JSON, invalid UTF-8, invalid enum, over-limit aggregate,
  or invariant mismatch → `STORAGE_UNAVAILABLE`;
- process reference in snapshot equals row metadata;
- current node in snapshot equals row `current_node`;
- task/action revisions and identities agree;
- process definition/digest is supported;
- current authority presence/absence exactly matches the node-authority matrix in `data-model.md`;
- TaskPlan acceptance indexes, completed work-item IDs, TestRecord evidence, comprehension authority,
  and completed Outcome references resolve against the current aggregate;
- no runtime event replay or historical decoder is used to repair invalid data.

Encoding validates the complete domain/workflow aggregate before producing compact JSON and remains
within `MaxPersistedTaskSnapshotBytes`.

The production source MUST NOT include a v1 task DTO, v1 codec, legacy process decoder, or
metadata-selected dual-codec branch.

## 8. New Task Insert

A new task inserts:

```text
process_id                = standard-development
process_version           = 1
process_definition_digest = exact standard-development@1 digest
snapshot_version          = 2
current_node              = REQUIREMENTS
snapshot                  = encoded ProcessTask
```

The task, creation event, and repository claim are committed in one transaction under the existing
uniqueness and CAS rules. No public input can override the process, snapshot version, or entry node.

## 9. Current-Generation Mutation

A successful normal mutation updates in one transaction:

- `tasks.current_node` to the Core-derived destination;
- the strict v2 snapshot;
- revision/update/completed time as appropriate;
- one TaskEvent with exact source/destination/transition/reason;
- Core-generated evidence;
- repository claim retain/release.

Process and snapshot metadata are immutable. Two concurrent handles commit at most once.

## 10. TaskEvent Rules

### Normal transition

```text
event_type        = apply_action
source_node       = source node
destination_node  = Core-derived destination
transition_id     = exact submitted/validated transition ID
transition_reason = NULL for reason-free edge; normalized text for required edge
```

`payload_digest` includes the canonical complete transition-bearing payload.

### Recovery, blocker resolution, and cancellation

Event type and node fields reflect the actual operation. Core does not fabricate a normal
transition ID for an exceptional operation.

## 11. Incompatible Schema 1 Behavior

A Schema 1 database is an expected unsupported input during this rapid-iteration transition.
Feature 008 Core MUST:

- detect it before decoding a task snapshot;
- return `SCHEMA_UNSUPPORTED`;
- preserve the database file and all rows byte-for-byte/logically unchanged;
- avoid creating a Schema 2 history row or any new table/column/index;
- avoid releasing claims, cancelling tasks, or generating events;
- provide no “continue old task” or “convert task” API.

After the user explicitly selects a fresh directory or manually archives/renames/deletes the old
Dev Flow data, the next open initializes Schema 2 and permits only new graph tasks.

No old-binary journey, downgrade behavior, or cross-generation compatibility proof is part of
Feature 008.

## 12. Future and Corrupt Data Behavior

| Condition | Result | Writes |
| --- | --- | ---: |
| Schema history is exactly `[1]` or otherwise pre-graph | `SCHEMA_UNSUPPORTED` | 0 |
| Schema version > 2 | `SCHEMA_UNSUPPORTED` | 0 |
| Schema digest mismatch | `SCHEMA_UNSUPPORTED` | 0 |
| Missing/extra/gapped history | `SCHEMA_UNSUPPORTED` | 0 |
| Future snapshot version | `SCHEMA_UNSUPPORTED` | 0 |
| Unknown process ID/version/digest | `PROCESS_UNSUPPORTED` | 0 |
| Row/snapshot metadata mismatch | `STORAGE_UNAVAILABLE` | 0 |
| Malformed strict JSON | `STORAGE_UNAVAILABLE` | 0 |
| Invalid current action blueprint | `STORAGE_UNAVAILABLE` | 0 |
| Missing required table/column/index | `SCHEMA_UNSUPPORTED` | 0 |

The product does not delete, quarantine, rewrite, import, convert, or repair unsupported data.

## 13. Recovery Contract

For current-generation tasks, LastOperation/operation probe binds:

```text
operation ID
process definition
source node
expected revision
action ID/kind
repository issuance binding
canonical transition-bearing payload digest
```

Repository-changing actions use the same bounded repository-effect relation as their accepted
payload. The five classifications remain:

```text
not_started
completed_and_recorded
completed_but_unrecorded
partially_completed
conflicting
```

Phase 7A implements the complete five-class Core for graph tasks. A probe observes once and writes
nothing. Explicit recovery apply observes again and may commit exactly one recovered normal
transition or one source-to-`BLOCKED` exceptional transaction. A blocker stores the source resume
node, classification, observed drift digest, exact restoration condition, required resolution, and
creation time while retaining the authoritative issuance binding. Resolution returns only to the
stored resume node with a new action identity and one exceptional event. Duplicate recovered
transition, blocker creation, or resolution performs no additional write. Omitted/null fields retain
ordinary behavior; malformed Recovery input returns `INVALID_ARGUMENT`. Storage bootstrap and
unsupported-data rejection are not task mutations and do not create TaskEvents.

## 14. Package Removal and Data Retention

For Schema 2 data only:

- explicit Codex remove does not delete the database;
- npm uninstall does not delete the database;
- reinstalling a compatible graph-based package may reopen current-generation tasks;
- neither operation attempts to discover or convert Schema 1 tasks.

A user may retain an archived Schema 1 database outside the active data directory, but Feature 008
provides no reader or restore path for it.

## 15. Required Evidence

Deterministic tests:

- fresh empty directory → exact Schema 2 bootstrap;
- bootstrap statement order/digest and rollback on failure;
- strict v2 insert/close/reopen/current-action equality;
- Schema 1 rejection with before/after file or logical manifest proving zero writes;
- no v1 codec, `legacy-linear`, dual-task projection, or migration-2 branch in production source;
- future/corrupt schema/process/snapshot safe-stop;
- current-generation concurrent apply;
- event transition fields;
- repository claim retention/release;
- complete Store-open task/claim preflight with zero-write manifests;
- historical Phase 5D non-null Recovery fail-closed evidence plus the superseding Phase 7A
  graph-native operation probe, five-class reconciliation, repository effects, blocker, and
  resolution tests.

Native evidence:

- the one final local-artifact Codex journey uses a fresh Schema 2 data directory;
- no old-task continuation, old-binary observation, or public release mutation is required.

## 16. Explicitly Unsupported

- reading, resuming, cancelling, or completing Schema 1 tasks;
- Schema 1 → Schema 2 migration;
- `legacy-linear@1`;
- v1 snapshot codec or dual codec;
- automatic or manual semantic conversion inside the product;
- task import/export;
- Schema 2 downgrade;
- event-replay repair;
- user-editable process metadata;
- automatic data deletion or reset;
- modifying released historical evidence.
