# Requirements Quality Checklist: Publish the Codex Product

**Feature**: [spec.md](../spec.md)  
**Reviewed**: 2026-08-17  
**Meaning**: `[x]` approves requirements quality and implementation readiness; it does not claim a
release has been published.

## Route and product boundary

- [x] Feature 004 is explicitly deferred rather than silently completed or deleted.
- [x] Feature 006 publishes only `dev-flow-codex`.
- [x] Features 003 and 005 are explicit entry gates.
- [x] macOS arm64 is the sole first-release platform.
- [x] DeepSeek, extra platforms, signing, auto-update, and runtime-package graphs are excluded.
- [x] Shared Core semantics and `packages/deepseek/` must remain unchanged.

## Package contract

- [x] Public name, version source, license, OS/CPU, runtime path, and closed file allowlist are fixed.
- [x] Package-name permission failure has a stop-and-amend rule, not an automatic alias.
- [x] npm lifecycle hooks cannot mutate host, repository, shell, or task data.
- [x] Explicit setup/remove remain separate from npm file installation/removal.
- [x] Unsupported platforms fail before host mutation.
- [x] Source-free install and retained-data removal are independently testable.

## Release integrity

- [x] One clean commit/tree and one root version bind all components.
- [x] Two independent clean builds and normalized package comparison are measurable.
- [x] Release manifest, checksums, artifact records, and support entry are schema-defined.
- [x] Forbidden secret/path/raw-output content is explicitly rejected.
- [x] PR CI cannot publish or receive credentials.

## Publication and recovery

- [x] Exact confirmation separates read-only preparation from irreversible publication.
- [x] Tag/draft/npm/assets have exact reuse and conflict-stop rules.
- [x] npm and GitHub bytes are redownloaded and verified.
- [x] Finalization waits for the registry-package Codex journey.
- [x] Partial publication produces a truthful durable record and no fake rollback.
- [x] Immutable versions, tags, and assets are never overwritten.

## Lifecycle and support evidence

- [x] Install, setup, ordinary non-trigger, create, restart, resume, `DONE`, remove, uninstall, and
  retained reopen are all required.
- [x] Upgrade and unsupported newer schema behavior are measurable.
- [x] The support matrix claims only the actual final-artifact environment.
- [x] No real DeepSeek journey is implied.

## Spec Kit completeness

- [x] No unresolved clarification marker remains.
- [x] Plan, research, model, contracts, quickstart, checklist, and tasks agree.
- [x] Constitution Check passes under host-specific `0.x` release policy.
- [x] Every task names concrete repository paths.
- [x] User stories are independently testable and ordered by value.
- [x] Irreversible final publication is a distinct operator checkpoint.

## Approval

- [x] Feature 006 is ready for staged implementation after Features 003 and 005 are merged.
