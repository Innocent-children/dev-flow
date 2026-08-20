# Implementation Plan: Publish Codex 0.4.0

**Branch**: `main` | **Date**: 2026-08-20 | **Spec**: [spec.md](spec.md)

**Change Type**: Release Change

**Input**: Feature specification from `specs/009-publish-codex-0.4.0/spec.md`

## Summary

Align the current repository and distributed Codex product to `0.4.0`, update the current release
manifest so it identifies the completed Feature 008 graph contract, and add one root release command.
The command composes the existing deterministic builder, verifier, resumable publisher, registry
read-back, native final Journey, GitHub asset verification, and finalization in one invocation.

The operator supplies only an absolute durable output path and exact `v0.4.0` confirmation. The
command prepares an absent or empty directory, resumes an exact existing five-file directory, and
stops on every other local or remote state. Existing publish-once, read-before-mutation, digest,
atomic record, and conflict gates remain authoritative.

## Current System Baseline

| Surface | Current Authority | Current Behavior | Feature Impact |
| --- | --- | --- | --- |
| Domain | `internal/domain/` | Feature 008 graph task and baseline model complete | Unchanged |
| Workflow/Process | `internal/workflow/` | `standard-development@1`, 11 nodes, 29 normal transitions | Unchanged; identity recorded in manifest |
| Persistence | `internal/store/` | Fresh Schema 2, snapshot v2, Schema 1 zero-write rejection | Unchanged; release docs retain boundary |
| MCP | `internal/mcp/`, `protocol/fixtures/graph-*.json` | Contract 0.2 and six tools | Unchanged; current fixture version aligns to `0.4.0` |
| Host Adapter | `packages/codex/` | Explicit Codex package with bundled darwin-arm64 Core | Version and public availability change only |
| Release entrypoints | `package.json`, `scripts/build-codex-release.sh`, `scripts/verify-codex-release.mjs`, `scripts/publish-codex-release.mjs` | Three manual commands; publisher is resumable | Add one thin root command composing them |
| Release manifest | `release/schemas/release-manifest.schema.json`, `scripts/verify-codex-release.mjs` | Schema 1 binds Feature 003/005 and an old fixture digest | Replace current implementation authority with Schema 2 bound to Feature 008 and graph identities |
| Public identity | `VERSION` and workspace manifests | Current source remains `0.3.0`; public `0.3.0` is historical linear runtime | Align current authorities to `0.4.0`; preserve historical evidence |

## Technical Context

**Language/Version**: Go `>=1.26`; Node.js `>=24`; POSIX shell for existing builders

**Primary Dependencies**: Node.js standard library; existing `git`, `npm`, `gh`, `pnpm`, Go, and Codex executables; no new dependency

**Storage**: Runtime SQLite Schema 2 unchanged; release output is five regular files in one durable external directory

**Transport/Public Surface**: Existing local STDIO MCP product; root maintainer command `release:codex`

**Testing**: Node command/package/publication/Journey tests; Go release/package/graph contract tests; shell and JSON syntax; one final `pnpm run validate`; one production registry Journey

**Target Platform**: Release operator and distributed runtime: macOS arm64

**Performance Goals**: One invocation begins or resumes the release; bounded remote observations and existing command timeouts remain unchanged

**Constraints**: Clean pushed `main`; strict SemVer; exact confirmation; no CI publication; generated output outside Git; one npm publish; four immutable GitHub assets; frozen historical release identities

**Scale/Scope**: One Codex package, one bundled Core, one platform, one source commit/tree, one Tag, one npm version, one GitHub Release

## Constitution Check

*GATE: Passed before research and after design.*

