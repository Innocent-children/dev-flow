# Dev Flow 文档与源码范围

[中文](MANIFEST.md) | [English](MANIFEST_en.md)

人类文档帮助读者判断、使用和理解 Dev Flow。它们不会被运行时代码解析为流程、Schema、命令或
发布约定。当文档与可执行行为不一致时，以源码、机器可读 Schema、package manifest、CLI parser
和可执行测试为准，并同步修正文档。

## 文档职责

| 文档 | 主要回答的问题 |
| --- | --- |
| 根 `README*.md` | 项目介绍和用户说明书：用途、适用场景、安装、启动、恢复、常用操作及必要限制 |
| `AGENTS.md` | AI 在本仓库工作的指令、职责边界、修改约束、验证和文档更新规则 |
| `docs/PRODUCT.md` | 目标用户、主要问题、用户可见的行为规则、产品范围和非目标 |
| `docs/DEMO.md` | 一次长时任务中断后如何从同一个 Task 继续 |
| `docs/ROADMAP.md` | 未来希望改善的用户结果和优先级；不是当前能力清单 |
| `docs/PROJECT-STATUS.md` | 当前已交付能力、稳定/源码/未验证状态、现有记录和产品缺口 |
| `docs/ARCHITECTURE.md` | Core、Adapter、Workflow、Store、Recovery、Git Observer 和协议原理 |
| `docs/COMMANDS.md` | lifecycle、Host、Core、selector 和 MCP 工具的完整可执行入口 |
| `docs/WEBUI.md` | 本机可视化与诊断入口的使用、支持的页面操作和安全边界 |
| `docs/SUPPORT-MATRIX.md` | 已验证 package、平台和 Host 范围 |
| `CONTRIBUTING_zh-CN.md` | 人类贡献者的 Issue、产品提案、开发环境、验证和 Pull Request 指南 |
| `MANIFEST.md`、`docs/I18N.md` | 文档与源码阅读入口；维护语言、文档配对与翻译一致性 |
| `docs/DESKTOP-PETS.md` | 桌面入口的安装、操作、形象格式与可重复的检查方法 |
| `docs/WINDOWS-ADAPTATION.md` | 特定产物与环境的已记录检查、实际结果及未验证范围 |
| `docs/TOOLCHAIN-BASELINES.md` | 当前开发与构建工具链的兼容范围、职责及重新验证要求 |
| package README 与 Host 使用指南 | 对应包或 Host 的安装、操作、恢复、排错、维护、移除和特有限制 |
| `docs/ARTIFACTS*`、`docs/WORKTREE-SOURCES*`、`docs/THREAT-MODEL*` | 流程文件、工作树来源和信任边界的详细设计 |
| `internal/README*`、`scripts/README*`、`tests/**/README.md`、`protocol/fixtures/README.md` | 所在目录的结构、开发命令、测试方法和样例用法 |
| `release/**/README.md`、`docs/RELEASE-STRATEGY.md`、`docs/VERSIONING.md` | 维护者使用的版本、产物检查和发布流程 |
| `skills/dev-flow/core/` 与各 Host Skill 目录 | 安装后由 Agent 使用的 Core 交互说明和 Host 操作规则 |
| `SECURITY.md` | 漏洞报告方式与安全报告政策 |

根 README 按用户操作组织内容，技术细节通过专门文档查阅；目录内面向维护者的 README 说明该目录的
技术用途。仓库 AI 的维护规则由 [AGENTS.md](AGENTS.md) 管理，安装后使用产品的 Agent 指令由 Skill
维护，两者的职责不同。

## 运行时与发布范围

| Responsibility | 最终实现位置或入口 |
| --- | --- |
| Core product version | `CORE_VERSION` |
| Codex product version 与 package 内容 | `packages/codex/package.json` |
| DeepSeek product version 与 package 内容 | `packages/deepseek/package.json` |
| 统一 lifecycle package 与 `dev-flow` bin | `packages/dev-flow/package.json`、`packages/dev-flow/` |
| Process nodes、transitions 与 guards | `internal/workflow/` |
| Task aggregate、WorkspaceOrigin/Binding 与 validation | `internal/domain/` |
| SQLite bootstrap、codec、Action operation 与只读 preflight | `internal/store/` |
| Recovery、workspace blocker、relocation 与 abandon | `internal/recovery/`、`internal/application/` |
| 只读 Git identity/history/content/task-surface observation | `internal/repository/` |
| MCP 工具、允许的输入字段和返回数据 | `internal/mcp/` |
| Codex 新请求评估、工作树创建、会话重启/交接和触发指令 | `packages/codex/` |
| DeepSeek 新请求评估、WorkspaceCoordinator、运行记录/会话重启和触发指令 | `packages/deepseek/` |
| Protocol fixtures | `protocol/fixtures/` |
| 接口规范测试和实际宿主中的完整流程测试 | `tests/contract/`、`tests/journeys/` |
| Release schemas、prepare 与 publisher | `release/`、`scripts/release-*.mjs` |
| 稳定产品支持声明 | `docs/SUPPORT-MATRIX.md` |
| 安全报告与信任边界 | `SECURITY.md`、`docs/THREAT-MODEL.md` |

历史设计与实施记录通过 Git 历史追溯。README、已完成的 Feature Markdown 和其他人类文档不会
决定运行时行为、package 内容、版本或发布结果。

文档更新范围与 AI 维护要求见 [AGENTS.md](AGENTS.md)，翻译配对与维护语言见 [I18n 策略](docs/I18N.md)。
当前文档说明现有行为；历史设计通过 Git 查询，验证记录说明对应产物、环境、结果和限制。
