# Implementation Plan: Simplify Product Version Governance

**Branch**: `011-simplify-product-version-governance` | **Date**: 2026-08-21 | **Spec**:
[spec.md](spec.md)

**Change Type**: Product Feature with governance amendment

**Input**: Feature specification from
`specs/011-simplify-product-version-governance/spec.md`

## Summary

Replace the repository-wide version with three independent product authorities. Core reads
`CORE_VERSION`; Codex and DeepSeek read their own package manifests; the Codex plugin remains a
checked mirror. Builds and release evidence carry both host-product and bundled-Core identity where
needed, without adding a duplicate embedded-Core field.

Remove artificial internal version fields from the process reference, MCP server info, SQLite rows,
strict snapshot DTO name, release manifest, publication record, fixtures, adapters, and current
documentation. Compatibility remains closed and evidence-based: exact current SQLite structure,
strict JSON fields, process definition digest, Core identity, tool catalog/schema, artifact digests,
and runtime behavior. Unsupported old data and old publication directories are rejected before
writes or remote effects.

## Current System Baseline

| Surface | Current Authority | Current Behavior | Feature Impact |
| --- | --- | --- | --- |
| Repository version | `VERSION`, root/package/host manifests | All products and root tooling must equal `0.5.0` | Rename the Core authority and remove root/cross-product equality |
| Core version | `internal/version/version.go`, build scripts | Reads root `VERSION`; host build version is injected into Core | Read/inject only `CORE_VERSION` |
| Codex | `packages/codex/package.json`, plugin manifest, lifecycle/bin | Package, plugin, and Core must match | Plugin follows Codex; runtime reports and accepts a different Core |
| DeepSeek | `packages/deepseek/package.json`, `lib/runtime.mjs` | `manifest.version` is passed as expected Core version | Inspect actual Core and validate current capabilities |
| Process/MCP | `internal/domain/process.go`, `internal/mcp/results.go` | Envelope, process, server info, and payload IDs expose numeric internal versions | Retain stable IDs/digests/catalogs; remove artificial fields/suffixes |
| Persistence | `internal/store/migrations.go`, `sqlite.go`, `codec.go` | Migration row, numbered schema helpers, process/snapshot columns, numbered DTO | Direct current-format bootstrap and exact read-only preflight without version metadata |
| Codex build | `scripts/build-codex-*.sh`, verifier | One version names package and Core artifact and is injected into Core | Read Codex/Core separately and record both |
| Codex release | `scripts/release-codex.mjs`, verifier, publisher | One version commit touches five authorities and uses `v*` | Codex-only commit, `codex-v*`, previous Codex baseline, frozen dual identity |
| Release records | `release/schemas/`, verifier/publisher | Top-level schema numbers and internal compatibility versions are required | Closed current-only format with product/Codex/Core/source/artifact identity |
| Documentation | current README/docs/release/package docs | Describes one root version and numbered internal protocols | Document three products and capability/content compatibility |

## Technical Context

**Language/Version**: Go 1.26; Node.js >=24; pnpm >=11 <12; POSIX shell on macOS arm64

**Primary Dependencies**: Existing standard library, MCP Go SDK, `modernc.org/sqlite`, Node built-ins;
no new dependency

**Storage**: One current exact SQLite layout; no storage-format version or migration table

**Transport/Public Surface**: Existing local STDIO MCP six-tool catalog; Codex/DeepSeek packages;
Codex release command and current release-record JSON

**Testing**: Targeted Go packages, contract fixtures, Codex/DeepSeek package tests, release harness
tests, version-governance test, and one final `pnpm run validate`

**Target Platform**: Existing macOS arm64 package/runtime support only

**Performance Goals**: Version checks and preflight remain bounded to small files, one Core identity
command, fixed tool/schema catalogs, or exact local SQLite metadata/rows

**Constraints**: Three product versions stay `0.5.0`; history is frozen; unsupported data fails with
zero writes; remote release mutation is excluded; Core Git access remains read-only; six MCP tools
remain unchanged

**Scale/Scope**: One monorepo, three product authorities, one built-in process, one current SQLite
format, one Codex publisher

## Constitution Check

*GATE: Passed before research and repeated after design.*

| Principle / Constraint | Status | Evidence / Design Response |
| --- | --- | --- |
| Single Core authority | PASS | Only identity metadata changes; Core still owns task/process semantics |
| Bounded state graph | PASS | No node, transition, guard, or tool changes; numeric process identity is removed |
| Comprehensibility gate | PASS | No process behavior or delivery gate changes |
| Method tools are guidance | PASS | Adapter references change fields only; no runtime dependency is added |
| Recovery before retry | PASS | Codex resume binds product, both product versions, source, baseline, mode, and digests |
| Read-only Git | PASS | Core remains read-only; release tooling remains outside Core and is not invoked by this Feature |
| Evidence-bounded testing | PASS | Targeted slices plus one final validation; native and publication journeys excluded |
| Proven simplicity | PASS | Direct reads and exact key/schema checks; no registry, migration framework, or generic publisher |
| Release separation | PASS | Product values remain unchanged and no publication command is executed |
| Host fixture parity | PASS | Shared server/task/process fixtures and both host Skill/runtime tests change together |

