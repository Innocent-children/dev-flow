# Data Model: 多仓库任务范围与用户配置

## 1. Repository Scope

Repository Scope 是 `ProcessTask` 内不可变的仓库成员集合，不是新的流程聚合或 Workspace。

### ProcessTask 仓库字段

| 字段 | 类型 | 规则 |
| --- | --- | --- |
| `PrimaryRepositoryKey` | `RepositoryKey` | 默认 `primary`；创建后不可变。 |
| `Repository` | `RepositoryBinding` | 保留现有字段，始终是主仓库。 |
| `AdditionalRepositories` | `[]RepositoryScopeEntry` | 0～7 项，按 key 升序持久化；创建后成员、角色、key 均不可变。 |

Task 的节点、Action、revision、Intent/verification budget、Recovery、Blocker、LastOperation、Outcome
和 event stream 均保持单一。Repository Scope 没有独立 revision、cursor 或状态。

### RepositoryKey

规范形式匹配 `^[a-z0-9][a-z0-9._-]{0,127}$`。key：

- 在完整 Scope 中唯一；
- 区分大小写的选择被关闭，因为只接受小写 ASCII；
- 不能包含 `::`、斜杠、反斜杠或空白；
- 不从目录名、Git remote 或索引结果推断；
- 创建后不得重命名。

### RepositoryScopeEntry

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `Key` | `RepositoryKey` | 附加仓库的稳定路径 namespace 和错误定位标识。 |
| `Binding` | `RepositoryBinding` | 复用现有单仓库 canonical root、identity、branch、HEAD、fingerprint、changed paths 和 component digest。 |

主/附加角色由所在字段确定，不增加开放 role enum。用户输入路径只用于观察；持久化的是 observer
返回的 canonical root 和 binding。

### Scope 不变量

1. 总 entry 数为 1～8。
2. 主 key 和所有附加 key 唯一；additional 按 key 严格递增。
3. 所有 `RepositoryIdentity` 唯一；指向同一仓库的不同路径在观察后仍被拒绝。
4. 每个 component `RepositoryBinding` 继续通过现有自洽校验。
5. Scope membership 由角色、key、canonical root/repository identity 定义，不能被后续 worktree
   状态更新改变。
6. Store mutation 的旧/新 snapshot 必须具有相同 membership；只有各 entry 的可变观察字段可以按
   现有 Action 规则重新 binding。

## 2. 有效 Repository Binding Digest

Repository Scope 不持久化第二个摘要字段。`EffectiveRepositoryBindingDigest(task)` 是纯计算：

- `len(AdditionalRepositories) == 0`：返回 `task.Repository.BindingDigest`；
- 多仓库：返回以下长度前缀字段序列的 SHA-256：

```text
domain = dev-flow/repository-scope-binding/v1
entry_count
primary, PrimaryRepositoryKey, Repository.BindingDigest
additional, AdditionalRepositories[0].Key, AdditionalRepositories[0].Binding.BindingDigest
...
```

附加项已经按 key 排序。`ObservedAt`、输入数组顺序、用户输入路径字符串和 Host 配置不进入摘要。

下列现有字段在多仓库 Task 中保存该有效摘要，字段名不变：

- `ProcessAction.RepositoryBindingDigest`；
- `OperationReference.RepositoryBindingDigest`；
- Implementation、Test、Comprehension 的 `RepositoryBindingDigest`；
- Blocker condition/observed binding digest；
- Outcome final repository digest。

每个 `RepositoryBinding.BindingDigest` 仍是单仓库 component digest，只用于 binding 自洽和 Scope
聚合，不改写为 aggregate。

## 3. Scoped Path

### 表示

| Task 类型 | 合同路径 |
| --- | --- |
| 单仓库 | `internal/store/sqlite.go` |
| 多仓库 | `core::internal/store/sqlite.go` |

多仓库解析规则：

1. 以第一个 `::` 分成非空 key 和非空 repository-relative path；
2. key 必须精确匹配 Scope entry；
3. path 必须通过现有相对路径、clean path、非父目录逃逸校验；
4. 输入必须已规范化，重复 scoped path 被拒绝。

### 适用字段

- `ArtifactReference.Path`；
- `WorkItem.ExpectedPaths`；
- `ImplementationRecord.ChangedPaths`；
- Refactor result `changed_paths`；
- 从这些字段导出的 RepositoryEffect 和 Recovery 声明路径。

`RepositoryBinding.ChangedPaths` 是 observer 对单个仓库的事实，始终使用该仓库内普通相对路径。
Application 根据 entry key 在 scoped path 和 component path 之间映射。

