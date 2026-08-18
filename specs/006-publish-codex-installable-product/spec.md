# Feature Specification: Publish the Codex Installable Product

**Feature Branch**: `006-publish-codex-installable-product`  
**Created**: 2026-08-14  
**Revised**: 2026-08-18
**Status**: Deterministic implementation complete — T001–T046 passed. Real publication created the
exact Tag and GitHub Draft, then stopped twice at npm `EOTP`. The original external release
directory was removed by volatile temporary-directory cleanup; T051–T055 define the approved
recovery preparation and completion route.
**Input**: Build, verify, publish, install, upgrade, and remove the first public `dev-flow-codex`
package from one clean source identity while Feature 004 remains deferred.

## Route Decision

Feature 006 is a Codex-only `0.x` release. It does not wait for, implement, package, test, or publish
DeepSeek Harness integration. The long-term Monorepo still owns two products, and `1.0.0` still
requires both, but host-specific `0.x` products may be released independently when shared Core
semantics are unchanged and the deferred host is stated explicitly.

The existing directory `006-publish-two-installable-products` is superseded by
`006-publish-codex-installable-product`.

The 2026-08-18 recovery amendment preserves the frozen release identity and remote immutable state.
It permits one recovery preparation only because the original external operator directory no
longer exists. Recovery MUST reproduce the frozen npm tarball and Core digests, use a durable
repository-external directory, reconstruct mutable publication truth from exact remote read-back,
and reuse rather than replace the existing Tag and GitHub Draft.

## User Scenarios & Testing

### User Story 1 — Install and run the Codex product from npm (Priority: P1)

As a macOS arm64 Codex user, I can install `dev-flow-codex` from npm, explicitly register it, run
`$dev-flow`, restart Codex, resume the same task, remove the registration, and retain task data.

**Why this priority**: A public release has value only when a user can install and complete the
delivered product without a source checkout or separate Go runtime.

**Independent Test**: On a clean macOS arm64 user environment, install the exact registry version,
run explicit setup, verify package/Core/Codex identity, create and advance one task, restart Codex,
resume to `DONE`, remove registration, uninstall the npm package, and directly reopen the retained
task database with the released Core.

**Acceptance Scenarios**:

1. **Given** no Dev Flow source checkout or Go toolchain is present, **When** the user globally
   installs the supported package and runs explicit setup, **Then** one packaged runtime, one Codex
   plugin, one Skill, and one MCP server are available.
2. **Given** ordinary `npm install`, update, or uninstall, **When** package files change, **Then** no
   Codex registration, shell profile, repository, or task database is silently mutated.
3. **Given** an unsupported OS or architecture, **When** installation is attempted, **Then** package
   compatibility metadata rejects it before setup or host mutation.
4. **Given** a registered supported package, **When** `$dev-flow` creates a task and Codex restarts,
   **Then** the same task/revision/action is resumed and reaches Core `DONE`.
5. **Given** explicit removal and npm uninstall, **When** the released Core is later used against the
   retained data directory, **Then** the completed task remains readable.

---

### User Story 2 — Publish one immutable and internally consistent release (Priority: P2)

As the maintainer, I can build and publish one version from one clean commit and prove that the npm
package, bundled Core, checksums, Git tag, GitHub Release, source identity, and final journey all
refer to the same release.

**Why this priority**: A convenient installer is unsafe when source, package, runtime, and remote
identities can mix.

**Independent Test**: Prepare the release twice from independent clean worktrees, compare the
documented deterministic components, inspect the package allowlist, create a matching draft GitHub
Release, publish the npm version once, redownload and verify the registry tarball, run the final
registry-package Codex journey, finalize the manifest/checksums, upload and redownload GitHub
assets, then publish the GitHub Release.

**Acceptance Scenarios**:

1. **Given** a dirty worktree, non-main source, inconsistent version, conflicting tag, unavailable
   package ownership, existing npm version, or failed required check, **When** preparation runs,
   **Then** it stops before any remote mutation.
2. **Given** two clean builds from the same commit and approved toolchains, **When** deterministic
   components are compared, **Then** the Go runtime bytes and normalized package trees match.
3. **Given** a verified local release set, **When** the operator creates remote state, **Then** only
   an exact matching Git tag and draft GitHub Release are created before npm publication.
