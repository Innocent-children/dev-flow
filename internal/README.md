# Shared Go Core

[中文](README.md) | [English](README_en.md)

`internal/` 是 Dev Flow 的 Host-independent Go Core。它管理 Task、状态图、MCP、SQLite、
Recovery 和只读 Git observation；Codex 与 DeepSeek package 通过同一个 Core 获得一致的过程行为。

## 包职责

| Package | 职责 |
| --- | --- |
| `domain` | `ProcessTask`、TaskIntent、baselines、records、evidence、outcome 与 limits |
| `workflow` | `standard-development`、node contracts、29 条 transitions、payload 与 invalidation |
| `application` | open/read/apply/cancel use cases 与组件协调 |
| `store` | SQLite bootstrap、strict snapshot、CAS、events、claims 与 read-only preflight |
| `repository` | canonical repository 与 bounded read-only Git observation |
| `recovery` | 五分类 reconciliation、retry advice、blocker 与 resume |
| `mcp` | 六工具 local STDIO contract、closed schemas 与 Result Envelope |
| `webui` | loopback HTTP adapter、嵌入资产、session 保护、共享 runtime receipt 与 lifecycle |
| `version` | 从 `CORE_VERSION` 或 build injection 读取 Core 产品版本 |

## 权威边界

Core 独自拥有：

- Task identity、immutable intent 与 method profile；
- process definition/digest、current node、resume node 与 legal transitions；
- requirements/design/task-plan baselines 及其失效关系；
- repository claim、revision CAS、current action 与 evidence；
- Recovery classification、blocker 与 terminal outcome。

Host Adapter 执行用户授权的仓库工作并提交结果。Core 只读观察 Git，不执行任何 Git mutation，
也不提供通用 shell。

## 当前运行模型

```text
cmd/dev-flow
    ├── internal/mcp
    └── internal/webui ── embedded React assets
    ↓
internal/application
    ├── internal/workflow
    ├── internal/recovery
    ├── internal/repository
    └── internal/store
            ↓
        local SQLite
```

当前 Store 只支持当前 SQLite Schema 与严格 snapshot。不兼容或 pre-graph 数据在写能力开放前返回
`SCHEMA_UNSUPPORTED`，并保持零写入；`dev-flow webui reset` 使用 target-bound plan 和数据库独占访问
只清理确认的 Task database/sidecars。浏览器没有 reset mutation；双语显示偏好只存在于 frontend local
site storage，不进入 Core 或 Task。

## 定向验证

修改单个 package 时优先运行对应测试：

```bash
go test ./internal/workflow
go test ./internal/recovery
go test ./internal/store
go test ./internal/mcp
go test ./internal/webui
```

跨层 contract 与 journey 检查位于 `tests/contract/` 和 `tests/journeys/`。完整仓库验证由活动
任务或最终 checkpoint 明确授权后运行：

```bash
pnpm run validate
```

源码、机器可读 Schema 和可执行测试是当前行为权威。
