# Contract: One-Command Codex Release

## Command

```text
pnpm run release:codex -- --output ABSOLUTE_DIRECTORY --confirm vVERSION
```

Both flags are required exactly once. No positional or unknown arguments are accepted. `VERSION` is
the strict SemVer value read from root `VERSION`; confirmation must equal `v${VERSION}`.

## Source Preconditions

- current branch is `main`;
- worktree is clean;
- `HEAD` equals `origin/main`;
- operator platform is `darwin-arm64`;
- root, root package, Codex package, Codex plugin, and private DeepSeek metadata versions match;
- the output argument is absolute and outside the source repository; an existing output is a real
  directory, while a missing output has a real existing parent directory.

Failure of any precondition has zero remote effects.

## Output Routing

| Observed state | Command behavior |
| --- | --- |
| Path absent | Create one mode-0700 directory, then prepare |
| Existing empty real directory | Prepare |
| Exact five-file release directory | Resume publication |
| Any other state | Fail closed |

Preparation invokes the existing two-worktree builder and verifier. Resume delegates directly to the
publisher, which performs its own manifest, checksum, package, source, and publication-record
validation.

## Publication Effects

After local checks, the command invokes the production publisher exactly once with the supplied exact
confirmation. The publisher owns this order:

1. source/auth/ownership/remote preflight;
2. exact Git Tag;
3. exact GitHub Draft;
4. npm publish at most once;
5. npm metadata and tarball read-back;
6. native final registry-package Journey;
7. final manifest and checksum generation;
8. four GitHub asset uploads and read-backs;
9. GitHub Release finalization and identity read-back.

## Recovery

The command preserves the release directory on every failure. Rerunning with the same directory and
confirmation delegates recovery to the publication record and remote read-back. Exact completed state
is reused. Conflicting source, version, Tag, Draft, npm bytes, asset bytes, Journey identity, or public
Release state is blocked.

The command never moves or deletes a Tag, overwrites an asset, republishes or unpublishes npm, deletes
the output directory, or synthesizes a completed publication record.

## Output

Child command diagnostics stream to the operator. Successful completion emits the publisher's bounded
JSON summary. Errors contain bounded messages and omit credentials, authentication material, raw
environment values, private home paths, prompts, and unbounded subprocess output.
