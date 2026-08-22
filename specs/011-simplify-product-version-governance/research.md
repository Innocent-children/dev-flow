# Research: Simplify Product Version Governance

## Decision 1: Three direct product authorities

**Decision**: Use `CORE_VERSION`, Codex package version, and DeepSeek package version as the only Dev
Flow product authorities. Keep the Codex plugin value as a checked mirror.

**Rationale**: Each value already has a natural product owner. Direct reads prevent a fourth registry
or a duplicate embedded-Core declaration.

**Alternatives considered**: One root repository version; a product registry; host manifests with an
embedded-Core version.

**Why alternatives were rejected**: They preserve coupling or duplicate executable truth.

**Consequences**: Builds and evidence that contain a host plus Core must carry two independently read
values.

## Decision 2: Capability and content identity replace artificial protocol numbers

**Decision**: Remove internal contract, limits, schema, snapshot, and process numbers. Use actual Core
product identity/version, exact six-tool catalog and schemas, closed server info, stable process ID,
definition digest, strict result behavior, and bounded limits as concrete compatibility evidence.

**Rationale**: Current code supports one contract, one data format, and one process. Extra numbers do
not select an implementation and only create equality gates.

**Alternatives considered**: Rename numbers to revision/generation/API level; keep them for future
compatibility; add a compatibility matrix.

**Why alternatives were rejected**: Each recreates the removed internal version system without a
current user need.

**Consequences**: A compatibility failure cites the missing field/catalog/schema/behavior itself.

Current neutralization also covers result-envelope, receipt, build-report, payload-contract, digest-
domain, and production type/helper generation numbers. It is a mechanical identity change; the
process graph and payload behavior remain unchanged.

## Decision 3: Exact current SQLite structure with one database version

**Decision**: Create one exact current SQLite layout directly, store database version `0.1.0` as the
sole `schema_metadata` row, and validate existing databases with a read-only exact
object/column/row/snapshot preflight. Keep migration machinery and numbered task columns/DTO names
removed.

**Rationale**: The database version gives the persisted layout one explicit identity while exact
structure and strict snapshot validation continue to prove compatibility. Feature 011 does not
support old data.

**Alternatives considered**: Preserve `schema_migrations`; replace its integer with a format name or
digest row; migrate existing databases; retain old decoders.

**Why alternatives were rejected**: A metadata row would be a replacement format identity, while
migration/decoders contradict the pre-1.0 current-only boundary.

**Consequences**: Former databases fail before writable open and require a user-controlled fresh
directory.

## Decision 4: Codex release identity contains Codex plus Core

**Decision**: Use product `codex`, Codex version/Tag, bundled Core version, source commit/tree,
verification mode, previous Codex release, and artifact digests as the frozen release identity.

**Rationale**: These are the facts required to reproduce or safely resume a Codex artifact. Host and
Core versions can differ.

**Alternatives considered**: Continue one release version; derive Core from current source during
resume; store Core version in Codex package metadata.

**Why alternatives were rejected**: They either couple products, break frozen recovery, or duplicate
runtime truth.

**Consequences**: Verifier/publisher APIs accept or derive both versions; exact-key validation rejects
old record formats before remote work.

## Decision 5: Product-prefixed Tag lineage with one historical bridge

**Decision**: New Codex Tags use `codex-vX.Y.Z`. The first new Codex release compares against frozen
`v0.5.0`; subsequent releases compare against the latest eligible `codex-v*`.

**Rationale**: The bridge preserves published history without synthesizing a false alias.

**Alternatives considered**: Recreate `codex-v0.5.0`; continue unprefixed Tags; scan all product Tags.

**Why alternatives were rejected**: They rewrite history or reintroduce cross-product lineage.

**Consequences**: Baseline selection has an explicit no-prefixed-tag branch and targeted tests.

## Decision 6: Changed-path ownership stays explicit

**Decision**: Keep the existing quick/normal model. Block quick for Core, shared contract, and Codex
product/runtime paths; do not block a diff confined to DeepSeek ownership.

**Rationale**: Verification intensity follows the product being released, not unrelated monorepo
activity.

**Alternatives considered**: Any `packages/**` change blocks quick; a generic product registry; a new
release framework.

**Why alternatives were rejected**: They are over-broad or outside the requested minimum change.

**Consequences**: The allow/block lists remain direct constants covered by path fixtures.

## Decision 7: Historical and external version markers are not rewritten

**Decision**: Leave Features 001–010, designated legacy protocol fixtures, frozen release testdata,
external Codex testdata, retained native evidence, and public evidence frozen. Retain dependency/
tool-owned version metadata required by external formats, including module/package dependency
versions, JSON Schema dialect URIs, Spec Kit workflow metadata, and Constitution SemVer.

**Rationale**: They are neither Dev Flow product authorities nor internal product compatibility
fields. Rewriting them would damage evidence or external-tool interoperability.

**Alternatives considered**: Global replacement of every textual `version` token.

**Why alternatives were rejected**: It would conflate product governance with immutable history and
third-party format contracts.

**Consequences**: Current production/host/release fields are removed; scoped searches exclude the
enumerated frozen evidence and dependency-owned metadata. Current validators reject frozen old
formats without rewriting them.
