# Dev Flow Repository Instructions

This file defines how AI agents maintain this repository. Put repository-specific AI instructions,
implementation constraints, and documentation-update rules here. `CONTRIBUTING*` guides human
contributors; product README files guide users. The shipped Dev Flow Skills govern Host interaction
with the product and remain in the locations listed under Skill Maintenance.

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

## Documentation Responsibilities

Choose a document by its reader and purpose before editing it. A code change does not automatically
require a README or PRODUCT change. Keep detailed explanations in their owning reference and link
to them from user guides when needed.

| Document | Reader and responsibility |
| --- | --- |
| `AGENTS.md` | Repository AI agents: instruction priority, scope, architecture constraints, implementation, review, validation, documentation maintenance, and release boundaries. |
| Root `README*.md` | End users: what Dev Flow does, suitable tasks, prerequisites, installation, starting and resuming work, common operations, necessary usage limits, and links to further help. |
| `packages/*/README.md`, `docs/CODEX_en.md`, `docs/DEEPSEEK_en.md` | Users of that package or Host: setup, supported operations, troubleshooting, maintenance, removal, and Host-specific limitations. |
| `docs/PRODUCT*` | Product readers: target users, problems, user-visible behavior rules, product scope, and non-goals. |
| `docs/DEMO*`, `docs/WEBUI*`, `docs/DESKTOP-PETS*` | Users following a walkthrough or operating a specific interface; detailed interface and artwork guidance stays here. |
| `docs/ARCHITECTURE*`, `docs/ARTIFACTS*`, `docs/WORKTREE-SOURCES*`, `docs/THREAT-MODEL*` | Developers and integrators: component responsibilities, protocols, state and data rules, implementation design, and trust boundaries. |
| `docs/CORE-RESPONSES*` | Core and Host developers: success/failure envelopes, structured error detail, recovery instructions and response validation. |
| `docs/COMMANDS*` | Users and integrators needing exact commands, options, selectors, environment variables, and MCP inputs and results. |
| `docs/SUPPORT-MATRIX*`, `docs/PROJECT-STATUS*`, `docs/WINDOWS-ADAPTATION*` | Readers checking supported environments, delivered capability, recorded verification, and remaining limitations. |
| `docs/ROADMAP*` | Product readers: future outcomes and priorities, clearly distinguished from delivered capability. |
| `CONTRIBUTING*` | Human contributors: issues, proposals, development setup, validation, and pull requests. |
| `MANIFEST*`, `docs/I18N*` | Readers navigating documentation and source locations; translators checking maintained languages, document families, and translation consistency. |
| `internal/README*`, `scripts/README*`, `tests/**/README.md`, `protocol/fixtures/README.md` | Maintainers of those directories: local structure, development commands, test procedures, and fixture usage. |
| `release/**/README.md`, `docs/RELEASE-STRATEGY.md`, `docs/VERSIONING.md`, `docs/TOOLCHAIN-BASELINES*` | Maintainers: build environments, version policy, artifact preparation, verification, and publication procedures. |
| `SECURITY.md` | Users and researchers reporting vulnerabilities and checking the security reporting policy. |
| `skills/dev-flow/core/` and Host Skill directories | Agents using the installed product: maintained Core interaction instructions and Host-specific authorization, workspace, and tool operations. |

### README content

- Write root READMEs as a project introduction and user manual. Explain what the user can do, how to
  do it, and the result they should expect, using ordinary developer language.
- Keep setup steps and limitations that affect successful or safe use. Link to exact support
  coverage, advanced commands, troubleshooting, and technical explanations.
- Keep repository AI instructions in `AGENTS.md`. Do not put instruction priority, code-search
  preferences, review discipline, test-budget rules for repository development, documentation
  synchronization rules, or release approval rules in a product README.
- Explain product capabilities such as scope control and verification limits through user outcomes.
  Keep their internal algorithms, node transitions, payloads, storage fields, response transport,
  handoff formats, and Skill generation procedures in technical references or maintained Skills.
- Rewrite the relevant user section when its meaning changes. Do not append per-change summaries,
  implementation notes, regression stories, validation logs, or internal changelog sections.
- Root README rules do not remove the technical purpose of directory-local maintainer READMEs.

### Selecting documentation updates

1. Identify which existing statements or user instructions the change makes inaccurate or incomplete.
   Update those documents and any reference that owns the changed behavior in the same change.
2. Update root READMEs only when the project introduction, main capabilities, prerequisites,
   installation, common usage, or necessary usage limits change. Internal refactoring, bug fixes
   that restore documented behavior, tests, build details, and agent-maintenance rules do not by
   themselves require README edits.
3. Update `docs/PRODUCT.md` and `docs/PRODUCT_en.md` when product scope or user-visible behavior rules
   change. Technical details belong in the affected technical reference. Update ROADMAP only when
   the approved future direction or priorities change.
4. A changed command, selector, environment variable, lifecycle operation, or MCP tool requires an
   update to `docs/COMMANDS.md` and `docs/COMMANDS_en.md` and guides that expose that entry. Change
   README examples only when the entry is part of README-level usage or an existing example changes.
