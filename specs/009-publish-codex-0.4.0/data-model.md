# Data Model: Codex 0.4.0 Release

## ReleaseInvocation

| Field | Type | Rule |
| --- | --- | --- |
| `output_directory` | absolute path | Real directory outside the repository; durable for the attempt |
| `confirmation` | string | Exactly `v` plus root `VERSION` |
| `source_commit` | Git SHA | Current clean `main` and `origin/main` identity |
| `source_tree` | Git tree SHA | Must match prepared manifest |

Lifecycle: `validated → prepared_or_resumed → published_or_failed`. The wrapper owns only invocation
and local directory routing; the Publication Record owns remote progress.

## ReleaseDirectory

Exact entries for version `V`:

```text
dev-flow-codex-V.tgz
dev-flow-V-darwin-arm64
SHA256SUMS
release-manifest.json
publication-record.json
```

States:

- `missing`: wrapper creates a real mode-0700 directory, then prepares.
- `empty`: wrapper prepares.
- `exact`: wrapper resumes through the publisher.
- `invalid`: any other entry set, symlink, special file, in-repository path, or identity mismatch;
  processing stops.

## ReleaseManifestV2

Immutable fields bind:

- schema version `2`;
- release version/Tag/source commit/source tree;
- completed Feature 008 commit;
- Core Contract `0.2`;
- storage Schema `2` and snapshot version `2`;
- process ID/version/definition digest;
- toolchains;
- two artifacts and closed package-file inventory;
- one macOS arm64 support entry;
- bounded validation results.

The provisional support entry begins pending. The final publisher rewrites the manifest and checksum
atomically after the native registry Journey passes.

## PublicationRecord

Publication Record Schema 1 remains the mutable external state. It contains exactly nine ordered
steps:

```text
preflight → tag → github_draft → npm_publish → npm_readback
→ final_journey → github_upload → github_readback → github_finalize
```

Every step has pending/complete/failed/blocked status, bounded timestamps/identities/digests, an error
code, summary, and safe next action. Completed immutable state is reused only after exact read-back.

## ProductVersionAuthority

Current version authorities are root `VERSION`, root package, Codex package, Codex plugin, and private
DeepSeek workspace metadata. Build output, bundled Core, current graph ServerInfo fixture, manifest,
Tag, npm version, and GitHub Release derive from the same value.

Historical specifications, artifacts, fixtures that model completed releases, Tags, npm versions,
Release assets, digests, and publication records retain their literal historical versions.

## Runtime Persistence Boundary

Release tooling has no Core database entity or transition. The distributed runtime retains Feature
008's fresh Schema 2 lifecycle and zero-write rejection of pre-graph or unsupported data. User-owned
archive, rename, deletion, or fresh-root selection remains outside Core and release tooling.
