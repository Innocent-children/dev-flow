# Implementation Plan: Publish the Codex Installable Product

**Branch**: `006-publish-codex-installable-product`  
**Spec**: [spec.md](./spec.md)  
**Status**: Recovery amendment active. T001–T046 passed; exact Tag and GitHub Draft exist; npm,
Journey, assets, and finalization remain incomplete. T051–T055 recover the lost volatile operator
directory without changing frozen payload/source identity.

## Summary

Feature 006 has converted the private local package delivered by Feature 003 into a fixed public
package contract and implemented its deterministic release machinery. The intended release contains
one `dev-flow-codex` npm package with one bundled macOS arm64 Core runtime. Feature 004 remains
deferred and is neither modified nor published. The first publication attempts stopped at npm
`EOTP`; their exact Tag and Draft remain reusable. The original output directory was lost because it
was placed under a volatile macOS temporary root, so the approved route adds one durable recovery
preparation before completing the existing publication sequence.

The workflow separates repeatable preparation from irreversible publication:

```text
clean source
→ two clean builds
→ normalized comparison
→ package and release validation
→ explicit publish confirmation
→ exact tag + GitHub draft
→ npm publish
→ npm read-back
→ registry-package Codex journey
→ final manifest/checksums
→ GitHub upload/read-back
→ GitHub Release finalization
```

Recovery inserts one bounded prefix before the existing confirmed sequence:

```text
lost volatile operator directory
→ one durable repository-external output directory
→ prepare from frozen source commit/tree
→ require the frozen tarball/Core digests
→ read-only reconstruction from exact Tag/Draft/npm truth
→ existing confirmed publication sequence
```

## Technical Context

| Item | Decision |
|---|---|
| Product | public `dev-flow-codex` |
| Initial platform | macOS arm64 only |
| Runtime layout | one bundled `runtime/darwin-arm64/dev-flow` |
| Package manager | npm package produced through pnpm/npm tooling |
| Node | `>=24`, supported release line |
| pnpm | `>=11 <12` |
| Go | `>=1.26` |
| Release operator tools | `git`, `npm`, `gh`, `sh`, Node standard library |
| Publication location | explicit local operator process, not PR CI |
| Version source | root `VERSION` |
| Registry tag | `latest` for the first stable `0.x` package |
| Git tag | `v<VERSION>` |
| GitHub state | draft until all read-back and final journey pass |
| Deferred product | `dev-flow-deepseek` |
| Signing/notarization | out of scope |
| Full validation budget | preparation checks plus one final registry-package journey |

## Entry Gate

Before implementation:

1. update `main` and verify Features 003 and 005 are merged;
2. copy the delivered Codex compatible range and actual final tested host version into the Feature
   006 baseline record;
3. prove the authenticated npm account can publish `dev-flow-codex`;
4. prove GitHub repository release/tag permissions;
5. confirm `VERSION` is a strict SemVer and the intended version is absent remotely;
6. confirm the first supported target is `darwin-arm64`.

No fallback package name or extra platform is selected inside implementation.

## Constitution Check

| Principle | Result | Design response |
|---|---|---|
| Self-contained scope | PASS | One public Codex product and one platform are released. |
| Single workflow authority | PASS | Release work packages the existing Core without semantic changes. |
| One bounded surface | PASS | Six MCP tools and existing workflow remain unchanged. |
| Thin host adapter | PASS | Package contains only Codex resources, launcher/lifecycle glue, and Core runtime. |
| Recovery before retry | PASS | Feature 005 is an entry gate; publication adds no retry semantics. |
| Read-only repository boundary | PASS | Product Core remains read-only; release operator may tag/publish this source repository only. |
| Evidence-bounded testing | PASS | One final registry-package Codex journey supports the one claimed platform. |
| Proven simplicity | PASS | One package bundles one runtime; no platform-package graph or download installer. |
| Vertical slice | PASS | The feature independently publishes the Codex user journey. |
| Two-host parity | PASS | Host-specific `0.x` release changes no shared semantics; DeepSeek is explicitly deferred. |

The Constitution release gate is amended to allow a host-specific `0.x` release while preserving
the two-product requirement for `1.0.0`.

## Design Decisions

### 1. Keep one bundled runtime

Retain the Feature 003 package layout and add public package metadata plus `os`/`cpu` constraints.
This avoids optional-dependency behavior, registry replication ordering between platform packages,
and first-run downloads.

A later platform feature may introduce a different packaging strategy after real need is proven.

### 2. Keep npm lifecycle inert

`npm install` only places files. `dev-flow-codex setup` and `dev-flow-codex remove` remain the sole
host-registration mutations. No lifecycle hook or downloaded executable is permitted.

### 3. Use a local explicit publisher

