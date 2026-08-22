# Dev Flow Repository Instructions

## Authority

Before any implementation work, read in this order:

1. `.specify/memory/constitution.md`
2. `docs/SPEC-KIT-WORKFLOW.md`
3. the active feature's `README.md`
4. the active feature's `spec.md`
5. the active feature's `plan.md`
6. the active feature's `contracts/`
7. the active feature's `tasks.md`

Before a version-only release, do not select or create a Feature. Read in this order:

1. `.specify/memory/constitution.md`
2. `docs/SPEC-KIT-WORKFLOW.md`
3. `release/README.md`
4. `release/codex/README.md`
5. the current release schemas and publisher contracts under `release/`

The active Spec Kit feature is selected by `.specify/feature.json` when available or by
`SPECIFY_FEATURE_DIRECTORY`. Do not infer it only from the Git branch, directory name, chat history,
or the most recently edited specification.

## Requirement Scope

Only the Constitution, the complete active Product Feature package when product behavior changes,
and the user's current explicit instruction define authorized product work. A version-only release
is authorized by completed product work plus the user's selected release mode, target version, and
exact confirmation; it does not use a release Feature.

- Every implementation task must trace to an active `FR-*`, `SC-*`, contract clause, or approved
  engineering constraint.
- A task must name exact files or directories before implementation.
- Do not convert rationale, examples, future candidates, historical incidents, or release evidence
  into new product behavior.
- Do not broaden an implementation because a nearby abstraction appears useful.
- When the active package is incomplete or contradictory, stop implementation and amend the
  specification first.
- Completed historical feature packages are evidence. Do not rewrite them to match current
  templates or terminology.

## Documentation and Internationalization

Human-readable documentation mirrors delivered product behavior; it is not runtime, build, release,
or test authority. The maintained locale set and document-family coverage are defined by
`docs/I18N.md` and `docs/I18N_en.md`.

Every Product Feature that changes user-visible behavior MUST update documentation in the same pull
request and in the same implementation checkpoint:

1. update `README.md` and every maintained root README locale listed in `docs/I18N.md`;
2. update both `docs/PRODUCT.md` and `docs/PRODUCT_en.md`;
3. update each affected technical reference, including `docs/ARCHITECTURE*`,
   `docs/SUPPORT-MATRIX*`, `docs/COMMANDS*`, `docs/ROADMAP*`, host package READMEs, installation
   instructions, or invocation documentation when the changed surface applies;
4. list the exact documentation paths in the active `tasks.md` and in the pull-request validation
   summary.

A version-only release that changes public versions, bundled Core identities, platform support, Host
compatibility, installation commands, or release evidence MUST synchronize the same facts across all
maintained root README locales and the affected support, command, and package documentation before
publication.

Public end-user installation examples MUST select the current npm stable channel with
`dev-flow-codex@latest` or `dev-flow-deepseek@latest`. Exact versions MUST remain in Support Matrix
rows, npm version links, Release Tags, bundled Core identities, artifact digests, and final release
evidence. Do not replace immutable evidence identities with `latest`, and do not leave a released
version pinned indefinitely in ordinary installation instructions.

Every documented command MUST be checked against its executable authority before merge:

- npm package names, `bin` entries, and platform constraints from the relevant `package.json`;
- Codex subcommands and argument forms from `packages/codex/bin/dev-flow-codex.mjs`;
- DeepSeek DSH install, inspection, and removal forms from lifecycle tests and final-artifact journeys;
- packaged Core commands from `cmd/dev-flow/main.go`;
- MCP tool names, annotations, and purposes from the closed catalog under `internal/mcp/`.

A change that adds, removes, or changes a CLI command, selector, environment variable, lifecycle
command, or MCP tool MUST update `docs/COMMANDS.md`, `docs/COMMANDS_en.md`, every affected package
README, and all root README locale command snippets in the same checkpoint. Do not document inferred
`help`, `update`, `uninstall`, alias, or other command forms that the implementation does not accept.
Clearly distinguish user shell commands, managed Host commands, conversational selectors, and MCP
tools.

