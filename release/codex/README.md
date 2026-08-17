# Codex Release Contract

The first Codex release is one `dev-flow-codex` npm package for `darwin-arm64`, containing one
package-relative Go Core runtime. Root `VERSION` is the single version source.

## Preparation

Preparation and verification use an operator-selected temporary/output directory. They may create
and inspect a local tarball, standalone Core, provisional manifest, checksum file, and initial
publication record without changing npm, Git tags, GitHub Releases, Codex registration, repository
content, shell profiles, or task data.

A local tarball journey is described only as source-free local tarball installation evidence and
fake-Codex lifecycle evidence. It is not registry evidence, final release evidence, or a real Codex
Host journey.

## Artifact roles

The npm tarball is the installable product. The standalone Core is a byte-identical copy of the
runtime inside that tarball. The final manifest binds source, package, Core, inventory, digests, and
the one supported platform. `SHA256SUMS` covers those immutable payloads without a circular
self-digest.

`publication-record.json` is local mutable operator state. It records exact observations and safe
continuation after partial publication, and it is never uploaded as a release asset.

## Current implementation boundary

The User Story 2 checkpoint adds deterministic two-worktree preparation, normalized package/Core
verification, provisional manifest/checksums/publication state, and an exact-confirmation publisher
whose resume/conflict behavior is exercised only with fake npm/gh and temporary Git remotes.

Preparation output is exactly:

```text
dev-flow-codex-<VERSION>.tgz
dev-flow-<VERSION>-darwin-arm64
SHA256SUMS
release-manifest.json
publication-record.json
```

The publication record begins `prepared`, with `preflight` complete and the remaining eight steps
pending. Exact fixture publication may establish Tag, draft, npm publish-once/read-back, and
post-journey mechanical asset behavior, but production GitHub finalization remains absent. The
Release stays draft.

Pull-request CI syntax-checks the release commands and runs preparation-safe contracts; it never
calls the publisher. This checkpoint performs no real npm publication, Tag push, GitHub Release or
asset mutation, registry read-back, or final Codex journey. DeepSeek and every platform other than
macOS arm64 remain outside Feature 006.
