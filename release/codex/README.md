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

The Codex version commit changes exactly the package and plugin manifests and uses
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
mutation. DeepSeek publication and generic multi-product release machinery remain out of scope.
