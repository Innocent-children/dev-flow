# Release Ownership

`release/` contains the current Codex release schemas and operator guidance. Generated output stays
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
  --mode quick|normal \
  --version "<CODEX_VERSION>" \
  --output "<ABSOLUTE_DIRECTORY>" \
  --confirm "codex-v<CODEX_VERSION>" \
  [--confirm-comprehension]
```

The command updates only the Codex package and plugin mirror. It records the Core version read from
`CORE_VERSION` and the built executable. It then performs the selected validation, deterministic
preparation, verification, and resumable publisher flow.

Without confirmation, the publisher performs read-only npm/GitHub/Tag preflight. With exact
confirmation, it creates or reuses only matching immutable state, publishes npm at most once,
verifies registry bytes, uploads exact assets, and finalizes only after the selected Journey gate.

CI syntax-checks these components and runs fake-remote contracts; it never invokes the real release
entrypoint or mutates Tag, npm, GitHub Release, assets, Codex registration, or task data.