| Principle / Constraint | Status | Evidence / Design Response |
| --- | --- | --- |
| Single Core authority | PASS | Release tooling does not persist or infer Core task state |
| Bounded state graph | N/A | Feature 008 graph is published unchanged |
| Comprehensibility gate | N/A | Product process behavior is unchanged |
| Method tools are guidance | PASS | Package retains Feature 008 profile mapping without release-owned cursor state |
| Recovery before retry | PASS | Publisher rereads local/remote truth and resumes only exact state |
| Read-only Git | PASS | Core remains read-only; maintainer release tooling has explicit Feature 009 authority |
| Evidence-bounded testing | PASS | Targeted checks, one full validation, and one final native Journey are specified |
| Proven simplicity | PASS | One thin orchestrator reuses three existing commands and adds no dependency or framework |
| Release separation | PASS | Feature 009 is a release-only feature selecting completed Feature 008 |
| Host fixture parity | PASS | Shared Core fixtures remain unchanged; current product version fixture alignment is tested |

Post-design review remains PASS. No Constitution exception is required.

## Design

### Process and Domain Model

Core entities, graph definitions, Task semantics, transition contracts, and Recovery behavior are
unchanged. Release metadata records `core_contract_version=0.2`, `storage_schema_version=2`,
`snapshot_version=2`, `process_id=standard-development`, `process_version=1`, and the existing
definition digest.

### Public Contract

The root package adds:

```text
release:codex -- --output ABSOLUTE_DIRECTORY --confirm vVERSION
```

`scripts/release-codex.mjs` validates the two exact flags, version authorities, clean pushed `main`,
platform, and output state. For a missing path it creates one real directory; for an empty path it
runs preparation and verification; for an exact five-file path it resumes. It then invokes the
publisher with the exact confirmation. Unknown flags, relative paths, symlinks, in-repository paths,
version mismatches, dirty/unpushed source, partial file sets, and immutable conflicts fail closed.

The existing `release:codex:prepare`, `release:codex:verify`, and `release:codex:publish` scripts remain
available as internal reviewed components and diagnostic entrypoints. Production operator guidance
uses only `release:codex`.

The current release manifest advances to Schema 2. Its closed release identity removes the obsolete
Feature 003/005-only fields and records the completed Feature 008 commit plus Core Contract, storage,
snapshot, and process identity. Publication record Schema 1 and the nine-step remote state machine
remain unchanged.

### Persistence Transition

Feature disposition is `N/A`: release orchestration does not read or write the Core database. The
distributed runtime preserves Feature 008's `reject-and-reset` contract for Schema 1/pre-graph data,
including zero writes and explicit user-controlled archive, rename, deletion, or fresh data root.

### Recovery and Concurrency

The wrapper never invents recovery state. An exact five-file directory is delegated to the existing
publisher, which validates manifest/publication identity and rereads npm, Tag, Draft, assets, Journey,
and Release state before mutation. One command may be rerun with the same directory and confirmation;
publish-once and immutable conflict rules remain in `scripts/publish-codex-release.mjs`.

The first confirmed production invocation published npm once and created the exact Tag/Draft, then
stopped during registry propagation; exact rerun verified npm and entered the final Journey. The
substantive native session passed, while the resume mutation omitted the caller-generated request ID
binding and Core correctly returned `INVALID_ARGUMENT`. Because source/Tag/npm are now immutable, the
approved recovery uses reviewed prompt tooling from a later commit against a clean `main`-named
checkout at frozen source `a749143b74d786cfc7c864155897984481c1d24b`. A confirmation-free preflight
must first prove exact reuse and zero assets. The confirmed recovery may then rerun the Journey and
continue finalization without moving Tag, republishing npm, changing artifacts, or recreating Draft.
The first fixed-prompt recovery passed the request-binding gate, then exposed that final-registry
post-session validation still required the historical Schema 1 handshake and `phase` cursor. The
second tooling correction adds an explicit graph-contract validation branch that reuses the existing
Contract 0.2 handshake and reads `current_cursor` for terminal and retained tasks; the historical
linear validator remains the default for frozen fixture paths.

### Method Profiles and Host Adapters

The Codex package continues to expose `plain`, `spec-kit`, and `openspec` over the same Core graph.
Only current version metadata, release availability statements, and final artifact evidence change.
DeepSeek metadata follows the root workspace version but no DeepSeek package is built or published.

### Documentation and Product Definition

