# Feature 011: Simplify Product Version Governance

## Status

- **Feature**: `011-simplify-product-version-governance`
- **Status**: Complete
- **Change Type**: Product Feature with governance amendment
- **Created**: 2026-08-21
- **Baseline**: `main` at `189cd3f1b36d75b495aa5758298252b4ea3465d0`
- **Release Authority**: Not authorized
- **Current Checkpoint**: Feature complete in unmerged Draft PR #10

## Purpose

Separate the Core, Codex, and DeepSeek product versions, remove artificial internal version
numbers, and preserve one bounded Codex release entrypoint that can build, verify, resume, and later
publish Codex with a different bundled Core version.

## Authority

Read in this order:

1. [Dev Flow Constitution](../../.specify/memory/constitution.md)
2. [Spec Kit workflow](../../docs/SPEC-KIT-WORKFLOW.md)
3. [Feature specification](spec.md)
4. [Implementation plan](plan.md)
5. [Normative contracts](contracts/)
6. [Implementation tasks](tasks.md)

## Dependencies and Baseline

Feature 011 starts from the completed Codex `0.5.0` release tooling and completed DeepSeek product
on the latest `main`. Historical Features 001–010, historical Tags, npm packages, GitHub Releases,
and publication evidence remain frozen.

## Execution Boundary

- Product source, tests, current contracts, current governance documents, and release tooling are in
  scope.
- Core, Codex, and DeepSeek product version values remain `0.5.0` throughout this Feature.
- Targeted tests run per implementation slice; `pnpm run validate` runs at most once at the final
  checkpoint.
- Native Codex and DeepSeek journeys, real publication, Tag mutation, npm mutation, GitHub Release
  mutation, platform expansion, and stress testing are outside this Feature.

## Activation

```bash
export SPECIFY_INIT_DIR="$PWD"
export SPECIFY_FEATURE_DIRECTORY="$PWD/specs/011-simplify-product-version-governance"
```

The Git branch does not select the active Feature.

## Checkpoints

| Checkpoint | Exit Condition |
| --- | --- |
| Specification | Clarification and requirements-quality review have no blocking gap |
| Design | Plan, current-format disposition, contracts, and tasks pass analysis |
| Version authorities | Three independent values and the read-only checker pass targeted tests |
| Runtime adapters | Codex and DeepSeek accept a bundled Core with a different version |
| Release tooling | Product-prefixed baseline, artifacts, manifest, resume, and path ownership pass targeted tests |
| Final gate | Converge reports no gap and one repository validation passes |

## Release Boundary

Completion authorizes only a Draft PR for review. It does not authorize a version bump, Tag, npm
publication, GitHub Release, release asset upload, or invocation of the real one-command publisher.

## Acceptance Evidence

- `pnpm run versions:check`: Core `0.5.0`, Codex `0.5.0`, DeepSeek `0.5.0`.
- `node --test tests/version-governance.test.mjs`: 3/3 passed, including
  `1.2.3 / 2.3.4 / 3.4.5` independence and current-source no-internal-version scan.
- `go test ./...`: all Go packages, contract tests, storage/recovery journeys passed.
- `pnpm --dir packages/codex test`: 167/167 passed.
- `pnpm --dir packages/deepseek test`: 34 passed; two pre-existing opt-in DSH lifecycle/spill gates
  skipped because their exact external environments were not selected and are outside Feature 011.
- `pnpm run validate`: passed on the single authorized repository-wide run.
- `go test ./internal/store` and `node --test tests/version-governance.test.mjs`: passed after the
  approved database Schema version `0.1.0` amendment; the repository-wide gate was not rerun.
- Post-review targeted checks: SQLite sidecar zero-write rejection, frozen release resume after current
  Codex version advance, package/build contracts, and current-source version scan passed.
- `$speckit-converge`: no remaining acceptance gap and no appended task.
- Read-back: local/remote Tags, npm `dev-flow-codex@0.5.0`, GitHub Releases/assets, and frozen
  Features/evidence are unchanged.

## Pull Request

Draft PR: <https://github.com/Innocent-children/dev-flow/pull/10>
