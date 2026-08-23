# Research: 多仓库任务范围与用户配置

## 研究范围

研究基于当前 Go Core、SQLite Store、MCP catalog、Codex/DeepSeek Host adapter、合同测试和维护
文档。代码图仅用于定位，所有结论均回到当前源码核对。本 Feature 不引入外部依赖或发布工作。

### 当前实现基线

| 边界 | 源码事实 |
| --- | --- |
| Task authority | `internal/domain/task.go` 只有一个 `ProcessTask.Repository`，Action、records、Blocker 和 Outcome 均直接校验该 binding digest。 |
| Git observation | `internal/repository/observer.go` 定义单仓库 `Observe`；`git_observer.go` 只执行有界只读 Git 命令。 |
| Application | `internal/application/open_task.go` 观察一个路径并以一次 `TaskMutation` 创建 Task；`apply_action.go` 只重观察主 binding。 |
| Recovery | `internal/recovery/reconcile.go` 已有单 binding relation/effect；`classify.go` 已有包括 partial/conflicting 在内的五类结果。 |
| Persistence | `internal/store/sqlite.go` 已把 Task CAS、event、claim 放在同一事务；`migrations.go` 当前以 `task_id UNIQUE` 限制每 Task 一条 claim。 |
| MCP | `internal/mcp/schemas.go`, `tools.go`, `server.go`, `results.go` 固定六工具、closed input 和单 repository projection。 |
| Host | 两套 `packages/*/skills/dev-flow/SKILL.md` 当前拒绝多仓库；DeepSeek `authorization.mjs` 只有现成 guard，Codex launcher 只负责 Core 启动。 |
| Config/index | 当前产品没有用户配置 reader 或 codebase-memory runtime dependency。 |

## Decision 1: 在 ProcessTask 的主 Repository 旁增加有界附加集合

**Decision**: 保留 `ProcessTask.Repository` 作为主仓库 binding，新增默认主 key 和 0～7 个
`{key, binding}` 附加项。主项始终第一，附加项按 key 升序规范化并持久化。

**Rationale**: 当前 Task、Store 主 identity 镜像和大量流程不变量都以 `Repository` 为中心。旁路
增加小型集合能保持主仓库合同和单 Task 聚合，不需要重做现有架构。

**Alternatives considered**: 通用 Workspace 聚合、Repository Provider/registry、仓库子 Task、按
仓库复制 Action 或 revision。它们都会引入第二流程权威或为未批准的未来能力建立框架，因此拒绝。

## Decision 2: key 与固定观察顺序

**Decision**: 未提供主 key 时规范化为 `primary`。key 必须匹配
`^[a-z0-9][a-z0-9._-]{0,127}$`，在 Scope 内唯一；附加仓库输入最多 7 项。Application 先观察主仓库，
再按 key 升序逐个调用现有 `RepositoryObserver.Observe`。

**Rationale**: key 需要稳定、可读并且不能包含 `::`。固定默认值保留主 key 的可选输入，规范排序
让 snapshot、claim、摘要和错误定位不依赖调用者数组顺序。

**Alternatives considered**: 保留输入顺序、允许任意 Unicode key、从目录名生成 key、并行观察。
这些选择分别导致摘要不稳定、路径分隔歧义、隐式扩大用户声明或增加无必要并发复杂度。

## Decision 3: 复用唯一 repository_binding_digest

**Decision**: 单仓库有效摘要直接返回主 `Repository.BindingDigest`。多仓库有效摘要使用固定 domain
separator 和长度前缀 SHA-256，依次纳入仓库数量、主角色、主 key、主 component digest，再纳入
按 key 排序的每个附加角色、key 和 component digest；`ObservedAt` 不参与。结果继续写入现有
`repository_binding_digest`、Blocker expected/observed digest 和 Outcome final digest 字段。

**Rationale**: 单仓值保持字节级兼容；多仓摘要对 key、角色和任一 binding 变化敏感；长度前缀避免
拼接碰撞。聚合函数放在 domain，只组合已经验证的 component digest，不复制 Git binding 算法。

**Alternatives considered**: 新增 `repository_scope_digest`、把聚合值覆盖主 binding digest、把全部
binding JSON 直接 hash。前两者分别制造双摘要或破坏 component binding 自洽；后一种会把时间戳和
序列化细节误纳入流程身份。

## Decision 4: 多仓库路径使用 key namespace

