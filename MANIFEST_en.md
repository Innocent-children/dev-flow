# Dev Flow Source Authority

[中文](MANIFEST.md) | [English](MANIFEST_en.md)

Current Dev Flow behavior is defined by source code, machine-readable schemas, artifact manifests,
and executable tests. Historical design and implementation records remain available through Git
history rather than as completed Feature contract copies in the current source tree.

| Responsibility | Authority |
| --- | --- |
| Core product version | `CORE_VERSION` |
| Codex product version | `packages/codex/package.json` |
| DeepSeek product version | `packages/deepseek/package.json` |
| Process nodes, transitions, and guards | `internal/workflow/` |
| Task aggregates and validation | `internal/domain/` |
| SQLite bootstrap, codec, and read-only preflight | `internal/store/` |
| Recovery and blocker reconciliation | `internal/recovery/`, `internal/application/` |
| MCP tools, schemas, and projections | `internal/mcp/` |
| Codex product resources | `packages/codex/` |
| DeepSeek product resources | `packages/deepseek/` |
| Protocol fixtures | `protocol/fixtures/` |
| Release schemas and implementation | `release/`, `scripts/release-codex.mjs`, `scripts/release-deepseek.mjs` |
| Product support claims | `docs/SUPPORT-MATRIX.md` |

Human-readable documents explain usage and decisions. Production code, build scripts, release
scripts, and tests do not parse repository documentation or completed Feature Markdown as behavioral
authority. Packaged Skill files are executable product resources validated as package inputs, rather
than repository design documentation.
