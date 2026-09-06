# Repository Scripts

[中文](README.md) | [English](README_en.md)

`scripts/` contains repository development validation, source-package builders, and standalone
release tooling. Development and publication entrypoints are separate: ordinary validation does not
install real Host products or create npm, Tag, or GitHub Release state.

## Daily development

| Command | Purpose |
| --- | --- |
| `pnpm run validate` | Run the repository's required checks |
| `pnpm run validate:contracts` | Run public contract tests only |
| `pnpm run versions:check` | Verify Core, Codex, and DeepSeek version files and mirrors |
| `pnpm run dev-flow:local` | Pack all three products from current source and open the normal `dev-flow` install menu |
| `pnpm --dir packages/codex test` | Run Codex package-local tests |
| `pnpm --dir packages/deepseek test` | Run DeepSeek package-local tests |

`validate-repository.sh` checks toolchains, frozen dependency installation, version files,
whitespace, Go formatting, package contracts, Host Adapter tests, deterministic end-to-end tests, and
release-tooling contracts. It does not invoke a real release entrypoint.

## Local installation testing

This one command builds the WebUI and bundled Core, creates `@imotong/dev-flow`, `dev-flow-codex`,
and `dev-flow-deepseek` tarballs in a temporary directory outside the repository, and starts the
unified install menu from the local tarball:

```bash
pnpm run dev-flow:local
```

Existing non-interactive arguments can be forwarded unchanged:

```bash
pnpm run dev-flow:local -- reinstall --host codex --yes
```

Local mode really replaces the selected Host Adapter even when its manifest version matches the
installed version. The existing `dev-flow` lifecycle still owns plans, confirmation, registration,
receipts, and readiness read-back. The launcher removes temporary artifacts when it exits; it never
runs `npm publish` or creates a Tag or GitHub Release. Registry byte read-back and Release asset
checks still require the publication workflow.

The `dev-flow:local` Node orchestrator runs on macOS arm64 and Windows 10/11 x64, and builds,
verifies, and stages both `darwin-arm64/dev-flow` and `win32-x64/dev-flow.exe`. A Windows development
host needs Go, Node.js, npm, and pnpm; this entry does not require Bash to launch.

## Local source builds

- `build-webui.mjs`: build and synchronize the embedded WebUI cross-platform;
  `build-webui.sh` is its Unix wrapper;
- `build-core-runtimes.mjs`: the only dual-Core runtime builder, returning one JSON report keyed by
  runtime pair;
- `build-codex-local.sh`: build the Codex source-local tarball from that runtime report;
- `build-deepseek-local.mjs`: build the DeepSeek source-local tarball from that runtime report in a
  system-temporary staging directory;
- `build-codex-release.sh` and `build-deepseek-release.sh`: prepare deterministic artifacts for a
  standalone release.

Neither the Codex nor DeepSeek source package stores a precompiled Core. Each `package.json` still
declares the two runtime paths required in the final npm package; local builds and release staging
create those files before packing.

Final packages and test records must be written to an operator-selected directory outside the
repository.

## Release entrypoints

The usual maintainer entrypoint is the manually dispatched `publish-npm` GitHub Actions workflow.
For each npm package, configure `publish-npm.yml` from `Innocent-children/dev-flow` as a GitHub Actions
Trusted Publisher allowed to run `npm publish`. Then select only the product, channel, and exact
version. The workflow uses one fixed release check and obtains a short-lived npm
publish credential through OIDC, uses macOS 15 ARM64, Go `1.26.5`, Node.js `24.18.0`, and pnpm
`11.24.0`, cross-builds and verifies both macOS arm64 and Windows amd64 Core executables, serializes
runs per product, and invokes the existing commands below. The release runner OS is build
infrastructure rather than an artifact-runtime restriction. npm publication does not create
registry authentication configuration that depends on `NODE_AUTH_TOKEN`.
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
The Publisher retries the actual `npm pack <package>@<version>` tarball read-back for up to ten
minutes. Only registry propagation responses such as `ETARGET` and `E404` keep waiting;
authentication failures and byte mismatches stop immediately.

Actions uploads the temporary release directory after both successful and failed runs. Rerunning the same workflow inputs makes the
publisher reread npm, Tag, and GitHub Release state before another irreversible operation; the runner
directory itself is not automatically reused across workflow runs.

See [Release Ownership](../release/README.md) for the exact operator contract.

## Desktop pet local build

`node scripts/build-desktop-pet.mjs --output "/absolute/pet-build"` compiles Swift on macOS arm64,
assembles existing artwork and language resources, signs ad hoc, and creates a local unified-entry
tarball. Source JS files and the staging manifest including the app are checked separately. Existing
USTAR helpers preserve native executable permissions, followed by extracted-signature verification.
This entry does not rebuild Core, change Adapter installations, or publish npm. Use the installed
package for functional checks as described in the [command reference](../docs/COMMANDS_en.md#desktop-pet-macos-arm64).
`dev-flow:local` retains its temporary lifecycle manager; the pet uses the persistent installed package
built by this entry.
