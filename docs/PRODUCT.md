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

mutation 响应缺失、取消、截断或损坏时，直接重放可能造成二次副作用。Host 通过当前 Action 指定的
提交工具发送 Task ID、Action ID 和节点结果；Design、Tasks 与 Implementation 结果分别省略
`requirements_revision`、`design_revision` 与 `task_plan_revision`。Core 先确认当前 Action 身份，再从
同一 Task 快照填充这三个系统状态字段，并补齐完整 identity、artifact role、method step 与 payload
envelope，完整构造并校验下一版 Task mutation，再把规范化提交保存为独立 Action 操作记录。
Task、Event、Claim 与操作记录的 applied revision 在同一事务提交。Recovery 直接读取这份操作记录，
调用方不再保存或重建原始 payload，Task snapshot 也不再携带恢复 payload。Delivery 节点提交只报告
Host 负责的交付判断、风险和新发现；acceptance、当前自动/人工 evidence ID 以及 Test/Comprehension
record ID 不进入提交合同，由 Core 从同一 Task 快照补齐。提交这些 Core-owned 字段会按
`unknown_member` 拒绝。

在保存提交前，Core 先按提交契约递归检查必填字段，再按内部完整契约和当前 Task 预检节点结果。
可从 Core 当前结果唯一确定的 system-state revision 由 Core 补齐；Delivery authority 字段不允许调用方
提交。节点提交中已证明零写入的 `required_member_missing` 可以按准确路径修正
一次，但修正内容必须来自当前节点工作已经确认的事实；需要新的用户决定时，Host 必须停止并请求
输入。其他无法安全推导的错误只返回字段信息，不提供自动纠正授权；被拒绝的输入不会进入可恢复
操作记录，也不会转入不确定 mutation Recovery。

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

任务、可恢复 Action 操作、事件、证据和 repository claim 保存在本地 SQLite。一个 Task 可以拥有
一个主仓库和最多七个显式附加仓库；Scope 创建后不可变，全部仓库共享同一流程状态。Core 按主仓优先、附加仓库 key
排序的顺序读取各仓库的 canonical identity、branch、HEAD、index/worktree 和有界 changed paths；
Git 修改仍由获得用户授权的 Host 负责。

`GitCommonDirDigest` 只用于识别同一 Git common directory 下的 linked worktree 组；包含 canonical
root 的 `RepositoryIdentity` 继续表示一个实际 worktree，也是 repository claim 的排他键。因此同一
逻辑 Git 仓库可以在不同 worktree 中同时运行多个独立 Task，但同一个 worktree 仍最多有一个活动 Task。

`$HOME/.dev-flow/config.json` 只读提供 Codex 与 DeepSeek 各自的 `codebase_memory` 布尔偏好。
配置不存在时默认关闭；配置和索引能力不进入 Task、repository binding、Recovery 或流程权威。

### Codex Setup 开箱体验

`dev-flow-codex setup` 在配置缺失时创建安全的完整默认配置，保留既有配置，并展示本次直接创建或
更新的配置与 registration receipt。交互式结果使用 Dev Flow 自有简中/英文品牌首屏；非交互输出
使用纯文本，`setup --json` 提供同一文件事实。该体验属于 Codex Host lifecycle，不改变 Core、Task
或 DeepSeek。

### 统一 Adapter 生命周期

`@imotong/dev-flow` 在源码中提供一个 Host 无关的 `dev-flow` 入口，覆盖 Codex 与 DeepSeek Adapter 的状态、诊断、安装、
升级、修复、保留数据重装、卸载、恢复出厂状态和清空后重装。它调用 Codex setup/remove/status 与
DSH 公开 lifecycle，不复制 Core 或 Host 注册权威。普通维护保留用户配置和 Task 数据；恢复出厂
状态要求绑定当前计划的强确认，默认把精确数据目标移动到 macOS Trash。Codex 全局 package 的安装
状态与 receipt、Plugin 注册状态分别判断，注册已缺失时仍能通过卸载或恢复出厂操作清理 package。
交互菜单、确认提示、计划和结果读取当前 locale：`zh*` 使用简体中文，其余 locale 统一使用英文；JSON
输出保持语言无关。安装、升级、修复和重装的文本输出会在执行期间逐项显示当前 Host 动作，以及驱动已确认完成的
package、注册、制品和就绪检查步骤；JSON 模式不混入进度文本。公共 launcher 从已安装 Adapter 的 receipt 中选择最新可用 Core，只转发闭合的
`webui` 命令，不保存第二份 Core 或流程状态。`webui start` 可按 `0700` 创建缺失的产品默认数据目录；
显式数据目录必须预先存在，其余 WebUI 命令保持零写入。平台与安装要求见 Support Matrix。

## 产品组成

