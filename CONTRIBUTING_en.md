# Contributing to Dev Flow

[中文](CONTRIBUTING.md) | [English](CONTRIBUTING_en.md)

Thank you for helping improve Dev Flow. The project welcomes reproducible bug reports,
documentation corrections, platform support backed by final-artifact evidence, and bounded product
improvements grounded in real development problems.

## Classify the change before starting

| Change | Required path |
| --- | --- |
| Spelling, links, wording, or corrections to documentation of existing behavior | Open a bounded pull request directly and update the corresponding Chinese and English documents |
| Constitution, AGENTS, template, or documentation-governance change | Explain the governance impact; do not change product versions or perform a release |
| Implementation defect that does not change public semantics | Identify the gap between the approved contract and actual behavior, then fix only that gap |
| User-visible behavior, Core/MCP contract, persistence, process graph, or host-adapter contract change | Create a complete Product Feature first and follow the [Spec Kit workflow](docs/SPEC-KIT-WORKFLOW.md) through specification and analysis |
| Version bump, npm publication, Tag, or GitHub Release | Do not make this an ordinary pull-request deliverable; maintainers run the separate release flow after product work is merged |

When the classification is unclear, open an Issue first and describe the user problem, current
behavior, and expected result. Do not implement a large solution and then ask the specification to
accept the completed code.

## Opening an Issue

A useful bug report includes:

- the product and version, such as Core, `dev-flow-codex`, or `dev-flow-deepseek`;
- operating system, CPU, Node.js version, and host version;
- minimal reproduction steps;
- expected and actual results;
- logs or errors with secrets, private paths, and personal data removed;
- whether the issue concerns installation, explicit activation, Task transitions, Recovery, the data
  directory, or removal.

A product proposal should first explain the concrete user problem, why the current workflow cannot
solve it, and how success would be measured. Implementation approaches are useful discussion inputs,
but one technical approach should not be treated as the requirement itself.

## Local environment

Repository development requires:

- Go `>=1.26`;
- Node.js `>=24`;
- pnpm `>=11 <12`.

Fork the repository on GitHub, then create a branch from your fork:

```bash
git clone https://github.com/<your-account>/dev-flow.git
cd dev-flow
git remote add upstream https://github.com/Innocent-children/dev-flow.git
git fetch upstream
git checkout -b <type>/<short-description> upstream/main
pnpm install --frozen-lockfile
```

Before editing, read [`AGENTS.md`](AGENTS.md), the
[Constitution](.specify/memory/constitution.md), and the documents directly related to the change.
A product-behavior change must also select its exact Feature explicitly. Do not infer the active
Feature from the branch name or the most recently edited directory.

## Implementation principles

- Solve only the problem stated by the pull request. Do not add future capabilities, generic
  frameworks, or unrelated refactoring.
- Keep Go Core as the sole authority for Tasks, nodes, legal transitions, recovery classification,
  and terminal outcomes.
- Keep Core's Git observation read-only; do not add shell, commit, push, merge, tag, or publication
  authority.
- Run only validation directly connected to the changed surface, acceptance criteria, or known risk.
- When user-facing documentation has Chinese and English counterparts, update both.
- Do not edit generated files under `.agents/skills/` directly.
- Do not bump versions or perform a release from an ordinary feature or documentation pull request.

## Validation

At minimum, documentation changes should confirm that:

- Markdown renders correctly on GitHub;
- relative links, code fences, and Mermaid syntax have no obvious errors;
- Chinese and English documents describe the same product facts;
- the change does not broaden claims in the current
  [Support Matrix](docs/SUPPORT-MATRIX_en.md).

For code changes, prefer targeted checks for the affected package, node, contract, or user story.
Run repository-wide validation only at the final checkpoint required by the change contract:

```bash
pnpm run validate
```

Do not rerun the complete suite repeatedly for reassurance, and do not present simulation, static
checks, or user-performed results as real-host final-artifact evidence.

## Pull request requirements

Create the branch from current `main` and explain these items in the pull request:

1. the current problem;
2. what this change actually modifies;
3. the explicit non-goals;
4. validation performed and its result;
5. for a Product Feature, the applicable Feature, requirement, or contract references.

Concise Conventional Commit-style messages are recommended, for example:

```text
docs: clarify contributor workflow
fix(store): reject invalid snapshot before writable open
```

A pull request should remain independently reviewable. Split documentation rewrites, product
behavior changes, unrelated refactors, and version publication into separate changes rather than
placing all of them on one branch.

## Release boundary

Merging product work does not publish it immediately. Core, Codex, and DeepSeek have independent
versions. After changes are merged, maintainers inspect the actual diff, select the `quick` or
`normal` release mode, and then perform version alignment, build, read-back, Tag, npm, and GitHub
Release operations. Ordinary contributors do not need to change product versions or generate public
artifacts.

By submitting a pull request, you agree that your contribution is provided under this repository's
[Apache License 2.0](LICENSE).
