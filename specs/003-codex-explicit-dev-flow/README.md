# 003 Codex Explicit Dev Flow

This feature is planned and ready for implementation review; this status does not imply approval.
Its original planning gates are satisfied:

1. `002-govern-and-resume-single-repository-task` is complete.
2. Core Contract 0.1 and fixture digests are recorded.
3. The then-current official Codex plugin, Skill, MCP registration, local import, and removal
   behavior has been revalidated.
4. A minimum Codex version, compatible range, and real-evidence platform have been selected; the
   latest stable compatible Codex is required for the implementation journey.

The directory now contains the specification plus planning, research, data model, external
contracts, quickstart, requirements-quality checklists, and dependency-ordered implementation tasks.
The workflow used to prepare them was:

```text
$speckit-clarify
$speckit-plan
$speckit-checklist
$speckit-tasks
$speckit-analyze
```

Implementation must not modify Core Contract 0.1 merely to simplify the Codex adapter. Any genuine
shared contract gap requires a separate Core feature before implementation continues. Feature 003
will claim native evidence only after the final local artifact's exact Codex CLI 0.147.x macOS arm64
journey is recorded; it does not publish the package.
