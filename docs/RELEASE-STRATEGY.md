# Product Release Strategy

Dev Flow releases Core, Codex, and DeepSeek independently. See [VERSIONING.md](VERSIONING.md) for
their authorities. A product release changes only that product's version; a host artifact records the
actual bundled Core version separately.

## Tags and Codex baseline

New Tags use `core-vX.Y.Z`, `codex-vX.Y.Z`, or `deepseek-vX.Y.Z`. Historical `v0.1.0` through
`v0.5.0` remain frozen. The first new Codex release compares against `v0.5.0`; later Codex releases
compare against the latest lower `codex-v*`.

## Codex artifacts

```text
dev-flow-codex-<CODEX_VERSION>.tgz
dev-flow-core-<CORE_VERSION>-darwin-arm64
SHA256SUMS
release-manifest.json
publication-record.json
```

The manifest records product `codex`, Codex version, Core version, Tag, source commit/tree, mode,
previous Codex release, and artifact digests. The publication record uses the same frozen identity.
Both formats are current-only and contain no internal format number.

## One-command release

```bash
pnpm run release:codex -- \
  --mode quick|normal \
  --version "<CODEX_VERSION>" \
  --output "<ABSOLUTE_DIRECTORY>" \
  --confirm "codex-v<CODEX_VERSION>" \
  [--confirm-comprehension]
```

The version commit changes only the Codex package and plugin mirror and uses
`release(codex): v<CODEX_VERSION>`. Core and DeepSeek remain unchanged.

`quick` is limited to existing non-product surfaces. Core/shared/Codex runtime, package, Skill,
lifecycle, layout, platform, or support changes require `normal`. A DeepSeek-only diff does not by
itself invalidate Codex quick eligibility.

Preparation keeps the two-clean-worktree deterministic build. Publication keeps exact confirmation,
publish-once npm behavior, immutable Tag/assets, remote read-back, atomic local state, and
read-before-retry. Resume uses the original product, Codex/Core versions, Tag, source, mode, previous
release, and digests, including a frozen source checkout when current source has advanced.

Product changes and pull-request validation never execute publication. A release occurs only after
merge, mode selection, target version, and exact maintainer confirmation.
