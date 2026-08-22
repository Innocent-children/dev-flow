# Dev Flow 产品定义

[中文](PRODUCT.md) | [English](PRODUCT_en.md)

## 一句话定位

Dev Flow 是 AI 开发的过程边界与恢复层：它让 Agent 在每一步都明确只该做什么、做到什么算
完成、验证到什么程度，以及下一步可以去哪里。

## 面向谁

Dev Flow 面向希望让 AI 深度参与真实代码库、又不想接受需求发散、过度设计、过度测试和上下文
丢失的开发者与团队。典型任务会经历需求澄清、设计选择、实现返工、测试失败、会话中断和交付
审查，单靠聊天记录很难稳定维护范围、进度和证据。

## 解决什么问题

### 小需求在执行中不断膨胀

Host 可能把一个局部修改扩展成相邻模块重构、通用抽象、额外文档或未来能力。Dev Flow 保存
不可变的原始意图和当前 requirements、design、task-plan authority；每个 Action 都暴露允许的
副作用。范围发生实质变化时，任务必须回到正确节点，并明确使下游旧证据失效。

### 验证没有停止条件

Agent 容易把“确认这次修改正确”扩展成完整回归、平台矩阵、压力测试、模糊测试或大量边界用例。
Dev Flow 为每个 Task 保存 verification budget。检查必须关联当前节点、改动表面、验收条件或
已知恢复风险；更宽的验证需要明确要求或最终 checkpoint，不能作为默认动作不断追加。

### 过程依赖聊天记录

聊天压缩、Host 重启或任务跨天继续后，Agent 可能忘记当前节点、重复读取仓库或重新执行已经
完成的工作。Dev Flow 把 Task、当前节点、基线、证据、阻塞原因和合法流转保存在本地 SQLite，
一次权威读取即可恢复真实进度。

### 中断后的重复执行可能造成二次副作用

mutation 结果不确定时，Dev Flow 先读取已记录的 operation、Task 和 repository binding，再
判断是否需要恢复。调用者不需要从输出片段推测上一次操作是否成功，也不能把盲目重试当成默认
恢复方式。

### 测试通过不等于代码值得交付

测试验证行为，理解审查验证开发者能否解释和维护结果。Dev Flow 把两者作为独立证据，并为
过度复杂的实现提供正式的 `DESIGN` / `REFACTOR` 回路；修改仓库后的重构必须重新经过 `TEST`。

### 多套工具容易产生多个游标

Spec Kit、OpenSpec、Codex 和 DeepSeek Harness 都可以辅助开发。Dev Flow 把它们视为方法工具
或 Host Adapter，由 Go Core 独自保存 process cursor、transition authority 和 terminal outcome。
外部命令成功、checkbox 勾选或 artifact 存在可以形成证据，但不能自行推进 Task。

## 核心能力

### 可见的标准开发图

当前产品只提供内建的 `standard-development`，包含 8 个工作节点、`DONE`，以及
`BLOCKED`、`CANCELLED` 两个异常节点。

```text
REQUIREMENTS → DESIGN → TASKS → IMPLEMENT → TEST
                                         ↓
                              COMPREHENSION_REVIEW
                                  ↙           ↘
                             REFACTOR       DELIVERY → DONE
                                 └────→ TEST
```

精确实现含 29 条流转，覆盖需求修订、重新设计、实现返工、测试失败、理解失败、重构、重新测试
和交付拒绝。每个 Action 返回全部合法出边；调用者选择 `transition_id`，Core 校验 guard 并
推导 destination。

### 范围与验证边界

Task 保留不可变的初始意图和 method profile，并维护当前 requirements、design、task-plan、
implementation、test、comprehension 与 delivery authority。每个当前 Action 同时返回：

- 当前节点的 purpose、entry assumptions 与 completion conditions；
- `allowed_effects` 和 `required_evidence`；
- 当前 verification budget；
- 全部合法 transitions 及选择条件。

上游发生实质变化时，下游过期 authority 会被明确失效。Host 不能把范围扩大、额外验证或未来
能力隐藏在当前节点中，再用“测试通过”替代正确的流程流转。

### 三种 method profile

- `plain`：使用 Host 的通用开发能力完成节点语义；
- `spec-kit`：把 Spec Kit 能力映射到当前节点；
- `openspec`：把 OpenSpec 能力映射到当前节点。

三种 profile 使用同一张 Core 状态图。外部工具只帮助完成当前节点，不保存第二个流程游标。

### 五分类 Recovery

不确定 mutation 由 Core 分类为：

```text
not_started
completed_and_recorded
completed_but_unrecorded
partially_completed
conflicting
```

Core 决定 retry advice、recovery apply 或 `BLOCKED`。Blocker 解除后回到保存的 resume node。

### 本地持久化与只读 Git 观察

任务、事件、证据和 repository claim 保存在本地 SQLite。Core 可以读取 canonical repository、
branch、HEAD、index/worktree 和有界 changed paths；Git 修改仍由获得用户授权的 Host 负责。

## 产品组成

| 产品 | 职责 | 当前版本 |
| --- | --- | --- |
| Core | 状态图、Task、Store、Recovery、MCP | `0.5.0` |
| Codex | Codex Plugin、Skill、注册生命周期和 bundled Core | `0.5.1` |
| DeepSeek | DSH bundle、Skill、guard、MCP child 和 bundled Core | `0.5.1` |

三个产品独立版本化。Host 包会记录实际 bundled Core 版本，不要求两个产品使用同一版本号。

## 产品保证

- 当前 Task、节点、合法流转、恢复分类和终态只有一个 Core 权威；
- Task 保存不可变原始意图，需求或设计发生实质变化时使下游旧 authority 失效；
- 每个 Task 携带 verification budget，验证范围必须与当前节点、改动或验收条件直接相关；
- mutation 使用 revision、action identity、source cursor 与 repository binding；
- 不确定 mutation 先读取再决定后续动作；
- repository-changing refactor 必须重新经过 `TEST`；
- `DELIVERY` 需要当前测试证据和当前开发者理解证据；
- Core 只读观察 Git，不提供 shell 或 Git mutation；
- 不兼容 SQLite 数据在暴露写能力前被拒绝，并保持零写入；
- Codex 和 DeepSeek 的公开支持分别由对应 registry package lifecycle 证据建立。

## 当前产品边界

当前版本聚焦一个本地 Host、一个现有 Git 仓库和每个 canonical repository root 一个活动任务。
产品尚未提供：

- 用户自定义 graph、workflow DSL、graph editor 或 plugin framework；
- Web UI、remote MCP、HTTP/SSE、authentication 或 telemetry；
- 通用 shell、自动 Git 修复、commit、push、merge、rebase 或发布；
- 多仓库任务、并行节点、subtasks 或自动跨 Host takeover；
- pre-graph task migration、legacy snapshot decoder 或兼容 runtime；
- Core 内安装、执行或解析 Spec Kit/OpenSpec。

这些边界让当前过程图保持确定、可解释和可验证。未来能力只有在真实用户价值和独立规格成立
后进入路线图。

## 当前公开状态

Codex `0.5.1` 与 DeepSeek `0.5.1` 均已发布到 npm，并分别使用
`codex-v0.5.1`、`deepseek-v0.5.1` GitHub Release。两个 Host 产品都打包 Core `0.5.0`，
公开支持 macOS arm64 与 Node.js `>=24`。

精确平台、Host 版本、Journey 结论和 Release 入口见
[Support Matrix](SUPPORT-MATRIX.md)。精确产品行为由当前代码、机器可读 Schema 和可执行测试
定义。
