# Release Ownership

`release/` owns reviewed release contracts, operator guidance, bounded test fixtures, and
implementation-owned Schema copies. Generated release output is never committed here or elsewhere
in the repository.

## Repository-owned content

```text
release/
├── README.md
├── codex/README.md
├── schemas/
│   ├── release-manifest.schema.json
│   └── publication-record.schema.json
└── testdata/
    ├── valid-release-manifest.json
    ├── valid-publication-record.json
    ├── valid-SHA256SUMS
    └── invalid-release-fixtures.json
```

The current release-manifest authority is
`specs/009-publish-codex-0.4.0/contracts/release-manifest.schema.json`; its implementation copy under
`release/schemas/` is byte-identical. Publication Record Schema 1 remains owned by Feature 006.
Contract tests guard exact identity, closed required fields, `additionalProperties: false`, one
`darwin-arm64` support entry, safe paths, immutable digests, and all nine publication steps.

## Five-file generated output

The operator selects an existing empty absolute directory outside the source repository. A prepared
release contains exactly:

```text
dev-flow-codex-<VERSION>.tgz
dev-flow-<VERSION>-darwin-arm64
SHA256SUMS
release-manifest.json
publication-record.json
```

The tarball, standalone Core, final manifest, and checksum file are immutable release payloads.
`SHA256SUMS` covers the tarball, standalone Core, and final manifest without hashing itself.

`publication-record.json` is mutable operator state. It records every local/remote observation,
completed/failed/blocked step, and safe continuation. It is not stored in SQLite and is not uploaded
as a GitHub Release asset.

## Operator command

```bash
pnpm run release:codex -- \
  --output "<absolute-release-directory>" \
  --confirm "v<VERSION>"
```

This is the production operator entrypoint. It creates or prepares a missing/empty directory, resumes
an exact five-file directory, runs local verification, and invokes the exact-confirmation publisher.
The `release:codex:prepare`, `release:codex:verify`, and `release:codex:publish` scripts remain reviewed
internal components and diagnostic commands.

### Prepare

- requires a clean `main` checkout on native macOS arm64;
- creates two temporary detached clean worktrees at the same commit;
- runs the local builder independently, compares Runtime bytes and normalized package trees;
- emits the canonical five-file set;
- removes temporary worktrees and performs no Tag, Release, npm, registry, GitHub or Host mutation.

### Verify

- rehashes artifacts and checks the exact package allowlist, modes, versions, source/Core identity,
  Schema shape, provisional support, checksums and bounded forbidden content;
- is local, dependency-free, network-free and safe to repeat.

### Publish

- without `--confirm`, performs read-only source/npm/GitHub/remote-state preflight;
- mutation requires the exact `v<VERSION>` confirmation, reviewed clean `main`, and the same frozen
  verified directory;
- creates/reuses only the exact Tag and GitHub Draft, publishes npm at most once, and verifies the
  public registry tarball before later gates;
- runs the closed `--final-registry` Journey contract, finalizes native support/manifest/checksums,
  uploads and redownloads four assets, then finalizes and rereads the GitHub Release;
- writes `publication-record.json` atomically after each observation/mutation;
- resumes exact matching remote state and blocks conflicts without moving, deleting, overwriting,
  unpublishing, or republishing immutable state.

## Deterministic test evidence

Package/release tests put temporary fake `npm` and `gh` executables first in an isolated PATH, use a
temporary bare Git remote, and isolate HOME/cache/config/state/log. They cover missing confirmation,
publish-once, delayed read-back, record loss, exact resume, immutable conflicts, final Journey gates,
four-asset read-back, finalization failure/recovery, and completed read-back reuse.

The final Journey harness has a production-only registry mode. Fixture-simulated journey facts may
exercise the fake finalization path, but production validation accepts only native registry-package
evidence for a public passed support entry.

These are deterministic fake-remote and harness-contract results. They are not real npm publication,
registry read-back, Git Tag, GitHub Release/asset, or real Codex Host evidence.

## CI and generated-output boundary

Pull-request CI syntax-checks release commands and runs preparation-safe contracts/package/repository
validation. It does not read npm/GitHub authentication, call the publisher, create/push a Tag,
publish npm, create/upload/finalize a GitHub Release, or run real Codex/DeepSeek.

Generated output stays in the operator-selected external directory and is never committed. It may
not contain credentials, auth configuration, home/machine paths, raw environment values, raw host
prompts, unbounded command output, source, task databases, receipts, caches, or DeepSeek resources.

## Current release status

- Feature 008 graph behavior and source-local acceptance are complete.
- Feature 009 aligns current identity to `0.4.0`, upgrades the current manifest to graph-aware Schema
  2, and exposes the one-command release entrypoint.
- Public `0.4.0` npm, Tag, final Journey, assets, and Release evidence remain pending until the clean
  source gate passes and the exact command runs.

The release scope is only `dev-flow-codex` on macOS arm64. DeepSeek, other platforms,
platform-runtime packages, signing, notarization, and automated CI publication remain outside
Feature 009.
