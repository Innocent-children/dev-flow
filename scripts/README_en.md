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
Trusted Publisher allowed to run `npm publish`. Then select only the product, channel, and exact
version. The workflow uses one fixed release check and obtains a short-lived npm
publish credential through OIDC, uses macOS 15 ARM64, Go `1.26.5`, Node.js `24.18.0`, and pnpm
`11.24.0`, serializes runs per product, and invokes the existing commands below. npm publication
does not create registry authentication configuration that depends on `NODE_AUTH_TOKEN`.
Version commits, Tags, and GitHub Releases use a short-lived token from a dedicated GitHub App that is
installed on this repository and added to the `main` ruleset bypass list. Repository variable
`RELEASE_APP_CLIENT_ID` and secret `RELEASE_APP_PRIVATE_KEY` provide the App Client ID and complete PEM
private key respectively.

```bash
pnpm run release:codex -- \
  [--channel stable|beta] \
  --version "<CODEX_VERSION>" \
  --output "<ABSOLUTE_DIRECTORY>" \
  --confirm "codex-v<CODEX_VERSION>"
```

```bash
pnpm run release:deepseek -- \
  [--channel stable|beta] \
  --version "<DEEPSEEK_VERSION>" \
  --output "<ABSOLUTE_DIRECTORY>" \
  --confirm "deepseek-v<DEEPSEEK_VERSION>"
```

`stable` is the default channel. It accepts stable SemVer and requires `main` to equal
`origin/main`. `beta` accepts only `MAJOR.MINOR.PATCH-beta.N`, may use any clean named branch, and
pushes the version commit back to that branch. It always uses npm dist-tag `beta`, marks the GitHub
Release as a prerelease, and preserves stable `latest`.

Both one-command release flows update only machine-readable version files such as package manifests,
the Plugin mirror, and `release/public-versions.json`; they neither read nor rewrite Markdown.

The release command uses one fixed check set. Only these exact-confirmation entrypoints may change a
product version, commit and push, create a Tag, publish npm, or mutate GitHub Release assets.

Both channels share one Publisher. The external `release-manifest.json` binds source, version, and
artifact digests; reruns reread and reuse matching remote state.

Actions uploads the temporary release directory after both successful and failed runs. Rerunning the same workflow inputs makes the
publisher reread npm, Tag, and GitHub Release state before another irreversible operation; the runner
directory itself is not automatically reused across workflow runs.

See [Release Ownership](../release/README.md) for the exact operator contract.
