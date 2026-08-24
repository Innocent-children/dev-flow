# Dev Flow 产品定义

[中文](PRODUCT.md) | [English](PRODUCT_en.md)

## 定位

Dev Flow 是 AI 辅助软件开发的过程控制与恢复层。Go Core 保存 Task、当前节点、节点合同、
verification budget、合法流转、Recovery 和终态；Host Adapter 负责在用户授权下读取仓库、修改
代码并运行工具。

产品目标不是增加 Agent 的执行能力，而是为已有执行能力增加可持久化、可验证的过程边界。

## 目标场景

Dev Flow 面向让 AI 深度参与真实代码库，同时需要控制范围、验证强度和交付质量的开发者与团队。
典型任务包含需求澄清、设计选择、实现返工、测试失败、会话中断和交付审查，无法只依赖聊天记录
保存权威状态。

## 需要控制的失效模式

### 范围漂移与隐式工作

Host 可能把局部修改扩展为相邻模块重构、通用抽象、额外文档或未要求的未来能力。Task 保存
不可变 `TaskIntent` 和当前 requirements、design、task-plan authority；当前 Action 暴露
completion conditions、`allowed_effects` 和全部合法流转。实质范围变化必须通过状态图报告，
Core 随后失效不再成立的下游 authority。

### 无界验证

定向验证可能扩展为完整回归、平台矩阵、压力测试、模糊测试或不断追加的边界用例。每个 Task
保存 verification budget。检查必须关联当前节点、改动表面、验收条件或已知恢复风险；更宽的
验证需要明确要求或最终 checkpoint，不能作为默认工作持续追加。

### 会话上下文成为唯一状态存储

聊天压缩、Host 重启或跨会话继续后，Agent 可能重新扫描仓库、重复已完成工作，或从残缺输出
推断当前进度。Dev Flow 将 Task、当前节点、baselines、证据、blocker 和合法流转持久化到本地
SQLite，一次 Core 读取即可恢复权威状态。

### 不确定 mutation 的重复执行

mutation 响应缺失、取消、截断或损坏时，直接重放可能造成二次副作用。Dev Flow 使用 revision、
action identity、source cursor、repository binding 和原始 payload 识别操作，并要求
read-before-retry。Core 返回五分类 Recovery assessment，再决定恢复、阻塞或安全重试。

### 行为正确性与可维护性未分离

自动化测试证明行为，不证明实现易于解释和维护。`COMPREHENSION_REVIEW` 是独立交付门禁；
不符合可理解性要求的结果可以返回 `REQUIREMENTS`、`DESIGN`、`IMPLEMENT`、`TEST` 或
`REFACTOR`。任何修改仓库的重构必须重新经过 `TEST`。

### 多工具流程出现多个状态权威

Spec Kit、OpenSpec、Codex 和 DeepSeek Harness 都可以辅助开发，但只能作为 method tool 或
Host Adapter。Go Core 独自保存 process cursor、transition authority 和 terminal outcome。
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

### 节点合同、范围与验证预算

每个当前 Action 返回：

- process、node、revision 和 action identity；
- purpose、entry assumptions 和 completion conditions；
- `allowed_effects`、`required_evidence` 和 verification budget；
- 当前 method profile 的 semantic method steps；
- 全部合法 transitions、destination、guard、选择条件和 reason rule。

Core 校验 Task 流转，但不会静态拦截 Host 的每个文件操作。Host Adapter 必须按照当前 Action
合同执行，并将实质范围变化通过合法 transition 交回 Core。

### 三种 method profile

- `plain`：使用 Host 的通用开发能力完成节点语义；
- `spec-kit`：把 Spec Kit 能力映射到当前节点；
- `openspec`：把 OpenSpec 能力映射到当前节点。

三种 profile 使用同一张 Core 状态图。外部工具不保存第二个流程游标。

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

任务、事件、证据和 repository claim 保存在本地 SQLite。一个 Task 可以拥有一个主仓库和最多七个
显式附加仓库；Scope 创建后不可变，全部仓库共享同一流程状态。Core 按主仓优先、附加仓库 key
排序的顺序读取各仓库的 canonical identity、branch、HEAD、index/worktree 和有界 changed paths；
Git 修改仍由获得用户授权的 Host 负责。

`$HOME/.dev-flow/config.json` 只读提供 Codex 与 DeepSeek 各自的 `codebase_memory` 布尔偏好。
配置不存在时默认关闭；配置和索引能力不进入 Task、repository binding、Recovery 或流程权威。

## 产品组成

| 产品 | 职责 | 当前版本 |
| --- | --- | --- |
| Core | 状态图、Task、Store、Recovery、MCP | `0.5.1` |
| Codex | Codex Plugin、Skill、注册生命周期和 bundled Core | `0.5.3` |
| DeepSeek | DSH bundle、Skill、guard、MCP child 和 bundled Core | `0.5.2` |

三个产品独立版本化。Host 包记录实际 bundled Core 版本，不要求两个产品使用同一版本号。

## 产品保证

- 当前 Task、节点、合法流转、恢复分类和终态只有一个 Core 权威；
- Task 保存不可变原始意图，实质 requirements 或 design 变化会失效下游旧 authority；
- 每个 Task 携带 verification budget，验证范围必须与当前节点、改动、验收条件或恢复风险直接相关；
- mutation 使用 revision、action identity、source cursor 与 repository binding；
- 一个 Task 的一至八个显式仓库共享同一 Action、revision、verification budget、Recovery、Blocker
  和 Outcome；
- 不确定 mutation 必须先读取，再选择恢复或重试；
- repository-changing refactor 必须重新经过 `TEST`；
- `DELIVERY` 需要当前测试证据和当前开发者理解证据；
- Core 只读观察 Git，不提供 shell 或 Git mutation；
- 不兼容 SQLite 数据在开放写能力前被拒绝，并保持零写入；
- Codex 和 DeepSeek 的公开支持分别由对应 registry-package lifecycle evidence 建立。

## 当前产品边界

当前产品聚焦一个本地 Host，以及由一个主仓库和零至七个显式附加仓库组成的有界 Repository
Scope。每个参与仓库最多被一个活动 Task claim；单仓库调用继续使用普通相对路径，多仓库路径使用
`<repository-key>::<repository-relative-path>`。产品尚未提供：

- 用户自定义 graph、workflow DSL、graph editor 或 plugin framework；
- Web UI、remote MCP、HTTP/SSE、authentication 或 telemetry；
- 通用 shell、自动 Git 修复、commit、push、merge、rebase 或发布；
- 自动发现或动态修改 Repository Scope、多仓库并行节点、subtasks 或自动跨 Host takeover；
- 自动多仓库编排、跨仓库 Git 事务或仓库级独立流程状态；
- pre-graph Task migration、legacy snapshot decoder 或兼容 runtime；
- Core 内安装、执行或解析 Spec Kit/OpenSpec。

这些边界保持当前过程图确定、可解释和可验证。未来能力只有在真实用户价值和独立规格成立后进入
路线图。

## 当前公开状态

Codex 当前版本 `0.5.3` 已发布到 npm，并使用 `codex-v0.5.3` GitHub Release。
DeepSeek 当前版本 `0.5.2` 已发布到 npm，并使用 `deepseek-v0.5.2` GitHub Release。
两个 Host 产品分别打包支持表记录的 Core 精确身份，公开支持 macOS arm64 与 Node.js `>=24`。

精确平台、Host 版本、Journey 结论和 Release 入口见
[Support Matrix](SUPPORT-MATRIX.md)。精确产品行为由当前代码、机器可读 Schema 和可执行测试
定义。
