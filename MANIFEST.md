# Dev Flow 文档与源码范围

[中文](MANIFEST.md) | [English](MANIFEST_en.md)

人类文档帮助读者判断、使用和理解 Dev Flow。它们不会被运行时代码解析为流程、Schema、命令或
发布合同。当文档与可执行行为不一致时，以源码、机器可读 Schema、package manifest、CLI parser
和可执行测试为准，并同步修正文档。

## 文档职责

| 文档 | 主要回答的问题 |
| --- | --- |
| `README_zh-CN.md` | Dev Flow 是什么、当前核心能力、如何最短开始，以及支持与安全边界 |
| `docs/PRODUCT.md` | 目标用户、主要失效场景、当前承诺、非目标和功能决策原则 |
| `docs/DEMO.md` | 一次长时任务中断后如何从同一个 Task 继续 |
| `docs/ROADMAP.md` | 未来希望改善的用户结果和优先级；不是当前能力清单 |
| `docs/PROJECT-STATUS.md` | 当前已交付能力、稳定/源码/未验证状态、现有记录和产品缺口 |
| `docs/ARCHITECTURE.md` | Core、Adapter、Workflow、Store、Recovery、Git Observer 和协议原理 |
| `docs/COMMANDS.md` | lifecycle、Host、Core、selector 和 MCP 工具的完整可执行入口 |
| `docs/WEBUI.md` | 本机可视化与诊断入口的使用、安全边界和 reset 流程 |
| `docs/SUPPORT-MATRIX.md` | 已验证 package、平台和 Host 范围 |
| `CONTRIBUTING.md` | Issue、产品提案、文档和代码贡献规则 |
| Host README | 对应 Host 的安装、启动、恢复、状态、移除和特有边界 |

README、PRODUCT 和 Host README 不重复协议字段、完整 MCP 目录或 Store 实现；需要精确细节时进入
Architecture、Command Reference 和 Host 对应的高级入口。

## 运行时与发布范围

| Responsibility | 最终实现位置或入口 |
| --- | --- |
| Core product version | `CORE_VERSION` |
| Codex product version 与 package 内容 | `packages/codex/package.json` |
| DeepSeek product version 与 package 内容 | `packages/deepseek/package.json` |
| 统一 lifecycle package 与 `dev-flow` bin | `packages/dev-flow/package.json`、`packages/dev-flow/` |
| Process nodes、transitions 与 guards | `internal/workflow/` |
| Task aggregate 与 validation | `internal/domain/` |
| SQLite bootstrap、codec、Action operation 与只读 preflight | `internal/store/` |
| Recovery 与 blocker reconciliation | `internal/recovery/`、`internal/application/` |
| 只读 Git observation 与 repository binding | `internal/repository/` |
| MCP tools、closed schemas 与 projections | `internal/mcp/` |
| Codex Host lifecycle 与 selector 行为 | `packages/codex/` |
| DeepSeek Host lifecycle 与 selector 行为 | `packages/deepseek/` |
| Protocol fixtures | `protocol/fixtures/` |
| 可执行合同与真实 Journey | `tests/contract/`、`tests/journeys/` |
| Release schemas、prepare 与 publisher | `release/`、`scripts/release-*.mjs` |
| 稳定产品支持声明 | `docs/SUPPORT-MATRIX.md` |
| 安全报告与信任边界 | `SECURITY.md`、`docs/THREAT-MODEL.md` |

历史设计与实施记录通过 Git 历史追溯。README、已完成的 Feature Markdown 和其他人类文档不会
决定运行时行为、package 内容、版本或发布结果。