- Do not update only one locale when a maintained document family has multiple locale files.
- Do not leave placeholder translations, stale version numbers, untranslated new sections, or an
  English fallback copied into another locale file.
- Preserve commands, identifiers, paths, versions, digests, code blocks, tables, Mermaid graphs, and
  support claims exactly across translations; translate prose, not product facts.
- If synchronized translation cannot be completed, the Product Feature or release documentation is
  incomplete and must not be reported as ready for merge or publication.
- A documentation-only correction must update every maintained locale file containing the corrected
  statement.

## Product Boundary

Only the Go Core owns:

- task and repository-claim identity;
- process definition and content digest;
- current node and resume node;
- node purpose, obligations, allowed effects, and required evidence;
- legal outgoing transitions and transition guards;
- next-action identity;
- blocker and recovery classification;
- terminal outcome.

Codex, DeepSeek, Spec Kit, OpenSpec, CLI, MCP, and package scripts are adapters or execution aids.
They must not persist a second process cursor, add a transition, skip a node, infer completion, or
reinterpret a Core result.

The target product direction is the development-process state graph defined by the active replacement
feature. Feature 008 intentionally carries no released linear Core contract task runtime, migration, v1 codec, or
legacy process. Until the replacement completes, do not add new old-model phases, result values, or
hidden fast paths.

## Method-Tool Boundary

`plain`, `spec-kit`, and `openspec` are method profiles, not workflow authorities.

- Core owns semantic method steps and the current process node.
- Host adapters may render supported commands or instructions for the selected profile.
- Missing tooling must be reported honestly; it does not authorize fabricated completion.
- Spec Kit/OpenSpec artifacts may provide evidence, but their local status does not mutate Core
  state without an exact Core action submission.
- Do not make Spec Kit or OpenSpec a production dependency of the Go Core.

## Spec Kit Package Discipline

Feature 文档只服务于实施阶段，不是产品、构建、发布或测试权威。生产代码、脚本和测试不得读取
Feature Markdown 来决定版本、Schema、能力或运行行为；完成后的 Feature 可以从当前源码树清理，
历史通过 Git 追溯。

A public-behavior, process, shared-contract, persistence, or adapter-contract change requires this
complete package:

```text
specs/<NNN-feature-name>/
├── README.md
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
├── checklists/requirements.md
└── tasks.md
```

Use `docs/SPEC-KIT-WORKFLOW.md` for artifact responsibilities, status values, change
classification, execution order, amendment rules, and release separation.

Version alignment and publication MUST NOT create a Feature. They use the standalone release command,
release schemas, external manifest/publication record, and immutable public identities.

For an already prepared package:

1. select the exact feature directory;
2. run `$speckit-clarify`;
3. review or run `$speckit-checklist`;
4. run `$speckit-analyze`;
5. implement one approved phase or user story;
6. run its targeted checks;
7. run `$speckit-converge`;
8. stop at the requested checkpoint.

Do not regenerate `spec.md`, `plan.md`, or `tasks.md` merely because a command is available. Amend
them intentionally and keep requirement/task traceability.

Do not modify generated skills under `.agents/skills/`.

## State-Graph Specification Discipline

When a feature changes process behavior, its artifacts must define all of the following before code:

- affected process definition and content digest;
- affected nodes;
- complete outgoing transitions for every affected node;
- transition IDs, destinations, guards, and required reasons;
- node entry assumptions and completion conditions;
- allowed effects and required evidence;
- method-profile operations;
- payload and MCP projections;
- exact persisted-data disposition; before `1.0.0`, do not invent historical-task compatibility unless the user explicitly requires it;
- forbidden transitions and non-goals.

Do not implement a node without its full edge set. Do not add a destination in code and ask the
documentation to recognize it later.

## Implementation Discipline

