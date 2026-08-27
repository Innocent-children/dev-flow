# Dev Flow Repository Instructions

## Authority

Before implementation work, read in this order:

1. the user's current explicit request and acceptance criteria;
2. `CONTRIBUTING.md` or `CONTRIBUTING_en.md`;
3. `docs/PRODUCT.md` or `docs/PRODUCT_en.md`;
4. the technical documents directly related to the change;
5. the current source code, schemas, package manifests, and executable tests for the affected surface.

Before a version-only release, read in this order:

1. `release/README.md`;
2. the selected product's release README under `release/`;
3. the current release schemas and publisher contracts;
4. the package manifest and current public-version metadata.

When documentation and executable behavior disagree, use the executable implementation to determine
current behavior and update the affected documentation in the same change. Do not infer requirements
from branch names, directory names, chat history, or historical design documents.

## Requirement Scope

The user's current explicit instruction, current public contracts, and existing product boundaries
define authorized product work.

- Every implementation task must map to the current request, an acceptance criterion, a public
  contract, or an approved engineering constraint.
- Identify the exact files or directories affected before implementation.
- Do not convert rationale, examples, future candidates, or historical incidents into new behavior.
- Do not broaden an implementation because a nearby abstraction appears useful.
- When the request conflicts with current contracts or leaves a material product choice unresolved,
  stop and ask for direction before changing behavior.
- Historical design material is available through Git history; it is not current implementation
  authority.

## Documentation and Internationalization

Human-readable documentation mirrors delivered product behavior; it is not runtime, build, release,
or test authority. The maintained locale set and document-family coverage are defined by
`docs/I18N.md` and `docs/I18N_en.md`.

Every change to user-visible behavior must update documentation in the same pull request:

1. update `README.md` and every maintained root README locale listed in `docs/I18N.md`;
2. update both `docs/PRODUCT.md` and `docs/PRODUCT_en.md`;
3. update each affected technical reference, including `docs/ARCHITECTURE*`,
   `docs/SUPPORT-MATRIX*`, `docs/COMMANDS*`, `docs/ROADMAP*`, host package READMEs, installation
   instructions, or invocation documentation;
4. list the exact documentation paths in the pull-request validation summary.

A version-only release that changes public versions, bundled Core identities, platform support, Host
compatibility, installation commands, or release evidence must synchronize the same facts across all
maintained root README locales and the affected support, command, and package documentation before
publication.

Public end-user installation examples must select the current npm stable channel with
`dev-flow-codex@latest` or `dev-flow-deepseek@latest`. Exact versions must remain in Support Matrix
rows, npm version links, Release Tags, bundled Core identities, artifact digests, and final release
evidence.

Every documented command must be checked against its executable implementation before merge:

- npm package names, `bin` entries, and platform constraints come from the relevant `package.json`;
- Codex subcommands and argument forms come from `packages/codex/bin/dev-flow-codex.mjs`;
- DeepSeek install, inspection, and removal forms come from lifecycle tests and final-artifact
  journeys;
- packaged Core commands come from `cmd/dev-flow/main.go`;
- MCP tool names, annotations, and purposes come from the closed catalog under `internal/mcp/`.

A change that adds, removes, or changes a CLI command, selector, environment variable, lifecycle
command, or MCP tool must update `docs/COMMANDS.md`, `docs/COMMANDS_en.md`, every affected package
README, and all affected root README locale snippets.

- Do not update only one locale when a maintained document family has multiple locale files.
- Do not leave placeholder translations, stale version numbers, untranslated new sections, or an
  English fallback copied into another locale file.
- Preserve commands, identifiers, paths, versions, digests, code blocks, tables, Mermaid graphs, and
  support claims exactly across translations; translate prose, not product facts.
- If synchronized translation cannot be completed, do not report the change as merge-ready.
- A documentation-only correction must update every maintained locale containing the same statement.

## Product Boundary

Only the Go Core owns:

- task and repository-claim identity;
- process definition and content digest;
- current node and resume node;
- action identity and revision;
- node purpose, obligations, allowed effects, and required evidence;
- legal outgoing transitions and transition guards;
- blocker and recovery classification;
- terminal outcome.

Codex, DeepSeek, method tools, CLI, MCP, and package scripts are adapters or execution aids. They must
not persist a second process cursor, add a transition, skip a node, infer completion, or reinterpret a
Core result.

## Method-Tool Boundary

