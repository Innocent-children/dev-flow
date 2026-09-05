# Dev Flow Repository Instructions

## Authority

Before implementation work, read in this order:

1. the user's current explicit request and acceptance criteria;
2. `CONTRIBUTING_zh-CN.md` or `CONTRIBUTING.md`;
3. `docs/PRODUCT.md` or `docs/PRODUCT_en.md`;
4. the technical documents directly related to the change;
5. the current source code, schemas, package manifests, and executable tests for the affected surface.

Before a version-only release, read in this order:

1. `release/README.md`;
2. the selected product's release README under `release/`;
3. the current prepare and publisher contracts under `release/`;
4. the package manifest and current public-version metadata.

When documentation and executable behavior disagree, use the executable implementation to determine
current behavior and update the affected documentation in the same change. Do not infer requirements
from branch names, directory names, chat history, or historical design documents.

## Requirement Scope

The user's current explicit instruction, current public contracts, and existing product boundaries
define authorized product work.

- Every implementation task must map to the current request, an acceptance criterion, a public
  contract, or an approved engineering constraint.
- Identify the exact responsibilities, files, and directories affected before implementation.
- Do not convert rationale, examples, future candidates, or historical incidents into new behavior.
- Do not broaden an implementation because a nearby abstraction appears useful. Structural changes
  required to establish the responsibilities explicitly requested by the user remain in scope.
- When the request deliberately replaces a current contract, update that contract and its direct
  consumers in the same change. Stop only when the target design still leaves a material product
  choice unresolved.
- Historical design material is available through Git history; it is not current implementation
  authority.

## Architecture and Current Design

Code structure, responsibility boundaries, and long-term readability are implementation requirements,
not optional cleanup after behavior works.

Before choosing an implementation pattern, assign every affected behavior to exactly one of these
responsibilities:

- Core owns platform-neutral product semantics, the state graph, current data rules, and decisions.
- Host adapters translate Codex, DeepSeek, CLI, MCP, and WebUI interactions without becoming workflow
  authorities.
- Platform implementations own operating-system-specific paths, permissions, processes, signals,
  executable handling, file identity, and deletion behavior.
- Build and release code owns target compilation, artifact staging, package contents, verification,
  and publication.

Apply the following rules to every redesign:

- Select adapters or another design pattern only after the responsibilities are clear. A pattern is
  useful only when it makes those responsibilities easier to understand and change.
- Keep interfaces small and consumer-specific. Do not create one platform or Host interface that
  combines paths, processes, files, builds, releases, and product rules.
- Do not add a layer when a direct function or small module already expresses one responsibility
  clearly.
- Keep every platform difference inside its platform implementation. Adding or changing Windows or
  another platform must not change macOS implementation details or Core semantic rules.
- Core semantic code must not branch on the operating system. Operating-system selection belongs at
  the platform boundary.
- Implement only the current approved design. Do not add or retain historical-data readers, old
  Schema migrations, old path rules, compatibility versions, compatibility branches, or fallback
  behavior.
- Historical Task data may be incompatible with the current design. Do not add migration, reset
  prompts, fallback reads, or user-facing compatibility-result handling for it.
- When the affected surface contains compatibility code alongside the current design, remove that
  code in the same change. Remove its tests and documentation at the same time.
- Tests describe only current behavior. Do not retain tests solely to preserve superseded data,
  Schemas, paths, commands, or runtime behavior.

Judge the resulting design by these outcomes:

1. A maintainer can identify the owner of each behavior directly from the code structure.
2. A platform change does not alter another platform's implementation.
3. Core semantic code contains no operating-system decisions.
4. Build, runtime, and product-data rules remain separate.
5. Superseded compatibility code and tests are absent.
6. Understanding current behavior does not require tracing fallback chains.

## Product Feature Proposals

Before implementation, structure a product feature proposal with this template:

```markdown
## Problem

What actually happened?

## Current approach

How does the user handle it without Dev Flow?

## Available data

What can the Task, Action, repository, and saved results tell us?

## Behavior rules

Should the system continue, review, retry, block, or ask the user to decide?

## Expected result

What change will the user ultimately see?

## Risks and impact

What are the consequences of a false allow and a false block?

## Acceptance checks

How will we test this, in which environment, and what result should we see?

## Non-goals

Which capabilities will this change not expand?
```