4. **Given** npm publication succeeds, **When** registry read-back downloads
   `dev-flow-codex@<version>`, **Then** package files, modes, version, source identity, runtime
   identity, and digest match the prepared set.
5. **Given** npm read-back and the final registry-package Codex journey pass, **When** the final
   manifest and checksum set are generated, uploaded, and redownloaded through the release asset
   API, **Then** every immutable payload digest matches.
6. **Given** all read-back checks pass, **When** the operator finalizes the release, **Then** the
   draft becomes public without moving the tag or changing published npm bytes.

---

### User Story 3 — Upgrade, remove, and recover partial publication truthfully (Priority: P3)

As a user or release operator, I can deliberately upgrade or remove the product without losing task
data, and I can recover from an interrupted publication without pretending immutable remote
components were rolled back.

**Why this priority**: Lifecycle and partial publication failures are inevitable once a package is
public.

**Independent Test**: Install release A, create an active task, install compatible release B, run
explicit setup/read-back, resume where schema compatibility permits, remove the product, and verify
data retention. Separately stop the release process after each remote step and confirm the
publication record reports the exact remote state and safe next action.

**Acceptance Scenarios**:

1. **Given** npm installs a compatible newer package, **When** the user has not run setup, **Then**
   Codex registration is unchanged.
2. **Given** the user runs setup after upgrade, **When** package/Core/Codex identities and retained
   schema are compatible, **Then** registration read-back points to the new package and the task can
   resume.
3. **Given** the retained database has an unsupported newer schema, **When** the released Core
   starts, **Then** it refuses mutation and preserves data.
4. **Given** explicit removal, **When** owned registration is deleted, **Then** task data and unknown
   adjacent files remain.
5. **Given** npm publication succeeded but a later GitHub upload, read-back, journey, or finalization
   failed, **When** the operator reruns the release command, **Then** it reuses only exact matching
   immutable state, never republishes the npm version, and reports the remaining safe step.
6. **Given** existing remote state conflicts by source, digest, version, tag target, or release
   identity, **When** the operator retries, **Then** publication stops for manual resolution and
   does not overwrite or delete the conflict.
7. **Given** the only local release directory is lost after exact Tag and Draft creation but before
   npm publication, **When** the maintainer authorizes recovery preparation, **Then** one durable
   replacement directory may be prepared from the frozen source only if the npm tarball and Core
   digests reproduce exactly and remote truth is reread before any further mutation.

## Edge Cases

- The npm package name exists but the authenticated account lacks publish permission.
- The exact version already exists on npm.
- Registry replication delays metadata or tarball availability.
- A corporate npm mirror does not yet expose the version.
- The Git tag exists at another commit.
- A draft GitHub Release exists with different assets or target commit.
- Upload succeeds but local process exits before recording it.
- Asset read-back follows redirects or returns stale bytes.
- `npm pack` includes an unexpected file or omits executable mode.
- Two release operators start from the same version.
- macOS quarantine or execution permissions prevent the bundled runtime from starting.
- Codex introduces a host-contract change after local Feature 003 validation.
- Upgrade crosses an incompatible SQLite schema.
- The final Codex journey fails after npm publication.
- GitHub Release finalization fails after all assets and npm bytes are immutable.
- A generated manifest accidentally contains tokens, home paths, registry auth, or raw command
  output.
- The operator selected a volatile system temporary directory and it disappears after a partial
  publication attempt while the exact Tag and GitHub Draft remain remotely observable.

## Scope Boundaries

### In Scope

- public `dev-flow-codex` npm package;
- macOS arm64 first-release support;
- one bundled Go runtime inside the host package;
- root `VERSION` alignment;
- clean-worktree and exact-source preflight;
- package `os`/`cpu` constraints and closed file allowlist;
- deterministic runtime and normalized package-tree comparison;
- release manifest, checksums, and durable publication record;
- explicit local operator preparation, verification, and publication commands;
- exact npm/GitHub authentication and ownership preflight;
- exact Git tag and draft GitHub Release handling;
- npm and GitHub artifact read-back;
- one final journey using the registry-downloaded package;
- explicit setup, compatible upgrade, removal, npm uninstall, and retained-data checks;
- truthful partial-publication recovery;
- one explicitly authorized recovery preparation after loss of the sole local operator directory,
  with fixed payload digests and exact remote-state reconstruction;
- documentation for only the supported platform and tested Codex version/range.

### Out of Scope

