# Feature Specification: Publish Codex 0.4.0

**Feature Branch**: `main`

**Created**: 2026-08-20

**Status**: Blocked

**Change Type**: Release Change

**Contract Impact**: Release

**Release Impact**: Release-only feature

**Dependencies**: Completed Feature 008 at merged `main` commit `3b99b0c198a72f0e079ada18bc7f214075585f79`; historical public `0.3.0`

**Input**: User description: "Upgrade and publish version 0.4.0 through the simplest release flow: modify `main`, then use one release command."

## Problem Statement

The repository has a deterministic builder, verifier, resumable publisher, and final Codex Journey,
but the maintainer must currently coordinate separate preparation, verification, preflight, and
publication commands. The completed Feature 008 graph runtime also remains identified as unpublished
`0.3.0` source. The maintainer needs one bounded release change that aligns the product to `0.4.0`
and exposes one exact-confirmation command for the complete public release.

## User Scenarios & Testing

### User Story 1 - Publish from one command (Priority: P1)

As the release maintainer, I provide one durable output directory and the exact `v0.4.0`
confirmation from a clean `main` checkout, and one command completes all safe local and remote release
steps or reports the exact resumable failure state.

**Why this priority**: This is the requested simplification and the sole authority for irreversible
release effects.

**Independent Test**: In an isolated fake npm/GitHub/Git environment, invoke the root release command
once and prove ordered prepare, verify, preflight, publish-once, read-back, Journey, assets, and
finalization behavior; invoke it again against exact completed state and prove no immutable mutation
is repeated.

**Acceptance Scenarios**:

1. **Given** a clean reviewed `main`, an absent or empty durable output path, aligned `0.4.0` identities,
   absent remote `0.4.0` identities, and exact confirmation, **When** the maintainer invokes the release
   command, **Then** it prepares and verifies the five-file release set before publishing the exact
   version once.
2. **Given** a valid retained release directory and exact partially completed remote state, **When**
   the maintainer invokes the same command with the same confirmation, **Then** it reuses matching
   completed steps and continues only the missing steps.
3. **Given** a source, version, digest, Tag, npm, Draft, asset, or confirmation conflict, **When** the
   command evaluates the release, **Then** it stops before the conflicting mutation and records a safe
   next action.

---

### User Story 2 - Install the verified graph release (Priority: P2)

As a Codex user on macOS arm64, I install `dev-flow-codex@0.4.0` from the public npm registry and
receive the Feature 008 graph runtime with one bundled Core and an exact public release record.

**Why this priority**: Publication is complete only when the registry bytes and real installed
product are verified.

**Independent Test**: Download the exact registry tarball in an isolated environment, verify its
digest and closed contents, then complete the native create/restart/resume/`DONE`/remove/uninstall/
retained-reopen Journey against fresh Schema 2 data.

**Acceptance Scenarios**:

1. **Given** public npm version `0.4.0`, **When** the final Journey installs from the official registry,
   **Then** package, plugin, bundled Core, ServerInfo, manifest, Tag, and Release report the intended
   identities and the graph task reaches `DONE`.
2. **Given** a pre-graph data directory, **When** the released Core observes it, **Then** it rejects the
   directory with zero writes and preserves user control over archive, rename, deletion, or fresh-root
   selection.
3. **Given** the final Journey and asset read-backs pass, **When** the publisher finalizes the GitHub
   Release, **Then** the support statement covers only the verified macOS arm64 Codex artifact.

### Edge Cases

- A missing output directory is created as the durable release directory; an empty existing directory
  is prepared; an exact prepared or partial directory is resumed; every other directory state fails
  closed.
- A failure after npm publication preserves the publish-once fact and resumes from registry read-back.
- A matching existing Tag, Draft, npm version, Journey, or asset is reused only after exact identity
  verification.
- A conflicting immutable remote identity produces a blocked publication record and no overwrite,
  move, deletion, unpublish, or replacement publication.
- Persisted-data disposition is `N/A` for this release change; the distributed runtime retains Feature
  008's Schema 1 zero-write rejection and user-controlled reset contract.
- An interrupted command retains the durable output and publication record so the same command can
  reread reality before continuing.
- After Tag and npm become immutable, a final-Journey tooling defect may be corrected only by reviewed
  release tooling operating against the exact frozen source checkout and retained release directory;
  immutable remote identities and bytes remain unchanged.

## State-Graph Impact

### Process Definition

- **Process ID**: N/A — this Release Change publishes the completed definition unchanged.
- **Process Version**: N/A — `standard-development@1` remains authoritative.
- **Affected Nodes**: None.
- **Existing Data Disposition**: N/A for release behavior; distributed runtime preserves Feature 008
  `reject-and-reset` semantics.
- **Historical Runtime Code**: None.

The node set, outgoing transitions, method profiles, payloads, persistence rules, and recovery rules
remain exactly those approved and completed by Feature 008.

## Requirements

### Functional Requirements

- **FR-001**: The approved release version MUST be strict SemVer `0.4.0`, with Tag and GitHub Release
  identity `v0.4.0`.
- **FR-002**: Root product, Codex package, Codex plugin, private DeepSeek workspace metadata, bundled
  Core, current public fixtures, manifest, and release output MUST report the aligned current version.
- **FR-003**: The release MUST include the completed Feature 008 Core Contract 0.2, Schema 2,
  `standard-development@1`, six-tool MCP surface, and three method profiles from one clean source
  commit and tree.
- **FR-004**: The root workspace MUST expose one production release command accepting one absolute
  durable output path and the exact `v0.4.0` confirmation.
