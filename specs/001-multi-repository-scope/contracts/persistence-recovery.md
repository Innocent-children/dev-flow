# Persistence, Claim, Drift and Recovery Contract

## SQLite schema boundary

本 Feature 使用一个新的精确内部 SQLite schema identity，计划值为 `0.2.0`。它不是 Core、Codex、
DeepSeek 或 npm 的公开版本。

### 保留

- `tasks` 一行保存一个 Task 和一个 closed JSON snapshot；
- `tasks.repository_identity` 镜像主仓库 identity；
- `task_events` 继续按 Task revision 保存单一流程事件；
- `repository_claims.repository_identity` 继续是主键。

### 改变

- 删除 `repository_claims.task_id` 的唯一约束；
- 为按 Task 校验/释放 claim 提供普通 `task_id` 索引；
- snapshot 包含主 key 和按 key 排序的 additional bindings；
- 不增加 repository-level Task/event/revision 表。

## Transaction contract

所有 Scope claim 操作仍是 `CommitTask` 事务的一部分：

### Acquire

1. 插入 Task snapshot；
2. 插入 Task event；
3. 按主仓库、sorted additions 顺序插入 1～8 条 claims；
4. 任一 identity 已有 claim 时返回 `ACTIVE_TASK_CONFLICT`；
5. transaction rollback 确保 Task、event 和此前插入的 claims 均为零残留。

### Retain

在更新 snapshot/event 的同一事务中，读取该 `task_id` 的全部 claims，并要求 identity 集、数量、host
与 Task Scope 精确相等。缺失、额外或不一致均 `STORAGE_UNAVAILABLE` safe-stop，不自动补齐。

### Release

在 Done/Cancelled mutation 中删除该 Task 的完整预期 claim 集，并要求受影响行数等于 Scope 大小；
之后提交 terminal snapshot/event。不存在部分 release 或补偿流程。

### CAS

revision CAS 仍只针对 Task row。所有仓库共享该 revision 和 event；不增加仓库级 CAS。

## Startup preflight

对非空数据库，在 writable connection 前使用现有 immutable read-only preflight：

- schema/table/index/column/constraint identity 必须精确匹配；
- snapshot 必须由当前唯一 closed decoder 解码并通过完整 Task/Scope 校验；
- row 的 `repository_identity` 必须等于 snapshot 主 identity；
- 每个活动 Task 的 claim 集必须精确等于其 Scope identities；
- 每个 terminal Task 必须没有 claim；
- 所有 claim 必须指向存在、活动且 host 一致的 Task；
- 总 claim 数等于所有活动 Scope cardinality 之和。

任一失败都在零写入状态返回 `SCHEMA_UNSUPPORTED` 或 `STORAGE_UNAVAILABLE`。

## Reject-and-reset

旧 `0.1.0` 数据库和任何不兼容/未知 schema：

- 不进入 writable bootstrap；
- 不执行 `ALTER`、copy、decode fallback 或 migration；
- 不删除、truncate、rename、archive 或覆盖文件；
- 不保留旧 codec 或双 runtime；
- 向用户说明选择新的 `DEV_FLOW_DATA_DIR`，或在 Core 外手工归档旧目录。

“reset”只描述用户控制的新数据目录边界，不授权 Core 自动清理。

## Drift aggregation

Application 逐 entry 复用当前 `CompareRepositoryBindings`。每个 entry 产生：

- `exact`：identity、branch/HEAD 和 worktree/binding 均一致；
- `worktree_only_changed`：identity、branch/HEAD 一致，仅 worktree/binding 改变；
- `forbidden_change`：identity、canonical membership、branch、HEAD、unborn/detached 等不兼容。

整体 relation：

```text
all exact                              -> exact
no forbidden and at least one changed -> worktree_only_changed
any forbidden                         -> forbidden_change
```

普通 apply 只有当 payload 的 scoped paths 分派后，每个 entry 的 observed changed paths 都精确等于
authoritative paths 加本次声明 paths 时才能提交。任一未声明路径或 forbidden change 整体返回
`REPOSITORY_DRIFT`，message/assessment 指出 repository key，且 revision/Task/claim 零写入。

## Uncertain mutation recovery

Recovery 仍使用现有 operation identity、payload digest、LastOperation proof、一个 Scope digest 和现有
分类器。对 Implementation/Refactor 的 retained scoped paths：

| Scope facts | Classification |
| --- | --- |
| 精确 LastOperation proof 已记录 | `completed_and_recorded` |
| 所有声明仓库 effect 已精确出现，未涉及仓库 exact | `completed_but_unrecorded` |
| 所有声明 effect 尚未出现，全部仓库 exact | `not_started` |
| 已完成仓库是声明仓库的非空严格子集，其余 exact | `partially_completed` |
| 任一 forbidden、额外路径、错误 key 或 effect 不兼容 | `conflicting` |

`partially_completed` 和需要阻止推进的 `conflicting` 继续使用现有单一 Blocker directive。Blocker 的
expected/observed digest 是完整 Scope aggregate。解决 Blocker 要求所有仓库恢复到 issuance Scope
binding；不能按仓库分别解除。

## Claim/Recovery failure visibility

公开信息只使用已验证 repository key 和闭合 reason；不输出 canonical root、底层 SQLite 语句或 Git
stderr 作为错误详情。Task 正常 projection 中的 canonical root 是 Host 执行合同的一部分，不应被
复制到通用错误文本。
