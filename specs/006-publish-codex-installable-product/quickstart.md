# Quickstart: Prepare and Publish `dev-flow-codex`

The commands below define the Feature 006 operator interface. Preparation and verification are safe
to repeat. Publication is irreversible and requires exact confirmation.

## Prerequisites

- Features 003 and 005 are merged into `main`.
- The worktree is clean and checked out at the exact release commit on `main`.
- Go, Node.js, pnpm, npm, git, and GitHub CLI satisfy repository policies.
- `npm whoami` identifies the authorized publisher.
- GitHub CLI is authenticated to `Innocent-children/dev-flow`.
- The publisher has verified permission for `dev-flow-codex`.

Activate the feature for Spec Kit work:

```bash
export SPECIFY_FEATURE_DIRECTORY="$PWD/specs/006-publish-codex-installable-product"
```

## 1. Run release preflight

```bash
VERSION="$(cat VERSION)"
test "$VERSION" = "$(node -p "require('./packages/codex/package.json').version")"
npm whoami
npm view "dev-flow-codex@$VERSION" version
gh repo view Innocent-children/dev-flow
```

Expected result:

- local versions agree;
- authentication succeeds;
- the intended npm version is absent;
- any existing `v$VERSION` tag/draft is either absent or exactly matches the release source.

An npm “not found” result is acceptable only for the exact version lookup after package ownership
has separately been proven.

## 2. Prepare in a temporary output directory

```bash
OUT="$(mktemp -d)"
pnpm run release:codex:prepare -- --output "$OUT"
```

Expected output includes:

```text
dev-flow-codex-<VERSION>.tgz
dev-flow-<VERSION>-darwin-arm64
SHA256SUMS
release-manifest.json
publication-record.json
```

Preparation creates no tag, release, npm version, Codex registration, or task data.

## 3. Verify prepared artifacts

```bash
pnpm run release:codex:verify -- --directory "$OUT"
```

Expected result:

- two clean runtime builds match byte-for-byte;
- normalized package trees match;
- package allowlist, executable modes, metadata, schemas, provisional checksums, and
  forbidden-content scans pass;
- the support entry is still `pending`;
- the publication record remains the local operator record in status `prepared`.

## 4. Inspect before irreversible publication

Review:

```bash
cat "$OUT/release-manifest.json"
cat "$OUT/publication-record.json"
cat "$OUT/SHA256SUMS"
```

Confirm there are no absolute paths, credentials, raw environment values, prompts, or unbounded
outputs.

## 5. Publish explicitly

```bash
pnpm run release:codex:publish -- \
  --directory "$OUT" \
  --confirm "v$VERSION"
```

Without the exact confirmation, the command performs read-only preflight and exits.

The command must:

1. create/reuse the exact tag and draft;
2. publish the verified npm tarball once;
3. download and verify the public registry package;
4. run the final clean registry-package Codex journey;
5. finalize the support entry, manifest, and checksums;
6. upload and redownload GitHub assets;
7. finalize the GitHub Release only after every prior step passes.

## 6. Resume after interruption

Rerun the same publish command with the same verified directory and confirmation.

Expected behavior:

- exact matching completed steps are reread and reused;
- npm is never republished for the same version;
- missing later steps continue;
- conflicting remote state stops with `blocked`;
- `publication-record.json` states the safe next action.

## 7. Final user lifecycle check

The final journey uses a clean macOS arm64 environment:

```text
npm install -g dev-flow-codex@<VERSION>
dev-flow-codex setup
ordinary Codex request → zero Dev Flow task
$dev-flow substantive task → create and advance
restart Codex → resume same task
Core reports DONE
dev-flow-codex remove
npm uninstall -g dev-flow-codex
released Core reopens retained task data
```

No local tarball, source checkout, runtime override, or development package path may substitute for
the registry package.

## 8. Final repository checks

```bash
git diff --check
pnpm run validate
git status --short
```

Generated release output stays outside Git. `packages/deepseek/` must remain unchanged.
