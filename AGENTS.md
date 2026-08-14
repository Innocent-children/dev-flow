# Dev Flow Repository Instructions

## Authority

Before any implementation work, read:

1. `.specify/memory/constitution.md`
2. the active feature's `spec.md`
3. the active feature's `plan.md`
4. the active feature's `tasks.md`

The active Spec Kit feature is selected by `.specify/feature.json` or
`SPECIFY_FEATURE_DIRECTORY`. Do not infer it only from the current Git branch.

## Requirement Scope

Only the Constitution, the active feature artifacts, and the user's current explicit instruction
define product work.

- Every implementation task must trace to an active requirement or approved engineering constraint.
- Do not invent compatibility, migration, integration, platform, or release requirements that the
  active feature does not define.
- Do not turn rationale, examples, future candidates, or unrelated repository context into product
  behavior or test gates.
- When current artifacts are insufficient, stop implementation and amend the feature before coding.

## Product Boundary

Only the Go core owns:

- task state;
- workflow transitions;
- next-action selection;
- repository claims;
- recovery classification;
- terminal outcomes.

Codex and DeepSeek adapters must remain host-specific and thin. They must not persist task state,
reimplement the transition table, or infer completion independently of the core.

## Implementation Discipline

- Implement only tasks explicitly listed in the active `tasks.md`.
- Stop at the requested phase or user-story checkpoint.
- Do not add future abstractions, generic plugin frameworks, workflow DSLs, HTTP transports,
  Web UI, multi-repository support, or unspecified compatibility layers.
- Do not change public contracts from an adapter branch.
- When a core contract is insufficient, stop and create or amend a core specification first.
- Keep normal state count, MCP tool count, and direct dependency count within the Constitution.
- Prefer direct, readable code over frameworks and wrappers.
- Do not create an interface until at least two real implementations need it, except for the
  minimal Store and RepositoryObserver ports required to isolate infrastructure from domain logic.

## Git Boundary

The product core may inspect Git read-only. It may not create, switch, delete, reset, clean,
stash, commit, push, merge, rebase, tag, or publish Git state.

Repository development actions also require explicit user authority. Do not publish releases or
npm packages during ordinary implementation.

## Test Budget

Run only checks required by the active task and its acceptance criteria.

- Do not run an entire repository suite after every small change.
- Prefer package-local or user-story-local checks.
- Run full cross-repository validation only at the final feature checkpoint or when explicitly
  required by the specification.
- Never claim native-host or real-agent evidence from a fake adapter, static inspection, or a
  different operating system.
- User-performed validation must be reported as user evidence, not automated evidence.

## Spec Kit Workflow

For an already prepared feature package:

1. Review the existing spec; do not recreate it.
2. Run `$speckit-clarify`.
3. Run `$speckit-checklist`.
4. Run `$speckit-analyze`.
5. Implement one phase at a time with `$speckit-implement`.
6. Run `$speckit-converge` after the selected implementation slice.
7. Append only concrete remaining work.

Do not modify Spec Kit generated skills under `.agents/skills/`.