The publisher runs from an authenticated maintainer machine and uses `npm` and `gh`. Pull-request CI
runs preparation-safe tests only and receives no release secrets. A future manual GitHub Actions
workflow requires a separate decision.

### 4. Compare normalized package trees

The Core runtime bytes must match between two clean builds. Tarballs are unpacked and compared by
closed path, bytes, executable mode, and package metadata. Raw `.tgz` equality is recorded when it
happens but is not the permanent contract because archive metadata may be toolchain-dependent.

### 5. Treat remote publication as resumable, not atomic

npm and GitHub cannot be rolled back as one transaction. The publication record is written after
every remote observation and mutation. Retry reuses exact matching immutable state and stops on
conflict.

### 6. Finalize only after registry-package use

The final Codex journey installs the package from the public registry in a clean environment. A
local tarball journey is preparation evidence, not final release evidence.

### 7. Recover a lost operator directory without redefining the release

The recovery preparation runs once from frozen commit
`eb3b1b128c7d3d117dc09470fb3477a722b1c13b` and tree
`9466505a70ec3d9d4e3607cd9d20ec038343fb36`. Its output lives under the persistent external root
`/Users/innocent-children/dev-flow-releases/v0.1.0-recovery`, never under `mktemp` or another
volatile system temporary root. The tarball and Core must reproduce the already reviewed digests.

The provisional manifest and mutable publication record may be regenerated because neither was a
published public asset. They are new recovery evidence, not byte-preserved copies of the lost
operator files. The fixed tooling commit rereads and reuses Tag `v0.1.0` and GitHub Draft
`371678198`; any difference in target, Draft identity, assets, npm bytes, version, or source blocks
the route.

### 8. Allow bounded npm replication time

The production publisher observes npm metadata up to ten times and waits two seconds between
unsuccessful observations. Tests inject the wait operation through the existing publication runtime
fixture boundary so they can prove the exact attempt count and interval without adding eighteen
seconds of wall-clock delay. Production keeps the real timer and all existing publish-once,
checkpoint, conflict, and timeout behavior.

### 9. Query npm metadata as a bounded object

The supported npm CLI returns dot-selected fields as flat JSON keys. The publisher therefore asks
for `version` and the bounded `dist` object, then validates nested integrity and tarball strings.
The fake npm command contract accepts only that production argument shape so fixture evidence
cannot silently diverge from the real CLI query.

### 10. Treat the observed Codex launcher as evidence, not a version gate

The final registry Journey requires an absolute, executable Codex launcher outside the source
repository and a parseable semantic version response. It accepts native binaries and executable
scripts, removes the fixed range and Mach-O admission checks, and records the observed version in
the final evidence/support entry. The package-declared Feature 003 range remains informational
metadata; the successful real Journey is the release support proof.

### 11. Separate tooling code from frozen product source

The publisher module resolves the production Journey runner relative to its own module checkout.
`repositoryRoot` continues to validate the frozen release commit/tree and provides no executable
release tooling. This lets a reviewed recovery tooling commit fix publisher/Journey behavior without
changing or substituting the immutable product source and payload.

## Project Structure

### Package and build paths

```text
packages/codex/package.json
packages/codex/README.md
packages/codex/bin/dev-flow-codex.mjs
packages/codex/lib/**
packages/codex/plugin/**
packages/codex/tests/**
scripts/build-codex-local.sh
scripts/build-codex-release.sh
scripts/verify-codex-release.mjs
scripts/publish-codex-release.mjs
scripts/run-codex-real-journey.sh
package.json
pnpm-lock.yaml
```

### Release contract and implementation paths

```text
release/README.md
release/codex/README.md
release/schemas/release-manifest.schema.json
release/schemas/publication-record.schema.json
release/testdata/**
tests/contract/release_contract_test.go
specs/006-publish-codex-installable-product/**
```

Generated release output is written to an operator-selected temporary/output directory and is not
committed.

### User Story 1 implementation audit

The Feature 003 package manifest currently names this production `files` allowlist:

```text
.agents/plugins/marketplace.json
bin/dev-flow-codex.mjs
lib/lifecycle.mjs
lib/paths.mjs
plugin/.codex-plugin/plugin.json
plugin/.mcp.json
plugin/skills/dev-flow/SKILL.md
plugin/skills/dev-flow/agents/openai.yaml
runtime/darwin-arm64/dev-flow
```

`package.json` and `README.md` are npm metadata files, and the current local builder stages the root
license as package `LICENSE`. The packed contract therefore contains those three files plus the
manifest allowlist. The sole runtime path is `runtime/darwin-arm64/dev-flow`; the approved current
builder is `scripts/build-codex-local.sh`.