## 4. Scope Observation

Scope Observation 是 Application 内的瞬时值，不持久化、没有接口注册表：

| 字段 | 规则 |
| --- | --- |
| `Primary` | 对持久化主 canonical root 的新 `RepositoryBinding`。 |
| `Additional` | 与 Task additional key 一一对应并按 key 排序的新 binding。 |
| `EffectiveDigest` | 以新 component digests 计算的聚合摘要。 |
| `ObservedAt` | 汇总报告使用最后一个 component observation 的 UTC 时间；各 binding 保留各自时间。 |

观察顺序固定为主仓库，然后是 sorted additions。任何观察失败终止整个 Application 操作；观察本身
只读且不写 Task。

## 5. Repository Claim Set

每个活动 Task 对 Scope 中每个 repository identity 持有一条现有形状的 claim：

| 列 | 规则 |
| --- | --- |
| `repository_identity` | 主键；同一仓库最多属于一个活动 Task。 |
| `task_id` | 可重复；一个 Task 对应 1～8 行。 |
| `origin_host` | 每行必须等于 Task origin host。 |
| `claimed_at` | 同一次 Task mutation 的事件时间。 |

`tasks.repository_identity` 继续等于主仓库 identity。建议为
`repository_claims(task_id)` 建立普通索引，不增加 claim group 或 repository-level revision。

### Claim 生命周期

```text
Open active Task
  -> Acquire exact Scope claim set in one Task mutation transaction

Non-terminal mutation
  -> Retain and verify exact Scope claim set

Done or Cancelled
  -> Release exact Scope claim set in the same terminal mutation
```

Acquire 的任一 primary-key 冲突回滚 Task、event 和此前插入的 claims。Retain/Release 的缺失、额外、
host mismatch 或受影响行数不符均 safe-stop，不做部分修复。

## 6. Recovery Scope Facts

### RepositoryObservationFact

每个 Scope entry 形成一个有界事实：

| 字段 | 值 |
| --- | --- |
| `RepositoryKey` | 已验证 key，不输出绝对路径。 |
| `Relation` | 现有 `exact`、`worktree_only_changed`、`forbidden_change`。 |
| `EffectEvidence` | `not_started`、`complete` 或 `contradictory` 的内部 entry 结论。 |
| `Reason` | 有界枚举/说明：branch、HEAD、identity、unexpected path、missing claim 等。 |

overall relation 仍使用现有三值；Recovery classification 仍使用现有五类。公开 Recovery assessment
可增加按 key 排序的 bounded repository facts，不能增加仓库级 Recovery 或 Blocker。

### Partial 与 Conflict

- `not_started`: 所有声明会改变的仓库仍 exact，且无其他变化；
- `completed_but_unrecorded`: 所有声明 effect 均已精确出现，未涉及仓库仍 exact；
- `partially_completed`: 完成仓库集合是声明 effect 仓库的非空严格子集，其余声明仓库仍 exact；
- `conflicting`: 任一 forbidden relation、未声明路径、错误仓库 key 或与 retained payload 不兼容；
- `completed_and_recorded`: LastOperation 的现有精确 proof 匹配，优先于重新推断。

## 7. User Configuration

配置不是 Task 数据，不进入 SQLite、Action、摘要、changed paths 或 Recovery。

### EffectiveHostPreferences

| 字段 | 类型 | 默认值 |
| --- | --- | --- |
| `Codex.CodebaseMemory` | bool | `false` |
| `DeepSeek.CodebaseMemory` | bool | `false` |

`$HOME/.dev-flow/config.json` 不存在时产生默认值。存在时以 16 KiB 为硬上限，closed decode 后形成
单次 Core 进程的只读快照。配置失败发生在 SQLite 打开之前。

Host 会话可以短暂记录“codebase-memory 不可用提示已显示”以满足最多提示一次；该标记只属于 Host
会话表现，不是 Core Task 或持久化状态。

## 8. MCP Projection

Task 投影保留现有主 `repository`，新增：

```text
primary_repository_key
additional_repositories[]
  key
  repository
```

主和附加 repository projection 均提供 Host 后续执行所需的 `canonical_root` 及现有非敏感 binding
事实。没有 `repository_scope_digest`；当前 Action 的 `repository_binding_digest` 是唯一 Scope 摘要
合同。

Server info 投影新增：

```text
host_preferences
  codex.codebase_memory
  deepseek.codebase_memory
```

这些值不表示能力已安装或可用，只表示有效用户偏好。
