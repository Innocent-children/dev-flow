# Shared Go Core

[中文](README.md) | [English](README_en.md)

`internal/` 是 Dev Flow 的 Host-independent Go Core。它管理 Task、状态图、MCP、SQLite、
Recovery 和只读 Git observation；Codex 与 DeepSeek package 通过同一个 Core 获得一致的过程行为。

## 包职责

| Package | 职责 |
| --- | --- |
| `domain` | `ProcessTask`、WorkspaceOrigin/Binding、baselines、records、blocker、evidence、outcome 与 limits |
| `workflow` | `standard-development`、node contracts、30 条 transitions、TASKS verification plan、payload 与 invalidation |
| `application` | open/resume/read/submit/recover/relocate/cancel/abandon use cases 与组件协调 |
| `store` | SQLite bootstrap、strict snapshot、CAS、events、claims 与 read-only preflight |
| `repository` | dedicated worktree、identity/history/content/task-surface 的 bounded read-only Git observation |
| `recovery` | 五分类 reconciliation、retry advice、blocker 与 resume |
| `mcp` | 十七工具 local STDIO contract、按 Action kind 收窄的提交 schema 与 Result Envelope |
| `webui` | loopback HTTP adapter、嵌入资产、session 保护、共享 runtime receipt 与 lifecycle |
| `version` | 从 `CORE_VERSION` 或 build injection 读取 Core 产品版本 |

## 权威边界

Core 独自拥有：

- Task identity、immutable intent 与 method profile；
- process definition/digest、current node、resume node 与 legal transitions；
- requirements/design/task-plan baselines 及其失效关系；
- 以实际 worktree-instance identity 为键的 repository claim、revision CAS、current action 与 evidence；
- 固定 WorkspaceOrigin、当前 Task surface，以及 Action issuance identity/history/content；
- Recovery classification、blocker 与 terminal outcome。

Host Adapter 在用户确认后执行 fetch、branch、worktree、handoff 和普通仓库工作并提交语义结果。Core
从 Git 计算当前 surface，只读观察 Git，不执行任何 Git mutation，
也不提供通用 shell。

linked worktree 共享 `SourceRepositoryGroupDigest`，但每个实例由 canonical root 与 worktree-specific
Git dir 形成不同的 `WorktreeInstanceDigest`。Store 按后者排他 claim，因此同组 worktree 可各自运行
Task，同一实例只能有一个活动 Task。

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