Answer these questions before product implementation:

1. Does the proposal help a long-running task resume from the correct state?
2. Is the decision based on Task, Action, repository observation, or retained records rather than
   only an agent narrative?
3. Does it reduce the user's effort to understand current state and next step?
4. Can we repeat the full workflow in an actual Codex or DeepSeek session?
5. Does Core remain the only component that decides Task state?
6. Does it add unnecessary process steps?
7. Does it solve a task problem, or only add another platform, Host, or interface?

Do not move a proposal directly into implementation when it cannot state the user problem,
user-visible result, and acceptance method clearly.

## Documentation and Internationalization

Write documentation in clear, formal technical language. Explain current behavior, component
responsibilities, verification methods, and the impact of failure. Use concise technical headings
rather than conversational questions. Use concrete descriptions such as test results, saved records, allowed fields, and the component that owns a decision. Keep actual
code identifiers, field names, commands, and paths unchanged; explain them when first introduced.
Retain established technical terms such as code baseline, interface specification, state machine, and
idempotency when they express the intended meaning accurately. Revise wording in context rather
than applying a word blacklist.
Acceptance sections must name the steps or tests, expected results, and actual verification scope.

Human-readable documentation describes only delivered current product behavior; it is not runtime,
build, release, or test authority. The maintained locale set and document-family coverage are defined
by `docs/I18N.md` and `docs/I18N_en.md`.

Every change to user-visible behavior must update documentation in the same pull request:

1. update all nine root README locale files defined by `docs/I18N.md`;
2. update both `docs/PRODUCT.md` and `docs/PRODUCT_en.md`;
3. update each affected technical reference, including `docs/ARCHITECTURE*`,
   `docs/SUPPORT-MATRIX*`, `docs/COMMANDS*`, `docs/ROADMAP*`, host package READMEs, installation
   instructions, or invocation documentation;
4. list the exact documentation paths in the pull-request validation summary.

A version-only release updates machine-readable version files and release records. Human-readable
documentation must not contain exact Core, Codex, DeepSeek, or Dev Flow CLI release versions.

Public end-user installation examples must select the current npm stable channel with
`dev-flow-codex@latest` or `dev-flow-deepseek@latest`. Exact product versions remain only in
machine-readable authorities, package metadata, Release Tags, artifact digests, and release records.

Every documented command must be checked against its executable implementation before merge:

- npm package names, `bin` entries, and platform constraints come from the relevant `package.json`;
- Codex subcommands and argument forms come from `packages/codex/bin/dev-flow-codex.mjs`;
- DeepSeek install, inspection, and removal forms come from lifecycle tests and final-artifact
  end-to-end tests;
- packaged Core commands come from `cmd/dev-flow/main.go`;
- MCP tool names, annotations, and purposes come from the fixed tool list under `internal/mcp/`.

A change that adds, removes, or changes a CLI command, selector, environment variable, lifecycle
command, or MCP tool must update `docs/COMMANDS.md`, `docs/COMMANDS_en.md`, every affected package
README, and all affected root README locale snippets.

- Do not update only one side of a maintained Chinese/English document family.
- All nine root README locale files are maintained. Keep their core position, capability, boundaries,
  commands, support facts, and detailed-document links synchronized.
- Do not leave placeholder translations, stale version numbers, untranslated new sections, or an
  English fallback copied into another locale file.
- Remove superseded compatibility descriptions, historical Schema and path rules, migration
  instructions, reset guidance, and historical-data incompatibility notes from every maintained
  document in the same change that removes the behavior.
- Preserve commands, identifiers, paths, versions, digests, code blocks, tables, Mermaid graphs, and
  support claims exactly across translations; translate prose, not product facts.
- If synchronized translation cannot be completed, do not report the change as merge-ready.
- A documentation-only correction must update both Chinese and English technical files containing the
  same statement and every affected root README locale.

## Product Boundary

Only the Go Core owns:

- task and repository-claim identity;
- process definition and content digest;
- current node and resume node;
- action identity and revision;
- node purpose, obligations, allowed effects, and required verification records;
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
- Method artifacts may provide verification records, but their local status does not mutate Core state without an
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
- allowed effects and required verification records;
- method-profile operations;
- payload and MCP projections;
- current persisted Schema and validation rules;
- forbidden transitions and non-goals.

Do not implement a node without its full edge set. Do not add a destination in code and ask the
documentation to recognize it later.

## Implementation Discipline

- Implement only behavior authorized by the current request and current contracts.
- Implement version-only release work only through the standalone release contracts after the user
  selects a release mode; do not mix publication with ordinary product work.
- Stop at the requested phase or checkpoint.
- Make the smallest coherent change after responsibilities and module boundaries are correct. Do not
  minimize changed files or lines at the cost of structure, readability, or maintainability.
- Prefer direct code over new abstractions, but perform the structural refactoring required by the
  approved design instead of layering compatibility branches onto the old structure.
- Do not add unrelated refactoring, frameworks, registries, DSLs, provider systems, a second state
  machine, or speculative future capability.
- Multi-repository capability changes require an explicit, bounded requirement and complete contract
  review. Other work must not add them incidentally.
- Keep Core and Host responsibilities separate.
- Do not change public contracts from a host-only change.
- When a shared contract is insufficient, update and review that contract before its consumers.
- No release operation belongs in an ordinary product change.

## Core Version Changes

`CORE_VERSION` is the single machine-readable Core product-version file. Every ordinary change
that modifies the shipped Core executable, its externally observable behavior, or a Core-owned
contract must review and update `CORE_VERSION` in the same change. This includes changes to Core data
structures, the persisted Schema, protocols or payloads, process definitions, CLI or MCP behavior,
and platform implementations compiled into Core. Select the MAJOR, MINOR, or PATCH increment from
the compatibility impact and the current semantic-versioning contract; do not leave the version
unchanged merely because the change is not a release.

Changes limited to tests, documentation, or build tooling that do not alter the shipped Core do not
require a Core version increment. Direct consumers and version checks must continue to read
`CORE_VERSION`; stable public release metadata is synchronized later by the standalone release flow,
not by the ordinary product change.

## Git Boundary

The product Core may inspect Git read-only. It may not create, switch, delete, reset, clean, stash,
commit, push, merge, rebase, tag, publish, or otherwise mutate Git state.

Repository development actions require explicit user authorization. npm publication, Git Tag changes,
GitHub Release changes, asset upload, and public support claims require an explicit target version,
exact release confirmation, and the standalone release command.

## Release Selection

Before every release, require the product, channel, exact target version, and exact confirmation.
Run the fixed release checks before creating the version commit. Reruns reuse matching Tag, npm, and
GitHub Release state after verifying source and artifact bytes.

## Test Budget

Every check must trace directly to the current acceptance criteria, affected current contract, or a
regression that remains relevant to current behavior.

- Prefer package-local, node-local, storage-boundary-local, or user-story-local checks.
- Do not run the complete repository suite after each edit.
- Full matrices, stress tests, platform matrices, and real-host end-to-end tests require a concrete need.
- Delete tests for removed compatibility behavior; do not count them as current regression coverage.
- A release runs only the fixed package and publication checks; product-wide validation belongs to
  ordinary CI before release.
- Never present fake, fixture, static, different-platform, or user-performed results as native
  automated results.
- Report unavailable checks as unavailable; do not replace them with broader unrelated testing.

## Change Control

When approved behavior changes:

1. update affected public contracts and machine-readable schemas;
2. remove superseded implementations, compatibility branches, Schema migrations, fallbacks, tests,
   and documentation from the affected surface;
3. update the implementation and direct consumers;
4. update targeted tests for the current success path, main current failure paths, and regressions
   that remain relevant;
5. update affected documentation and maintained locales so they describe only current behavior;
6. run checks proportional to the changed surface;
7. report exact changed paths, verification results, and remaining current-design risks.

Do not enlarge code scope first and ask documentation to approve it afterward.
