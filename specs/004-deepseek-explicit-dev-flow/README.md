# 004 DeepSeek Explicit Dev Flow

This directory contains the reviewed planning package for the thin, explicit-only DeepSeek Harness
product.

Feature 004 has one explicitly authorized, bounded parallel-preparation slice before Feature 003 is
merged:

1. Before the merge, work is limited to Feature 004 documentation, official Harness contract
   research, package-local fake/deterministic tests and fixtures, Host-local source/Skill/bundle
   configuration, fake-profile journey infrastructure, and RC/stable evidence models. It may touch
   only `specs/004-deepseek-explicit-dev-flow/**`, `packages/deepseek/**`,
   `scripts/build-deepseek-package.sh`, `scripts/run-deepseek-real-journey.sh`, and
   `scripts/validate-deepseek-journey-evidence.mjs`.
2. The parallel slice must not edit shared Core/version/protocol/MCP code, shared contract tests,
   the root validator, or `pnpm-lock.yaml`; it must not run a native Harness gate or final journey,
   build a final artifact, add a proxy or DeepSeek-specific version seam, or establish stable
   support/completion.
3. The slice stops at the explicit **003 merge barrier** with a clean worktree and bounded commits.
4. After Feature 003 is merged, Feature 004 merges the latest `main` with a merge commit, records
   the exact merge commit, and verifies the delivered detached-build version
   seam, Codex-aware shared contracts, and Codex-aware root validator.
5. Feature 004 consumes those merged capabilities; it does not depend on mutable Feature 003 task
   numbers, duplicate shared code, or weaken Codex validation.

Harness evidence is deliberately split:

- a release-candidate direct-result spike is provisional engineering evidence only;
- the full direct-result gate is established on the exact official stable Harness version/build
  used by the final journey; RC or different-artifact evidence never substitutes;
- user-story checkpoints use deterministic package, fake Core, fake profile, retained-data, and
  journey-harness evidence only;
- exactly one final stable Harness journey is run after stable Gate B, deterministic/root validation,
  a read-only scope audit, source freeze, and creation of one final product artifact.

Passing final evidence must use a real co-installed Codex product and prove DeepSeek removal does not
change its registration, packaged runtime identity, package selection, or shared Core data. Codex
absence is a blocker, not a passing skip.

The adapter remains limited to one explicit Skill, one direct local STDIO MCP integration, a
package-relative Core launcher, and package/profile lifecycle glue. No result proxy is authorized.
A failed direct-result gate requires an explicit specification, plan, contract, test, and
Constitution amendment before proxy work can begin.

Parallel preparation proceeds only after clarification, checklist revalidation, and analysis report
no CRITICAL/HIGH issue. Shared integration and finalization proceed only after both reviewer-owned
checklists remain satisfied against the post-merge artifacts.