当前源码还提供嵌入 Core 的本机 Control Center：统一浏览所有 Host 的 Task，展示时间线、流程图、Action、
Recovery 与 Blocker，并执行 Task 生命周期操作。`dev-flow webui start|open|status|stop` 管理一个共享
loopback 实例；界面支持简体中文/英文、首次按系统语言选择并将手工选择仅保存在浏览器。旧 Task 数据只通过 CLI-only、目标绑定且需要数据库独占访问的 `reset` 清理。浏览器不提供
远程访问、账号、权限、shell、Git 写入或 reset mutation。

| 产品 | 职责 |
| --- | --- |
| Core | 状态图、Task、Store、Recovery、MCP |
| Codex | Codex Plugin、Skill、注册生命周期和 bundled Core |
| DeepSeek | DSH bundle、Skill、guard、MCP child 和 bundled Core |
| Dev Flow CLI | Host 无关的 Adapter 生命周期编排、公共 WebUI launcher 与恢复 |

四个产品独立版本化。Host 包记录实际 bundled Core 版本，不要求各产品使用同一版本号。

## 产品保证

- 当前 Task、节点、合法流转、恢复分类和终态只有一个 Core 权威；
- Task 保存不可变原始意图，实质 requirements 或 design 变化会失效下游旧 authority；
- 每个 Task 携带 verification budget，验证范围必须与当前节点、改动、验收条件或恢复风险直接相关；
- mutation 使用 revision、action identity、source cursor 与 repository binding；
- Host 只提交当前 Action 的结果，Core 负责补齐并保存完整 mutation 输入；
- Core 在保存可恢复 Action 操作前完整构造并校验下一版 Task mutation；Task、Event、Claim 与
  操作记录的 applied revision 原子提交；
- 允许写入的 Action result 提交相对当前 Action 签发状态新产生的精确 `changed_paths`，或本节点未改文件时提交 `no_file_changes`；Core 验证签发基线、
  `allowed_effects` 和 fresh observation，artifact references 不代替 mutation envelope；
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
Scope。每个参与 worktree identity 最多被一个活动 Task claim；同一 Git common directory 下的
不同 linked worktree 可以分别运行活动 Task。单仓库调用继续使用普通相对路径，多仓库路径使用
`<repository-key>::<repository-relative-path>`。产品尚未提供：

- 用户自定义 graph、workflow DSL、graph editor 或 plugin framework；
- 远程 Web UI、remote MCP、通用 HTTP/SSE transport、authentication 或 telemetry；
- 通用 shell、自动 Git 修复、commit、push、merge、rebase 或发布；
- 自动发现或动态修改 Repository Scope、多仓库并行节点、subtasks 或自动跨 Host takeover；
- 自动多仓库编排、跨仓库 Git 事务或仓库级独立流程状态；
- pre-graph Task migration、legacy snapshot decoder 或兼容 runtime；
- Core 内安装、执行或解析 Spec Kit/OpenSpec。

这些边界保持当前过程图确定、可解释和可验证。未来能力只有在真实用户价值和独立规格成立后进入
路线图。

## 当前公开状态

维护者发布 npm 产品时，通过 GitHub Actions 手工运行 `publish-npm` 工作流。工作流在 ARM64 macOS
runner 上调用现有 standalone release command，执行固定的发布检查、精确版本确认和 npm/Tag/
GitHub Release 回读。npm 发布通过绑定该 workflow 的 Trusted
Publisher 和短期 OIDC 凭据完成，不保存长期 npm 发布 token。该自动化属于仓库发布工具，不进入
Go Core，也不改变 Task 或 Host Adapter 的产品职责。

Codex 与 DeepSeek Adapter 已发布到 npm。两个 Host 产品分别打包自己的 Core，公开支持 macOS arm64
与 Node.js `>=24`。

精确平台、Host 版本、Journey 结论和 Release 入口见
[Support Matrix](SUPPORT-MATRIX.md)。精确产品行为由当前代码、机器可读 Schema 和可执行测试
定义。

## Codex 智能启用

Codex Plugin 允许 Host 为边界明确的实现、缺陷修复、重构、定向测试和开发交付请求隐式选择
Dev Flow；`$dev-flow-codex:dev-flow` 保留为精确强制入口。仅解释、仅状态查询、方案讨论、普通问答
和含糊请求不自动创建或恢复 Task。两种入口共用同一 admission、Core Action 和授权边界，均不自动
授权 Git 变更或发布。

当用户明确要求在同一逻辑 Git 仓库并行执行两个以上彼此独立的有界任务时，Codex Plugin 先走
Host 协调路径：只有当前 Host 能为每个任务创建独立 worktree-backed task/thread 时才分派，每个
子任务再独立进入普通 Dev Flow admission。协调者不创建父 Core Task，也不调用 Dev Flow MCP；共享
当前目录的 sub-agent 不属于有效隔离。能力不可用时，Plugin 停止并提示用户分别启动独立 worktree。