- Feature 004 implementation or `dev-flow-deepseek` publication;
- Linux, Windows, or Intel macOS support;
- platform-runtime npm subpackages;
- first-run binary download or compilation;
- `postinstall` host mutation;
- automatic/background update;
- package signing, notarization, Sigstore, transparency log, or third-party mirror;
- remote daemon, Web UI, telemetry, or authentication;
- arbitrary version rollback;
- package overwrite, unpublish-as-rollback, tag move, or force publication;
- npm/GitHub publish credentials in pull-request CI;
- publication from an unreviewed pull-request commit;
- changes to shared workflow, recovery, MCP, or SQLite semantics;
- a second real-host journey for a deferred product.

## Requirements

### Release Identity

- **FR-001**: Root `VERSION` MUST be the single release version for the Go Core, Codex package,
  packaged plugin, Git tag `v<VERSION>`, GitHub Release, release manifest, and publication record.
- **FR-002**: The first public version MUST be strict `MAJOR.MINOR.PATCH`; prerelease versions and
  non-`latest` npm tags require a later explicit amendment.
- **FR-003**: A release MUST originate from one clean `main` commit whose commit and tree identities
  are recorded.
- **FR-004**: Existing npm name/version combinations, Git tags, and published GitHub Release assets
  are immutable; the publisher MUST NOT overwrite, move, unpublish as rollback, or force-republish.
- **FR-005**: Release preparation MUST record the exact Core fixture digest and the merged Feature
  003/005 source baseline.

### Package Composition

- **FR-006**: The public package name MUST be `dev-flow-codex`; publish permission for the
  authenticated maintainer MUST be proven before remote mutation.
- **FR-007**: The first package MUST support only `darwin-arm64` through package compatibility
  metadata and MUST contain exactly one executable `runtime/darwin-arm64/dev-flow`.
- **FR-008**: The package MUST be installable without Go, a compiler, source checkout, separate
  backend, or DeepSeek product.
- **FR-009**: The package MUST retain one Codex plugin, one `dev-flow` Skill, one local STDIO MCP
  registration, and the exact six-tool Core surface delivered by Feature 003.
- **FR-010**: The packed file set MUST be closed and MUST exclude Core source, tests, fixtures,
  databases, receipts, release credentials, build caches, source-control metadata, DeepSeek
  resources, and temporary output.
- **FR-011**: The package MUST NOT define `preinstall`, `install`, `postinstall`, `prepare`, or another
  lifecycle hook that mutates host configuration, repositories, task data, shell profiles, or PATH.
- **FR-012**: npm file installation/update/removal and explicit Codex setup/remove MUST remain
  separate operations.
- **FR-013**: Package metadata MUST identify the repository, license, supported Node range, supported
  OS/CPU, public access, and exact package version without embedding secrets or machine paths.

### Build and Verification

- **FR-014**: Release preparation MUST run from two independent clean worktrees at the same commit.
- **FR-015**: The Go runtime MUST be built with documented reproducibility flags and version/source
  identity, and its bytes MUST match across the two builds.
- **FR-016**: npm tarballs MUST be compared by normalized unpacked path, file bytes, executable mode,
  and package metadata; raw archive byte equality is required only if the toolchain actually
  produces it and is not a permanent compatibility rule.
- **FR-017**: Every tarball MUST pass the Feature 003 package/lifecycle/Skill/Core-loop/parser tests
  plus release-specific allowlist and public-metadata tests.
- **FR-018**: A machine-readable release manifest MUST inventory the immutable npm tarball and Core
  binary; the SHA-256 checksum file MUST cover those payloads plus the final manifest. The checksum
  file does not hash itself, and the mutable operator publication record is not a public release
  asset.
- **FR-019**: Generated artifacts MUST not contain credentials, auth configuration, home-directory
  paths, raw environment values, raw host prompts, or unbounded command output.
- **FR-020**: Pull-request CI MUST run only preparation/verification-safe checks and MUST not possess
  npm publish or GitHub Release credentials.

### Publication and Read-Back

- **FR-021**: Irreversible publication MUST require an explicit operator command and exact version
  confirmation after preparation is complete.
- **FR-022**: Preflight MUST verify npm identity/ownership, GitHub repository permissions, clean
  source identity, absence or exact reuse of the tag/draft, and absence of the npm version.
- **FR-023**: The publisher MUST create or reuse only a tag that points to the exact source commit
  and one matching draft GitHub Release.