Update `README.md`, `MANIFEST.md`, `docs/PRODUCT.md`, `docs/ARCHITECTURE.md`,
`docs/RELEASE-STRATEGY.md`, `release/README.md`, `release/codex/README.md`, and
`packages/codex/README.md` so public `0.4.0` availability, one-command operation, platform support,
and historical-data boundary are current. Historical Feature 001–008 records remain unchanged except
Feature 009 references them as frozen dependencies.

## Project Structure

### Feature Documentation

```text
specs/009-publish-codex-0.4.0/
├── README.md
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── one-command-release.md
│   └── release-manifest.schema.json
├── checklists/requirements.md
└── tasks.md
```

### Source Changes

```text
VERSION
package.json
packages/codex/package.json
packages/codex/plugin/.codex-plugin/plugin.json
packages/deepseek/package.json
scripts/release-codex.mjs
scripts/verify-codex-release.mjs
scripts/validate-repository.sh
release/schemas/release-manifest.schema.json
protocol/fixtures/graph-server-info.json
tests/contract/package_manifest_test.go
tests/contract/release_contract_test.go
packages/codex/tests/release-command.test.mjs
packages/codex/tests/package-contract.test.mjs
packages/codex/tests/release-package.test.mjs
packages/codex/tests/release-publication.test.mjs
packages/codex/tests/journey-harness.test.mjs
README.md
MANIFEST.md
docs/PRODUCT.md
docs/ARCHITECTURE.md
docs/ROADMAP.md
docs/RELEASE-STRATEGY.md
release/README.md
release/codex/README.md
packages/codex/README.md
```

**Structure Decision**: Retain the existing release builder, verifier, publisher, Journey runner,
schemas, fixtures, and tests. Add one Node.js standard-library orchestrator because argument/path
validation and exact resume-state classification are clearer and safer there than in another shell
layer.

Feature 006 `release/testdata/` remains frozen Schema 1 history. Current Schema 2 coverage comes from
the Feature 009 planning schema, its implementation mirror, verifier tests, and temporary prepared
release directories.

## Test Strategy and Budget

| Checkpoint | Required Checks | Explicitly Excluded |
| --- | --- | --- |
| Contract freeze | JSON/Markdown validity and `git diff --check` | Product tests, remote mutation |
| User Story 1 | `release-command`, package-contract, release-package, release-publication; Go release/package contracts; syntax checks | Real npm/GitHub mutation and native Journey |
| User Story 2 source gate | Codex package/Journey harness tests, graph contract fixture, deterministic local release preparation | Public publication before clean source commit |
| Final source gate | One `pnpm run validate`, final analyze/converge, clean pushed `main` | Extra platform/Host matrices |
| Public release | One `release:codex` invocation, npm/asset read-back, one real registry-package Codex Journey, final Release read-back | DeepSeek and unsupported platforms |

Repository-wide validation budget: one initial run before publication. The 2026-08-20 initial run
reached `go test ./...` and exposed one current-version fixture test that still constructed ServerInfo
with literal `0.3.0`; all preceding release/command/contract gates passed. One retry is authorized only
after `internal/mcp` derives that current test version from root `VERSION` and its targeted package
test passes. The initial production Journey failed at the observed resume request-binding gate. One
recovery Journey is authorized after a targeted prompt-contract correction and test; no additional
repository-wide validation is authorized.

## Rollout and Persistence Boundary

The maintainer explicitly authorized direct `main` implementation. One clean source commit is pushed
to `origin/main`, then the one-command release creates and retains
`/Users/innocent-children/dev-flow-releases/v0.4.0`, publishes `v0.4.0`, and records remote truth. After
successful publication, a documentation-only completion commit records bounded public evidence on
`main` without moving Tag `v0.4.0` or changing published bytes.

Incident recovery retains the original release directory and frozen source. Reviewed tooling is
committed separately, then runs one read-only preflight and one confirmed publisher resume against a
clean external checkout of Tag `v0.4.0` with local branch name `main`.

No feature flag or persistence rollout exists. Installers with Schema 1/pre-graph data receive the
Feature 008 safe-stop and choose a fresh data directory or manage the old directory explicitly.

## Complexity Tracking

No Constitution violations or approved complexity exceptions.
