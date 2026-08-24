# Repository Scope Contract

## 创建输入

`dev_flow_open_task` 的 `repository_path` 在创建时指向主仓库。调用者可以额外提供：

```json
{
  "primary_repository_key": "core",
  "additional_repositories": [
    {
      "key": "docs",
      "repository_path": "/absolute/path/to/docs"
    }
  ]
}
```

- `primary_repository_key` 可省略，省略后规范化为 `primary`。
- `additional_repositories` 可省略或为空，最多 7 项。
- 每项是 closed object，只允许 `key` 和 `repository_path`。
- 用户必须显式声明所有仓库；Core 不扫描父目录、相邻目录、依赖或索引结果来扩展 Scope。

## Key 合同

所有主/附加 key：

- 必须匹配 `^[a-z0-9][a-z0-9._-]{0,127}$`；
- 必须在完整 Scope 中唯一；
- 创建后不可增加、删除、重命名或替换；
- 既是 scoped path namespace，也是公开错误中的安全仓库 locator。

输入数组顺序不是权威顺序。Core 将附加项按 key 升序规范化；主仓库永远在第一位。

## Identity 与观察

Application 使用现有只读 `RepositoryObserver`：

1. 观察主 `repository_path`；
2. 按 key 升序观察每个附加路径；
3. 验证所有 canonical repository identity 唯一；
4. 全部成功后才提交 Task 和 claims。

任何路径不存在、不是 Git 仓库、观察不稳定或解析为重复 identity，创建均整体失败且零 Task/claim
写入。Core 不 clone、fetch、checkout 或修改 Git。

## 创建后不可变

Task mutation 必须证明新旧 snapshot 的下列集合精确相等：

```text
(role=primary, primary key, primary repository identity)
(role=additional, key, repository identity) ...
```

branch、HEAD、worktree fingerprint、changed paths 和 component binding digest 是可重新观察的仓库
事实，不是 Scope membership。对这些事实的合法更新仍受当前 Action 和 Recovery 约束。

## 有效 repository_binding_digest

```text
single repository:
  effective digest = primary Repository.BindingDigest

multiple repositories:
  effective digest = SHA-256(length-prefixed(
    domain separator,
    entry count,
    primary role + key + component binding digest,
    each sorted additional role + key + component binding digest
  ))
```

component binding digest 保持现有算法和字段。聚合摘要不包含 `ObservedAt`、用户输入数组顺序、Host
配置或 codebase-memory 状态。

Action、operation probe/apply、Recovery、Blocker 和 Outcome 继续只使用现有
`repository_binding_digest`/final digest 字段；不得新增并行 Scope digest 字段。

## Scoped Path

单仓库 Task：

```text
internal/application/open_task.go
```

多仓库 Task：

```text
core::internal/application/open_task.go
docs::docs/ARCHITECTURE.md
```

多仓库公共路径必须满足：

1. 恰好可按第一个 `::` 得到非空 key 与非空相对路径；
2. key 在 Task Scope 中存在；
3. 相对路径通过现有 clean、非绝对、非 `..` 逃逸校验；
4. 在同一字段集合内不重复。

该合同适用于 `artifacts[].path`、`expected_paths`、Implementation/Refactor `changed_paths`。单仓库
Task 不接受强制 namespace，也不改变原相对路径行为。Observer 返回的每仓 `ChangedPaths` 永远是
普通相对路径，由 Application 与 scoped paths 映射。

## 从任一仓库恢复

恢复调用继续使用 `dev_flow_open_task`：

- `repository_path` 可以指向主仓库或任一附加仓库；
- `new_task` 省略或为 `null`；
- Scope 创建字段省略；
- Core 观察该路径并通过其 repository claim 定位 Task；
- 返回原 Task、原主仓库、同一 revision 和同一 current Action。

恢复位置不会提升为主仓库，也不会改变 key 或 Scope 顺序。若调用者以非空 `new_task` 命中活动
Task，规范化 intent 与显式 Scope 必须与存量 Task 完全一致，否则返回
`ACTIVE_TASK_CONFLICT` 且零写入。

## 单仓库兼容

未提供附加仓库时：

- `repository_path`、主 `repository`、claim 数量和观察行为保持现有语义；
- 默认主 key 只用于结果描述，不改变路径语法；
- 有效摘要与现有 component binding digest 完全相等；
- 无需使用 `::`；
- 不需要安装或配置任何代码索引工具。