- **FR-005**: One invocation MUST validate clean pushed `main`, source identity, version alignment, output
  state, deterministic preparation, release verification, remote preflight, publication, registry
  read-back, final Journey, asset read-back, and Release finalization in that order.
- **FR-006**: The command MUST create a missing output directory, prepare an empty output directory,
  and resume an exact valid prepared or partial output directory.
- **FR-007**: Remote mutation MUST begin only after local verification and a complete remote preflight
  pass under the exact version confirmation.
- **FR-008**: Publication MUST create or reuse the exact Tag and GitHub Draft, publish npm at most once,
  verify registry bytes, pass the native registry-package Journey, upload and read back the four
  immutable assets, then finalize and reread the GitHub Release.
- **FR-009**: Every observation and completed, failed, or blocked step MUST be recorded atomically in
  the durable external publication record with one safe next action.
- **FR-010**: Reinvoking the command against exact retained state MUST reuse completed steps and MUST
  NOT move a Tag, overwrite an asset, republish or unpublish npm, or hide a prior partial result.
- **FR-011**: The release manifest MUST bind version, source commit/tree, Feature 008 identity, Core
  Contract 0.2, Schema 2, process definition identity, package/Core digests, closed contents, final
  Journey, and the single macOS arm64 support entry.
- **FR-012**: The final public package and support statement MUST cover only `dev-flow-codex` on macOS
  arm64; DeepSeek and other platforms remain unpublished and unsupported.
- **FR-013**: Historical `0.3.0` Tag, npm package, GitHub Release, artifacts, digests, publication
  records, historical specifications, and historical fixtures MUST remain immutable.
- **FR-014**: Release documentation MUST state the public `0.4.0` graph contract, installation entry,
  supported platform, historical-data safe-stop, and one-command operator route.
- **FR-015**: Ordinary validation and CI MUST exercise only preparation-safe checks and MUST NOT
  create a Tag, publish npm, mutate a GitHub Release, or run the production publisher.
- **FR-016**: One final repository-wide validation MUST pass before the clean source commit is pushed
  and used for publication.
- **FR-017**: If the immutable Tag and npm version exist but the final Journey fails because reviewed
  tooling guidance is insufficient, a later reviewed tooling commit MAY resume the retained publisher
  against a clean checkout of the frozen source only after an exact read-only remote preflight; the
  recovery MUST reuse the Tag, Draft, npm bytes, manifest identity, and publication record, and MUST
  NOT republish npm, move the Tag, recreate the Draft, or change the prepared artifacts.

### Persistence Transition Requirements

- **FR-S001**: This Release Change uses disposition `N/A` because it does not change persisted
  behavior.
- **FR-S002**: The released runtime MUST preserve Feature 008's zero-write rejection of pre-graph or
  unsupported data and MUST NOT delete, rename, truncate, replace, or convert it automatically.
- **FR-S003**: The release MUST contain no legacy runtime, historical decoder, dual projection,
  migration, or conversion path.

### Non-Goals

- The feature MUST NOT change Core graph, MCP, persistence, Recovery, Host Adapter, setup/remove, or
  task lifecycle semantics completed by Feature 008.
- The feature MUST NOT publish DeepSeek, add another platform, add signing/notarization, introduce
  lifecycle downloads, add a hosted release service, or grant publication credentials to CI.

### Key Entities

- **Release Invocation**: One maintainer request containing the durable output directory and exact Tag
  confirmation.
- **Release Directory**: Durable repository-external state containing the immutable payloads and
  mutable publication record.
- **Release Manifest**: Closed immutable identity binding source, product contract, package, Core,
  supported platform, and final evidence.
- **Publication Record**: Mutable atomic record of remote truth, step outcomes, and safe continuation.

## Success Criteria

### Measurable Outcomes

- **SC-001**: A maintainer starts or resumes the complete release with one root command and two
  explicit values: output path and `v0.4.0` confirmation.
- **SC-002**: All current version authorities and distributed identities report `0.4.0`, while every
  frozen historical `0.3.0` identity remains unchanged.
- **SC-003**: The final publication record contains nine completed ordered steps, one verified npm
  version, four verified GitHub assets, one passed native Journey, one public GitHub Release, and no
  unresolved safe next action.
- **SC-004**: The public registry tarball and all GitHub payloads match the prepared SHA-256 values and
  closed package inventory.
- **SC-005**: The final native Journey reaches `DONE`, removes registration, uninstalls the package,
  and reopens retained current-generation task data on macOS arm64.
- **SC-006**: A repeated exact command after completion causes zero additional immutable publication
  mutations.
- **SC-007**: The repository records one passing full validation and contains no generated release
  output or credential material.
- **SC-008**: Incident recovery completes the existing release with npm publish count one, unchanged
  Tag/source/package digests, one passed final Journey, and no replacement release identity.

## Assumptions

- The authenticated maintainer retains npm ownership of `dev-flow-codex` and GitHub release permission
  for `Innocent-children/dev-flow`.
- `v0.4.0` and `dev-flow-codex@0.4.0` are absent when the release begins.
- The release host is native macOS arm64 with supported Go, Node.js, pnpm, npm, Git, GitHub CLI, and
  Codex executables.
- The durable output path is `/Users/innocent-children/dev-flow-releases/v0.4.0` unless the maintainer
  supplies another absolute repository-external path.

## Open Questions

- Has the maintainer read the final-registry proof implementation and validation path, can explain and
  maintain it, and explicitly confirms that the current result passes `COMPREHENSION_REVIEW`?
