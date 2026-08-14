# Feature Specification: Bootstrap Monorepo

**Feature Branch**: `001-bootstrap-monorepo`

**Created**: 2026-08-14

**Status**: Ready for Review

**Input**: Establish the Dev Flow Monorepo with one Go core ownership area, two independently
packaged host-product workspaces, one root Spec Kit project, one version source, and bounded
repository validation. This feature delivers project structure only, not product behavior.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Initialize a governed repository (Priority: P1)

As the maintainer, I can open the repository and immediately identify the product boundary,
repository-wide Constitution, active Spec Kit workflow, and ownership of every top-level area.

**Why this priority**: Every later capability depends on one unambiguous project root and one set of
governance rules.

**Independent Test**: Inspect the repository tree and documentation, then run the repository-layout
contract tests to verify one root Spec Kit project and the declared ownership areas.

**Acceptance Scenarios**:

1. **Given** the implemented bootstrap, **When** the repository tree is inspected, **Then** one root
   `.specify/` project and one root `specs/` directory exist.
2. **Given** a contributor reading `README.md`, `AGENTS.md`, and `docs/ARCHITECTURE.md`, **When** they
   review the repository, **Then** they can identify the core, host-product, protocol, test, release,
   documentation, and specification ownership areas.
3. **Given** an invalid nested `.specify/` root or nested `go.mod` in a contract fixture, **When**
   repository-layout validation runs, **Then** it fails and reports the offending path.

---

### User Story 2 - Establish one core and two product packages (Priority: P2)

As the maintainer, I can see a concrete Monorepo layout containing one Go command/core boundary and
two separate host-product workspaces, while no product package claims functionality that does not
exist.

**Why this priority**: Source ownership must be visible before workflow, persistence, MCP, or host
integration code is introduced.

**Independent Test**: List and test the Go module, list pnpm workspaces, and dry-pack each private
host package without installing or publishing anything.

**Acceptance Scenarios**:

1. **Given** the repository layout, **When** Go packages are listed, **Then** exactly one root Go
   module owns `cmd/` and `internal/`.
2. **Given** the pnpm workspace, **When** workspaces are listed, **Then** `packages/codex` and
   `packages/deepseek` are distinct private packages.
3. **Given** either package dry-run, **When** its contents are inspected, **Then** it contains only
   the bootstrap files declared by its manifest and contains no executable entry, lifecycle script,
   or runtime dependency.

---

### User Story 3 - Run bounded baseline validation (Priority: P3)

As a contributor, I can run one documented validation command locally and receive the same bounded
checks that pull requests run.

**Why this priority**: The project needs a reliable baseline before product behavior is added, but
the baseline must remain proportional to the bootstrap scope.

**Independent Test**: Run the documented validation entry point and confirm that it checks Go,
pnpm workspace integrity, package manifests/dry-packs, repository layout, and Markdown links only.

**Acceptance Scenarios**:

1. **Given** a valid checkout, **When** baseline validation runs, **Then** all declared Go, pnpm,
   package, layout, and documentation checks pass.
2. **Given** a contract fixture containing a nested Spec Kit root, nested Go module, product
   `postinstall`, unexpected `bin`, or product runtime dependency, **When** validation runs, **Then**
   it fails with a concrete violation.
3. **Given** a documentation-only change, **When** validation runs, **Then** it does not build release
   binaries, install host plugins, launch Codex/DeepSeek, or publish any asset.

## Edge Cases

- Spec Kit initialization has already created managed templates and Codex Skills.
- The repository directory is non-empty when this document package is copied into it.
- A package directory exists but has no implementation source yet.
- The developer has Node.js but no globally installed pnpm binary.
- A future feature directory intentionally contains `spec.md` but no `plan.md` or `tasks.md`.
- The CI environment is Linux while the first end-user evidence target is macOS arm64.
- Markdown links include paths under hidden directories such as `.specify/`.
- A package dry-run changes output ordering without changing the declared file set.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The repository MUST have one Git project root and one root-level Spec Kit project.
- **FR-002**: The repository MUST NOT initialize nested `.specify/` projects under source or product
  packages.
- **FR-003**: The ratified Constitution MUST exist at `.specify/memory/constitution.md`.
- **FR-004**: Root-level `specs/`, `docs/`, `cmd/`, `internal/`, `packages/`, `protocol/`, `tests/`,
  `release/`, and `scripts/` ownership areas MUST exist or be represented by an explanatory file.
