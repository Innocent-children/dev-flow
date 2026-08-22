# Dev Flow Source Authority

[中文](MANIFEST.md) | [English](MANIFEST_en.md)

Dev Flow 的当前行为权威是源码、机器可读 Schema、制品清单和可执行测试。历史设计与实施记录
通过 Git 历史追溯，不在当前源码树维护完成后的 Feature 合同副本。

| Responsibility | Authority |
| --- | --- |
| Core product version | `CORE_VERSION` |
| Codex product version | `packages/codex/package.json` |
| DeepSeek product version | `packages/deepseek/package.json` |
| Process nodes, transitions and guards | `internal/workflow/` |
| Task aggregates and validation | `internal/domain/` |
| SQLite bootstrap, codec and read-only preflight | `internal/store/` |
| Recovery and blocker reconciliation | `internal/recovery/`, `internal/application/` |
| MCP tools, schemas and projections | `internal/mcp/` |
| Codex product resources | `packages/codex/` |
| DeepSeek product resources | `packages/deepseek/` |
| Protocol fixtures | `protocol/fixtures/` |
| Release schemas and implementation | `release/`, `scripts/release-codex.mjs`, `scripts/release-deepseek.mjs` |
| Product support claims | `docs/SUPPORT-MATRIX.md` |

Human-readable documents may explain usage or decisions. Production code, build scripts, release
scripts and tests must not parse repository documentation or completed Feature Markdown as behavioral
authority. Packaged Skill files are executable product resources and are validated as package inputs,
not treated as repository design documentation.
