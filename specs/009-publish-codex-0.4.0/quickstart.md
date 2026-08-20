# Quickstart: Publish `dev-flow-codex@0.4.0`

## Prerequisites

- Feature 009 source work is committed and pushed to clean `main`.
- Native macOS arm64 with supported Go, Node.js, pnpm, npm, Git, GitHub CLI, and Codex.
- npm ownership of `dev-flow-codex` and GitHub release permission for
  `Innocent-children/dev-flow`.
- `dev-flow-codex@0.4.0`, Tag `v0.4.0`, and GitHub Release `v0.4.0` are absent or exact resumable state.

## One-command release

```bash
pnpm run release:codex -- \
  --output /Users/innocent-children/dev-flow-releases/v0.4.0 \
  --confirm v0.4.0
```

The command validates clean pushed `main` and all current version authorities. It creates or prepares
the durable directory when missing/empty, or resumes its exact five-file release state. It then owns
local verification, remote preflight, exact Tag/Draft, publish-once npm, registry read-back, native
final Journey, four assets, GitHub Release finalization, and final read-back.

## Expected completion

The command exits successfully only when:

- npm `dev-flow-codex@0.4.0` is visible and the downloaded tarball matches;
- Tag `v0.4.0` targets the prepared source commit;
- the native macOS arm64 registry Journey passes;
- the tarball, standalone Core, final manifest, and checksums are uploaded and read back;
- GitHub Release `v0.4.0` is public;
- `publication-record.json` is `complete` with all nine steps complete.

## Resume after failure

Retain the external directory and rerun the same command with the same arguments. The publisher reads
remote truth before every mutation, reuses exact matching state, and continues only missing steps.
An immutable identity conflict stops as `blocked` and preserves the safe next action.

## Installer boundary

The public package supports Codex on macOS arm64. New graph tasks use fresh Schema 2. A Schema 1 or
pre-graph data directory is rejected with zero writes; the user explicitly selects a fresh
`DEV_FLOW_DATA_DIR` or manages the old directory outside Dev Flow.

## Repository closure

After public completion:

```bash
git status --short
npm view dev-flow-codex@0.4.0 version dist.integrity --json --registry=https://registry.npmjs.org/
gh release view v0.4.0 --repo Innocent-children/dev-flow --json tagName,isDraft,publishedAt,assets,url
```

Generated release output and publication state remain outside Git.
