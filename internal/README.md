# Shared Go Core

[中文](README.md) | [English](README_en.md)

`internal/` 是不依赖具体编程工具的 Go Core。它管理任务、流程图、MCP、SQLite、异常恢复和 Git
只读查询。Codex 与 DeepSeek 都使用这个 Core，因此遵循同一套任务规则。

## 包职责

| Package | 职责 |
| --- | --- |
| `domain` | `ProcessTask`、工作树来源与绑定、需求/设计/任务计划基线、操作和验证记录、阻塞、结果及数量限制 |
| `workflow` | `standard-development` 的节点规则、30 条转换、TASKS 验证计划、提交字段和旧结果失效规则 |
| `application` | 创建、恢复、读取、提交、迁移、取消和放弃任务，并协调各组件 |
| `store` | SQLite 初始化、快照校验、CAS 并发更新、事件、工作树占用和只读预检查 |
| `repository` | 只读查询专属工作树的身份、历史、内容和任务改动，并限制查询范围 |
| `recovery` | 对操作结果作五种分类，给出重试、阻塞或恢复的处理方式 |
| `mcp` | 通过本地 STDIO 提供十七个工具；按 Action 类型限定提交字段并返回统一结构 |
| `webui` | 本机 HTTP 接口、嵌入页面、session 检查、共享服务进程记录和启停 |
| `version` | 从 `CORE_VERSION` 或构建时写入的值读取 Core 产品版本 |

## Core 负责的内容

以下数据和规则只由 Core 管理：

- Task 标识、创建时确定的目标与方法配置；
- 流程定义和摘要、当前节点、恢复节点与允许的转换；
- 需求、设计和任务计划基线，以及它们的失效规则；
- 以实际工作树实例为键的仓库占用记录、revision CAS、当前 Action 与验证记录；
- 固定的工作树来源、当前任务改动，以及签发 Action 时的工作树身份、历史和内容；
- 恢复分类、阻塞信息与任务结束结果。

Host Adapter 在用户确认后执行 fetch、branch、worktree、handoff 和普通仓库工作，并提交语义结果。
Core 从 Git 计算实际改动，只执行 Git 查询，不修改 Git，也不提供通用 shell。

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

跨组件的接口检查和完整流程测试位于 `tests/contract/` 和 `tests/journeys/`。完整仓库验证由活动
任务或最终 checkpoint 明确授权后运行：

```bash
pnpm run validate
```

源码、机器可读 Schema 和可执行测试是判断当前行为的依据。
