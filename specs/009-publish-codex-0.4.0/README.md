# Feature 009: Publish Codex 0.4.0

## Status

- **Feature**: `009-publish-codex-0.4.0`
- **Status**: Implementing
- **Change Type**: Release Change
- **Created**: 2026-08-20
- **Baseline**: `main` at `3b99b0c198a72f0e079ada18bc7f214075585f79`
- **Release Authority**: Align and publish `dev-flow-codex@0.4.0` for macOS arm64 from one clean `main` source identity

## Purpose

Publish the completed Feature 008 development-process graph as `dev-flow-codex@0.4.0`. The
maintainer-facing release workflow is one reviewed source change followed by one exact-confirmation
operator command that prepares, verifies, publishes, reads back, runs the final native Journey, and
finalizes the GitHub Release.

## Authority

Read in this order:

1. [Constitution](../../.specify/memory/constitution.md)
2. [Workflow standard](../../docs/SPEC-KIT-WORKFLOW.md)
3. [`spec.md`](spec.md)
4. [`plan.md`](plan.md)
5. [`contracts/`](contracts/)
6. [`tasks.md`](tasks.md)

## Scope

- Align the current product, package, plugin, bundled Core, manifest, Tag, and Release identity to
  `0.4.0`.
- Add one root release command that owns local preparation, verification, remote preflight,
  publication, final Journey, asset verification, and finalization.
- Publish only `dev-flow-codex` with the existing macOS arm64 bundled runtime and record exact
  source/artifact/publication evidence.
- Publish the completed Core Contract 0.2, Schema 2, and `standard-development@1` source delivered by
  Feature 008.

## Non-Goals

- Product graph, MCP, persistence, recovery, and Host Adapter semantics remain those completed by
  Feature 008.
- DeepSeek, Linux, Windows, Intel Mac, signing, notarization, automatic updates, migration, and a
  hosted publication service are outside this release.

## Dependencies and Persistence Boundary

Feature 008 is complete and merged. Feature 009 changes release identity and operator orchestration
only. Runtime persistence remains Feature 008's `reject-and-reset` boundary: Schema 1 data is rejected
with zero writes, the product never deletes it automatically, and the user selects a fresh data
directory or archives, renames, or deletes the old directory explicitly.

## Activation

```bash
export SPECIFY_INIT_DIR="$PWD"
export SPECIFY_FEATURE_DIRECTORY="$PWD/specs/009-publish-codex-0.4.0"
```

## Workflow Gate

Before implementation:

1. run or review `$speckit-clarify`;
2. complete `checklists/requirements.md`;
3. run `$speckit-analyze`;
4. resolve all blocking findings;
5. update status to `Ready`.

## Checkpoints

| Checkpoint | Exit Condition | Status |
| --- | --- | --- |
| Contract freeze | Version, command, manifest, failure, support, and historical-evidence boundaries are closed | Complete — T001–T003; analyze found zero blocking findings |
| Release implementation | One-command orchestration and `0.4.0` identity pass targeted checks | Complete — T004–T015; targeted source/package/release checks passed |
| Clean source gate | One repository validation passes and the exact clean `main` source is pushed | Complete — T016–T018; validated source committed directly to `main` |
| Public release | npm, Tag, final Journey, four assets, GitHub Release, and publication record are verified | Pending |

## Release Boundary

This Release Feature explicitly authorizes version `0.4.0`, npm publication of `dev-flow-codex`,
Tag `v0.4.0`, GitHub Draft/Release and asset mutation, one final registry-package Codex Journey, and
the associated public macOS arm64 support statement. The exact-confirmation operator command is the
only production publication entrypoint.