- **FR-024**: npm publication MUST occur at most once for the version and MUST use the verified local
  tarball.
- **FR-025**: Registry read-back MUST download the exact published package from the public registry
  and verify normalized contents, modes, package version, source identity, runtime identity, and
  digests.
- **FR-026**: After the final registry-package journey, GitHub read-back MUST redownload the Core
  binary, npm tarball copy, final manifest, and checksum file through the official release-asset
  path and verify every non-circular digest.
- **FR-027**: The GitHub Release MUST remain draft until npm read-back, the final registry-package
  Codex journey, final manifest/checksum generation, and GitHub asset read-back all pass.
- **FR-028**: A partial or failed publication MUST write a bounded publication record listing exact
  local identity, remote tag/draft/npm/assets, verified/unverified steps, failure, and safe next
  action.
- **FR-029**: Retry MUST reuse only exact matching remote state; ambiguous or conflicting remote
  state MUST stop without mutation.

### Lifecycle and Final Evidence

- **FR-030**: Final evidence MUST use a clean environment and the registry-downloaded package, not a
  source path or locally substituted runtime.
- **FR-031**: The final journey MUST cover install, explicit setup, ordinary non-trigger, exact
  Skill invocation, task create/apply, Codex restart, resume to `DONE`, explicit removal, npm
  uninstall, and retained-task reopen.
- **FR-032**: Setup/upgrade MUST verify package, plugin, Core, and compatible Codex identities before
  reporting success.
- **FR-033**: Removal MUST delete only proven product-owned registration/receipt state and MUST
  preserve the shared task database and unknown adjacent files.
- **FR-034**: A Core that encounters an unsupported newer SQLite schema MUST refuse mutation and
  preserve data.
- **FR-035**: The support matrix MUST list only macOS arm64, record the actual tested Codex version,
  and retain the package-declared Feature 003 range as informational metadata rather than a release
  gate; every other platform/host remains `UNVERIFIED`.
- **FR-036**: Feature 006 MUST leave `packages/deepseek/` and all shared Core semantics unchanged.
- **FR-037**: If the sole local release directory is lost after partial remote initialization, one
  recovery preparation MAY run only under explicit maintainer approval from the same frozen source
  commit/tree and version.
- **FR-038**: Recovery preparation MUST use a durable absolute directory outside the source
  repository and outside volatile system temporary roots, and that directory MUST be retained until
  publication completes or a maintainer explicitly retires the attempt.
- **FR-039**: The recovered npm tarball SHA-256 MUST equal
  `288a665eb88789dede7ac30b29d447dad8b90347d0f95753df71ceb9e5a06bf4`, and the recovered
  standalone Core SHA-256 MUST equal
  `3f30d9b4607e063e67a7e9845d5a6f071aa5ae7231ccee89ed3f32870ddeb025`; mismatch MUST stop
  recovery before publisher confirmation.
- **FR-040**: A recovered publication record MUST be derived from local verification plus read-only
  remote observation, reuse only Tag `v0.1.0` at the frozen source and GitHub Draft `371678198`,
  require npm `dev-flow-codex@0.1.0` to remain absent before publish, and MUST NOT claim that the
  lost record or provisional manifest was preserved byte-for-byte.
- **FR-041**: npm registry replication read-back MUST make ten bounded observations with a two-second
  interval between unsuccessful observations; the publisher MUST preserve publish-once truth and
  stop with `NPM_READBACK_TIMEOUT` if the version is still unavailable after the tenth observation.
- **FR-042**: npm registry metadata observation MUST request the bounded `version` and `dist` object
  fields from the supported npm CLI, require string `dist.integrity` and `dist.tarball` values, and
  reject missing or malformed identity before package read-back.
- **FR-043**: The final registry Journey MUST accept a real executable Codex located outside the
  source repository when `codex --version` returns a strict semantic version. It MUST NOT require a
  fixed Codex version/range or Mach-O file type, and MUST record the observed version in final
  evidence.
- **FR-044**: The production publisher MUST load the final Journey runner and evidence validator
  from its own fixed tooling checkout. The frozen source checkout MUST remain limited to release
  source identity and MUST NOT select an older publisher/Journey implementation.

## Key Entities

- **Release Identity**: Version, source commit/tree, Core fixture digest, build profile, and Feature
  baselines.
