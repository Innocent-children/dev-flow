# Codex Release Contract

The Codex release is one `dev-flow-codex` npm package for `darwin-arm64`, containing one
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

## Current release entrypoint

The maintainer invokes one command:

```bash
pnpm run release:codex -- \
  --mode quick|normal \
  --version "<VERSION>" \
  --output "<absolute-release-directory>" \
  --confirm "v<VERSION>" \
  [--confirm-comprehension]
```

It first commits and pushes the aligned version authorities. `quick` is admitted only for a proven
non-product diff and runs bounded checks plus registry lifecycle smoke. `normal` runs complete
repository validation and the native final registry graph Journey. Both modes then compose
deterministic two-worktree preparation, normalized package/Core verification, provisional
manifest/checksums/publication state, exact remote preflight, resumable publication, asset read-back,
and Release finalization. Normal mode also requires `--confirm-comprehension`.

Preparation output is exactly:

```text
dev-flow-codex-<VERSION>.tgz
dev-flow-<VERSION>-darwin-arm64
SHA256SUMS
release-manifest.json
publication-record.json
```

The publication record begins `prepared`, with `preflight` complete and the remaining eight steps
pending. Each rerun rereads exact remote state and continues missing steps. Production finalization
requires npm read-back, native Journey, final manifest/checksums, and four verified assets.

CI syntax-checks release commands and runs preparation-safe contracts; it never calls the production
entrypoint or publisher. DeepSeek and every platform other than macOS arm64 remain outside the
current release scope.