**Decision**: 多仓库 Task 的 `artifacts[].path`、work item `expected_paths`、Implementation/Refactor
`changed_paths` 必须是 `<repository-key>::<repository-relative-path>`；以第一个 `::` 分隔并要求
key 属于 Task Scope，后半段复用现有相对路径校验。单仓库继续只接受普通仓库相对路径。

每个 `RepositoryBinding.ChangedPaths` 仍是该仓库内部的普通相对路径。Application 在 effect/Recovery
比较前把公共 scoped path 按 key 分派，比较后再以 key 生成有界报告。

**Rationale**: 路径归属显式且不需要新 payload schema；内部 Git 观察无需知道 Scope。

**Alternatives considered**: 绝对路径、隐式搜索唯一文件、嵌套 `{repository,path}` 替换所有既有
字段、单仓也强制前缀。它们会泄露/耦合本地目录、产生歧义、扩大合同修改或破坏单仓体验。

## Decision 5: Scope 创建、恢复和不可变性

**Decision**: 新建请求中 `repository_path` 是主仓库；`primary_repository_key` 与
`additional_repositories` 是可选创建输入。恢复请求以 `repository_path` 指向任一参与仓库并省略
Scope 声明；Core 通过该 identity 的 claim 返回原 Task。若携带 `new_task` 并命中活动 Task，则规范化
intent 和 Scope 必须与原 Task 完全相同，否则返回冲突。任何 mutation 的新旧 Scope membership、
角色和 key 必须一致。

**Rationale**: 现有 `LoadActiveTask(repository_identity)` 已是从任一 claim 恢复的正确入口；保持主
仓库不因恢复位置而改变，避免 Scope 漂移。

**Alternatives considered**: 增加独立 resume 工具、允许动态添加仓库、把恢复所在仓库提升为主仓库。
它们会增加工具或改变权威 Scope。

## Decision 6: 复用单仓库 Observer，按 Scope 汇总 Drift 与 Recovery

**Decision**: 不改变 `RepositoryObserver`。Application 对每个 entry 顺序观察并复用现有
`exact / worktree_only_changed / forbidden_change` 比较；overall relation 为：全部 exact 则 exact，
无 forbidden 且至少一个 worktree change 则 worktree-only，任一 forbidden 则 forbidden。

对保留的 mutation payload，按 scoped paths 计算每仓 effect：全部声明 effect 完成是
`completed_but_unrecorded`；全部未开始是 `not_started`；完成集合是非空严格子集且其余未开始是
`partially_completed`；任一 forbidden、未声明路径或不兼容 effect 是 `conflicting`。已提交的精确
LastOperation proof 仍优先得到 `completed_and_recorded`。继续复用现有分类、directive 和一个 Blocker。

**Rationale**: 当前 classifier 已表达所有需要的用户结果，缺少的只是从多 binding 产生正确 facts。

**Alternatives considered**: 新增仓库级 Recovery、每仓 Blocker、新分类、自动回滚 Git。全部超出
Feature 且会形成第二套状态机或违反 Git 只读边界。

## Decision 7: 全部 repository claim 进入同一 SQLite mutation

**Decision**: 保留 `tasks.repository_identity` 作为主仓库镜像。`repository_claims` 继续以
`repository_identity` 为主键，但移除 `task_id UNIQUE` 并为 task lookup 保留索引。Acquire 按固定顺序
插入完整 claim 集；Retain 校验 DB claim 集与 Task Scope 精确相等；Release 删除完整集合并核对行数。
Task CAS、event 和这些 claim 操作仍在当前一个事务中。

**Rationale**: 现有事务 rollback 已能保证任一冲突时 Task、event 和先前 claim 零残留，不需要补偿
逻辑或仓库级事务。

**Alternatives considered**: 每仓单独事务、补偿删除、claim group 表、仓库级 revision。它们增加
中间态或重复 Task 权威。

## Decision 8: SQLite 采用精确 reject-and-reset

**Decision**: 以新的内部 schema identity（计划为 `0.2.0`）描述多 claim 结构和新 snapshot。非空旧
数据库在 writable open 前通过 immutable read-only preflight 拒绝；不迁移、不尝试旧 decoder、不
自动删除/改名/覆盖。用户选择新的 `DEV_FLOW_DATA_DIR`，或在 Core 外手工归档旧目录。

**Rationale**: 当前 Store 已采用 exact schema 和单一 closed codec，延续这一模式最小且符合已批准
的旧数据处置。