- **Codex Package Artifact**: Public npm tarball containing one Codex product and one macOS arm64
  Core runtime.
- **Release Manifest**: Closed machine-readable inventory of identities, toolchains, files, modes,
  checksums, and support evidence.
- **Publication Record**: Durable operator record of prepared and remote immutable state.
- **Artifact Record**: Name, kind, path, size, SHA-256, package integrity, and source identity.
- **Support Matrix Entry**: OS, architecture, actual Codex version, compatible range, package digest,
  Core version, and final-journey result.
- **Lifecycle Observation**: Bounded setup/upgrade/remove/read-back facts used by final evidence.
- **Recovery Preparation**: One approved reconstruction of the lost operator directory that binds
  reproduced immutable payloads to reread remote Tag, Draft, npm, asset, and journey state.

## Success Criteria

- **SC-001**: A clean macOS arm64 environment installs exactly one `dev-flow-codex` package and
  bundled Core without Go or another host product.
- **SC-002**: npm install/update/uninstall performs zero hidden Codex, repository, shell, or task-data
  mutation.
- **SC-003**: Two clean builds produce identical Go runtime bytes and identical normalized package
  trees.
- **SC-004**: Package, Core, plugin, tag, manifest, and GitHub Release all report one version and one
  source identity.
- **SC-005**: Every npm/GitHub artifact is redownloaded and digest/content verified before release
  finalization.
- **SC-006**: The final registry-package Codex journey reaches `DONE`, removes registration, and
  reopens retained task data.
- **SC-007**: Unsupported platforms are rejected or labeled `UNVERIFIED` and receive no support
  claim.
- **SC-008**: Partial publication leaves a truthful resumable/manual record and never overwrites an
  immutable component.
- **SC-009**: `packages/deepseek/` is unchanged and no DeepSeek product claim is made.
- **SC-010**: Pull-request CI contains no release credentials or irreversible publication step.
- **SC-011**: Loss of the sole local operator directory can be recovered once without moving or
  deleting the exact Tag/Draft, without publishing a different payload, and without treating a
  regenerated provisional manifest or publication record as prior preserved evidence.
- **SC-012**: A registry version that becomes visible within ten observations separated by
  two-second intervals is verified in the same publisher invocation, while a longer delay stops
  truthfully without a second npm publication.
- **SC-013**: The production npm CLI metadata shape used by the publisher is exercised by a closed
  fixture command contract and yields the exact version, integrity, and official tarball identity.
- **SC-014**: A repository-external executable Codex launcher, including an official Node.js script,
  can complete the final Journey regardless of its semantic version while the observed version is
  preserved in the final support entry.
- **SC-015**: A publisher imported from a tooling checkout invokes the runner adjacent to that
  tooling module even when `repositoryRoot` points at a different frozen source commit.

## Implementation Evidence Status — 2026-08-17

- T001–T046 implement and validate all three user stories without changing shared Core, MCP,
  SQLite, workflow, recovery, or `packages/deepseek/` contracts.
- Feature 003 supplies the existing real Codex create/restart/resume/`DONE`/remove evidence.
- Feature 005 recovery and Feature 006 local tgz/lifecycle/upgrade/release/fake-remote tests are
  deterministic evidence only.
- The final Journey runner accepts only the official registry package in production; fixture
  journeys exercise gates but do not create public support evidence.
- T047 created the frozen payload and real publication attempts created the exact Tag and GitHub
  Draft. Both npm attempts stopped at `EOTP`; npm `0.1.0`, assets, final Journey, and Release
  finalization remain absent/pending.
- The sole T047 operator directory was under a volatile macOS temporary root and is now absent.
  T051–T055 cover the approved one-time durable recovery preparation, exact payload digest proof,
  remote-state reconstruction, resumed publisher, and final completion verification.

## Assumptions

- Features 003 and 005 are merged and green before implementation.
- The authorized maintainer can obtain or already has npm publish permission for
  `dev-flow-codex`; failure to prove this stops the feature for a naming amendment.
- Initial public support is intentionally limited to macOS arm64.
- The bundled-runtime package layout from Feature 003 remains suitable for the first release.
- GitHub and npm remote publication are non-transactional; truth and resumability come from the
  publication record, not rollback claims.
- The lost provisional manifest and mutable publication record had not been uploaded as public
  assets; recovery may regenerate them only while preserving the frozen payload/source identities
  and rereading all remote state.