Method profiles select how a Host performs the current semantic work; they are not workflow
authorities and are not repository development requirements.

- Core owns semantic method steps and the current process node.
- Host adapters may render supported commands or instructions for the selected profile.
- Missing tooling must be reported honestly; it does not authorize fabricated completion.
- Method artifacts may provide evidence, but their local status does not mutate Core state without an
  exact Core action submission.
- Do not make an external method tool a production dependency of the Go Core.
- External code indexes, including codebase-memory, are optional and must not be installed
  automatically. When unavailable or incomplete, use Host-provided file and text search and report
  the limitation honestly.

## State-Graph Specification Discipline

When a change affects process behavior, define all of the following before implementation:

- affected process definition and content digest;
- affected nodes;
- complete outgoing transitions for every affected node;
- transition IDs, destinations, guards, and required reasons;
- node entry assumptions and completion conditions;
- allowed effects and required evidence;
- method-profile operations;
- payload and MCP projections;
- exact persisted-data disposition;
- forbidden transitions and non-goals.

Do not implement a node without its full edge set. Do not add a destination in code and ask the
documentation to recognize it later.

## Implementation Discipline

- Implement only behavior authorized by the current request and current contracts.
- Implement version-only release work only through the standalone release contracts after the user
  selects a release mode; do not mix publication with ordinary product work.
- Stop at the requested phase or checkpoint.
- Extend the existing architecture with the smallest direct change that satisfies the requirements,
  and prefer readable code over new abstractions.
- Do not add unrelated refactoring, frameworks, registries, DSLs, provider systems, a second state
  machine, or speculative future capability.
- Multi-repository capability changes require an explicit, bounded requirement and complete contract
  review. Other work must not add them incidentally.
- Keep Core and Host responsibilities separate.
- Do not change public contracts from a host-only change.
- When a shared contract is insufficient, update and review that contract before its consumers.
- No release operation belongs in an ordinary product change.

## Git Boundary

The product Core may inspect Git read-only. It may not create, switch, delete, reset, clean, stash,
commit, push, merge, rebase, tag, publish, or otherwise mutate Git state.

Repository development actions require explicit user authority. npm publication, Git Tag changes,
GitHub Release changes, asset upload, and public support claims require an explicit target version,
the user's selected `quick` or `normal` mode, exact release confirmation, and the standalone release
command.

## Release Mode Selection

Before every version release, inspect changed paths since the current public Tag, recommend `quick` or
`normal` with a concise eligibility reason, and ask the user which mode to use. Do not modify versions,
commit a release bump, or publish until the user answers.

- Recommend `quick` only when product/runtime behavior is unchanged. Eligible changes are limited to
  documentation, tests, repository configuration, release tooling, and approved version metadata.
- Recommend `normal` for every product-affecting change or whenever quick eligibility cannot be
  proven.
- If the user explicitly requests `quick` for an ineligible diff, stop and report the blocking paths.
- Both modes first align the selected product authority and required mirror, create and push one
  version commit on clean `main`, and only then create Tag, npm, or GitHub effects.
- `quick` runs bounded targeted checks and a final registry-package lifecycle smoke tied to the
  previous normal release. `normal` runs the approved full validation and the same registry-package
  lifecycle smoke.
- Recovery reuses the same mode, version, output directory, source identity, Tag, npm bytes, and
  publication record.

## Test Budget

Every check must trace directly to the current acceptance criteria, affected contract, or documented
regression.

- Prefer package-local, node-local, storage-boundary-local, or user-story-local checks.
- Do not run the complete repository suite after each edit.
- Full matrices, stress tests, platform matrices, and real-host journeys require a concrete need.
- Run final repository-wide validation at most once for a normal product change unless a concrete
  failure requires a retry. A quick release does not run the repository-wide suite.
- Real-host registry lifecycle smoke runs only at the selected release mode's final checkpoint.
- Never present fake, fixture, static, different-platform, or user-performed results as native
  automated results.
- Report unavailable checks as unavailable; do not replace them with broader unrelated testing.

## Change Control

When approved behavior changes:

1. update affected public contracts and machine-readable schemas;
2. update the implementation and direct consumers;
3. update targeted tests for the success path, main failure paths, and known regressions;
4. update affected documentation and maintained locales;
5. run checks proportional to the changed surface;
6. report exact changed paths, verification results, and remaining risks.

Do not enlarge code scope first and ask documentation to approve it afterward.