Current package-contract coverage is in `packages/codex/tests/package-contract.test.mjs` and
`packages/codex/tests/launcher.test.mjs`. Current lifecycle and retention coverage is in
`packages/codex/tests/lifecycle.test.mjs` and
`packages/codex/tests/removal-retention.test.mjs`. The public-package source-free checkpoint adds
only `packages/codex/tests/release-package.test.mjs` to those layers.

The bounded T001–T018 writable scope is:

```text
specs/006-publish-codex-installable-product/**
release/**
tests/contract/release_contract_test.go
tests/contract/package_manifest_test.go
tests/contract/repository_layout_test.go
packages/codex/package.json
packages/codex/LICENSE
packages/codex/README.md
packages/codex/tests/package-contract.test.mjs
packages/codex/tests/launcher.test.mjs
packages/codex/tests/release-package.test.mjs
packages/codex/tests/removal-retention.test.mjs
packages/codex/bin/dev-flow-codex.mjs
packages/codex/lib/paths.mjs
packages/codex/lib/lifecycle.mjs
package.json
scripts/build-codex-local.sh
scripts/validate-repository.sh
.github/workflows/ci.yml
```

The local builder and launcher/path/lifecycle production files are conditional T017 targets and
change only for a test-proven public-package defect. Generated tarballs, prefixes, npm caches,
homes, data directories, repositories, and logs belong in explicit temporary/output directories
and are never committed.
The package `files` allowlist is the publication boundary, so no additional `.npmignore` contract is
introduced. `packages/deepseek/` is read-only; the T003 baseline command
`git diff --exit-code origin/main...HEAD -- packages/deepseek` passed with no output.

#### Bounded User Story 1 scope amendment

The first T015 source-free package test failed before building because
`scripts/build-codex-local.sh` still required the Feature 003 private-package identity. The user
explicitly added that file to the User Story 1 writable scope. Its authorization is limited to
replacing the stale private assertion with the fixed Feature 006 public package contract: exact
name/version, `private` absent-or-false, `darwin`/`arm64`, official public registry, Apache-2.0, and
the unchanged package/plugin/Core compatibility identities.

This amendment does not authorize changes to build arguments, source/dirty gates, Go flags,
runtime layout, deterministic archive construction, SHA-256 reporting, final-artifact behavior, or
any remote operation. After the builder correction, T015 reached setup and exposed the same stale
private assertion in `lib/lifecycle.mjs`; T017 therefore made the matching fixed-public-contract
correction there. `bin/dev-flow-codex.mjs` and `lib/paths.mjs` had no failing test and remain
unchanged.

### CI path

```text
.github/workflows/ci.yml
scripts/validate-repository.sh
```

CI may validate schemas, scripts, package metadata, and dry preparation. It must not publish, create
tags/releases, or require credentials.

### User Story 2 implementation boundary

`scripts/build-codex-release.sh` owns only clean-`main` source admission and two temporary worktree
build orchestration. Each worktree runs its own unchanged local builder. The verifier module owns
normalized tree comparison, five-file generation, closed record/package validation, checksums, and
bounded forbidden-content scanning. Preparation invokes no registry, GitHub CLI, Codex, Tag, push,
or network operation.

`scripts/publish-codex-release.mjs` uses argv-closed subprocess calls with fixed timeouts/buffers and
no shell. It rereads exact npm, Tag, GitHub draft, and asset state before each mutation; writes the
publication record atomically; publishes npm at most once; reuses only matching immutable state;
and blocks rather than overwrites conflicts. User Story 2 tests put fake npm/gh first in an isolated
PATH and use a temporary bare Git remote. A test-local simulated journey exercises only fake-remote
manifest/asset behavior and cannot satisfy the production native evidence validator.

### User Story 3 implementation boundary

The released-package tests perform a real two-version compatible upgrade in isolated npm prefixes,
prove explicit setup is the only registration transition, preserve the same active Task facts, and
refuse downgrade. A packaged Core is also exercised against a future SQLite migration marker and
must stop without changing Schema, Task/Event/Claim rows, database bytes, adjacent data, or the
repository.

The production publisher now owns the complete gated sequence after verified npm read-back:
registry-only final Journey, native support entry, final manifest/checksum rewrite, four-asset
upload/read-back, GitHub Release finalization, and final identity read-back. Fixture runtimes may
stop after npm or before finalization and may inject simulated journey facts only inside isolated
tests; production has no bypass and accepts only native registry-package evidence.

The publisher remains an operator tool outside Core/MCP. Publication records remain external
mutable artifacts and never enter SQLite or the public GitHub asset set. `packages/deepseek/`,
shared Core semantics, MCP tools, recovery classifications, and SQLite Schema are unchanged.

## Release Output

