# Data Model: Codex 智能隐式启用

## Persistence disposition

`not-applicable`。本 Feature 不修改 Task、SQLite、receipt、用户配置或 repository data。

## Host-only concepts

### Activation Path

瞬时枚举：

- `implicit`: Host 根据 Skill description 选择；
- `explicit`: 当前请求包含精确 `$dev-flow-codex:dev-flow` selector。

该值不序列化、不写入 Core，也不成为 Skill 维护的状态。

### Request Classification

仅用于 admission 说明的瞬时概念：

- `task_bearing`: 一个实质、有界的实现、修复、重构、定向测试、开发交付或明确 Task 恢复请求；
- `non_task_bearing`: 仅解释、仅状态、仅方案讨论、普通问答、空请求或含糊意图。

产品不实现独立分类实体或关键词解析器。Host 选择 Skill 后，Skill 只根据当前请求执行现有准入。

## Invariants

1. Activation Path 不改变 Repository Scope、allowed effects 或用户授权。
2. `non_task_bearing` 请求不得自动创建 Task。
3. 两种 Activation Path 使用相同 handshake、Task discovery 和 Action loop。
4. 既有 Task 无迁移、重写、取消或重新归属。
5. Core、DeepSeek、MCP Schema 和 codebase-memory preference 不读取 Activation Path。

## Lifecycle

```text
current prompt
  -> Host selects Skill implicitly or explicitly
  -> shared admission validates substantive request or resume intent
  -> compatibility handshake
  -> existing Core Task discovery and governed action loop
```

非任务请求在 Task discovery 前结束。所有 Task 生命周期继续由 Core 定义。
