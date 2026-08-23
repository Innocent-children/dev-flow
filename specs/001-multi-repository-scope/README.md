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
session 只恢复，并将返回身份与最后一次成功 apply 对比。Attempt 4 验证该结构时暴露 substantive
Prompt 未复用 apply request-binding 规则；Attempt 5 确认 binding 已修复，但后续 apply 仍返回
`INVALID_ARGUMENT`，旧 failure evidence 未保留失败调用详情。multi-repository 现进一步复用
既有完整 apply payload 规则，并为两个真实 Codex session 分别保留本地 raw JSONL；闭合 evidence
仍保持可提交的最小字段。Attempt 6 的 raw transcript 进一步确认失败不是 transition 缺失，而是
正常 `implementation_ready_for_test` 分支错误携带了非空 `findings`。共享 apply 规则现将
`problem_class`/`findings` 明确定义为分支选择语义，并将 TEST 验证留给后续 session。用户已授权读取和本地存储 raw transcript，并授权按“失败证据 → 精确修复
→ 下一次 source-bound 验证”的顺序继续到首次通过。T034 保持未完成，Feature 状态为 `Ready`。
本 Feature 不授权版本修改、npm
发布、Tag、GitHub Release 或其他发布操作。

## Fixed boundaries

- 保留现有状态图、Transition、Recovery 分类和六个 MCP 工具；
- 保留 `ProcessTask.Repository` 作为主仓库和现有 `repository_binding_digest` 合同字段；
- 不增加 Workspace、Provider、registry、DSL、Orchestrator、父子 Task 或第二套状态机；
- SQLite 不兼容数据使用零写入 reject-and-reset，不迁移或自动清理；
- T034 Attempts 1～5 保留为不可覆盖的历史证据；后续只允许由上一份 raw failure 直接支持的修复验证，首次通过后立即停止；
- T035 DeepSeek Journey 和 T040 `pnpm run validate` 仍各最多一次，当前均为 0/1；
- T034 repair loop 不授权 T035、T040 或任何无关真实测试；
- Product Feature 与版本发布严格分离。
