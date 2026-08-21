# Feature Specification: Simplify Product Version Governance

**Feature Branch**: `011-simplify-product-version-governance`

**Created**: 2026-08-21

**Status**: Complete

**Change Type**: Product Feature

**Contract Impact**: Public Core, Persistence, Host Adapter, Release

**Release Impact**: None; a standalone product release may follow after merge and a separate mode
decision

**Dependencies**: Latest `main` at `189cd3f`; completed Core, Codex `0.5.0`, DeepSeek `0.5.0`, and
Codex standalone quick/normal release workflow

**Input**: Separate Core, Codex, and DeepSeek product versions, remove artificial internal protocol
versions, and keep Codex release recoverable without publishing in this Feature.

## Problem Statement

Dev Flow currently treats one root version as the version of the whole repository. Core, Codex,
DeepSeek, build outputs, fixtures, release evidence, and release tooling consequently assume the
same number even though the three products can evolve independently. The repository also carries
artificial version numbers for internal contracts, limits, storage, snapshots, process definitions,
build profiles, and release-record formats. Those numbers add compatibility branches without a
current product need.

Maintainers need three independent product identities, direct capability-based compatibility, and a
Codex release command that changes only Codex while freezing the exact bundled Core identity. The
current public values remain unchanged; this Feature changes governance and behavior without
publishing anything.

## User Scenarios & Testing

### User Story 1 - Maintain Three Independent Product Versions (Priority: P1)

As a maintainer, I can inspect and validate one authoritative version for Core, Codex, and DeepSeek,
and those values may differ without making the repository invalid.

**Why this priority**: Every build, runtime, and release behavior depends on correct product
identity. Independent authorities are the smallest useful foundation.

**Independent Test**: In an isolated fixture, set Core to `1.2.3`, Codex to `2.3.4`, and DeepSeek to
`3.4.5`; validate the repository and observe that only Codex's plugin mirror must equal another
value.

**Acceptance Scenarios**:

1. **Given** three different valid product versions, **When** the read-only version check runs,
   **Then** it succeeds and reports no cross-product equality rule.
2. **Given** the private root package, **When** version authorities are inspected, **Then** the root
   package has no version and no fourth repository version exists.
3. **Given** a Codex package/plugin mismatch, an invalid Core value, or an invalid DeepSeek value,
   **When** the check runs, **Then** it fails with the exact invalid authority and performs no write.
4. **Given** the completed Feature source, **When** current values are read, **Then** all three still
   equal `0.5.0` by coincidence rather than by constraint.

---

### User Story 2 - Run Host Products with a Different Bundled Core (Priority: P1)

As a Codex or DeepSeek user, I can run a host product whose package version differs from the Core
executable it carries, while the adapter validates the actual Core identity and required
capabilities.

**Why this priority**: Independent package versions are only real if setup and runtime paths accept
them and report both product identities accurately.

**Independent Test**: Build or fixture Codex `2.3.4` and DeepSeek `3.4.5` around Core `1.2.3`, then
exercise version output, setup/preflight, and catalog/contract compatibility without changing the
three fixture values.

**Acceptance Scenarios**:

1. **Given** Codex `2.3.4` carrying Core `1.2.3`, **When** the user requests the Codex version,
   **Then** output is `dev-flow-codex 2.3.4 (core 1.2.3)`.
2. **Given** the same Codex/Core pair, **When** setup, receipt, upgrade, and removal guards inspect
   the package, **Then** no guard rejects it solely because the two product versions differ.
3. **Given** DeepSeek `3.4.5` carrying Core `1.2.3`, **When** the adapter starts, **Then** it accepts
   the runtime only after validating the actual Core identity, executable, catalog, schemas,
   process definition, and behavior required by the adapter.
4. **Given** a missing, non-executable, malformed, wrong-product, or capability-incompatible Core,
   **When** either host preflights it, **Then** startup fails closed before task mutation.

---

### User Story 3 - Build Each Product from Its Own Authority (Priority: P1)

As a maintainer, I can build Codex or DeepSeek using the host package version for host artifacts and
the Core version for the embedded executable and standalone Core artifact.

**Why this priority**: Build outputs are the evidence boundary between source authorities and later
release recovery.

**Independent Test**: With the three-version fixture, run bounded build-contract tests and observe a
Codex tarball named from `2.3.4`, a standalone Core asset named from `1.2.3`, a DeepSeek package
named from `3.4.5`, and Core binaries reporting `1.2.3`.

**Acceptance Scenarios**:

