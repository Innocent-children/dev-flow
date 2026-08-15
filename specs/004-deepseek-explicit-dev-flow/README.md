# 004 DeepSeek Explicit Dev Flow

Feature 002 is merged and Core Contract 0.1 is implemented. This directory now holds the planning
package for a thin, explicit-only DeepSeek Harness product:

- `spec.md` — product requirements and acceptance criteria;
- `research.md` — first-party Harness/package evidence and unresolved host gates;
- `plan.md` — architecture, Constitution checks, source layout, and stop gates;
- `data-model.md` — package/configuration/evidence records with no adapter workflow state;
- `contracts/` — bundle/lifecycle and explicit Skill/direct MCP contracts;
- `quickstart.md` — bounded implementation and real-host verification runbook;
- `checklists/` — specification and reviewer quality gates; and
- `tasks.md` — dependency-ordered implementation work after `$speckit-tasks` completes.

Two evidence gates remain intentionally open for implementation:

1. On 2026-08-15 the official registry offered only `@deepseek-ai/dsh@0.1.0-rc.6`; the final journey
   must wait for and use the latest official stable compatible Harness unless FR-003 is explicitly
   amended.
2. Direct Core MCP consumption must recover complete canonical results across native Harness
   inline, spill, and prune behavior before any user-story implementation proceeds. This plan does
   not authorize a projection proxy.

The adapter remains limited to Harness registration, one explicit Skill, direct local STDIO MCP,
and package-relative Core lifecycle glue. It must not add host-independent workflow, persistence,
claim, recovery, or completion logic outside the shared Core.