No Constitution exception is required. The post-design check also passes: all contracts retain one
Core authority, one process, six tools, current-only storage, bounded recovery identity, and no
publication side effect.

## Design

### Product Version Authorities

- Rename root `VERSION` to `CORE_VERSION`; `internal/version` and every Core build read only it.
- Remove root `package.json.version`.
- Treat `packages/codex/package.json.version` as Codex authority and the plugin manifest as its only
  mirror.
- Treat `packages/deepseek/package.json.version` as DeepSeek authority.
- Add one small read-only `scripts/check-versions.mjs`, used by `pnpm run versions:check`, with a
  fixture-capable exported check. It validates SemVer, names, mirror equality, root absence, and
  Core fixture mirrors; it never compares products.

### Process and MCP Contract

- `domain.ProcessReference` contains `process_id` and `process_definition_digest` only.
- `mcp.ServerInfoResult` contains the Core product/version, transport/health, supported hosts,
  supported process identities/digests, method profiles, and six tools. It omits contract, limits,
  schema, and process numbers.
- Success/error result envelopes retain exact keys, `ok`, request/tool identity, result or
  error/recovery, and remove their schema number.
- `standard-development` remains the stable process ID; the definition digest remains exact content
  identity and continues to protect persisted/runtime consistency.
- Payload-contract IDs drop `@1`; repository digest domains drop `/v1`; numbered current Go
  types/files/helpers are renamed mechanically. These changes alter digests once but do not alter
  nodes, transitions, payload fields, validation, or behavior.
- Codex and DeepSeek Skill references validate the actual closed fields, six tool names, schemas,
  process ID/digest, and behavior. No adapter compatibility number replaces removed fields.

### Persistence Transition

Selected disposition: `reject-and-reset`.

- Rename numbered storage helpers/files/DTO aliases to current-format names.
- Fresh bootstrap creates the current tables and indexes in one serializable transaction, then
  verifies their exact SQL, columns, indexes, and allowed object set. It creates no migrations table.
- Task rows omit `process_version` and `snapshot_version`; snapshots encode the current strict
  `ProcessTask` shape whose process reference has only ID and definition digest.
- Existing database open first uses the current read-only connection and validates the exact current
  object allowlist, columns, row metadata, strict snapshot, definition digest, claim cardinality, and
  task equality. Only after preflight passes may Core open writable.
- Databases with the former migration table, former version columns, partial schema, unknown objects,
  wrong process/digest, malformed snapshots, or corrupt cardinality fail with the existing stable
  unsupported/unavailable errors and zero writes.
- No decoder, ALTER migration, format registry, or automatic reset is added. The error/documentation
  directs users to a fresh data directory or explicit archive/rename/delete outside Core.

### Codex and DeepSeek Runtime

- Codex lifecycle continues to execute `dev-flow version`, parse a Core SemVer, and retain it in the
  receipt/runtime result; the package/Core equality assertion is removed. The CLI version command
  prints both independent values.
- The Codex receipt and local build report use one closed current shape without a schema number.
  Former numbered receipts fail before setup/upgrade/remove mutation with a bounded diagnostic; no
  historical receipt parser is retained.
- DeepSeek `preflightPackagedCore` removes the manifest-derived `expectedVersion` input. It verifies
  the package-relative executable and parses/returns its Core identity/version. Integration startup
  continues through the existing exact six-tool catalog gate and the Skill's live server-info/input-
  schema handshake, updated to current fields. No new schema registry or duplicate contract layer is
  added.
- Neither package manifest gains `coreVersion`, `embeddedCoreVersion`, or equivalent metadata.

### Codex Build and Release

- Local/release build scripts read `codexVersion` from the Codex package and `coreVersion` from
  `CORE_VERSION`; Go ldflags receive only `coreVersion`.
- Output names are `dev-flow-codex-<codexVersion>.tgz` and
  `dev-flow-core-<coreVersion>-darwin-arm64`.
- Release manifest `release` identity is closed over `product=codex`, Codex `version`,
  `core_version`, `codex-v<version>`, source commit/tree, mode, previous Codex release, and creation
  time. Artifacts retain their digests and source identity; process implementation details are not
  release-generation fields.