1. **Given** Codex `2.3.4` and Core `1.2.3`, **When** the Codex release build prepares artifacts,
   **Then** it emits `dev-flow-codex-2.3.4.tgz` and
   `dev-flow-core-1.2.3-darwin-arm64`.
2. **Given** either host build, **When** the Core executable is compiled, **Then** the injected build
   version is the Core authority and never the host package version.
3. **Given** a build report, **When** identities are recorded, **Then** host package version and Core
   version are separate fields and may differ.

---

### User Story 4 - Prepare and Resume a Codex-Only Release (Priority: P1)

As a release maintainer, I can use the existing Codex one-command workflow to prepare or resume a
Codex release that changes only Codex, uses product-prefixed Tags, and freezes the exact bundled
Core identity.

**Why this priority**: The release entrypoint is the highest-risk consumer of the old shared-version
assumption and must preserve read-before-retry behavior.

**Independent Test**: In a no-remote-mutation harness, prepare Codex `2.3.5` from Codex `2.3.4` with
Core `1.2.3` and DeepSeek `3.4.5`; verify the version diff, commit/tag plan, first-release baseline,
artifact names, manifest, path ownership, and frozen-directory resume checks.

**Acceptance Scenarios**:

1. **Given** the first new Codex release after historical `v0.5.0`, **When** its baseline is selected,
   **Then** `v0.5.0` is used and no `codex-v0.5.0` Tag is synthesized.
2. **Given** a later Codex release, **When** its baseline is selected, **Then** the latest eligible
   `codex-v*` Tag is used.
3. **Given** a Codex version change from `2.3.4` to `2.3.5`, **When** the version commit is prepared,
   **Then** only the Codex package and plugin mirror change, the planned commit message is
   `release(codex): v2.3.5`, and the planned Tag is `codex-v2.3.5`.
4. **Given** a frozen release directory for Codex `2.3.5` and Core `1.2.3`, **When** current source
   later contains a different Core version, **Then** resume remains bound to the frozen product,
   versions, Tag, source commit/tree, mode, baseline, artifact digests, and frozen source.
5. **Given** a release directory with a mismatched product or Core identity, **When** resume is
   requested, **Then** it fails before any Git, npm, GitHub, or asset mutation.
6. **Given** changes only under `packages/deepseek/**`, **When** Codex quick eligibility is evaluated,
   **Then** they do not invalidate quick unless shared Core, Codex, or shared product contracts are
   also affected.

---

### User Story 5 - Use Current Capabilities Without Internal Version Numbers (Priority: P2)

As a maintainer or adapter author, I can determine compatibility from current identities,
definitions, schemas, catalogs, and runtime behavior without maintaining artificial protocol,
storage, snapshot, process, build-profile, or evidence-format versions.

**Why this priority**: Removing version numbers is safe only when unsupported data and incompatible
runtimes still fail clearly and without side effects.

**Independent Test**: Validate current Core/host/release contracts and incompatible-data fixtures
after removing all governed internal version fields; confirm current inputs work and obsolete inputs
are rejected with zero writes and no compatibility registry.

**Acceptance Scenarios**:

1. **Given** current runtime and release data, **When** contracts are validated, **Then** no removed
   internal version field or renamed replacement version field is required or emitted.
2. **Given** pre-change persisted data that is incompatible with the current Core, **When** Core
   opens it, **Then** Core performs zero writes and tells the user to select a fresh data directory
   or archive/rename/delete the old data explicitly.
3. **Given** an old release publication directory, **When** current tooling is asked to resume it,
   **Then** tooling safely rejects it before remote mutation and does not add a multi-format parser.
4. **Given** `standard-development`, **When** its identity is inspected, **Then** it has no artificial
   `@1` suffix; a content digest may still identify its exact definition.

### Edge Cases

- A version file contains whitespace, a prerelease/build identifier, an invalid SemVer, or multiple
  lines; the current authority parser accepts only the explicitly documented SemVer form.
- A host package version differs from Core while the Core is otherwise fully compatible.
- A Core executable reports a valid SemVer but the wrong product identity or catalog.
- A release build succeeds but records the host version as the Core version; verification fails.
- A frozen resume directory is internally valid but does not match the requested product, Tag,
  baseline, source tree, mode, Core identity, or artifact digest.
- The repository has only DeepSeek changes since the previous Codex release.
- No product-prefixed Codex Tag exists yet, but historical `v0.5.0` exists.
- A current database is empty, partially initialized, or contains obsolete internal-version
  metadata; unsupported states fail with zero writes.
- A removed internal field is reintroduced under names such as `format_version`,
  `contract_revision`, `protocol_generation`, `api_level`, or `compatibility_version`.
