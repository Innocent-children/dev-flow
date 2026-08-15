# 003 Codex Explicit Dev Flow

Feature 002 and Core Contract 0.1 are complete. This directory contains the reviewed planning
package for the thin, explicit-only Codex product.

The remediation review establishes these implementation gates:

1. Codex compatibility is revalidated immediately before final validation; the planning-time
   `0.147.x` line is historical evidence, not a permanently frozen schema rule.
2. User-story checkpoints use static, fake-Codex, fake-Core, packaged-Core, and journey-harness
   evidence only.
3. Feature 003 performs exactly one real Codex host journey, after targeted checks, root validation,
   a read-only scope audit, source freeze, and creation of one final artifact.
4. JSON Schema validates evidence structure; a separate read-only semantic validator proves version,
   source/artifact, revision, task-lineage, budget, terminal-outcome, retained-data, repository, and
   prior-validation relationships.
5. Feature 003 owns the first Codex-aware expansion of the root repository validator. Feature 004
   consumes that merged capability rather than repairing it later.

The package remains one private local artifact containing one plugin, one `dev-flow` Skill, one
local STDIO MCP server, and one packaged Core runtime. It does not publish, mutate Git, edit target
repositories during setup/removal, or duplicate Core workflow authority.

Implementation proceeds only after the reviewer-owned checklists in this directory remain satisfied
against the final revised artifacts.
