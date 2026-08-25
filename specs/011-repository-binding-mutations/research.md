# Research: Repository Binding Authorized Mutations

## Decision 1: Explicit node-result mutation envelope

**Decision**: Every writable standard node result carries exact `changed_paths` and `no_file_changes`.

**Rationale**: The result reports execution outcome and is retained for uncertain-operation recovery.

**Alternatives considered**: Derive paths from `artifacts[]`; disable drift; add a Host mutation cursor.

**Why alternatives were rejected**: Artifacts may omit supporting files; disabled drift is unsafe; a Host
cursor duplicates Core authority.

**Consequences**: Six node schemas gain two required members; IMPLEMENT/REFACTOR keep existing members.

## Decision 2: Path-level envelope, not writer attribution

**Decision**: Validate baseline path set union declared paths against the fresh path set and preserve stable
identity checks. Content-only concurrent writer attribution on any already-dirty baseline path is out of scope.

**Rationale**: Git cannot identify which process wrote an already-dirty authorized path without new state.

**Alternatives considered**: Persist per-path images; filesystem watcher; Host-signed content claims.

**Why alternatives were rejected**: They change persistence or add an unreliable second authority.

**Consequences**: New undeclared paths and stable-binding changes reject. If bytes change on an already-dirty
baseline path without changing its status membership, the aggregate fingerprint changes but the responsible
path cannot be derived from the persisted aggregate alone.

## Decision 3: No persistence migration or Task recreation

**Decision**: Keep SQLite and process graph unchanged; resume uses persisted Action and live apply schema.

**Rationale**: The defect is payload interpretation, not Task data.

**Alternatives considered**: Change binding storage; bump SQLite schema; cancel affected Tasks.

**Why alternatives were rejected**: None is needed for an explicit path envelope.

**Consequences**: Data disposition is `not-applicable`; restart/resume receives deterministic coverage.

## Decision 4: One ordinary/recovery proof path

**Decision**: Reuse `DeriveRepositoryEffect` and `RepositoryScopeEffectEvidence` for both paths.

**Rationale**: A second classifier could disagree during uncertain mutation recovery.

**Alternatives considered**: Special-case ordinary apply; infer recovery from artifact files.

**Why alternatives were rejected**: Both create divergent authority.

**Consequences**: Recovery tests submit the exact ordinary mutation envelope.