- Current Feature verification is interrupted; interrupted checks remain unverified and do not
  authorize publication.

## State-Graph Impact

**State-Graph Impact: N/A.** This Feature does not change any development-process node, transition,
guard, method step, allowed effect, evidence obligation, blocker, or terminal outcome. It removes the
artificial numeric process identity and retains the stable `standard-development` identity plus the
existing content digest where runtime consistency requires it.

## Requirements

### Product Version Authorities

- **FR-001**: Dev Flow MUST maintain exactly three product versions: Core, Codex, and DeepSeek.
- **FR-002**: Core's only source authority MUST be the root `CORE_VERSION` file.
- **FR-003**: Codex's only source authority MUST be `packages/codex/package.json.version`.
- **FR-004**: DeepSeek's only source authority MUST be `packages/deepseek/package.json.version`.
- **FR-005**: The Codex plugin manifest version MUST mirror Codex's package version and MUST NOT be
  treated as an independent authority.
- **FR-006**: The private root package MUST contain no `version` field, and the repository MUST NOT
  introduce a repository or monorepo version authority.
- **FR-007**: All three authorities MUST accept valid SemVer independently and MUST NOT require
  equality with another product.
- **FR-008**: This Feature MUST leave all three source authority values at `0.5.0`.

### Core Identity and Builds

- **FR-009**: The root `VERSION` authority MUST be renamed to `CORE_VERSION`, with no second root
  product-version file retained.
- **FR-010**: Core version reads, CLI output, server identity, build injection, fixtures, bundled
  builds, release evidence, and current support documentation MUST obtain Core version from
  `CORE_VERSION` or from an executable built from it.
- **FR-011**: A Core executable MUST expose a valid Core product identity and product version.
- **FR-012**: Codex and DeepSeek build paths MUST inject the Core version into Core binaries even
  when a host package version differs.
- **FR-013**: A standalone Core artifact name MUST contain the Core version rather than a host
  package version.
- **FR-014**: No host package manifest may add an embedded-Core version field.

### Codex Product Behavior

- **FR-015**: `dev-flow-codex --version` MUST display the Codex product version and actual bundled
  Core version as distinct values.
- **FR-016**: Codex setup, lifecycle, receipt, removal, and upgrade behavior MUST NOT reject a package
  solely because Codex and Core versions differ.
- **FR-017**: Codex MUST inspect the actual packaged Core executable when it needs Core identity.
- **FR-018**: Codex compatibility MUST use the current Core identity, tool catalog, tool schemas,
  server information, process definition, and required runtime behavior.
- **FR-019**: The Codex tarball name MUST use the Codex package version.
- **FR-020**: Codex build and verification reports MUST record separate `package_version` and
  `core_version` values.

### DeepSeek Product Behavior

- **FR-021**: DeepSeek MUST NOT use its package or bundle manifest version as the expected Core
  version.
- **FR-022**: DeepSeek MUST inspect the actual packaged Core executable for Core identity and version.
- **FR-023**: DeepSeek preflight MUST require a present executable that returns a valid Core identity
  and satisfies the adapter's current catalog, schema, definition, and runtime requirements.
- **FR-024**: DeepSeek build reports and fixtures MUST keep DeepSeek and Core versions distinct.
- **FR-025**: Feature 011 MUST NOT add a DeepSeek publisher.

### Internal Compatibility and Persistence

- **FR-026**: Current code, current public contracts, current fixtures, release contracts, and current
  authoritative documentation MUST remove artificial fields or identities for result envelopes,
  Core contract, Core limits, storage schema, snapshots, process definitions, payload contracts,
  repository digest domains, lifecycle receipts, build reports, release records, numbered build
  profiles, and current production generation names.
- **FR-027**: Removed internal version fields MUST NOT be replaced with another artificial format,
  protocol, contract, generation, API-level, revision, or compatibility number.
- **FR-028**: The process identity MUST be `standard-development`; its content digest MAY remain as
  content identity.
- **FR-029**: Host compatibility MUST be evaluated from current concrete capabilities and behavior,
  not an extra internal protocol version.
- **FR-030**: Persisted data disposition MUST be `reject-and-reset` when pre-change data is
  incompatible: zero writes, no automatic deletion, and an explicit fresh-directory or user-managed
  archive/rename/delete instruction.
- **FR-031**: Current persistence MUST contain no migration framework, codec registry, historical
  decoder, compatibility matrix, or legacy runtime added for this change.
