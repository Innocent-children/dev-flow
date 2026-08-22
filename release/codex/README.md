# Codex Release Contract

Codex is versioned by `packages/codex/package.json`; its plugin manifest is a mirror. The packaged
Core is versioned independently by `CORE_VERSION` and is verified from the actual executable.

```bash
pnpm run release:codex -- \
  --mode quick|normal \
  --version "<CODEX_VERSION>" \
  --output "<ABSOLUTE_DIRECTORY>" \
  --confirm "codex-v<CODEX_VERSION>" \
  [--confirm-comprehension]
```

The Codex version commit changes the package and plugin manifests, synchronizes the maintained
public release-version descriptions from executable version authorities, and uses
`release(codex): v<CODEX_VERSION>`. The Tag is `codex-v<CODEX_VERSION>`.

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
