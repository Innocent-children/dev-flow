# Contract: Codex Release Process

## Commands

The implementation provides three explicit commands through root package scripts:

```text
release:codex:prepare
release:codex:verify
release:codex:publish
```

### Prepare

Inputs:

- clean source checkout;
- output directory;
- optional read-only toolchain report destination.

Effects:

- creates two temporary clean worktrees;
- builds and packs twice;
- compares deterministic components;
- writes release artifacts, checksums, manifest, and initial publication record;
- performs no tag, release, registry, or host mutation.

### Verify

Inputs:

- prepared release directory.

Effects:

- schema-validates records;
- rehashes every artifact;
- inspects normalized package contents/modes;
- verifies version/source/Core identities;
- scans forbidden content;
- performs no remote mutation.

### Publish

Inputs:

- verified release directory;
- exact confirmation `v<VERSION>`.

Preconditions:

- prepare/verify pass;
- source identity still matches;
- npm and GitHub authentication/ownership pass;
- remote state is absent or exact reusable state.

Effects in order:

1. exact Git tag;
2. exact GitHub draft release;
3. npm publish;
4. npm read-back;
5. final registry-package Codex journey;
6. final manifest/checksum generation;
7. GitHub asset upload;
8. GitHub asset read-back;
9. GitHub Release finalization.

Without exact confirmation, publish performs read-only preflight and exits.

## Idempotency and Resume

Every invocation rereads remote state before mutation.

- Exact existing tag/draft/npm/assets are reused after digest/source verification.
- An already published npm version is never published again.
- Missing later steps may continue from an exact publication record.
- Conflicting target, digest, source, package integrity, or asset set stops with status `blocked`.
- The tool never moves/deletes a tag, overwrites an asset, unpublishes npm, or hides prior failure.

### Lost local operator directory

If the sole local output directory is lost after partial remote initialization, recovery normally
stops. One maintainer-approved exception may prepare a new durable external directory from the same
frozen source only when the fixed npm tarball and Core digests reproduce exactly. The regenerated
provisional manifest and mutable publication record are new recovery evidence.

Before any confirmed publisher call, the production publisher must run without confirmation and
observe the exact existing Tag and Draft, absent npm version, empty assets, and pending Journey.
Recovery reuses those exact remote identities and does not move, delete, recreate, overwrite, or
manually synthesize completion state.

### npm registry replication window

After a successful npm publish or an exact previously published version observation, the publisher
makes at most ten registry metadata observations. It waits two seconds after each unsuccessful
observation except the tenth. If visibility remains absent, `npm_readback` fails with
`NPM_READBACK_TIMEOUT`, the successful publish fact remains recorded, and a later authorized resume
must reread rather than republish the version.

## Output and Diagnostics

Machine output is one bounded JSON summary or record path. Diagnostics go to stderr and exclude
tokens, auth configuration, environment values, home paths, raw prompts, and unbounded command
output.

## Credentials

Credentials are read only by standard `npm` and `gh` authentication mechanisms. They are never
copied into environment snapshots, manifests, records, logs, artifacts, tests, or Git.

Pull-request CI must not invoke `publish` and must not possess publication credentials.

## Finalization Rule

The GitHub Release remains draft until all of the following are true:

- npm read-back verified;
- all GitHub assets read back and verified;
- final clean registry-package Codex journey passed;
- final release manifest/checksum generated and verified;
- removal/uninstall retained data;
- publication record has no unresolved failed/blocked step.

Finalization is a distinct remote mutation and is followed by one final read-back of tag/release
identity.
