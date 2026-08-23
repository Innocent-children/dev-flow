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

Codex T034 Attempt 1 和 Attempt 2 均已消费并失败。Attempt 2 证明 source-bound
build、install、setup 与 readback 有效，同时暴露长 Prompt 末尾的恢复步骤可能被遗漏。
Attempt 3 通过了创建后立即恢复，但未证明双仓 mutation 后由新的附加仓 Host session 恢复。
runner 现拆成同一 Journey 内两个独立 Codex session：主仓 session 完成 mutation，附加仓
session 只恢复，并将返回身份与最后一次成功 apply 对比；定向 harness 为 47/47。最终
Attempt 4 已授权且尚未启动，Feature 状态为 `Ready`。本 Feature 不授权版本修改、npm
发布、Tag、GitHub Release 或其他发布操作。

## Fixed boundaries

- 保留现有状态图、Transition、Recovery 分类和六个 MCP 工具；
- 保留 `ProcessTask.Repository` 作为主仓库和现有 `repository_binding_digest` 合同字段；
- 不增加 Workspace、Provider、registry、DSL、Orchestrator、父子 Task 或第二套状态机；
- SQLite 不兼容数据使用零写入 reject-and-reset，不迁移或自动清理；
- T034 Codex Journey 总预算最多四次：Attempts 1～3 已消费，只有 Attempt 4 尚未启动；
- T035 DeepSeek Journey 和 T040 `pnpm run validate` 仍各最多一次，当前均为 0/1；
- Attempt 4 启动后禁止第五次 Codex Journey；
- Product Feature 与版本发布严格分离。
