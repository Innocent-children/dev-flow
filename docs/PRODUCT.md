# Dev Flow 产品定义

## 用户问题

Dev Flow 面向使用 AI 或普通工具完成真实软件开发的开发者。它处理以下容易反复出现的问题：

- 开发者忘记当前开发步骤、完成条件或允许的下一步；
- AI 跳过需求、设计、任务拆分、测试或交付核对；
- 测试已经通过，但代码过度设计，开发者无法解释和维护；
- Spec Kit、OpenSpec 和 Host 自己维护流程状态，形成多个互相漂移的游标；
- mutation 中断、结果不确定或 repository drift 后，调用者不知道是重试、读取还是恢复；
- 需求、设计、任务计划和验证证据发生变化后，旧证据仍被误当作当前 authority。

## 产品能力

Dev Flow 以 Go Core 中唯一的 `standard-development@1` 状态图管理当前代任务。当前源码图有
11 个节点和 29 条正常流转：

```text
REQUIREMENTS
→ DESIGN
→ TASKS
→ IMPLEMENT
→ TEST
→ COMPREHENSION_REVIEW
→ DELIVERY
→ DONE

REFACTOR
BLOCKED
CANCELLED
```

主路径之外，Core 提供受控的需求修订、重新设计、实现返工、测试失败、理解失败、重构、
重新测试和交付拒绝循环。每个 Action 同时返回当前节点目的、进入/完成条件、允许副作用、所需
证据、semantic method steps 和完整合法出边。调用者选择 `transition_id`，Core 校验 guard 并
推导 destination。

当前能力包括：

- 单一开发过程图和当前节点导航；
- 完整合法出边、稳定 transition identity 和受控回退；
- immutable `TaskIntent` 以及 versioned requirements/design/task-plan baselines；
- verification budget、current repository binding 和有界 evidence；
- 独立的 developer comprehension gate；
- repository-changing refactor 后强制 retest；
- `plain`、`spec-kit`、`openspec` 三种 method profile；
- 五分类 graph-native recovery、read-before-retry 和 Core-owned blocker/resume；
- local SQLite persistence、CAS、restart/resume 和 terminal retained data；
- local STDIO Core Contract 0.2，公开工具数量仍为六个；
- read-only Git observation，不把 Git mutation 或通用 shell 放入 Core。

## 产品权威

Go Core 唯一管理 Task、process/node/transition/guard/destination、baselines、evidence、recovery、
blocker 和 terminal outcome。Codex Adapter 只负责显式 selector、capability admission、method
operation rendering、用户呈现、closed payload forwarding 和不确定 mutation 的 read-before-
retry。

Spec Kit 与 OpenSpec 是 method tools，不是状态机。它们的文档、checkbox、command、sync 或
archive 状态可以成为有界 evidence，但没有一个能在缺少有效 Core apply 时推进任务。工具
不可用时允许诚实执行 Core 合同定义的 plain-equivalent work。

## 可理解性门禁

`TEST` 成功只证明当前验证完成，不等于允许交付。Core 必须进入
`COMPREHENSION_REVIEW`，由开发者明确确认能解释和维护当前设计与实现。理解审查可以把任务
送回 `IMPLEMENT`、`REFACTOR`、`DESIGN`、`TEST` 或 `REQUIREMENTS`。只有 current test 和
current user comprehension evidence 同时成立，任务才可进入 `DELIVERY`。

## Recovery 与本地持久化

不确定 mutation 使用 operation identity 和原始 source/action/payload 做 probe。Core 从当前
Task、LastOperation 和一次只读 repository observation 得出 `not_started`、
`completed_and_recorded`、`completed_but_unrecorded`、`partially_completed` 或 `conflicting`，
并独自决定 retry advice、recovery apply 或 `BLOCKED`。Adapter 不做分类。

当前代持久化只接受：

```text
Schema 2
Snapshot Version 2
standard-development@1
```

Feature 008 不兼容历史 Task。Schema 1/pre-graph 数据返回 `SCHEMA_UNSUPPORTED`，全程零写入；
用户显式选择新数据目录或在 Core 外部手工 archive/rename/delete 旧目录。Core 和 package
lifecycle 都不会自动迁移、reset 或删除旧数据。

## 非目标

当前产品不提供：

- 用户自定义图、workflow DSL、graph editor 或 plugin framework；
- Web UI、remote MCP、HTTP/SSE、authentication 或 telemetry；
- 通用 shell、自动 repository repair 或任何 Core Git history mutation；
- 多仓库任务、并行节点、subtasks 或 cross-host takeover；
- historical task compatibility、Schema 1 migration、snapshot-v1 codec 或 legacy process；
- Core 内运行、安装或解析 Spec Kit/OpenSpec；
- DeepSeek 产品、真实 Journey 或公开支持声明；
- 在普通 Product Feature 中进行 version、npm、Tag 或 GitHub Release 操作。

## 当前发布

已发布的 `0.3.0`、对应 Tag/npm/GitHub Release 和 Features 001–007 是冻结历史事实。
Feature 009 将完成的 Feature 008 图运行时对齐为 `0.4.0`，公开产品限定为 macOS arm64 上的
`dev-flow-codex`。

标准安装入口是 `npm install -g dev-flow-codex@0.4.0` 后显式运行 `dev-flow-codex setup`。公开
可用性、制品摘要、实际 Codex 版本和最终 Journey 结果以 npm 与 GitHub Release `v0.4.0` 的
回读证据为准。DeepSeek 和其他平台没有公开支持声明。

精确产品合同见 [Feature 008 specification](../specs/008-refactor-to-development-process-graph/spec.md)。
当前发布合同见 [`release/README.md`](../release/README.md)；Feature 009 保留为 `0.4.0` 历史证据。
