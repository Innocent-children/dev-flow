# Persistence, Purge and Reset Contract

## Current schema change

The existing schema remains authoritative for Task snapshots, TaskEvent history and repository claims. Feature 014 adds:

```text
tasks.archived_at NULLABLE UTC TEXT
```

No query mirror table, repository projection table, purge receipt, history snapshot, change feed or operation ledger is
added.

## Preflight

Current schema preflight validates the exact schema, persisted Task snapshots, event revision relationship and active
claims. `archived_at` may be non-null only for a terminal Task. Failure returns a safe error with zero writes.

## Archive and restore

The request contains current Task revision and target archive state. One transaction verifies the Task is terminal and the
revision is current, then sets or clears `archived_at`. Repeating the current target state returns that state. ProcessTask
snapshot, revision, node and Outcome remain unchanged.

## Permanent purge

The request contains current Task revision, typed Task ID, nonempty reason and irreversible confirmation. One transaction:

1. reads the current Task;
2. verifies revision, terminal state and zero claims;
3. deletes archive data, TaskEvent rows, any remaining claim rows and the Task row;
4. commits only when every deletion succeeds.

Failure rolls back. After an uncertain HTTP result, reading the Task determines the outcome: present means not deleted;
absent means deleted. No purge receipt or tombstone is retained.

## Concurrent mode

One WebUI instance and all compatible Host processes open the same SQLite data authority. Host identity does not select a
different WebUI database. Existing revision CAS determines concurrent Task writes: two submissions with the same revision
produce one committed result and one stale result. SQLite connection settings required for those existing concurrent
processes are implementation details validated in Store tests.

## Reject-and-reset

Old schema or pre-Feature Task data makes ordinary startup return reset-required with zero writes. Reset flow:

1. resolve the canonical Task database and existing SQLite sidecars;
2. display the exact targets and permanent effect;
3. issue one confirmation token bound to the displayed target identities;
4. obtain exclusive access to the Task database;
5. revalidate the confirmed file targets;
6. delete only the confirmed targets;
7. create and preflight the empty current schema.

Adapter packages, registrations, configuration and unrelated files remain. An interrupted reset returns to reset-required;
the next attempt resolves and confirms the targets that then exist. Failure to obtain exclusive access stops with zero
deletes and does not require a process registry or multi-stage reset protocol.
