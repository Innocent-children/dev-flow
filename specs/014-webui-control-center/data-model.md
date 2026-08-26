# Data Model: Dev Flow WebUI Control Center

## Boundary

`ProcessTask` remains the workflow aggregate. WebUI reads existing Task snapshots and TaskEvent rows, and persists only
the terminal archive flag required by the list. Graph and Recovery projections are derived on read.

## Existing entities

### ProcessTask

Existing Core authority for intent, process, current node, Action, revision, Scope, baselines, records, Evidence,
Blocker, Recovery-related LastOperation and Outcome. WebUI uses Application/Workflow behavior to read or mutate it.

### TaskEvent

Existing immutable revision event provides event kind, source, destination, transition, reason, Action/request identity,
payload digest and time. Events are ordered by revision for timeline and actual graph traversals. They do not reconstruct
the current Task.

### RepositoryClaim

Existing active ownership rows remain the authority for repository claims. Terminal Tasks have no claims; their repository
Scope remains available in the persisted Task snapshot.

## Added field

### ArchiveState

`tasks.archived_at` is a nullable UTC time:

- null: Task is visible in the default list;
- non-null: terminal Task is archived;
- only `DONE` and `CANCELLED` Tasks may be archived;
- changing archive state does not alter the ProcessTask snapshot or revision;
- setting the current target state again returns that state without another change.

## Read projections

### TaskSummary

Built from the existing `tasks` row and decoded ProcessTask snapshot:

- Task ID, request summary, origin/execution Host;
- current node, lifecycle, revision and updated time;
- primary and additional repository Scope;
- archive state and current Blocker/Outcome summary.

List processing uses existing indexed columns to obtain candidates and decodes their snapshots for remaining filters. Pages
have a fixed maximum size and deterministic order; no durable cursor or query watermark is stored.

### TaskDetail

One read model containing the complete current ProcessTask, archive state, ordered events and derived graph. A revision
change invalidates the model used by an open mutation form.

### ProcessGraphProjection

Derived from resolved Process Definition, TaskEvent rows and current Action:

- all nodes and transitions;
- actual traversals in revision order;
- current node and Blocked resume relation;
- current legal transition IDs;
- future reachable node and transition IDs.

Traversal uses a visited set and always terminates. The projection is never persisted.

### RuntimeReceipt

Mode-0600 Core-managed receipt containing:

- PID;
- process start identity;
- shared data-root digest;
- exact loopback URL;
- creation time.

The receipt contains no CSRF value or reusable credential.

## Transactions

### Core mutation

Existing transaction and revision CAS remain authoritative for Task snapshot, event and claims.

### Archive/restore

One transaction reads the Task, verifies terminal status and expected Task revision, and sets `archived_at` to the requested
target state. Repeating the same target state returns the current result.

### Purge

One transaction verifies current revision, terminal state and zero claims, then deletes Task-owned archive state, events,
claims and Task row. Any failed check rolls back. No receipt or tombstone is stored.

## Startup and reset

- Current schema preflight remains zero-write for existing data.
- Any unsupported schema or pre-Feature Task data returns reset-required.
- Reset requires exclusive access to the Task database and a confirmation bound to the exact canonical database and existing
  SQLite sidecars.
- Confirm first obtains exclusive access and revalidates targets. Failure returns zero deletes; success deletes only those
  files, creates the current empty schema and runs preflight.
- Interruption returns to reset-required; the next reset creates a new plan from the files that currently exist.

## Lifecycle

```text
old data → reset-required → confirmed reset → empty current schema
→ Task create/update and TaskEvent history
→ optional terminal archive/restore
→ confirmed terminal purge → no Task-linked data
```