- Publication record has no format number and binds the same product/Codex/Core/Tag/source identity.
  Extra old fields make old directories invalid under exact-key validation before publisher effects.
- Artifact rows carry name, kind, path, size, digest, mode, integrity, and source identity; the Core
  product version is recorded once in `release.core_version` and verified against the actual bytes.
- The Codex command validates all three authorities but updates/stages only the Codex package and
  plugin mirror, commits `release(codex): v<version>`, and plans `codex-v<version>`.
- Previous Codex release selection uses `v0.5.0` when no `codex-v*` exists, then the latest lower
  `codex-v*`. Both modes record that full baseline Tag; only quick uses it for changed-path
  eligibility. Historical Tags are never aliased or changed.
- Quick ownership blocks Core/shared/Codex product paths and ignores DeepSeek-only paths. Existing
  quick/normal validation intensity is retained.
- Resume compares product, Codex/Core versions, Tag, source commit/tree, mode, previous release, and
  artifact digests; changed current source triggers the existing frozen-source checkout.

### Recovery and Concurrency

No task mutation or concurrency contract changes. Release recovery remains read-before-retry:
validate the closed local record, inspect immutable remote state, compare exact identities/digests,
then continue only the next incomplete step. Old or mismatched local records stop before remote
inspection/mutation that could create state.

### Documentation and Product Definition

Add `docs/VERSIONING.md`. Update current governance/templates and the current README, manifest,
product, architecture, release, support, package, and release-operator documents. Historical Feature
001–010 packages, designated legacy protocol fixtures, frozen release testdata, external Codex
testdata, retained native evidence, and historical public evidence remain unchanged. Current contract
tests treat old release records as incompatible input rather than current-valid format.

External dependency-owned version markers such as Go modules, npm dependencies, JSON Schema dialect
URIs, Spec Kit workflow metadata, and the Constitution's own SemVer remain outside the three Dev Flow
product authorities and are not renamed into product compatibility fields.

## Project Structure

### Feature Documentation

```text
specs/011-simplify-product-version-governance/
├── README.md
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── product-versions.md
│   ├── core-capability-and-storage.md
│   └── codex-release.md
├── checklists/requirements.md
└── tasks.md
```

### Source Changes

```text
CORE_VERSION
package.json
internal/version/
internal/domain/
internal/workflow/
internal/store/
internal/mcp/
internal/application/
internal/repository/
protocol/fixtures/
packages/codex/
packages/deepseek/
scripts/build-codex-local.sh
scripts/build-codex-release.sh
scripts/build-deepseek-runtime.sh
scripts/check-versions.mjs
scripts/release-codex.mjs
scripts/verify-codex-release.mjs
scripts/publish-codex-release.mjs
scripts/write-codex-journey-evidence.mjs
scripts/validate-codex-journey-evidence.mjs
release/schemas/
release/testdata/
tests/contract/
tests/journeys/
README.md
AGENTS.md
MANIFEST.md
docs/
release/README.md
release/codex/README.md
.specify/templates/
```

**Structure Decision**: Retain existing Core/domain/workflow/store/MCP and host/release boundaries.
Neutralize current internal version names mechanically without changing responsibilities; do not add
a shared version library or generic release abstraction.

## Test Strategy and Budget

| Checkpoint | Required Checks | Explicitly Excluded |
| --- | --- | --- |
| Version authorities | Version-governance fixture tests; `pnpm run versions:check`; `go test ./internal/version ./tests/contract` | Full validation, build, release |
| Core contract/storage | Targeted domain/workflow/application/repository/store/MCP/contract/journey packages with current and old-data zero-write fixtures | Historical migration, platform matrix |
| Codex runtime/build | Codex package, lifecycle, CLI, release-command, release-package tests with differing versions | Native Codex journey, real publish |
| DeepSeek runtime | DeepSeek paths/integration/package/Skill/lifecycle tests with differing versions | Native DeepSeek journey, publisher |
| Release records/recovery | Release contract, verifier, publication, quick ownership, first/subsequent baseline, and frozen resume tests | Tag/npm/GitHub mutation |
| Final | One `pnpm run validate` after targeted gates and converge | Second full validation unless a specific failed subcheck requires bounded rerun |

Maximum repository-wide validations: one. Maximum real-host journeys: zero. Maximum real release
invocations: zero.

## Rollout and Persistence Boundary

Merging Feature 011 changes current source contracts and makes old numbered SQLite data unsupported.
Core rejects it read-only with zero writes; users explicitly select a fresh directory or preserve the
old directory outside the active path. Historical release directories remain evidence and are not
accepted for resume by the current-only parser.

No product version changes during implementation. A future maintainer independently selects quick or
normal and invokes the standalone release command for exactly one product.

## Complexity Tracking

No Constitution exception or added complexity is approved.
