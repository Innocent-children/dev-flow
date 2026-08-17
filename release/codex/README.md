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

This User Story 1 checkpoint establishes public package metadata, the closed packed layout,
unsupported-platform rejection, explicit setup/remove, source-free local tarball installation, and
retained task data. It performs no npm publication, Tag creation, GitHub Release creation, registry
read-back, or final registry-package journey.

The release script files referenced by the root package are implemented by T019–T029. Pull-request
CI validates only checked-in contracts and package behavior and never calls the publish entrypoint.
DeepSeek and every platform other than macOS arm64 remain outside Feature 006.
