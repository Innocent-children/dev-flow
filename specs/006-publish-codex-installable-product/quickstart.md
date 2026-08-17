# Quickstart: Prepare and Later Publish `dev-flow-codex`

This is the implemented Feature 006 operator interface. Deterministic preparation and verification
are repeatable and have no remote side effects. Irreversible publication, the native final Journey,
and GitHub Release finalization are T047–T050 work and have not been executed.

## Current status

```text
T001–T046 deterministic implementation passed
T047–T050 irreversible real release not started
```

No public npm version, registry tarball read-back, Git Tag, GitHub Draft/Release/assets, or final
registry-package Journey currently exists.

Activate the existing feature package for Spec Kit work:

```bash
export SPECIFY_FEATURE_DIRECTORY="$PWD/specs/006-publish-codex-installable-product"
```

## Operator prerequisites for T047–T050

- Feature 006 Phase 6 is committed, reviewed, and merged.
- The checkout is the frozen release commit on branch `main` and the worktree is clean.
- The machine is native macOS arm64.
- Go, Node.js, pnpm, npm, git, and GitHub CLI satisfy the recorded policy.
- npm identifies the authorized publisher for the fixed `dev-flow-codex` name.
- GitHub CLI has release/tag permission for `Innocent-children/dev-flow`.
- Root, package, plugin, Core, Tag, manifest, and record versions equal root `VERSION`.
- The npm version and remote Tag/Release state are absent or exact reusable state.

T002 already recorded the development permission preflight. Account checks are repeated only by the
real operator workflow when T047–T050 run, not by deterministic Phase 6 validation.

## Repeatable operations with no remote mutation

### 1. Select one empty external directory

```bash
RELEASE_OUTPUT="$(mktemp -d)"
```

The directory must be absolute, empty, non-symlinked, and outside the source repository. For the
real release, T047 freezes one reviewed source commit and uses one frozen output directory for the
entire T047–T050 sequence.

### 2. Prepare

```bash
pnpm run release:codex:prepare -- --output "$RELEASE_OUTPUT"
```

Preparation admits only a clean native `main` checkout, creates two independent detached clean
worktrees at the same commit, builds twice, compares Runtime bytes and normalized package trees,
then removes the temporary worktrees. It performs no npm/GitHub/Tag/Host mutation.

The output is exactly:

```text
dev-flow-codex-<VERSION>.tgz
dev-flow-<VERSION>-darwin-arm64
SHA256SUMS
release-manifest.json
publication-record.json
```

The support entry is `pending`; the publication record is `prepared`. The mutable publication
record is not a GitHub Release asset.

### 3. Verify

```bash
pnpm run release:codex:verify -- --directory "$RELEASE_OUTPUT"
```

Verification rehashes the exact artifacts, validates normalized files/modes/metadata, source and
Core identities, Schema shape, provisional checksums/support, and bounded forbidden content. It is
local, network-free, and safe to repeat before any real publication.

### 4. Inspect

```bash
sed -n '1,240p' "$RELEASE_OUTPUT/release-manifest.json"
sed -n '1,260p' "$RELEASE_OUTPUT/publication-record.json"
sed -n '1,40p' "$RELEASE_OUTPUT/SHA256SUMS"
```

Reject absolute paths, credentials, auth configuration, raw environment values, prompts, unbounded
output, source, database, receipt, cache, or DeepSeek content.

## Read-only remote preflight

The publisher can observe source, npm, Tag, and GitHub state without confirmation:

```bash
pnpm run release:codex:publish -- --directory "$RELEASE_OUTPUT"
```

Without `--confirm`, it writes bounded observations and a safe next action to the local publication
record, then exits before remote mutation.

## Irreversible operations — not yet executed

### 5. Exact publication command

Only T047–T050 may run this command, from the reviewed clean `main` commit and the same frozen
directory:

```bash
VERSION="$(cat VERSION)"
pnpm run release:codex:publish -- \
  --directory "$RELEASE_OUTPUT" \
  --confirm "v$VERSION"
```

The production publisher owns one gated sequence:

1. reread exact source/npm/GitHub state;
2. create or reuse the exact Git Tag and GitHub Draft Release;
3. publish the verified npm tarball at most once;
4. read back and verify the public registry metadata and tarball;
5. invoke the closed native `--final-registry` Journey runner;
6. generate the native passed support entry and final manifest/checksums;
7. upload and officially redownload the four immutable GitHub assets;
8. finalize and reread the GitHub Release;
9. mark the local publication record `complete`.

The T048, T049, and T050 task boundaries are operator evidence checkpoints inside this resumable
sequence; they are not alternative package sources or bypass flags.

### 6. Final registry-package Journey gate

The publisher invokes `scripts/run-codex-real-journey.sh --final-registry` with closed package,
version, official registry, digest, source, Codex executable, workspace, and result-directory
arguments. Production accepts only:

```text
dev-flow-codex@<VERSION>
https://registry.npmjs.org/
native macOS arm64
compatible real Codex
isolated npm prefix/cache/HOME/Codex/data/temp/workspace/evidence
```

The Journey proves install, explicit setup, ordinary zero-trigger, explicit `$dev-flow`, task
create/apply, Codex restart, same-task resume, Core `DONE`, explicit remove, npm uninstall, and
retained task reopen. Local tgz, source checkout, Runtime override, fake Codex, or fixture evidence
cannot satisfy this production gate.

### 7. GitHub finalization gate

Finalization occurs only after exact npm read-back, native final Journey, one passed macOS arm64
support entry, final manifest/checksums, four verified assets, removal/uninstall, and retained reopen.
The publisher rereads Tag, npm, assets, Release identity, and support facts immediately before and
after finalization.

## Resume after interruption

Rerun the same exact publish command with the same frozen directory and confirmation.

- Every invocation rereads remote truth before mutation.
- Exact matching completed steps are reused.
- An existing npm version is never republished.
- Missing later steps continue.
- Conflicting source, Tag, Draft, npm bytes, asset bytes, or final identity stops with `blocked`.
- `publication-record.json` records the exact failure and safe next action.

Never move/delete a Tag, overwrite an asset, unpublish npm as rollback, force-publish, or substitute
a new release directory to hide partial truth.

## Final repository checks

After the real operator sequence:

```bash
git diff --check
git status --short
```

Generated release output remains outside Git. `packages/deepseek/` and shared Core/MCP/SQLite
semantics remain unchanged.
