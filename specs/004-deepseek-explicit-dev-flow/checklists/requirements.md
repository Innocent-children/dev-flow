# Requirements Quality Checklist: DeepSeek Explicit Dev Flow

**Feature**: [spec.md](../spec.md)  
**Reviewed**: 2026-08-15 after audit remediation  
**Scope**: Requirements quality only; implementation, stable Harness availability, package
artifacts, and native evidence do not yet exist.

## Dependency and product boundary

- [x] Feature 004 starts only after completed Feature 003 is merged to `main` and records the exact
  merge/capability identities.
- [x] Shared version, Codex contract, and root-validation capabilities are consumed rather than
  duplicated or weakened.
- [x] One private package, one explicit Skill, one native STDIO integration, one launcher, and one
  packaged Core form the complete product.
- [x] Public release, cache deletion, proxy implementation, Git mutation, other platforms,
  multi-repository work, cross-host takeover, and future frameworks are excluded or explicitly
  gated.

## Harness compatibility and direct-result gate

- [x] Provisional release-candidate engineering evidence and stable support evidence are clearly
  separated.
- [x] Final compatibility requires an exact official stable Harness artifact and bounded compatible
  range.
- [x] The full direct-result gate must run on the same exact stable artifact used by the final
  journey.
- [x] Every inline/error/spill/prune/near-limit case has objective marker, byte, digest, parse, and
  retrieval-method criteria.
- [x] Failed direct consumption stops for an explicit reviewed amendment and grants no automatic
  proxy authority.

## Skill, runtime, recovery, and removal

- [x] Exact `/dev-flow`, user-only invocation, substantive/resume intent, one worktree, and
  one-repository scope are observable admission rules.
- [x] Complete fresh Core action/schema/effects/evidence/recovery/outcome remain the sole authority.
- [x] Uncertain/previewed/spilled/pruned/truncated/malformed results require complete retrieval or
  Core-defined readback before retry.
- [x] The Core child environment, no-shell/raw-STDIO/no-network lifecycle, bounded failure, and child
  cleanup are complete and measurable.
- [x] Product-identity removal, restart/readback, retained task data, compatible reinstall, repository
  safety, and Codex non-interference are distinct observable requirements.
- [x] Passing final evidence requires a real co-installed Codex product; absence cannot be recorded
  as a passing skip.

## Evidence and final ordering

- [x] Story checkpoints are deterministic and separated from native support claims.
- [x] An optional provisional Gate B, mandatory stable Gate B, and one final stable journey form the
  bounded native evidence budget.
- [x] Deterministic/root validation and source freeze precede exactly one final artifact.
- [x] The final artifact and exact stable Harness identity are reused unchanged for the final
  journey.
- [x] Structural and semantic evidence validation prove source/artifact/host identity, complete
  results, task lineage, budgets, `DONE`, removal/data/repository equality, reinstall, and Codex
  non-interference.
- [x] Honest failed/blocked records do not fabricate unavailable journey fields.

## Review result

- [x] Requirements are complete, consistent, measurable, and ready for staged implementation after
  the explicit Feature 003 merge and host gates are satisfied.
