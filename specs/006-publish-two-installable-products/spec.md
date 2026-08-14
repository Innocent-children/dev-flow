# Feature Specification: Publish Two Installable Products

**Feature Branch**: `006-publish-two-installable-products`

**Created**: 2026-08-14

**Status**: Planned — blocked by `003`, `004`, and required `005` hardening

**Input**: From one clean source identity, build, verify, and publish two independently installable
products—`dev-flow-codex` and `dev-flow-deepseek`—that contain the same compatible Go Core.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Install either product independently from npm (Priority: P1)

As a user, I can install only the host product I use and receive a compatible platform runtime
without installing the other host or a separate Dev Flow backend.

**Why this priority**: Independent products are the public distribution promise.

**Independent Test**: In a clean supported machine/user environment, install each final npm artifact
separately, run explicit setup/add, start its host, verify Core identity, then uninstall/remove it.

**Acceptance Scenarios**:

1. **Given** only the Codex package is installed, **When** setup and `$dev-flow` run, **Then** the
   Codex product works without the DeepSeek package.
2. **Given** only the DeepSeek package is installed, **When** the package is added and `/dev-flow`
   runs, **Then** the DeepSeek product works without the Codex package.
3. **Given** an unsupported OS/architecture, **When** installation or setup runs, **Then** it fails
   before host configuration mutation with a clear supported-target message.
4. **Given** both products are installed, **When** one is removed, **Then** the other product and
   shared task data remain functional.

---

### User Story 2 - Publish one immutable, internally consistent release (Priority: P2)

As the maintainer, I can publish one version from one clean commit and prove that Go binaries,
product packages, checksums, Tags, and GitHub/npm identities all refer to that release.

**Why this priority**: A convenient installer is unsafe if package/runtime versions can mix.

**Independent Test**: Build twice from clean checkouts, compare deterministic components, validate
all package archives, create a draft release, publish platform packages and host packages in a safe
order, install from registries, and verify the exact runtime identity.

**Acceptance Scenarios**:

1. **Given** a dirty worktree, inconsistent `VERSION`, moved existing Tag, existing conflicting npm
   version, or unavailable required package, **When** release starts, **Then** it stops before any
   irreversible publication.
2. **Given** two clean builds of the same source identity and approved toolchain, **When** components
   are compared, **Then** deterministic assets match and intentionally nondeterministic metadata is
   explicitly normalized or excluded by contract.
3. **Given** a draft GitHub Release and unpublished npm version set, **When** publication proceeds,
   **Then** platform runtime packages become available before host packages that reference them.
4. **Given** all packages are published, **When** registry artifacts and GitHub assets are
   redownloaded, **Then** their contents, checksums, versions, source identity, and Core identity
   match the local verified set before the GitHub Release becomes final.
5. **Given** a partial npm publication failure, **When** the operator retries, **Then** the workflow
   never overwrites an existing version and reports the exact recoverable/manual state.

---

### User Story 3 - Upgrade and remove without hidden lifecycle mutation (Priority: P3)

As a user, I can deliberately upgrade or remove either host product while preserving task data and
understanding which product-owned registration changes will occur.

**Why this priority**: package-manager convenience must not hide host-configuration mutation,
runtime acquisition, or unverifiable lifecycle side effects.

**Independent Test**: Install release A, create an active task, install compatible release B, run
explicit setup/upgrade read-back, resume the task where schema compatibility permits, remove one
product, and verify retained data and other product function.

**Acceptance Scenarios**:

1. **Given** a newer compatible product package, **When** npm updates package files, **Then** host
   configuration is not silently changed by npm lifecycle hooks.
2. **Given** the user runs explicit setup/upgrade, **When** registration changes, **Then** previous
   and requested product-owned identities are read back and success/failure is reported.
3. **Given** a task database schema incompatible with the new Core, **When** setup/launch occurs,
   **Then** mutation stops safely; data is not deleted or silently downgraded.
4. **Given** explicit removal, **When** product-owned registration is removed, **Then** task data is
   retained by default and unknown files are preserved.

