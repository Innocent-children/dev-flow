# Research: Publish the Codex Installable Product

## Decision 1 — Release Codex before DeepSeek

**Decision**: Publish a Codex-only `0.x` release after Features 003 and 005. Keep Feature 004
deferred and publish DeepSeek through a later feature.

**Rationale**: The Codex product already has a complete local package and real-host journey. A
host-specific release does not change shared Core semantics, so it need not wait for an unavailable
Harness capability.

**Alternatives considered**:

- Keep the original dual-product release gate: rejected because it makes the working product wait
  indefinitely.
- Remove DeepSeek from the product roadmap: rejected; it remains a deferred second product.
- Publish an unfinished DeepSeek package: rejected because it would create unsupported claims.

## Decision 2 — One npm package with one bundled runtime

**Decision**: The first public package contains the existing `darwin-arm64` Core runtime directly.

**Rationale**: Only one platform is claimed. A single package is easier to inspect, publish, install,
read back, and remove than host plus platform dependency packages.

**Alternatives considered**:

- Optional per-platform npm packages: deferred until at least two supported platforms require them.
- First-run download: rejected because install would depend on network code and mutable remote
  assets.
- Require users to install Go/Core separately: rejected because the product must be self-contained.

## Decision 3 — Use npm OS/CPU compatibility metadata

**Decision**: Declare only macOS and arm64 in package metadata and preserve a runtime check in setup.

**Rationale**: Package-manager rejection prevents unsupported installation from reaching host
mutation, while setup still verifies the actual packaged runtime and platform.

**Alternatives considered**:

- Install everywhere and fail on launch: rejected because it creates a misleading installed
  product.
- Publish under a platform-specific package name: rejected for the first single-platform release.
- Infer Rosetta support: rejected because it is not a tested native support claim.

## Decision 4 — No npm lifecycle mutation

**Decision**: Keep setup/remove explicit and define no install lifecycle script.

**Rationale**: Users must see and authorize host configuration mutation. It also keeps package
installation reproducible when scripts are disabled.

**Alternatives considered**:

- `postinstall` setup: rejected as hidden host mutation.
- `preuninstall` removal: rejected because uninstall interruption could make ownership unsafe.
- PATH/profile editing: rejected; npm's normal bin linking is sufficient.

## Decision 5 — Local explicit publication, not PR CI

**Decision**: Implement an authenticated local publisher using standard `npm` and `gh` CLIs.

**Rationale**: It minimizes permanent secret-bearing infrastructure and cleanly separates ordinary
CI from irreversible release actions.

**Alternatives considered**:

- Pull-request publication: prohibited.
- Automatic publish on merge/tag: deferred until release frequency and operational need justify it.
- Manual web-only publication: rejected because read-back, checksums, and partial-state recording
  need one repeatable workflow.

## Decision 6 — Normalize package comparison

**Decision**: Require byte-identical Go runtimes and normalized unpacked tarball equality. Record raw
tarball equality when available but do not make it the compatibility rule.

**Rationale**: User-visible package contents and modes are the contract. Archive metadata can vary
with tool versions even when installed bytes are identical.

**Alternatives considered**:

- Compare only package.json: rejected as too weak.
- Require raw `.tgz` equality forever: rejected as unnecessarily coupled to packaging internals.
- Skip double build: rejected because one-source consistency is a release promise.

## Decision 7 — Use a draft GitHub Release and remote read-back

**Decision**: Create the exact tag and draft release, publish/read back npm, run the
registry-package journey, finalize the manifest/checksums, upload/read back assets, then finalize the
release.

**Rationale**: A draft exposes a stable upload target without publicly declaring success before
remote bytes and user journey are verified.

**Alternatives considered**:

- Publish GitHub Release first: rejected because it may advertise a broken/missing registry package.
- Publish npm last: rejected because final journey must use the registry package.
- Trust upload responses without download: rejected because remote bytes are the release.

## Decision 8 — Preserve partial publication instead of rolling it back

**Decision**: Persist a bounded publication record after every remote observation/mutation and
resume only exact matching state.

**Rationale**: npm versions and release/tag identities are immutable distribution facts. Automatic
rollback claims would be false or destructive.

**Alternatives considered**:

- Unpublish npm on failure: rejected as unreliable, destructive, and not equivalent to rollback.
- Delete/recreate tags and releases: rejected because it obscures provenance.
- Start a new version immediately: allowed only after the current partial state is truthfully
  recorded and a maintainer decides it cannot complete.

## Decision 9 — Fix the public name and stop on ownership failure

**Decision**: Use `dev-flow-codex`. Preflight proves the authenticated account can publish it.

**Rationale**: Package identity is a product decision. A release script must not invent aliases.

**Alternatives considered**:

- Automatically add an npm scope: rejected because it changes installation identity.
- Choose the first available similar name: rejected as nondeterministic.
- Leave the name unresolved: rejected; implementation has a fixed contract and a clear stop rule.

## Implementation-Time Baseline Record

Before implementation, record:

| Item | Required value |
|---|---|
| Feature 003 merge commit | exact `main` commit |
| Feature 005 merge commit | exact `main` commit |
| Release source commit/tree | exact frozen identities |
| Root/package/Core version | one strict SemVer |
| Core fixture digest | exact server-reported digest |
| Codex minimum/range | copied from merged Feature 003 |
| Actual final Codex version | exact version used in registry-package journey |
| npm publisher/account | account name only; no token |
| npm package ownership result | pass/fail and timestamp |
| GitHub release permission result | pass/fail and timestamp |
| Toolchains | actual Go, Node, pnpm, npm, git, and gh versions |

These values are produced at implementation/release time and are not unresolved design questions.
