# 001 — 多仓库任务范围与用户配置

**Status**: Complete
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
→ 下一次 source-bound 验证”的顺序继续到首次通过。Attempt 7 已基于修复提交通过：两个独立 Codex
session 在双仓 mutation 后恢复同一个 Core Task，revision、Action ID、binding digest 与 Scope 保持
一致。T034 已完成。T035 基于 source commit
`14b8669bc331b88a6ccef3888d8c553a54c2bcc5` 启动了唯一一次 DeepSeek Journey，DSH 退出 0，
但 evidence validation 发现会话先执行 `bash` 而不是 runner 假定的首个 server-info 调用；闭合失败
evidence 只证明 Task 停在 `REQUIREMENTS`、revision 1，未证明双仓修改、附加仓恢复或终态。T035
原始预算 1/1 已消费且任务未完成。用户随后授权按 Codex 相同的 evidence-driven repair loop 继续：
Attempt 2 的前四段成功证明双仓修改、附加仓恢复、唯一验证命令和理解确认；最后一段在 Task 已到
`DELIVERY`、revision 7 后超时。runner 现进一步将理解确认与交付拆成两个单节点 checkpoint，并在
超时清理前也保存当前 raw transcript。Attempt 3 的 REQUIREMENTS apply 将
`unresolved_questions` 错放进闭合 `baseline` 对象，Core 返回 `INVALID_ARGUMENT`。同步 Host
reference 现明确该字段必须与 `baseline` 同级，创建 Task 与完成 REQUIREMENTS 也拆成独立
checkpoint。Attempt 4 的前五段均通过，最后 DELIVERY apply 因 `reason_required=false` 却携带非空
`reason` 被 Core 拒绝。同步 Host reference 与 runner 现将 `reason` 直接绑定当前 transition 合同。
Attempt 5 基于 source commit `b884e8d8eacaf055bfc5d938612258feb5c7cb4d` 首次通过：六个 DeepSeek
session 使用一个 Core Task，完成双仓修改、附加仓恢复、唯一验证命令、理解确认和 DONE。T035 已
完成。T036～T039 已同步全部维护文档族；T040 唯一一次 `pnpm run validate` 已通过，Feature 状态为
`Complete`。
本 Feature 不授权版本修改、npm
发布、Tag、GitHub Release 或其他发布操作。

## Fixed boundaries

- 保留现有状态图、Transition、Recovery 分类和六个 MCP 工具；
- 保留 `ProcessTask.Repository` 作为主仓库和现有 `repository_binding_digest` 合同字段；
- 不增加 Workspace、Provider、registry、DSL、Orchestrator、父子 Task 或第二套状态机；
- SQLite 不兼容数据使用零写入 reject-and-reset，不迁移或自动清理；
- T034 Attempts 1～6 保留为不可覆盖的历史证据，Attempt 7 为首次满足最终双 session 合同的通过结果；
- T035 Attempts 1～4 失败 evidence 必须保留，Attempt 5 是首次完整通过结果；不再运行 DeepSeek repair Journey；
- T040 `pnpm run validate` 已通过，预算 1/1 consumed，不得再次执行；
- T034 repair loop 不授权 T035、T040 或任何无关真实测试；
- Product Feature 与版本发布严格分离。
