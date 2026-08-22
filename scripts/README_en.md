# Repository Scripts

[中文](README.md) | [English](README_en.md)

`scripts/` contains repository development validation, source-package builders, and standalone
release tooling. Development and publication entrypoints are separate: ordinary validation does not
install real Host products or create npm, Tag, or GitHub Release state.

## Daily development

| Command | Purpose |
| --- | --- |
| `pnpm run validate` | Run bounded repository validation |
| `pnpm run validate:contracts` | Run public contract tests only |
| `pnpm run versions:check` | Verify Core, Codex, and DeepSeek version authorities and mirrors |
| `pnpm --dir packages/codex test` | Run Codex package-local tests |
| `pnpm --dir packages/deepseek test` | Run DeepSeek package-local tests |

`validate-repository.sh` checks toolchains, frozen dependency installation, version authorities,
whitespace, Go formatting, package contracts, Host Adapter tests, deterministic journeys, and
release-tooling contracts. It does not invoke a real release entrypoint.

## Source-local builds

- `build-codex-local.sh`: build the Codex source-local tarball and darwin-arm64 Core;
- `build-deepseek-runtime.sh`: build the Core used by DeepSeek package tests;
- `build-codex-release.sh` and `build-deepseek-release.sh`: prepare deterministic artifacts for a
  standalone release.

Final artifacts and evidence must be written to an operator-selected directory outside the
repository.

## Release entrypoints

```bash
pnpm run release:codex -- \
  --mode quick|normal \
  --version "<CODEX_VERSION>" \
  --output "<ABSOLUTE_DIRECTORY>" \
  --confirm "codex-v<CODEX_VERSION>" \
  [--confirm-comprehension]
```

```bash
pnpm run release:deepseek -- \
  --mode quick|normal \
  --version "<DEEPSEEK_VERSION>" \
  --output "<ABSOLUTE_DIRECTORY>" \
  --confirm "deepseek-v<DEEPSEEK_VERSION>" \
  [--confirm-comprehension]
```

Before a release, inspect paths changed since the current public Tag. The maintainer explicitly
selects `quick` or `normal`. Only these exact-confirmation entrypoints may change a product
version, commit and push, create a Tag, publish npm, or mutate GitHub Release assets.

The Publisher uses external `release-manifest.json` and `publication-record.json` files to retain
source, mode, versions, artifact digests, remote read-back, and recovery state. Resume with the same
command and output directory after an interruption.

See [Release Ownership](../release/README.md) for the exact operator contract.