- **FR-032**: Current release manifest and publication record formats MUST contain no internal schema
  version and MUST support only the current format.
- **FR-033**: Historical Release, Tag, npm, artifact, and publication evidence MUST remain byte-for-byte
  frozen and MUST NOT be migrated or rewritten.
- **FR-034**: Current release tooling MUST reject an incompatible historical publication directory
  before any remote mutation and MUST NOT add a multi-version record parser.
- **FR-054**: Current Core result envelopes, Codex lifecycle receipts, and local build reports MUST
  use exact current shapes without a `schema_version` or equivalent format field.
- **FR-055**: Current payload-contract identifiers and repository digest domains MUST remove `@N`
  and `/vN` suffixes; current production types, files, and helpers MUST remove generation-number
  names such as `V2` and `schema2` without changing process behavior.
- **FR-056**: An incompatible pre-change Codex receipt MUST fail before lifecycle mutation with a
  bounded diagnostic; current lifecycle code MUST NOT retain a numbered receipt parser.
- **FR-057**: Designated historical Features, release testdata, legacy protocol fixtures, external
  Codex testdata, and retained native evidence MUST remain frozen and MUST be excluded from current-
  format no-version searches.
- **FR-058**: After implementation, targeted verification, converge, and the single final validation
  pass, the Feature branch MUST be committed, pushed, and opened as a Draft PR; it MUST NOT be merged
  or published by this Feature.

### Codex Release and Recovery

- **FR-035**: `pnpm run release:codex` and `scripts/release-codex.mjs` MUST remain the single formal
  Codex release entrypoint with the existing quick/normal invocation shape.
- **FR-036**: A Codex version commit MUST change only the Codex package version and Codex plugin mirror.
- **FR-037**: A Codex version commit MUST use `release(codex): v<CODEX_VERSION>` and the public Tag
  MUST be `codex-v<CODEX_VERSION>`.
- **FR-038**: New Core and DeepSeek public Tags MUST use `core-v<CORE_VERSION>` and
  `deepseek-v<DEEPSEEK_VERSION>` respectively when separate publishers are authorized in future work.
- **FR-039**: Historical unprefixed Tags through `v0.5.0` MUST remain frozen; no prefixed alias for a
  historical release may be created.
- **FR-040**: The first new Codex release baseline MUST be historical `v0.5.0`; later baselines MUST
  use the latest eligible `codex-v*` release.
- **FR-041**: A Codex release manifest MUST distinguish product, Codex version, Core version, Tag,
  source commit, source tree, and artifact digests.
- **FR-042**: Frozen resume identity MUST bind product `codex`, Codex version, Core version, Tag,
  source commit, source tree, verification mode, previous Codex release, and artifact digests.
- **FR-043**: Resume MUST use its original frozen source and identities even when the current source
  authorities later differ.
- **FR-044**: Quick eligibility MUST use the previous Codex release as its diff baseline and MUST
  classify Core or Codex product/runtime changes as normal.
- **FR-045**: Changes confined to DeepSeek ownership MUST NOT invalidate Codex quick eligibility
  unless they also change Core, Codex, or a shared product contract.
- **FR-046**: This Feature MUST preserve the existing quick/normal semantics, comprehension gate,
  deterministic build, immutable remote-state, and read-before-retry recovery behavior.

### Verification and Documentation

- **FR-047**: A small read-only `versions:check` command MUST validate the three SemVer authorities,
  Codex plugin mirror, absence of root package version, and current Core-version fixtures.
- **FR-048**: The read-only check MUST NOT compare Core, Codex, and DeepSeek for equality and MUST NOT
  mutate version files.
- **FR-049**: `docs/VERSIONING.md` MUST briefly document the three authorities, independent evolution,
  bundled-Core identity, and absence of internal artificial version numbers.
- **FR-050**: Current authoritative repository, product, architecture, support, manifest, and release
  documents MUST describe independent product versions without rewriting historical Feature packages.
- **FR-051**: Targeted tests MUST use different fixture versions for Core, Codex, and DeepSeek.
- **FR-052**: Final verification MUST run targeted tests and at most one `pnpm run validate`.
- **FR-053**: Feature verification MUST NOT run a native Codex journey, native DeepSeek journey,
  real release command, publication, Tag mutation, GitHub Release mutation, platform matrix, stress
  test, or unrelated test expansion.

### Persistence Transition Requirements

- **FR-S001**: Persisted-data disposition is `reject-and-reset` for incompatible pre-change data.
- **FR-S002**: Unsupported data MUST fail closed with zero writes and MUST NOT be deleted, renamed,
  truncated, replaced, or converted automatically.
