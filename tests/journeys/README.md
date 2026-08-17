# Core Journeys

This directory owns process-level journeys for the shared Dev Flow Core. Feature 002 adds the
restart journey only after the application and MCP slices exist; Phase 1–2 reserve this boundary and
do not create a fake adapter or in-process substitute for restart evidence.

Journey fixtures must use temporary repositories and data directories, report simulated or
user-performed evidence honestly, and leave no database or repository state behind.

Feature 005 recovery journeys use only `t.TempDir()` for SQLite databases, Git repositories, JSON,
and bounded helper output. Test setup may initialize and commit a temporary repository fixture.
After setup, the recovery helper exposes read-only Git observations only and compares HEAD plus the
complete porcelain status before and after Core calls. The journey fails if Core or its test helper
mutates the target repository.

Failure labels describe only their deterministic boundary: `pre_commit`, `post_commit_discard`,
`pre_serialization`, `partial_write`, and `restart`. They are not real-host crash evidence. Stores,
database handles, observers, application services, and related Core objects are closed or discarded
before a restart/read-back assertion creates replacements. Test-owned directories are removed by
the Go test framework when each test finishes.
