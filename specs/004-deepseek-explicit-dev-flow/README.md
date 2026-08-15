# 004 DeepSeek Explicit Dev Flow

This directory contains the reviewed planning package for the thin, explicit-only DeepSeek Harness
product.

Feature 004 is deliberately serialized after Feature 003:

1. Feature 003 must be fully implemented and merged to `main`.
2. Feature 004 records the exact merge commit and verifies the delivered detached-build version
   seam, Codex-aware shared contracts, and Codex-aware root validator.
3. Feature 004 consumes those merged capabilities; it does not depend on mutable Feature 003 task
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

Implementation proceeds only after both reviewer-owned checklists remain satisfied against the
revised artifacts.
