# Dev Flow 产品定义

[中文](PRODUCT.md) | [English](PRODUCT_en.md)

## 一句话定位

Dev Flow 是 AI 开发的过程导航与恢复层：它把一次开发任务放进由 Go Core 管理的状态图，
持续给出当前节点、完成条件、证据要求和全部合法下一步。

## 面向谁

Dev Flow 面向希望让 AI 深度参与真实代码库、同时保留过程控制权的开发者和团队。典型任务会
经历需求澄清、设计选择、实现返工、测试失败、上下文切换和交付审查，单靠聊天记录很难稳定
维护这些事实。

## 解决什么问题

### 过程容易失焦

Host 可能跳过需求或设计，也可能在测试通过后直接交付难以维护的代码。Dev Flow 为每个节点
提供明确的 purpose、entry assumptions、completion conditions、allowed effects 和 required evidence。

### 多套工具容易产生多个游标

Spec Kit、OpenSpec、Codex 和 DeepSeek Harness 都可以辅助开发。Dev Flow 把它们视为方法工具
或 Host Adapter，由 Go Core 独自保存 process cursor、transition authority 和 terminal outcome。

### 中断后的重复执行可能造成二次副作用

mutation 结果不确定时，Dev Flow 先读取已记录的 operation、Task 和 repository binding，再
判断是否需要恢复。调用者不需要从输出片段推测上一次操作是否成功。

### 测试无法证明代码容易理解

测试验证行为，理解审查验证开发者能否解释和维护结果。Dev Flow 把两者作为独立证据，并为
过度复杂的实现提供正式的重构循环。

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

### 当前权威基线

Task 保留不可变的初始意图和 method profile，并维护当前 requirements、design、task-plan、
implementation、test、comprehension 与 delivery authority。上游发生实质变化时，下游过期
authority 会被明确失效。

### 三种 method profile

- `plain`：使用 Host 的通用开发能力完成节点语义；
- `spec-kit`：把 Spec Kit 能力映射到当前节点；
- `openspec`：把 OpenSpec 能力映射到当前节点。

三种 profile 使用同一张 Core 状态图。外部命令成功、checkbox 勾选或 artifact 存在可以形成
证据，但不会自行推进任务。

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
