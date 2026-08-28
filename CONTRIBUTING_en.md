# Contributing to Dev Flow

[中文](CONTRIBUTING.md) | [English](CONTRIBUTING_en.md)

Dev Flow accepts reproducible defects, documentation corrections, platform support backed by
final-artifact evidence, and bounded product improvements grounded in real development problems.

## Change classification

| Change | Requirement |
| --- | --- |
| Spelling, links, translation, or correction of existing behavior documentation | Open a bounded pull request directly and synchronize every maintained locale in that document family according to the [I18n policy](docs/I18N_en.md) |
| Template or documentation-maintenance rule change | Explain the affected surface; do not change product versions or perform a release |
| Implementation defect that does not change public semantics | Identify the gap between the approved contract and actual behavior, then fix only that gap |
| User-visible behavior, Core/MCP contract, persistence, process graph, or host-adapter contract change | Explain the user problem, scope, acceptance criteria, and approach in the pull request, and synchronize implementation, tests, documentation, and i18n |
| Version bump, npm publication, Tag, or GitHub Release | Do not make this an ordinary pull-request deliverable; maintainers run the separate release flow after product work is merged |

When classification is unclear, open an Issue first and describe the user problem, current behavior,
and expected result. Do not implement a large solution and then ask the specification to accept the
completed code.

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
solve it, and how success would be measured. An implementation approach may be discussed, but it does
not replace requirement definition.

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

Before editing, read the [I18n policy](docs/I18N_en.md), the
[Command Reference](docs/COMMANDS_en.md), and the documents directly related to the change.

## Implementation principles

- Solve only the problem stated by the pull request; do not add future capabilities, generic
  frameworks, or unrelated refactoring.
- Keep Go Core as the sole authority for Tasks, nodes, legal transitions, recovery classification,
  and terminal outcomes.
- Keep Core's Git observation read-only; do not add shell, commit, push, merge, tag, or publication
  authority.
- Run only validation directly connected to the changed surface, acceptance criteria, or known risk.
- A user-visible behavior change must synchronize every root README locale, `docs/PRODUCT*`, and
  affected technical documentation.
- A documentation correction must synchronize every maintained language in that document family.
- When adding or changing a command, verify it against the package manifest, CLI parser, DSH lifecycle,
  Core parser, or MCP catalog and synchronize `docs/COMMANDS*`.
- Public npm installation examples use `@latest`; human-readable documentation contains no exact
  product release versions.
- Do not bump versions or perform a release from an ordinary feature or documentation pull request.

## Validation

At minimum, documentation changes should confirm that:

- Markdown, tables, code fences, and Mermaid render correctly on GitHub;
- every file in the language navigation exists and links back to the other locales;
- section structure, commands, platforms, and support claims are aligned within a document
  family;
- every ordinary installation example uses `@latest`, while exact product versions remain in
  machine-readable files and release records;
- `docs/COMMANDS*` matches the executable command and tool catalog;
- non-English files contain no placeholder translation or whole-section English fallback;
- the change does not broaden claims in the current
  [Support Matrix](docs/SUPPORT-MATRIX_en.md).

For code changes, prefer targeted checks for the affected package, node, contract, or user story. Run
repository-wide validation only at the final checkpoint required by the change contract:

```bash
pnpm run validate
```

Do not repeatedly run the complete suite as generic insurance, and do not present simulation, static
checks, or user-performed results as real-host final-artifact evidence.

## Pull request requirements

Create the branch from current `main` and explain:

1. the current problem;
2. what the change actually modifies;
3. the explicit non-goals;
4. validation performed and its result;
5. acceptance criteria and their corresponding tests or contracts;
6. the document families changed and locales synchronized;
7. the implementation source for each installation or command claim.

Concise Conventional Commit-style messages are recommended, for example:

```text
docs: synchronize README locales
fix(store): reject invalid snapshot before writable open
```

A pull request should remain independently reviewable. Split documentation rewrites, product
behavior changes, unrelated refactors, and version publication into separate changes.

## Release boundary

Merging product work does not publish it immediately. Core, Codex, and DeepSeek have independent
versions. After changes are merged, maintainers select the product, channel, and exact version, then
run the fixed checks, version alignment, build, read-back, Tag, npm, and GitHub Release operations.

By submitting a pull request, you agree that your contribution is provided under this repository's
[Apache License 2.0](LICENSE).
