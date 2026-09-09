# Dev Flow Documentation and Source Scope

[中文](MANIFEST.md) | [English](MANIFEST_en.md)

Human-readable documentation helps people evaluate, use, and understand Dev Flow. Runtime code does
not parse it as a process, schema, command, or release contract. When documentation and executable
behavior disagree, source code, machine-readable schemas, package manifests, CLI parsers, and
executable tests decide current behavior, and the documentation must be corrected.

## Documentation responsibilities

| Document | Primary question it answers |
| --- | --- |
| Root `README*.md` | Project introduction and user manual: purpose, suitable tasks, installation, starting, resuming, common operations, and necessary limits |
| `AGENTS.md` | Instructions, responsibility boundaries, change constraints, validation, and documentation-update rules for AI agents working in this repository |
| `docs/PRODUCT_en.md` | Target users, problems, user-visible behavior rules, product scope, and non-goals |
| `docs/DEMO_en.md` | How one long-running task continues from the same Task after interruption |
| `docs/ROADMAP_en.md` | Future user outcomes and priorities; not a current capability inventory |
| `docs/PROJECT-STATUS_en.md` | Delivered capability, stable/source/unverified status, existing records, and product gaps |
| `docs/ARCHITECTURE_en.md` | Core, Adapter, Workflow, Store, Recovery, Git Observer, and protocol design |
| `docs/COMMANDS_en.md` | Complete lifecycle, Host, Core, selector, and MCP entrypoint reference |
| `docs/WEBUI_en.md` | Local visualization, diagnostics, supported page operations and security boundaries |
| `docs/SUPPORT-MATRIX_en.md` | Verified package, platform, and Host coverage |
| `CONTRIBUTING.md` | Human contributor guidance for issues, product proposals, development setup, validation, and pull requests |
| `MANIFEST_en.md`, `docs/I18N_en.md` | Documentation and source navigation; maintained languages, document pairs, and translation consistency |
| `docs/DESKTOP-PETS_en.md` | Desktop installation, controls, artwork formats and repeatable check methods |
| `docs/WINDOWS-ADAPTATION_en.md` | Recorded checks, actual results and unverified scope for specific artifacts and environments |
| `docs/TOOLCHAIN-BASELINES_en.md` | Current development/build toolchain ranges, responsibilities and revalidation requirements |
| Package READMEs and Host guides | Package or Host installation, operations, recovery, troubleshooting, maintenance, removal, and specific limitations |
| `docs/ARTIFACTS*`, `docs/WORKTREE-SOURCES*`, `docs/THREAT-MODEL*` | Detailed design of process files, worktree sources, and trust boundaries |
| `internal/README*`, `scripts/README*`, `tests/**/README.md`, `protocol/fixtures/README.md` | Directory structure, development commands, test procedures, and fixture usage |
| `release/**/README.md`, `docs/RELEASE-STRATEGY.md`, `docs/VERSIONING.md` | Maintainer procedures for versions, artifact checks, and publication |
| `skills/dev-flow/core/` and Host Skill directories | Core interaction instructions and Host operations used by agents running the installed product |
| `SECURITY.md` | Vulnerability reporting and the security reporting policy |

Root READMEs follow user operations and link to dedicated references for technical detail.
Directory-local maintainer READMEs describe their directory's technical purpose. [AGENTS.md](AGENTS.md)
governs AI maintenance of this repository; Skills govern agent use of the installed product.

## Runtime and release scope

| Responsibility | Final implementation location or entry point |
| --- | --- |
| Core product version | `CORE_VERSION` |
| Codex product version and package contents | `packages/codex/package.json` |
| DeepSeek product version and package contents | `packages/deepseek/package.json` |
| Unified lifecycle package and `dev-flow` bin | `packages/dev-flow/package.json`, `packages/dev-flow/` |
| Process nodes, transitions, and guards | `internal/workflow/` |
| Task aggregate, WorkspaceOrigin/Binding, and validation | `internal/domain/` |
| SQLite bootstrap, codec, Action operations, and read-only preflight | `internal/store/` |
| Recovery, workspace blockers, relocation, and abandon | `internal/recovery/`, `internal/application/` |
| Read-only Git identity/history/content/task-surface observation | `internal/repository/` |
| MCP tools, allowed input fields, and response data | `internal/mcp/` |
| Codex request assessment, worktree creation, session restart/handoff, and activation | `packages/codex/` |
| DeepSeek request assessment, WorkspaceCoordinator, run records/restart, and activation | `packages/deepseek/` |
| Protocol fixtures | `protocol/fixtures/` |
| Interface contract tests and end-to-end tests in actual Hosts | `tests/contract/`, `tests/journeys/` |
| Release schemas, prepare, and publisher | `release/`, `scripts/release-*.mjs` |
| Stable product support claims | `docs/SUPPORT-MATRIX_en.md` |
| Security reporting and trust boundaries | `SECURITY.md`, `docs/THREAT-MODEL_en.md` |

Historical design and implementation records remain in Git history. README files, completed Feature
Markdown, and other human-readable documents do not decide runtime behavior, package contents,
versions, or release results.

See [AGENTS.md](AGENTS.md) for documentation-update scope and AI maintenance instructions, and the
[I18n policy](docs/I18N_en.md) for maintained languages and translation pairs. Current documentation
explains current behavior; Git retains historical design, and verification records describe their
specific artifacts, environments, results, and limits.