- **FR-005**: The Go source MUST use one root Go module.
- **FR-006**: The Go entry point MUST be located at `cmd/dev-flow`.
- **FR-007**: Shared core implementation packages MUST be reserved under `internal/`.
- **FR-008**: Host-product workspaces MUST be located at `packages/codex` and
  `packages/deepseek`.
- **FR-009**: JavaScript workspaces MUST be managed from one root `pnpm-workspace.yaml`.
- **FR-010**: The root JavaScript package MUST be private and non-publishable.
- **FR-011**: Both host packages MUST remain private during this feature.
- **FR-012**: The repository MUST contain one `VERSION` file with a valid SemVer. Bootstrap may initialize a pre-1.0 value, but validation MUST read the current file and MUST NOT assert one literal version forever.
- **FR-013**: Checked-in package metadata MUST not contradict the root product version.
- **FR-014**: The bootstrap MUST NOT implement MCP, SQLite, workflow transitions, Git observation,
  host setup, host proxying, installation, update, uninstall, or release publishing.
- **FR-015**: The Go entry point MAY expose only bounded help and `version` output that clearly
  states task and MCP functionality is not implemented by this feature.
- **FR-016**: Host package manifests and README files MUST NOT claim a working runtime or host
  integration.
- **FR-017**: The repository MUST provide one local validation entry point covering Go checks,
  workspace integrity, repository-layout contracts, package manifest/dry-pack checks, and Markdown
  links.
- **FR-018**: Pull-request CI MUST invoke the same validation entry point and MUST NOT receive npm or
  GitHub Release credentials.
- **FR-019**: Repository-layout validation MUST reject nested Spec Kit roots, nested Go modules,
  undeclared executable roots, product `postinstall` scripts, product `bin` entries, and product
  runtime dependencies during this feature.
- **FR-020**: Spec Kit managed files under `.agents/skills/`, `.specify/scripts/`, and
  `.specify/templates/` MUST be generated by the latest stable Spec Kit available at initialization rather than handwritten. Repository validation MUST NOT compare an exact Spec Kit patch version.
- **FR-021**: Feature directories `003` through `006` MAY contain specifications without plans or
  tasks and MUST state their generation gate.
- **FR-022**: The root README MUST document setup, active-feature selection, bounded validation, and
  staged implementation.
- **FR-023**: The repository MUST use Apache-2.0 unless the maintainer explicitly changes the
  licensing decision before implementation.
- **FR-024**: This feature MUST NOT publish, register a host plugin, create user data, or mutate the
  global PATH or user configuration.

### Key Entities *(include if feature involves data)*

- **Repository Root**: The single Git and Spec Kit project containing all source and product
  packages.
- **Core Module**: The root Go module that owns the future workflow runtime.
- **Host Product Workspace**: A private bootstrap package reserved for Codex- or DeepSeek-specific
  distribution.
- **Product Version**: The single `VERSION` value used by later build and release features.
- **Ownership Area**: A top-level path with one documented responsibility and dependency boundary.
- **Feature Package**: A numbered directory under `specs/` containing one independently governed
  capability.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A checkout can run the documented baseline validation with zero manual file edits.
- **SC-002**: The repository contains exactly one root `.specify/memory/constitution.md` and no
  nested Spec Kit roots.
- **SC-003**: `go list ./...`, `go vet ./...`, and `go test ./...` complete successfully.
- **SC-004**: The documented package dry-run succeeds for both host packages without executing
  install scripts or publication.
- **SC-005**: Repository contract validation reports zero layout, ownership, or package-manifest
  violations in the project tree.
- **SC-006**: Pull-request CI performs no publication and uses no release secrets.
- **SC-007**: A contributor can identify the owner of every top-level directory from repository
  documentation.
- **SC-008**: The delivered source contains no workflow, persistence, MCP, host-integration, or
  release behavior beyond the explicit help/version placeholder.

## Assumptions

- The repository name is `dev-flow`.
- Initial development occurs on macOS arm64, while baseline CI may use Linux.
- Contributors have Go `>=1.26`, a supported Node.js `>=24`, pnpm `>=11 <12`, and the latest stable Spec Kit.
- Spec Kit is initialized before this document package is copied into the repository.
- Product npm scope and public package ownership are intentionally deferred to feature `006`.
- Host package names remain private workspace identities until publication planning.