- Implement product behavior only through tasks explicitly listed in the active `tasks.md`.
- Implement version-only release work only through the standalone release contracts after the user
  selects a release mode; do not create or reopen a Feature for publication.
- Stop at the requested phase, user story, or checkpoint.
- Prefer direct readable code over frameworks, registries, builders, and wrappers.
- Do not create a generic graph DSL, user-configurable process, plugin framework, HTTP transport,
  Web UI, multi-repository flow, or unspecified compatibility layer.
- Keep Core and host responsibilities separate.
- Do not change public contracts from a host-only branch.
- When a shared contract is insufficient, amend the shared feature first.
- Do not add `legacy-linear`, legacy snapshot decoding, dual task projections, or pre-graph data migration for Feature 008.
- Reject pre-graph databases with zero writes and require explicit user-controlled archive/rename/delete or a fresh data directory; never delete automatically.
- No release operation belongs in an ordinary product feature.

## Git Boundary

The product Core may inspect Git read-only. It may not create, switch, delete, reset, clean, stash,
commit, push, merge, rebase, tag, publish, or otherwise mutate Git state.

Repository development actions require explicit user authority. npm publication, Git Tag changes,
GitHub Release changes, asset upload, and public support claims require an explicit target version,
the user's selected `quick` or `normal` mode, exact release confirmation, and the standalone release
command. They do not require or permit a new release Feature.

## Release Mode Selection

Before every version release, the agent must inspect the changed paths since the current public Tag,
recommend `quick` or `normal` with a concise eligibility reason, and ask the user which mode to use.
The agent must not modify versions, commit a release bump, or publish until the user answers.

- Recommend `quick` only when product/runtime behavior is unchanged. Eligible changes are limited to
  documentation, specifications, tests, repository configuration, release tooling, and approved
  version metadata. `quick` must be rejected when Core, MCP, Schema, process, persistence, Codex
  launcher/lifecycle/Skill/library, package layout, platform, or support behavior changed.
- Recommend `normal` for every product-affecting change or whenever quick eligibility cannot be
  proven.
- If the user explicitly requests `quick` for an ineligible diff, stop and report the exact blocking
  paths; never silently downgrade verification.
- Both modes first align the selected product authority and required mirror, create and push one
  version commit on clean `main`, and only then create Tag/npm/GitHub effects. A Codex release changes
  only the Codex package and plugin mirror and records the bundled Core version separately.
- `quick` runs bounded targeted checks and a final registry-package lifecycle smoke tied to the previous
  normal release. `normal` runs the approved full validation and the same registry-package lifecycle
  smoke. Complete graph, recovery, and terminal-state behavior is verified by deterministic Core and
  integration tests rather than an LLM-driven release Journey.
- Recovery always reuses the same mode, version, output directory, source identity, Tag, npm bytes,
  and publication record. The script must automatically handle reviewed tooling against a frozen
  source after immutable remote state exists.

## Test Budget

Run only checks required by the active task and acceptance criteria.

- Prefer package-local, node-local, storage-boundary-local, or user-story-local checks.
- Do not run the complete repository suite after each edit.
- Run the final repository-wide validation at most once for `normal` unless the active Product
  Feature records a concrete reason for a retry. `quick` does not run the repository-wide suite.
- Real-host registry lifecycle smoke runs only at the selected release mode's explicit final checkpoint.
- Never promote fake, fixture, static, different-platform, or user-performed evidence into native
  automated evidence.
- Report unavailable checks as unavailable; do not replace them with broader unrelated testing.

## Change Control

When approved behavior changes:

1. update `spec.md`;
2. update the affected contract documents;
3. rerun clarification and requirements-quality review;
4. update `plan.md`, `data-model.md`, `quickstart.md`, and `tasks.md`;
5. rerun analyze;
6. reassess completed tasks against the amended requirements;
7. only then resume implementation.

Do not enlarge code scope first and ask the specification to ratify it afterward.
