# 003 Codex Explicit Dev Flow

This directory intentionally contains only `spec.md`.

Do not generate or approve `plan.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`,
`checklists/requirements.md`, or `tasks.md` until all of the following are true:

1. `002-govern-and-resume-single-repository-task` is complete.
2. Core Contract 0.1 and fixture digests are recorded.
3. The then-current official Codex plugin, Skill, MCP registration, local import, and removal
   behavior has been revalidated.
4. A minimum Codex version, compatible range, and real-evidence platform have been selected; the latest stable compatible Codex is used for the journey.

When unblocked, activate this feature directory and run:

```text
$speckit-clarify
$speckit-plan
$speckit-checklist
$speckit-tasks
$speckit-analyze
```

Planning must not modify the Core contract merely to simplify the Codex adapter. Any genuine shared
contract gap requires a separate Core feature before this feature continues.
