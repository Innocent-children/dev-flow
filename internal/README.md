# Shared Go Core

[中文](README.md) | [English](README_en.md)

`internal/` 是 Dev Flow 的 Host-independent Go Core。它管理 Task、状态图、MCP、SQLite、
Recovery 和只读 Git observation；Codex 与 DeepSeek package 通过同一个 Core 获得一致的过程行为。

## 包职责

| Package | 职责 |
| --- | --- |
| `domain` | `ProcessTask`、TaskIntent、baselines、records、evidence、outcome 与 limits |
| `workflow` | `standard-development`、node contracts、29 条 transitions、payload 与 invalidation |
| `application` | open/read/submit/recover/cancel use cases 与组件协调 |
| `store` | SQLite bootstrap、strict snapshot、CAS、events、claims 与 read-only preflight |
| `repository` | canonical repository 与 bounded read-only Git observation |
| `recovery` | 五分类 reconciliation、retry advice、blocker 与 resume |
| `mcp` | 十五工具 local STDIO contract、按 Action kind 收窄的提交 schema 与 Result Envelope |
| `webui` | loopback HTTP adapter、嵌入资产、session 保护、共享 runtime receipt 与 lifecycle |
| `version` | 从 `CORE_VERSION` 或 build injection 读取 Core 产品版本 |

## 权威边界

Core 独自拥有：

- Task identity、immutable intent 与 method profile；
- process definition/digest、current node、resume node 与 legal transitions；
- requirements/design/task-plan baselines 及其失效关系；
- 以实际 worktree identity 为键的 repository claim、revision CAS、current action 与 evidence；
- Recovery classification、blocker 与 terminal outcome。

Host Adapter 执行用户授权的仓库工作并提交结果。Core 只读观察 Git，不执行任何 Git mutation，
也不提供通用 shell。

linked worktree 共享 `GitCommonDirDigest` 作为 Control Center 的逻辑仓库组标识，但各自拥有包含
canonical root 的 `RepositoryIdentity`。Store 只按后者排他 claim，因此同组的不同 worktree 可各自
运行 Task，同一 worktree 仍只能有一个活动 Task。

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

当前 Store 只实现一份当前 SQLite Schema 与严格 snapshot；任何非当前 Schema 返回通用
`SCHEMA_UNSUPPORTED`。双语显示偏好只存在于 frontend local site storage，不进入 Core 或 Task。
操作系统相关的进程、receipt 与 signal 行为位于 `darwin`、`windows` build-tag 文件，Domain、Workflow、
Application 和 Recovery 不包含平台判断。

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