5. When README content changes, synchronize its meaning across all nine root README locales.
   For other maintained document families, update each counterpart containing the affected
   statement. Translation synchronization keeps the selected document family consistent; it does
   not expand that family's subject matter or require unrelated documents to change.
6. Remove superseded statements from affected documents. Put historical design in Git history and
   validation results in the relevant verification record or pull request.
7. Report the exact changed documentation paths and checks. If README or PRODUCT remains unchanged
   for a behavior change, briefly explain the applicable document responsibility in the handoff
   or pull request; do not add that explanation to README.

### Language, commands, and verification

Use clear prose appropriate to the reader. User guides describe operations and results; technical
references describe component responsibilities, fields, failure behavior, and verification. Keep
identifiers, commands, and paths unchanged and explain unfamiliar terms when first needed.
Acceptance sections name the steps or tests, environment, expected result, and actual scope checked.

The maintained languages and document families are listed in `docs/I18N.md` and `docs/I18N_en.md`.
Preserve command syntax, identifiers, support claims, and product meaning across translations.
Translate narrative text and example task descriptions naturally. Do not leave placeholder
translations, untranslated sections, or whole-section English fallbacks. Incomplete required
translations mean the change is not ready to merge.

Public npm installation examples use `@imotong/dev-flow@latest`, `dev-flow-codex@latest`, or
`dev-flow-deepseek@latest` as appropriate. Exact Core, Codex, DeepSeek, and Dev Flow CLI release
versions belong in machine-readable version files, package metadata, Release Tags, artifact digests,
and release records. A version-only release updates those records rather than README prose.

Check documented commands against their executable implementation:

- package names, `bin` entries, and platform constraints: the relevant `package.json`;
- unified lifecycle commands: `packages/dev-flow/lib/cli.mjs` and `packages/dev-flow/bin/dev-flow.mjs`;
- Codex commands: `packages/codex/bin/dev-flow-codex.mjs`;
- DeepSeek installation, inspection, and removal: lifecycle and final-artifact end-to-end tests;
- packaged Core commands: `cmd/dev-flow/main.go`;
- MCP tools: the fixed tool list under `internal/mcp/`.

For documentation-only changes, check affected links, Markdown structure, retained command
examples, translation consistency, and agreement between maintenance rules. Run additional tests
only when required by an affected executable contract; do not run the full product suite solely
because Markdown changed.

## Core Response Maintenance

Core responses follow `docs/CORE-RESPONSES.md` / `docs/CORE-RESPONSES_en.md`. Update the producer,
output Schema, error classifications and shared Host response examples together. Success and failure
have exclusive envelopes. Identified validation failures name the exact member and requirement;
quantity limits include counters, while permission restrictions have a separate error category.
Recovery actions and their messages must agree. A bounded correction requires proof of zero writes,
preserved request identity and exact allowed fields; ordinary node submissions also retain the current Action. User decisions are obtained from the user. Every complete shipped MCP request example must have an adjacent same-tool error example with a concrete trigger and implementation references. Tests must reproduce that trigger and compare the complete encoded error response. Tests
validate actual error responses as well as successful results against the published output Schema.

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

## Skill Maintenance

Core interaction instructions and examples have one maintained source: `skills/dev-flow/core/`.
Host-specific instructions and helpers are maintained in:

- Codex: `packages/codex/plugin/skills/dev-flow/`;
- DeepSeek: `packages/deepseek/skills/dev-flow/`.

The two Host directories each contain an authored `SKILL.md` entrypoint, Host-specific references
and helpers, and generated Core reference copies. Files marked `Generated from skills/dev-flow/core/`
are generated copies; edit their shared source instead of editing either package copy by hand.
Keep shared Core semantics in the shared source and actual Host authorization, workspace operations,
tool invocation and response transport in the corresponding adapter instructions. Every interaction
rule and example must be grounded in the current implementation; document Host limitations accurately.

After changing shared content, regenerate both package copies from the repository root:

```bash
node scripts/sync-skill-references.mjs
node scripts/sync-skill-references.mjs --check
```

Include the shared-source changes and both generated outputs in the same change. When adding,
moving or removing references or helpers, update their links, package manifests, staging lists and
affected checks together. Verify that both installed packages contain their complete references
without depending on the repository's shared directory. Validate shared examples against the current
Core contracts for both Hosts, and Host-specific examples against their actual adapter interfaces.

## Product Feature Proposals

Before product implementation, use the product feature proposal template and assessment in
`CONTRIBUTING_zh-CN.md` or `CONTRIBUTING.md`. Cover the user problem, current approach, available
data, behavior rules, expected result, risks, acceptance checks, and non-goals. Answer the assessment
questions before implementing. A proposal must state a concrete user result and a repeatable
acceptance method while keeping Core responsible for Task state.

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
5. select documentation by the responsibilities above and synchronize affected maintained locales;
6. run checks proportional to the changed surface;
7. report exact changed paths, verification results, and remaining current-design risks.

Do not enlarge code scope first and ask documentation to approve it afterward.
