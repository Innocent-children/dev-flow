# Research: Bootstrap Monorepo

## Decision 1: Use one root Spec Kit project

**Decision**: Keep `.specify/` and `specs/` at the repository root only.

**Rationale**: Core and both products share one Constitution and public contract. Multiple Spec Kit
projects would create independent numbering and governance with no built-in Constitution
inheritance.

**Alternatives rejected**:

- One Spec Kit project per package.
- A core project plus two adapter projects.
- Duplicated Constitutions synchronized by scripts.

## Decision 2: Use one root Go module

**Decision**: Initialize one Go module for `cmd/`, `internal/`, and Go contract tests.

**Rationale**: There is one core product authority. Multiple modules would create version and
dependency boundaries before a demonstrated need exists.

**Alternatives rejected**:

- Separate core and CLI modules.
- A reusable public Go library module.
- One Go module per host.

## Decision 3: Use pnpm workspaces only for host packages

**Decision**: The root pnpm workspace includes `packages/codex` and `packages/deepseek`; both remain
private.

**Rationale**: The host ecosystems use npm-compatible packaging. pnpm provides deterministic
workspace management without making Node a Core runtime dependency.

**Alternatives rejected**:

- npm workspaces: viable, but less aligned with the selected project toolchain.
- Turborepo or Nx: unnecessary orchestration for two packages.
- Publishing package placeholders: misleading before host products exist.

## Decision 4: Keep one dynamic version source

**Decision**: Store the current valid SemVer in root `VERSION`. Bootstrap may choose an initial pre-1.0 value, while package metadata and tests always derive or compare against the current file rather than a literal version embedded in specifications.

**Rationale**: One product version keeps the Core and two product boundaries aligned during the `0.x` line without making later version changes invalidate the bootstrap feature.

**Alternatives rejected**:

- Independent package versions from the first feature.
- Version duplicated across documentation.
- Deriving version only from Git tags before a release process exists.

## Decision 5: Provide a minimal placeholder binary

**Decision**: Provide a Go command that supports only `version` and help, clearly reporting that
task and MCP functionality is not implemented by this feature.

**Rationale**: It proves module and binary ownership without pretending that the product journey
exists.

**Alternatives rejected**:

- No binary: leaves the executable ownership boundary untested.
- Stub MCP server: prematurely commits to protocol behavior.
- Placeholder task operations that return success: creates false acceptance evidence.

## Decision 6: Validate repository contracts through Go tests

**Decision**: Use small Go contract tests for root layout, package-manifest constraints, and
Markdown relative links, orchestrated by one repository script.

**Rationale**: Go tests provide portable, path-specific failures without adding a validation
framework or duplicating logic across local and CI scripts.

**Alternatives rejected**:

- A custom policy engine.
- Multiple shell scripts containing overlapping path rules.
- A third-party monorepo linter before product code exists.

## Decision 7: Keep pull-request CI bounded

**Decision**: Pull requests run formatting, vet/test, workspace install, package dry-pack,
repository contracts, and Markdown link checks through the repository validation entry point.

**Rationale**: These checks validate the bootstrap user stories and nothing more.

**Alternatives rejected**:

- Cross-platform release build matrix.
- Real Codex or DeepSeek launch.
- Release asset generation.
- Security or dependency scanners beyond the dependencies introduced by this feature.

## Decision 8: Use Apache-2.0

**Decision**: Use Apache License 2.0 for the project.

**Rationale**: It provides an explicit patent grant and a familiar permissive model.

**Alternatives rejected**: Deferred unless the maintainer changes the licensing decision before
implementation.
