# Codex Release Contract

Codex is versioned by `packages/codex/package.json`; its plugin manifest is a mirror. The packaged
Core is versioned independently by `CORE_VERSION` and is verified from the actual executable.

```bash
pnpm run release:codex -- \
  [--channel stable|beta] \
  --mode quick|normal \
  --version "<CODEX_VERSION>" \
  --output "<ABSOLUTE_DIRECTORY>" \
  --confirm "codex-v<CODEX_VERSION>" \
  [--confirm-comprehension]
```

The default `stable` channel accepts `MAJOR.MINOR.PATCH`, requires clean synchronized `main`, and
synchronizes maintained public release-version descriptions. The `beta` channel accepts only
`MAJOR.MINOR.PATCH-beta.N`, permits any clean named branch, pushes the version commit to that branch,
keeps stable public identities unchanged, publishes npm with dist-tag `beta`, and marks the GitHub
Release as a prerelease. Both channels use `release(codex): v<CODEX_VERSION>` and Tag
`codex-v<CODEX_VERSION>`.

Preparation creates:

```text
dev-flow-codex-<CODEX_VERSION>.tgz
dev-flow-core-<CORE_VERSION>-darwin-arm64
SHA256SUMS
release-manifest.json
publication-record.json
```

Resume is bound to product `codex`, both product versions, Tag, source commit/tree, mode, previous
Codex release, and artifact digests. Mismatched or old-format directories fail before remote
mutation. The final registry gate installs the exact npm package, verifies package/Core identity,
performs setup and the Core handshake, then verifies removal, uninstall, and an unchanged repository.
Complete graph, recovery, and terminal-state behavior remains covered by deterministic Core and
integration tests. DeepSeek publication and generic multi-product release machinery remain out of scope.
