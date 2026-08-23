# 001 — 多仓库任务范围与用户配置

**Status**: Ready
**Created**: 2026-08-23

本 Feature 为一个 Dev Flow Task 增加显式、有界且创建后不可变的 Repository Scope：一个主仓库和
最多七个附加仓库。全部仓库继续共享一个 Core current node、Action、revision、Recovery、Blocker
和 Outcome；Core 只读观察 Git，Codex 与 DeepSeek 分别在用户授权的目录边界内执行修改。

同时定义固定 `$HOME/.dev-flow/config.json` 中两个 Host 的可选 `codebase_memory` 偏好。该能力缺失
时 Host 回退内置文件和文本检索；配置和索引状态不进入 Core Task 或流程摘要。

## Feature artifacts

- [Specification](spec.md)
- [Requirements checklist](checklists/requirements.md)
- [Implementation plan](plan.md)
- [Research decisions](research.md)
- [Data model](data-model.md)
- [Repository Scope contract](contracts/repository-scope.md)
- [MCP contract changes](contracts/mcp-tools.md)
- [Persistence and Recovery contract](contracts/persistence-recovery.md)
- [Host permission and configuration contract](contracts/host-configuration.md)
- [Validation quickstart](quickstart.md)
- [Implementation tasks](tasks.md)

`spec.md`、`plan.md`、contracts 和 `tasks.md` 已生成，`$speckit-analyze` 门禁已通过。当前
Feature 状态为 `Ready`，实施必须遵循 `tasks.md` 的阶段、任务和 checkpoint。本 Feature
不授权版本修改、npm 发布、Tag、GitHub Release 或其他发布操作。

## Fixed boundaries

- 保留现有状态图、Transition、Recovery 分类和六个 MCP 工具；
- 保留 `ProcessTask.Repository` 作为主仓库和现有 `repository_binding_digest` 合同字段；
- 不增加 Workspace、Provider、registry、DSL、Orchestrator、父子 Task 或第二套状态机；
- SQLite 不兼容数据使用零写入 reject-and-reset，不迁移或自动清理；
- 每个真实 Host 两仓库 Journey 最多一次，最终 `pnpm run validate` 最多一次；
- Product Feature 与版本发布严格分离。
