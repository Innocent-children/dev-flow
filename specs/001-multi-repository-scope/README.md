# 001 — 多仓库任务范围与用户配置

**Status**: Blocked
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

Codex T034 Attempt 1 和最后一次 Attempt 2 均已消费并失败。Attempt 2 的 source-bound
build、install、setup 与 readback 已通过，真实 Codex 线程已启动，但 post-session
evidence validation 未能证明从附加仓库恢复同一 Task。T034 保持未完成，且禁止
第三次 Codex Journey；当前 Feature 状态为 `Blocked`。本 Feature 不授权版本修改、npm
发布、Tag、GitHub Release 或其他发布操作。

## Fixed boundaries

- 保留现有状态图、Transition、Recovery 分类和六个 MCP 工具；
- 保留 `ProcessTask.Repository` 作为主仓库和现有 `repository_binding_digest` 合同字段；
- 不增加 Workspace、Provider、registry、DSL、Orchestrator、父子 Task 或第二套状态机；
- SQLite 不兼容数据使用零写入 reject-and-reset，不迁移或自动清理；
- T034 Codex Journey 总预算最多两次：Attempt 1 和 Attempt 2 均已消费并失败，当前为 2/2；
- T035 DeepSeek Journey 和 T040 `pnpm run validate` 仍各最多一次，当前均为 0/1；
- Attempt 2 失败后禁止第三次 Codex Journey；
- Product Feature 与版本发布严格分离。
