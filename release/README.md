# Release Ownership

`release/` contains current product release schemas and operator guidance. Generated output stays
in an external operator-selected directory and is never committed.

## Current five-file output

```text
dev-flow-codex-<CODEX_VERSION>.tgz
dev-flow-core-<CORE_VERSION>-darwin-arm64
SHA256SUMS
release-manifest.json
publication-record.json
```

The schemas are closed, current-only formats without internal version fields. Historical release
testdata remains frozen and is accepted only by its historical evidence tests; current tooling
rejects an old publication directory before remote mutation.

## Operator entrypoint

```bash
pnpm run release:codex -- \
  [--channel stable|beta] \
  --mode quick|normal \
  --version "<CODEX_VERSION>" \
  --output "<ABSOLUTE_DIRECTORY>" \
  --confirm "codex-v<CODEX_VERSION>" \
  [--confirm-comprehension]
```

`stable` is the default channel. It accepts `MAJOR.MINOR.PATCH`, requires clean `main` equal to
`origin/main`, and synchronizes maintained public release-version descriptions from `CORE_VERSION`,
package manifests, and `release/public-versions.json`.

`beta` accepts only `MAJOR.MINOR.PATCH-beta.N`. It may run from any clean named branch, pushes its
version commit back to that branch, leaves stable public-version descriptions unchanged, publishes
with npm dist-tag `beta`, and creates a GitHub prerelease. The publisher still uses the same
validation, deterministic preparation, exact confirmation, read-back, Journey, and recovery gates.

Without confirmation, the publisher performs read-only npm/GitHub/Tag preflight. With exact
confirmation, it creates or reuses only matching immutable state, publishes npm at most once,
verifies registry bytes, uploads exact assets, and finalizes only after the selected Journey gate.

CI syntax-checks these components and runs fake-remote contracts; it never invokes the real release
entrypoint or mutates Tag, npm, GitHub Release, assets, Codex registration, or task data.

DeepSeek uses the same operator argument shape with an independent product identity:

```bash
pnpm run release:deepseek -- \
  [--channel stable|beta] \
  --mode quick|normal \
  --version "<DEEPSEEK_VERSION>" \
  --output "<ABSOLUTE_DIRECTORY>" \
  --confirm "deepseek-v<DEEPSEEK_VERSION>" \
  [--confirm-comprehension]
```

Its package, Tag, output directory, npm identity, GitHub state and DSH registry lifecycle evidence
are independent from Codex. Stable releases apply the same public-document synchronization; beta
releases preserve stable public identities and use the isolated `beta`/prerelease channel. See
[`deepseek/README.md`](deepseek/README.md).

The Host-neutral CLI has its own normal-only release identity:

```bash
pnpm run release:dev-flow -- --mode normal --version "<DEV_FLOW_VERSION>" --output "<ABSOLUTE_DIRECTORY>" \
  --confirm "dev-flow-v<DEV_FLOW_VERSION>" --confirm-comprehension
```