## Edge Cases

- npm package scope/name is unavailable.
- One platform package publishes but another fails.
- Host package is accidentally published before its runtime dependency.
- GitHub draft exists from an interrupted attempt.
- The Tag exists locally or remotely at another commit.
- npm registry replication delays package lookup.
- The package manager omits optional dependencies.
- A corporate registry mirror does not carry platform packages yet.
- npm scripts are disabled.
- One host supports the release while another host changed after final candidate testing.
- Package archive permissions differ across build machines.
- macOS quarantine or Windows execution policy blocks a runtime.
- A user has both products with different package versions.
- Update encounters an unsupported database schema.

## Scope Boundaries

### In Scope

- one root product version and source identity;
- supported platform Go binaries;
- npm platform-runtime package strategy selected during plan;
- two public host product packages;
- GitHub Release assets and SHA-256 checksums;
- clean checkout builds;
- deterministic component comparison;
- package archive inspection;
- explicit setup/upgrade/remove commands or supported host actions;
- npm and GitHub publication preflight;
- draft/re-download/read-back verification;
- final-package Codex and DeepSeek journeys;
- task-data preservation;
- exact support matrix.

### Out of Scope

- package-version overwrite or force publish;
- automatic/background update;
- silent `postinstall` configuration mutation;
- centralized daemon/runtime required by both products;
- package signing, Sigstore, transparency log, third-party mirror, or offline installer unless a
  separate specification is approved;
- Web UI;
- telemetry;
- unsupported-platform claims;
- all-platform matrix in the first release;
- arbitrary rollback command;
- npm publication from pull-request CI.

## Requirements *(mandatory)*

### Functional Requirements

#### Version and Source Identity

- **FR-001**: One root `VERSION` MUST define the release version for the Core, both host products,
  platform runtime packages, Git Tag, GitHub Release, and generated metadata.
- **FR-002**: Release version MUST use strict `MAJOR.MINOR.PATCH`; prerelease publication requires a
  separate explicit version and npm dist-tag policy.
- **FR-003**: A release MUST originate from one clean commit whose commit and tree identities are
  recorded in generated release metadata.
- **FR-004**: Existing local/remote Tags and existing npm versions MUST be immutable; the publisher
  MUST not move, overwrite, unpublish, or force-republish them.
- **FR-005**: Version synchronization MUST be generated or validated from the root source rather
  than maintained through broad text replacement in documentation/tests.

#### Runtime and Package Composition

- **FR-006**: The plan MUST choose a bounded npm platform-runtime strategy that installs only the
  current OS/architecture runtime and does not download a binary on first execution.
- **FR-007**: Each host product MUST depend on or include exactly one compatible platform runtime
  selected by npm package constraints or another equally bounded package mechanism.
- **FR-008**: Codex and DeepSeek products MUST be installable independently and MUST not depend on
  one another.
- **FR-009**: Both products MUST use the same Core source identity and public protocol fixture
  digest for one synchronized `0.x` release.
- **FR-010**: Host packages MUST include only product-owned host resources, launch/setup glue,
  documentation, license, and runtime selection; they MUST not include Core source or another
  host's resources.
- **FR-011**: No package may run an install lifecycle script that modifies host configuration,
  repositories, task data, shell profiles, or global PATH.
- **FR-012**: Package archives MUST be prebuilt and MUST NOT compile Go or TypeScript on the user's
  machine.

#### Build and Verification

- **FR-013**: Release build MUST start from an exact clean checkout with pinned approved Go, Node,
  pnpm, and Spec Kit/source-generation inputs.
- **FR-014**: All supported Go binaries and package archives MUST be built twice from independent
  clean directories and compared according to a documented deterministic-asset contract.
- **FR-015**: Every npm tarball MUST be inspected for a closed file allowlist, executable modes,
  package identity, dependency versions, absence of secrets/temp files, and absence of hidden
  lifecycle mutation.
- **FR-016**: GitHub assets MUST include checksums and a machine-readable release manifest covering
  every published component.
