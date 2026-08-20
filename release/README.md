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

The current release-manifest authority is `release/schemas/release-manifest.schema.json`.
Completed release Features remain historical evidence and are not rewritten as the current contract.
Publication Record Schema 1 remains owned by Feature 006.
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
  --mode quick|normal \
  --version "<VERSION>" \
  --output "<absolute-release-directory>" \
  --confirm "v<VERSION>" \
  [--confirm-comprehension]
```

This is the production operator entrypoint. Before running it, the agent inspects paths changed since
the current public Tag, recommends `quick` or `normal`, and waits for the maintainer's selection. The
command aligns every current version authority, commits and pushes that version change on `main`, then
runs the selected validation and invokes the exact-confirmation publisher. It creates or prepares a
missing/empty directory and resumes an exact five-file directory.
The `release:codex:prepare`, `release:codex:verify`, and `release:codex:publish` scripts remain reviewed
internal components and diagnostic commands.

### Prepare

- requires a clean, pushed `main` checkout on native macOS arm64 after the version commit;
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
- `quick` runs the bounded contract checks and `--quick-registry` install/setup/remove smoke only when
  the changed paths prove that product/runtime behavior is unchanged;
- `normal` runs `pnpm run validate`, requires `--confirm-comprehension`, and runs the closed
  `--final-registry` graph Journey;
- finalizes native support/manifest/checksums,
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

## Expected duration

| Stage | Quick | Normal |
| --- | ---: | ---: |
| Version alignment, commit, push | 1–3 min | 1–3 min |
| Local validation and deterministic build | 3–8 min | 8–20 min |
| npm/GitHub publication and registry read-back | 2–5 min | 2–5 min |
| Native registry-package evidence | 2–5 min | 10–20 min |
| Typical total | 8–20 min | 20–45 min |

Registry propagation and native Host execution can extend these estimates. A rerun uses the same
mode, version, output directory, source identity and immutable remote objects. If release tooling on
`main` advances after preparation, the command automatically reconstructs the prepared frozen-source
checkout and continues publication without moving a Tag or republishing npm bytes.

The current release scope is only `dev-flow-codex` on macOS arm64. DeepSeek, other platforms,
platform-runtime packages, signing, notarization, and automated CI publication remain unsupported.
