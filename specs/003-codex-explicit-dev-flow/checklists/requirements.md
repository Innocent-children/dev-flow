# Requirements Quality Checklist: Codex Explicit Dev Flow

**Feature**: [spec.md](../spec.md)  
**Reviewed**: 2026-08-15 after audit remediation  
**Scope**: Requirements quality only; implementation, package, and native evidence do not yet exist.

## Product boundary

- [x] Product identity, one private artifact, one plugin, one explicit Skill, one STDIO server, and
  one packaged Core runtime are complete and bounded.
- [x] Core Contract 0.1 and the exact six tools remain the only workflow authority.
- [x] No proxy, generic shell MCP, target-repository setup, publication, automatic update, platform
  matrix, cross-host takeover, or future framework is implied.

## Setup, removal, and compatibility

- [x] npm installation and explicit Codex registration are separate operations.
- [x] Setup preconditions, supported mutations, exact readback, idempotency, rollback, ownership
  conflicts, receipt safety, and no-repository-write behavior are defined.
- [x] Removal ownership, interruption recovery, repeated absence, adjacent-file preservation, npm
  uninstall separation, retained data, and direct task reopen are measurable.
- [x] Codex compatibility is selected from current official stable evidence and updated consistently
  across documents, schemas, contracts, and tests rather than permanently freezing `0.147.x`.

## Skill, recovery, and evidence

- [x] Exact current-turn `$dev-flow`, substantive/resume intent, one worktree, and one-repository
  scope are observable admission rules.
- [x] Fresh Core action/schema/effects/evidence/recovery/outcome remain authoritative.
- [x] Lost, malformed, truncated, cancelled, or uncertain mutation results require read-before-retry.
- [x] Verification budgets, evidence-source labels, blockers, cancellation, and Core `DONE` are
  objectively measurable.

## Test and artifact ordering

- [x] Deterministic user-story checkpoints are separated from native evidence.
- [x] Exactly one real Codex journey is required and sufficient.
- [x] Feature 003 owns the Codex-aware root validation update.
- [x] Structural and semantic evidence validation responsibilities are separated.
- [x] Deterministic/root checks and source freeze precede one final artifact; evidence is written once
  and validated read-only afterward.
- [x] Honest failed/blocked records do not require fabricated unavailable journey fields.

## Review result

- [x] Requirements are complete, consistent, measurable, and ready for staged implementation.