- **FR-017**: Pull-request CI MUST never possess npm publish or GitHub Release credentials.
- **FR-018**: Release publication MUST require explicit operator invocation and preflight current
  GitHub/npm authentication and target ownership.

#### Publication and Read-Back

- **FR-019**: Publication MUST create or reuse only the exact matching Git Tag and one matching
  GitHub draft; ambiguous existing remote state must stop.
- **FR-020**: Platform runtime packages MUST be published and read back before host packages that
  reference them are published.
- **FR-021**: Both host packages MUST be published and read back before the GitHub draft becomes a
  public final release.
- **FR-022**: Registry read-back MUST download the exact published tarball/package metadata and
  validate file content, digest, version, runtime dependency, and source identity.
- **FR-023**: GitHub read-back MUST redownload every asset through the official release-asset path
  and validate it against the locally verified set.
- **FR-024**: Partial publication MUST produce an operator record listing published immutable
  components, unpublished components, draft/tag state, and safe next action; it MUST not pretend to
  roll back npm publication.

#### User Lifecycle and Data

- **FR-025**: Product setup, upgrade registration, and removal MUST remain explicit after npm file
  installation/update/removal.
- **FR-026**: Setup and upgrade MUST verify selected runtime identity and host registration read-back
  before reporting success.
- **FR-027**: Removal MUST preserve the shared task database by default and remove only proven
  product-owned host registration/files.
- **FR-028**: A Core encountering an unsupported newer database schema MUST refuse mutation and
  preserve data.
- **FR-029**: Installing/removing one product MUST not modify the other product's package,
  registration, or runtime selection.

#### Final Evidence and Support

- **FR-030**: One final-package Codex journey and one final-package DeepSeek journey MUST run using
  registry/downloaded artifacts, not development source paths.
- **FR-031**: Each journey MUST include install, explicit activation, create/resume, host restart,
  terminal outcome, and removal/data-preservation checks.
- **FR-032**: The first public support matrix MUST include only OS/architecture/host combinations
  completed with final artifacts; cross-compilation or simulated tests are insufficient.
- **FR-033**: Unverified platforms and host versions MUST be labeled `UNVERIFIED`, not inferred.

### Key Entities

- **Release Identity**: Version, source commit/tree, protocol fixture digest, and build profile.
- **Platform Runtime Package**: OS/architecture-specific npm package containing one Go binary.
- **Host Product Package**: `dev-flow-codex` or `dev-flow-deepseek` distribution artifact.
- **Release Manifest**: Closed list of components, versions, checksums, source identity, and support
  evidence.
- **Publication Record**: Durable operator evidence for partial/final remote state.
- **Support Matrix Entry**: Exact host, OS, architecture, package digest, and journey result.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Installing either host product on a supported target installs exactly one compatible
  platform runtime and does not require Go, a compiler, or the other host product.
- **SC-002**: The two public host packages and every runtime package for one release report the same
  product version and source identity.
- **SC-003**: Two independent clean builds match for every component classified deterministic.
- **SC-004**: Every published npm tarball and GitHub asset is redownloaded and validated before the
  release is declared complete.
- **SC-005**: A dirty tree, conflicting Tag/version, missing runtime package, failed read-back, or
  failed final journey prevents completion.
- **SC-006**: The final Codex and DeepSeek journeys both complete using only released artifacts.
- **SC-007**: Removing either product preserves task data and leaves the other installed product
  usable.
- **SC-008**: The first public release makes no platform or host claim beyond final-artifact
  evidence.
- **SC-009**: Publication failure leaves a bounded truthful record and never overwrites an immutable
  remote component.

## Assumptions

- Features `003` and `004` have completed final local-package journeys.
- Any hardening required by observed host failures has completed through `005` or an explicitly
  narrower replacement.
- Initial public support is expected to be macOS arm64; additional targets require final-artifact
  evidence before inclusion.
- Synchronized `0.x` versions are preferred to reduce compatibility combinations.
- npm package scope, publisher account, and final names will be resolved during clarify before plan.
