# Dev Flow 产品定义

## 当前交付

Feature 002 交付的是 **Core Contract 0.1**：一个通过本地 STDIO MCP 使用的单仓库任务控制
Core。它已经具备共享状态机、SQLite 持久化、只读 Git 观察、重启续作与保守恢复，但尚未
交付 Codex 或 DeepSeek 产品集成、安装和发布。

`server_info.supported_hosts = [codex, deepseek]` 只表示 Core 接受这两个 `origin_host` identity，
不表示两个宿主包已可安装、运行或通过真实宿主 journey。

## 用户价值

Core 把一次开发工作固定为不可静默修改的任务合同：

```text
goal
scope
out_of_scope
acceptance_criteria
verification_budget
origin_host
repository binding
```

它为任务保存唯一权威下一动作，让调用者在进程关闭后找回相同 task/revision/action，并在写入
前核对新的仓库现实。遇到 stale identity、仓库漂移或无法证明的 mutation 时，Core 返回稳定
错误或进入可机器验证的 `BLOCKED`，不会猜测完成、重放宿主副作用或自动修复 Git。

## 已实现能力

- 一个现有本地 Git repository；
- 每个 repository identity 最多一个活动 governed task；
- `codex` 或 `deepseek` origin-host ownership，禁止自动跨宿主接管；
- `INTAKE → ASSESS → PLAN → IMPLEMENT → VERIFY → REVIEW → HANDOFF → DONE`；
- `BLOCKED` 与 `CANCELLED`；
- 阶段级闭合 payload、revision CAS、action identity 与 repository binding；
- verification budget 与单一 retained Task evidence authority；
- SQLite snapshot、audit event 与 repository claim 的同事务 mutation；
- 关闭全部 Core/database objects 后重开同一数据库并恢复相同 action；
- 不确定 ApplyAction 的 read-after-write proof 与五类瞬时 RecoveryAssessment；
- ordinary repository drift 的零写入拒绝；
- partial/conflicting recovery 的显式 BLOCKED entry；
- 仅在精确恢复 issuance binding 后执行 `RESOLVE_BLOCKER`；
- 显式 cancellation、终态 Outcome 与 claim release；
- 本地 STDIO MCP 和统一 typed result envelope。

## MCP 使用面

```text
dev_flow_server_info
dev_flow_open_task
dev_flow_get_task
dev_flow_get_next_action
dev_flow_apply_action
dev_flow_cancel_task
```

工具输入不接受任意命令、环境、数据库路径或输出路径。调用者通过 `dev_flow_get_next_action`
取得 Core 已持久化的动作与 payload contract，使用自身已有的文件、Shell 和开发工具完成动作，
再提交有界结果。Core 本身不运行测试或用户命令。

服务通过以下唯一模式启动：

```bash
DEV_FLOW_DATA_DIR="<existing-directory>" dev-flow mcp --stdio
```

CLI 还提供 bounded help 与 `dev-flow version`。没有 HTTP、SSE 或监听端口。

详细 wire contract 见 [MCP Tools 0.1](../specs/002-govern-and-resume-single-repository-task/contracts/mcp-tools.md)，
转换与恢复规则见 [State Machine](../specs/002-govern-and-resume-single-repository-task/contracts/state-machine.md)，
共享示例见 [Protocol Fixtures](../protocol/fixtures/README.md)。

## 恢复与证据边界

不带 probe 的任务读取只返回持久状态，不观察 Git。带 `operation_probe` 的读取对所有阶段进行
一次新观察，返回以下五类之一，并且不写 Task、revision、event、binding 或 blocker：

```text
not_started
completed_and_recorded
completed_but_unrecorded
partially_completed
conflicting
```

只有显式 `recovery_apply` 可以记录未落账完成或创建 blocker。恢复分类来自 Core 的 typed facts，
不是模型文本。成功读取中的 `recovery_assessment` 与错误信封中的 retry guidance `recovery`
保持分离。

Retained evidence 只保存有界 summary、source、status、digest、command count 与 full-suite 标记；
不保存源码、diff、raw Git status、环境值或 raw command output。Outcome 只引用 Task.Evidence 中的
canonical IDs，不复制 evidence authority。

## 已验证边界

当前仓库测试覆盖 Domain/Workflow invariants、SQLite migration/CAS/claim、只读 Git fingerprint、
Application 全流程、五类 recovery、blocker exact resolution、共享 MCP contract/fixtures、官方
SDK 六工具握手、CLI EOF shutdown，以及独立进程关闭/重开后完成任务的 Core journey。

这些证据是 Core-local evidence。它们不是 Codex/DeepSeek 真实宿主证据，也不是安装、发布或
所有平台的产品兼容性声明。

## 明确不支持

- Codex product integration 或真实 Codex journey；
- DeepSeek product integration、Proxy 或真实 DeepSeek journey；
- installation、upgrade、remove、publication、Tag 或 Release；
- Web UI、remote MCP、HTTP/SSE、authentication、account 或 telemetry；
- multi-repository task、并行执行器或 cross-host takeover；
- Git mutation、自动 repository repair、新 binding adoption 或通用 Shell MCP；
- workflow plugin/DSL、通用 recovery policy 或 TaskEvent runtime replay；
- Windows release claim 或未经真实验证的平台产品声明；
- real-host transport-loss/crash/truncation hardening。

后续 Feature 的目标不能视为本版本已交付能力。
