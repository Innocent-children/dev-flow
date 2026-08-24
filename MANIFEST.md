# Dev Flow Source Authority

[中文](MANIFEST.md) | [English](MANIFEST_en.md)

Dev Flow 的当前行为权威是源码、机器可读 Schema、制品清单和可执行测试。面向人的页面用于理解和
评估这些事实，不会被运行时代码解析为合同。

| Responsibility | Authority 或入口 |
| --- | --- |
| 人类可读的项目概览与证据导览 | `README.md`、`docs/DEMO.md`、`docs/PROJECT-STATUS.md` |
| Core product version | `CORE_VERSION` |
| Codex product version | `packages/codex/package.json` |
| DeepSeek product version | `packages/deepseek/package.json` |
| Process nodes、transitions 与 guards | `internal/workflow/` |
| Task aggregates 与 validation | `internal/domain/` |
| SQLite bootstrap、codec 与只读 preflight | `internal/store/` |
| Recovery 与 blocker reconciliation | `internal/recovery/`、`internal/application/` |
| MCP tools、schemas 与 projections | `internal/mcp/` |
| Codex product resources | `packages/codex/` |
| DeepSeek product resources | `packages/deepseek/` |
| Protocol fixtures | `protocol/fixtures/` |
| Release schemas 与 implementation | `release/`、`scripts/release-codex.mjs`、`scripts/release-deepseek.mjs` |
| 稳定产品支持声明 | `docs/SUPPORT-MATRIX.md` |
| 安全报告与信任边界 | `SECURITY.md`、`docs/THREAT-MODEL.md` |

历史设计与实施记录通过 Git 历史追溯。生产代码、构建脚本、发布脚本和测试不会解析 README 或
已完成 Feature Markdown 来决定运行时行为。
