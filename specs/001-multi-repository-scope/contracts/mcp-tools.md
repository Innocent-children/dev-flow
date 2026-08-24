# MCP Contract Changes

## 不变边界

公开工具集合、顺序和 annotation 保持为以下六个：

1. `dev_flow_server_info`
2. `dev_flow_open_task`
3. `dev_flow_get_task`
4. `dev_flow_get_next_action`
5. `dev_flow_apply_action`
6. `dev_flow_cancel_task`

Result envelope、request ID 规则、1 MiB 上限、closed input 和错误 code 集合保持不变。不增加配置
工具、Scope 工具或仓库级工具。

## dev_flow_open_task

### Input schema

```json
{
  "type": "object",
  "additionalProperties": false,
  "required": ["host", "repository_path"],
  "properties": {
    "host": { "enum": ["codex", "deepseek"] },
    "repository_path": { "type": "string", "minLength": 1, "maxLength": 4096 },
    "primary_repository_key": {
      "type": "string",
      "pattern": "^[a-z0-9][a-z0-9._-]{0,127}$"
    },
    "additional_repositories": {
      "type": "array",
      "maxItems": 7,
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["key", "repository_path"],
        "properties": {
          "key": {
            "type": "string",
            "pattern": "^[a-z0-9][a-z0-9._-]{0,127}$"
          },
          "repository_path": {
            "type": "string",
            "minLength": 1,
            "maxLength": 4096
          }
        }
      }
    },
    "new_task": {
      "description": "Existing closed new-task contract or null"
    }
  }
}
```

所有 object 继续拒绝未知字段、重复 JSON member、trailing JSON 和非法 UTF-8。

### Semantics

- 创建：`new_task` 非 null，`repository_path` 是主仓库；缺省主 key 为 `primary`。
- 恢复：`new_task` 省略/null，`repository_path` 可以是任一参与仓库，调用者省略 Scope 创建字段。
- 如果调用命中活动 Task 又携带 `new_task`/Scope，Core 只在规范化 intent 与 Scope 完全相同时返回
  同一 Task；否则 `ACTIVE_TASK_CONFLICT`。
- 总数 8 可接受，第 9 个仓库在观察或写入前返回 `INVALID_ARGUMENT`。
- 重复 key、重复 identity、不可观察路径或 claim 冲突均零写入。

### Task result additions

现有 `repository` 继续代表主仓库。Task result 增加：

```json
{
  "primary_repository_key": "core",
  "repository": {
    "canonical_root": "/workspace/core",
    "repository_identity": "...",
    "branch": "main",
    "detached": false,
    "head": "...",
    "unborn": false,
    "worktree_fingerprint": "...",
    "observed_at": "2026-08-23T00:00:00Z",
    "binding_digest": "..."
  },
  "additional_repositories": [
    {
      "key": "docs",
      "repository": {
        "canonical_root": "/workspace/docs",
        "repository_identity": "...",
        "branch": "main",
        "detached": false,
        "head": "...",
        "unborn": false,
        "worktree_fingerprint": "...",
        "observed_at": "2026-08-23T00:00:00Z",
        "binding_digest": "..."
      }
    }
  ]
}
```

`additional_repositories` 按 key 排序。没有 `repository_scope_digest`。当前 Action 中唯一的
`repository_binding_digest` 在多仓库 Task 中是聚合摘要；单仓库中仍等于主 binding digest。

## dev_flow_server_info

Input 仍严格为 `{}`。Result 保留当前字段并增加：

```json
{
  "host_preferences": {
    "codex": { "codebase_memory": false },
    "deepseek": { "codebase_memory": false }
  }
}
```

字段表示本次 Core 进程启动时读取的有效偏好，不表示工具已安装、正在运行或可用。两个 Host、三个
method profile、一个 `standard-development` process 和六工具 catalog 保持不变。

## 其他工具

- `dev_flow_get_task` / `dev_flow_get_next_action`：输入不变；Task/Recovery result 使用新增 Scope
  projection。
- `dev_flow_apply_action`：输入不变；唯一 `repository_binding_digest` 必须等于当前 Action 的有效
  Scope digest；payload 中的路径遵守单仓/多仓 scoped path 合同。
- operation probe：输入形状不变；digest 是 issuance 时的有效 Scope digest。
- `dev_flow_cancel_task`：输入不变；同一 terminal mutation 释放 Scope 全部 claim。

## Recovery result additions

现有 classification、overall repository relation、directive/advice 和 digest 字段保持不变。为定位
多仓库 drift，assessment 可以增加按 key 排序的有界列表：

```json
{
  "repositories": [
    { "key": "core", "relation": "exact", "reason": "exact" },
    { "key": "docs", "relation": "forbidden_change", "reason": "head_changed" }
  ]
}
```

`reason` 使用闭合、有界事实，不含绝对路径或 Git 命令输出。普通 error envelope 形状不变；涉及
仓库的 message 使用已验证 key，例如 `Repository "docs" has forbidden HEAD drift.`。

## Single-repository example

旧调用继续有效：

```json
{
  "host": "codex",
  "repository_path": "/workspace/core",
  "new_task": null
}
```

它不需要新字段，路径仍是普通相对路径，唯一 digest 算法和值保持原行为。
