# Dev Flow Core 架构与边界

## 当前实现

Feature 002 实现一个单仓库、单活动任务的本地 Go Core。唯一可执行入口通过官方 Go MCP
SDK 在 STDIO 上公开六个工具；任务状态存入 SQLite，Git 仅被只读观察。Codex 与 DeepSeek
产品包仍是没有运行时、Skill 或宿主接入的私有骨架。

```text
CLI: dev-flow mcp --stdio
              │
              ▼
      MCP thin adapter
              │
              ▼
     Application Service
          ┌───┴────┐
          ▼        ▼
      Workflow   Recovery
          │        │
          └───┬────┘
              ▼
            Domain
          ┌───┴────┐
          ▼        ▼
   Repository     Store
   read-only Git  SQLite
```

依赖只能沿图中方向前进。CLI 和 MCP 不选择流程转换、不判断完成、不分类恢复，也不直接读写
Store；Application 协调用例并把权威判断委托给下层所有者。

## 源码所有权

```text
cmd/dev-flow/            唯一 CLI；help、version、mcp --stdio 与 SQLite 生命周期
internal/domain/         Task、Contract、Action、Outcome、稳定错误与 Core Limits 0.1
internal/workflow/       唯一转换表、下一动作蓝图、闭合 action payload
internal/recovery/       唯一 repository relation、五类恢复与 blocker reconciliation
internal/repository/     只读 Git 观察、repository/binding digest 构造与校验
internal/store/          SQLite migration、snapshot、revision CAS 与 repository claim
internal/application/    open/read/next/apply/cancel 用例及事务协调
internal/mcp/            六工具 catalog、严格 JSON 边界、结果信封与 stderr diagnostics
internal/version/        根 VERSION 读取
protocol/fixtures/       Core Contract 0.1 的共享公开示例
tests/contract/          Schema、MCP、fixture 与仓库合同测试
tests/journeys/          独立进程关闭/重开 Core journey
packages/codex/          非功能性私有宿主骨架
packages/deepseek/       非功能性私有宿主骨架
```

仓库只有一个根 Go module 和一个可执行源码根。生产 direct dependencies 只有
`modernc.org/sqlite` 与 `github.com/modelcontextprotocol/go-sdk`。

## 权威边界

### Workflow

`internal/workflow` 的显式转换表是阶段、动作、结果和下一阶段的唯一权威。它还验证每个阶段
唯一的闭合 payload。MCP Adapter 只把严格 JSON 转为这些 concrete payload；不会复制转换表
或从结果文本推断 `DONE`。

### Recovery

`internal/recovery` 是持久任务与新仓库观察之间结构化比较的唯一权威。它输出
`not_started`、`completed_and_recorded`、`completed_but_unrecorded`、
`partially_completed` 或 `conflicting`，并生成唯一的
`restore_issuance_binding` blocker condition。Application 不保存第二套 binding 规则。

带 `operation_probe` 的任务读取返回瞬时 `RecoveryAssessment`。该值不写入 Task、SQLite 或
TaskEvent；不带 probe 的读取不观察仓库。成功读取中的 `recovery_assessment` 与失败信封顶层
的 retry guidance `recovery` 是两个不同模型。

### Repository

`internal/repository` 构造并校验 repository identity、worktree fingerprint 与 binding digest。
它只通过固定参数执行有界的只读 Git 命令，不执行 checkout、reset、clean、stash、commit、
push、merge、rebase、tag 或其他 Git mutation。源码、diff、raw status 与 raw Git output 不会
进入 Task、MCP 结果或诊断。

### Store

SQLite `tasks` snapshot 是当前状态权威。每次 mutation 在一个事务中执行 revision CAS、写入
新 snapshot、追加一个 TaskEvent 并更新 repository claim。TaskEvent 是审计事实；运行时没有
event-list/replay API，恢复只使用 Task、CurrentAction、最新 LastOperation、OperationProbe 和
新 RepositoryBinding。

## MCP Adapter

Adapter 使用官方 Go MCP SDK 的 raw Tool handler，因此协议握手与 STDIO lifecycle 由 SDK
负责，而 Dev Flow 仍能在 typed dispatch 前检查原始 arguments。公开工具恰好是：

```text
dev_flow_server_info
dev_flow_open_task
dev_flow_get_task
dev_flow_get_next_action
dev_flow_apply_action
dev_flow_cancel_task
```

输入对象在所有嵌套层拒绝 unknown member、duplicate member、alias、错误 JSON type 与 trailing
JSON；不使用运行时 JSON Schema framework。`PREPARE_HANDOFF` 的两个闭合 Go payload 共用
action kind，Adapter 在必要时通过一次无 probe、无写入的 Application task read 取得权威 source
phase，然后仍由 `ApplyAction` 的 revision/action/binding 校验决定结果。

每个调用返回同一 typed envelope：固定 `schema_version=1`、当前 `request_id`、`tool`，以及
互斥的 `result` 或 `error + recovery`。最终 compact JSON 使用 `SetEscapeHTML(false)` 编码，
并按真实 UTF-8 bytes 强制 1 MiB 上限；超限结果替换为固定、非递归、已脱敏的
`INTERNAL_ERROR`。stdout 只承载 MCP wire；诊断仅写 stderr，且只含时间、级别、request ID、
tool、稳定错误码和固定 event name。

所有 annotation 都显式且保守：三个纯读取工具标记 read-only/idempotent，mutation 工具不标记
read-only/idempotent，取消标记 destructive，全部标记 closed-world。Annotation 只描述工具，
不授予文件、进程、Git 或网络权限。

## CLI 与数据

CLI 只接受：

```text
dev-flow
dev-flow help
dev-flow -h
dev-flow --help
dev-flow version
dev-flow mcp --stdio
```

`mcp --stdio` 要求 `DEV_FLOW_DATA_DIR` 指向现有可用目录，并在其中使用一个固定内部 SQLite
文件。CLI 不接受数据库路径或网络模式。client disconnect/stdin EOF 后 SDK session 结束，CLI
关闭 SQLite 并退出；没有 daemon、listener、HTTP、SSE、auth、background worker 或配置框架。

## 未实现边界

当前架构不包含 Codex/DeepSeek 产品接入、真实宿主 journey、安装、发布、Web UI、remote MCP、
HTTP/SSE、authentication、telemetry、多仓库任务、跨宿主接管、自动 repository repair、通用
Shell、工作流 DSL、TaskEvent replay 或 Git mutation。任何后续能力都必须由新的活动 Feature
授权，不能从本架构文档推导为已交付行为。