- **FR-S003**: Production code MUST NOT retain a legacy runtime, historical decoder, dual projection,
  migration, or conversion path for this change.

### Non-Goals

- The feature MUST NOT add a fourth product or repository version, embedded-Core version field,
  compatibility registry, migration framework, generic release framework, release DSL, changesets,
  Lerna, or semantic-release.
- The feature MUST NOT implement Core or DeepSeek publication, change the development process graph,
  change the six-tool MCP capability, add a platform, or broaden host support.
- The feature MUST NOT publish a version, change current product values, create/move/delete a Tag,
  mutate npm, create/modify a GitHub Release, upload public assets, or rewrite historical evidence.
- The feature MUST NOT bulk-edit historical Features 001–010.

### Key Entities

- **Product Version Authority**: One source value owned by exactly one of Core, Codex, or DeepSeek.
- **Core Runtime Identity**: The actual executable product identity, product version, catalog,
  schemas, process definition, and observable compatibility behavior.
- **Codex Release Identity**: Codex product/version/Tag combined with bundled Core version, source
  identity, previous Codex release, verification mode, and artifact digests.
- **Frozen Publication Directory**: Current-format local evidence used for read-before-retry and
  bound to one immutable Codex release identity.
- **Process Definition Identity**: Stable `standard-development` identifier plus a content digest,
  without an artificial numeric process version.

## Success Criteria

### Measurable Outcomes

- **SC-001**: A fixture with Core `1.2.3`, Codex `2.3.4`, and DeepSeek `3.4.5` passes the read-only
  version check.
- **SC-002**: The root package contains zero version authorities and the repository contains exactly
  three product version authorities.
- **SC-003**: Codex plugin version follows only the Codex package version in all targeted fixtures.
- **SC-004**: Every built or fixture Core reports the `CORE_VERSION` value rather than a host version.
- **SC-005**: Codex `2.3.4` carries Core `1.2.3`, reports both, and completes targeted setup/lifecycle
  validation without a version-equality failure.
- **SC-006**: DeepSeek `3.4.5` starts Core `1.2.3` in targeted runtime tests without using package
  version as expected Core version.
- **SC-007**: A simulated Codex `2.3.4` to `2.3.5` release changes exactly two version files and plans
  `release(codex): v2.3.5` plus `codex-v2.3.5`.
- **SC-008**: The first simulated prefixed Codex release uses `v0.5.0`; a subsequent simulation uses
  the latest eligible `codex-v*` baseline.
- **SC-009**: Codex tarball and standalone Core asset names use `2.3.4` and `1.2.3` respectively.
- **SC-010**: Release build evidence records distinct package and Core versions.
- **SC-011**: Release manifest evidence records the correct Codex and Core versions with product,
  Tag, source identity, and digests.
- **SC-012**: Resume rejects a changed product or Core identity before remote mutation and accepts
  an unchanged frozen identity even after current source versions change.
- **SC-013**: A DeepSeek-only changed-path fixture remains eligible for Codex quick evaluation.
- **SC-014**: Searches of current non-historical code, current contracts/fixtures, and authoritative
  docs find zero removed compatibility fields, numbered current-generation identifiers, or
  replacement artificial version fields; the search explicitly excludes frozen historical evidence
  and external dependency/tool format metadata.
- **SC-015**: Incompatible persisted data and incompatible historical publication directories both
  fail before writes or remote mutation.
- **SC-016**: Current source still reports Core `0.5.0`, Codex `0.5.0`, and DeepSeek `0.5.0` after all
  Feature tasks complete.
- **SC-017**: All Feature-targeted tests pass and the single final repository validation passes.
- **SC-018**: Git and remote read-back show no new or moved Tag, npm publication, GitHub Release,
  public asset, or historical evidence mutation from this Feature.
- **SC-019**: Remote read-back shows the pushed Feature branch HEAD and one open Draft PR for Feature
  011, with `main` unmerged.

## Assumptions

- Current public `0.5.0` identities and historical `v0.5.0` remain immutable baselines.
- macOS arm64 remains the only packaged-Core platform in current Codex and DeepSeek products.
- Existing Core identity, catalog, schema, server-info, process-definition, and behavior checks can
  express current adapter compatibility without a new compatibility registry.
- Removing internal storage-format numbers may make existing local data incompatible; before `1.0.0`
  the accepted disposition is safe rejection and a user-controlled fresh directory.
- Constitution version `4.0.0` is governance metadata and is not a product version.

## Open Questions

No acceptance-impacting questions remain in the supplied requirement.
