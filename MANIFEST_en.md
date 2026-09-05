# Dev Flow Documentation and Source Scope

[中文](MANIFEST.md) | [English](MANIFEST_en.md)

Human-readable documentation helps people evaluate, use, and understand Dev Flow. Runtime code does
not parse it as a process, schema, command, or release contract. When documentation and executable
behavior disagree, source code, machine-readable schemas, package manifests, CLI parsers, and
executable tests decide current behavior, and the documentation must be corrected.

## Documentation responsibilities

| Document | Primary question it answers |
| --- | --- |
| `README.md` | What Dev Flow is, its current core capabilities, shortest start, support, and safety boundaries |
| `docs/PRODUCT_en.md` | Target users, failure scenarios, current commitments, non-goals, and product decision principles |
| `docs/DEMO_en.md` | How one long-running task continues from the same Task after interruption |
| `docs/ROADMAP_en.md` | Future user outcomes and priorities; not a current capability inventory |
| `docs/PROJECT-STATUS_en.md` | Delivered capability, stable/source/unverified status, existing records, and product gaps |
| `docs/ARCHITECTURE_en.md` | Core, Adapter, Workflow, Store, Recovery, Git Observer, and protocol design |
| `docs/COMMANDS_en.md` | Complete lifecycle, Host, Core, selector, and MCP entrypoint reference |
| `docs/WEBUI_en.md` | Local visualization and diagnostics, security boundaries, and reset |
| `docs/SUPPORT-MATRIX_en.md` | Verified package, platform, and Host coverage |
| `CONTRIBUTING.md` | Rules for issues, product proposals, documentation, and code contributions |
| Host README | Installation, startup, recovery, status, removal, and Host-specific behavior |

README, PRODUCT, and Host README files do not repeat protocol fields, the complete MCP catalog, or
Store implementation. Precise details belong in Architecture, the Command Reference, and linked
advanced Host sections.

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
