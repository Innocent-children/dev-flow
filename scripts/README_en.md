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

The usual maintainer entrypoint is the manually dispatched `publish-npm` GitHub Actions workflow.
For each npm package, configure `publish-npm.yml` from `Innocent-children/dev-flow` as a GitHub Actions
Trusted Publisher allowed to run `npm publish`. Then select the product, channel, mode, and exact
version; normal mode also requires `confirm_comprehension`. The workflow obtains a short-lived npm
publish credential through OIDC, uses macOS 15 ARM64, the Go version declared by `go.mod`, Node.js 24,
and pnpm 11, serializes runs per product, and invokes the existing commands below. npm publication
does not create registry authentication configuration that depends on `NODE_AUTH_TOKEN`.
Version commits, Tags, and GitHub Releases use a short-lived token from a dedicated GitHub App that is
installed on this repository and added to the `main` ruleset bypass list. Repository variable
`RELEASE_APP_CLIENT_ID` and secret `RELEASE_APP_PRIVATE_KEY` provide the App Client ID and complete PEM
private key respectively.

```bash
pnpm run release:codex -- \
  [--channel stable|beta] \
  --mode quick|normal \
  --version "<CODEX_VERSION>" \
  --output "<ABSOLUTE_DIRECTORY>" \
  --confirm "codex-v<CODEX_VERSION>" \
  [--confirm-comprehension]
```

```bash
pnpm run release:deepseek -- \
  [--channel stable|beta] \
  --mode quick|normal \
  --version "<DEEPSEEK_VERSION>" \
  --output "<ABSOLUTE_DIRECTORY>" \
  --confirm "deepseek-v<DEEPSEEK_VERSION>" \
  [--confirm-comprehension]
```

`stable` is the default channel. It accepts stable SemVer and requires `main` to equal
`origin/main`. `beta` accepts only `MAJOR.MINOR.PATCH-beta.N`, may use any clean named branch, and
pushes the version commit back to that branch. It always uses npm dist-tag `beta`, marks the GitHub
Release as a prerelease, and preserves stable `latest` and public-version documentation.

Both one-command release flows invoke `sync-public-release-docs.mjs` only in stable version commits. The
synchronizer gets version facts only from `CORE_VERSION`, product package manifests, and
`release/public-versions.json`, then updates every maintained root README, product guide, Roadmap,
Support Matrix, and Host package README. Markdown never decides a version.

Before a release, inspect paths changed since the current public Tag. The maintainer explicitly
selects `quick` or `normal`. Only these exact-confirmation entrypoints may change a product
version, commit and push, create a Tag, publish npm, or mutate GitHub Release assets.

Both channels share the same Publisher. It uses external `release-manifest.json` and `publication-record.json` files to retain
source, mode, versions, artifact digests, remote read-back, and recovery state. Resume with the same
command and output directory after an interruption.

Actions uploads the temporary release directory after both successful and failed runs. Download its
`publication-record.json` to inspect completed steps. Rerunning the same workflow inputs makes the
publisher reread npm, Tag, and GitHub Release state before another irreversible operation; the runner
directory itself is not automatically reused across workflow runs.

See [Release Ownership](../release/README.md) for the exact operator contract.