**Alternatives considered**: 原地 migration、版本化 snapshot union、双 schema runtime、自动 reset。
这些方案均被明确排除。

## Decision 9: 只扩展 open_task 和 server_info 结果

**Decision**: 六工具名称、顺序、annotation 和 envelope 保持不变。`dev_flow_open_task` 保留必需
`host`、`repository_path`，新增可选 `primary_repository_key` 和最多 7 项的 closed
`additional_repositories[{key,repository_path}]`。Task 结果保留主 `repository`，增加主 key 和按 key
排序的附加 repository projection；projection 包含 Host 后续执行所需的 canonical root。

`dev_flow_server_info({})` 新增固定 `host_preferences`，分别返回 Codex/DeepSeek 的有效
`codebase_memory` 布尔值。错误 envelope 形状不变；涉及仓库的安全错误消息只包含已验证 key 和有界
原因，不返回绝对路径或底层命令输出。

**Rationale**: Host 能用首个 handshake 获得配置和六工具能力；现有唯一 digest 与 envelope 无需
平行合同。

**Alternatives considered**: 新配置工具、新 Scope 工具、新摘要字段、在 Task 中保存偏好、为错误
新增通用 details framework。它们均不必要。

## Decision 10: 配置在存储打开前加载一次

**Decision**: 新增窄化 `internal/userconfig`，只用 Go 标准库读取固定
`$HOME/.dev-flow/config.json`。文件和目录不存在时得到 false/false；存在时最大 16 KiB，UTF-8 closed
JSON，拒绝重复字段、未知字段、trailing JSON、null/non-object Host 配置和非布尔值。配置是单次 MCP
进程的不可变快照，在 `store.Open` 前加载；错误输出定位配置文件或字段并停止启动。

**Rationale**: 在 storage 之前失败能保证非法配置不创建数据库、不修改 Task/claim；一次快照避免
Action 中途偏好变化影响行为。

**Alternatives considered**: 环境变量覆盖、项目配置、配置 CLI/写 API、热重载、第三方配置库。
这些都超出固定只读个人配置需求。

## Decision 11: Host 权限分别在现有 admission 边界执行

**Decision**: Codex 使用当前 Git root 作为主仓库，仅接受当前会话已经授权的 additional writable
roots；不修改 sandbox，真实两仓 Journey 使用用户授权的 `--add-dir`。DeepSeek 在现有 guard 中以
启动时 `process.cwd()` 的 canonical Workspace Root 校验主/附加路径，允许 Root 本身不是 Git 仓库，
拒绝 root 外路径和 symlink escape。Core 合同、Scope 和摘要对两个 Host 完全相同。

**Rationale**: Core 没有也不应复制 Host sandbox/Workspace 权限；现有 Skill/guard 是创建前阻止
越权调用的正确位置。

**Alternatives considered**: 把 Host writable roots 写进 Task、让 Core 修改 sandbox、给 MCP 增加
permission 字段、增加 Host-specific Core 分支。全部违反权限分工或共享合同。

## Decision 12: codebase-memory 仅是可选代码发现方式

**Decision**: Host 只读取自己的有效偏好。false 时不调用 codebase-memory；true 时仅在能力已经
可见且可用时优先调用，缺失或中途不可用时本会话最多提示一次并回退到 Host 自带文件读取和文本
检索。Dev Flow 不增加 Go/npm 依赖或任何安装/生命周期逻辑。

**Rationale**: 当前产品没有 codebase-memory 集成；能力缺失不应改变 Task 或阻塞验收。

**Alternatives considered**: Indexer Provider、自动安装、把索引状态写进 snapshot/digest、把索引
作为多仓权限证明。全部被治理和 Feature 非目标排除。

## Decision 13: 文档与测试按验收边界同步

**Decision**: 同步 9 个根 README、产品/架构/命令/路线图双语文档和两个 Host 的中英配对文档；
Support Matrix 保持已发布证据不变。测试只覆盖一个两仓库代表路径及直接失败边界，每个真实 Host
Journey 最多一次，最终 `pnpm run validate` 最多一次。

**Rationale**: 用户可见合同必须多 locale 同步，而版本支持证据不能在未发布 Feature 中提前改写。

**Alternatives considered**: 只更新中文、修改 Support Matrix 版本行、扩大到平台/仓库数量/节点
矩阵或真实索引安装测试。全部不符合文档和测试预算。
