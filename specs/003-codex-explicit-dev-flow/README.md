# 003 Codex Explicit Dev Flow

Feature 002 and Core Contract 0.1 are complete. This directory contains the reviewed planning
package for the thin, explicit-only Codex product.

The remediation review establishes these implementation gates:

1. Codex compatibility is revalidated immediately before final validation. T052 selected exact
   stable Codex CLI `0.147.0` within `>=0.147.0 <0.148.0`; this remains an implementation-time
   result rather than a permanent product-schema rule.
2. User-story checkpoints use static, fake-Codex, fake-Core, packaged-Core, and journey-harness
   evidence only.
3. Feature 003 completes exactly one passing real Codex host journey. Only T058 may launch Codex,
   and each immutable source/validation/artifact chain may launch it at most once after targeted
   checks, root validation, a read-only scope audit, source freeze, and one final artifact/report.
   Failed or blocked attempts remain counted in the external attempt ledger, cannot establish
   support, and require a source fix plus a wholly new T055–T057 chain before another launch.
   Passing commit is evidence-first: a reserved chain durably prepares exact candidates, publishes
   evidence create-no-replace, then finalizes the ledger; valid passing evidence is an immediate
   no-host lock across crash recovery.
4. The canonical journey schema is pass-only; failed/blocked attempts use an independent closed
   external diagnostic schema. A read-only semantic validator proves version, source/artifact,
   raw-revision/thread lineage, Core-derived verification budget and commands, authoritative
   terminal outcome, non-secret retained-data identity, registry cardinality, repository, ledger
   lock/CAS, and prior-validation relationships.
5. Feature 003 owns the first Codex-aware expansion of the root repository validator. Feature 004
   consumes that merged capability rather than repairing it later.

The package remains one private local artifact containing one plugin, one `dev-flow` Skill, one
local STDIO MCP server, and one packaged Core runtime. It does not publish, mutate Git, edit target
repositories during setup/removal, or duplicate Core workflow authority.

The selected 0.147 contract stores the explicit-only policy in
`plugin/skills/dev-flow/agents/openai.yaml`, uses the MCP shape accepted by both 0.147 plugin
parsers, and reconciles the official top-level-object/camelCase plugin CLI JSON.

Implementation proceeds only after the reviewer-owned checklists in this directory remain satisfied
against the final revised artifacts.