For version `<VERSION>`, the prepared output directory contains:

```text
dev-flow-codex-<VERSION>.tgz
dev-flow-<VERSION>-darwin-arm64
SHA256SUMS
release-manifest.json
publication-record.json
```

The first four files become immutable public payload/metadata assets. `publication-record.json` is a
mutable operator record and is not uploaded as a release asset. The Go binary is both bundled in the
npm tarball and uploaded separately; both copies must have the same SHA-256. `SHA256SUMS` covers the
tarball, standalone binary, and final manifest, but not itself.

## Implementation Phases

### Phase 1 — Public package contract

Convert only `packages/codex` from private local artifact to public macOS arm64 package metadata,
preserve the Feature 003 allowlist/lifecycle behavior, and add release-specific contract tests.

### Phase 2 — Reproducible preparation

Build from two clean worktrees, compare runtime bytes and normalized tarball trees, create
checksums/manifest, validate schemas, and scan for forbidden content. This phase has no remote side
effects.

### Phase 3 — Publication state machine

Implement preflight, exact tag/draft handling, npm publish/read-back, GitHub upload/read-back,
publication-record checkpoints, and conflict-safe resume. Remote mutation remains disabled unless
the exact confirmation argument is present.

### Phase 4 — User lifecycle

Exercise source-free install/setup, ordinary non-trigger, create/restart/resume/DONE,
upgrade/read-back, explicit removal, npm uninstall, retained data, and unsupported schema behavior.

### Phase 5 — Final release

Freeze one source commit, prepare once, publish once, complete all read-backs, run the final
registry-package journey, finalize the GitHub Release, and commit no generated secrets/output.

### Phase 6 — Lost-directory recovery

Record the operator-directory loss, prepare exactly once into the durable external directory from
the frozen source, require fixed payload digests, reconstruct publication truth through a
confirmation-free production preflight using tooling commit `4345bd12`, and then resume the one
confirmed publisher sequence already defined by Phase 5.

## Publication Sequence

1. For lost-directory recovery only, create the approved durable empty directory and prepare once
   from the frozen clean `main` source.
2. Require recovered tarball/Core digests to equal the frozen values; stop on any mismatch.
3. Validate clean `main` source and version.
4. Validate npm/GitHub auth and package/repository ownership.
5. Prove npm is absent and the existing Tag/Draft are exact reusable state.
6. Write a provisional manifest/support entry and initial `publication-record.json` with status
   `prepared`.
7. Reuse the exact Git tag and draft release.
8. Publish the verified npm tarball once.
9. Poll boundedly for public registry visibility; download and verify.
10. Install `dev-flow-codex@<VERSION>` from the registry in a clean environment and run the final
   journey.
11. Finalize the support entry, release manifest, and `SHA256SUMS`.
12. Upload the tarball copy, standalone Core, final manifest, and checksum file; redownload and
    verify.
13. Publish the GitHub Release.
14. Read final release metadata and mark the local operator record `complete`.

At any failure, write the observed state and safe next action. Never delete or overwrite an
immutable remote component as automatic recovery.

## Verification Strategy

### Preparation-safe checks

```bash
node --test packages/codex/tests/*.test.mjs
go test ./tests/contract
pnpm run release:codex:prepare -- --output "<temp-dir>"
pnpm run release:codex:verify -- --directory "<temp-dir>"
```

### Final publication

```bash
pnpm run release:codex:publish -- \
  --directory "<verified-release-dir>" \
  --confirm "v$(cat VERSION)"
```

The publish command is never run by PR CI and is not part of ordinary repository validation.

### Final host evidence

Use a clean macOS arm64 account/environment and install from the public registry. The journey must
not set a package source override or substitute the runtime.

## Complexity Tracking

| Rejected complexity | Reason |
|---|---|
| Platform runtime npm packages | One supported platform does not justify a package graph. |
| Postinstall binary download | Adds network/runtime mutation and supply-chain complexity. |
| Automatic update daemon | Outside the first public release. |
| PR-driven publication | Gives pull-request automation irreversible credentials. |
| DeepSeek package in this release | Feature 004 is explicitly deferred. |
| Signing/notarization | Valuable later but not required for the bounded first release. |
| Raw tarball byte equality as permanent rule | Toolchain archive metadata may vary without content change. |

## Delivery Gate

Feature 006 is complete only when:

1. the public package contract and preparation checks pass;
2. two clean builds match under the deterministic contract;
3. remote npm and GitHub assets are read back and verified;
4. the final registry-package Codex journey passes;
5. removal/uninstall preserve task data;
6. the public GitHub Release is finalized at the exact tag/source;
7. the publication record is complete and secret-free;
8. `packages/deepseek/` and shared Core semantics are unchanged.
