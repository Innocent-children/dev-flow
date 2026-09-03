# Dev Flow 工作树优先任务生命周期改造计划

## 计划状态

本计划定义一次完整、破坏性的产品改造。实现不得把准入评估、工作树创建、仓库观察、Task
生命周期、Codex、DeepSeek、WebUI、测试或文档拆成可独立发布的中间能力。只有本文定义的全部
行为和真实 Host Journey 通过后，改造才算完成。

本文描述目标行为，不代表当前产品已经具备这些能力。当前实现仍以源码、机器可读 Schema、
package manifest 和可执行测试为准。

## 用户事件

开发者把 Codex 或 DeepSeek 用于一个需要多轮实现和验证的需求。Dev Flow 当前先把 Task 绑定到
用户正在使用的 checkout；在 Action 执行期间，只要同一工作区出现另一个工具、用户或进程产生的
Git 可见改动，提交就可能返回 REPOSITORY_DRIFT。用户已经完成的工作无法原地继续，只能恢复整个
工作区或停止。

另一方面，小型机械修改也可能被 Codex 隐式送入完整 Dev Flow 流程。用户在尚未看到实际影响面
之前，就承担了需求、设计、任务拆分、验证和交付的流程成本。

## 当前做法

当前 Codex Skill 对有界实现、缺陷修复、重构和定向测试可以隐式启用，并在握手后直接调用
dev_flow_open_task。只有新请求先遇到 ACTIVE_TASK_CONFLICT，Codex 才尝试创建另一个 worktree
task；该任务从项目默认分支的已提交状态开始，用户不能在创建前确认 remote、base branch 和
target branch。

当前 DeepSeek Skill 只能由当前用户消息中的 /dev-flow 显式启用。DSH Workspace Root 在进程启动
时固定，插件没有等价的 worktree-backed task 或会话迁移能力。

Core 的 RepositoryBinding 同时保存仓库位置、branch、HEAD、整个 dirty worktree fingerprint 和
changed paths。Action 提交要求签发时的 dirty paths 加上 Host 声明的 changed_paths，必须等于
提交时观察到的全部 dirty paths。该模型能发现额外路径，却不能确认修改者；同一路径原本已经
dirty 时，它也不能可靠区分后续内容由谁修改。

## 最终决定

1. 每个新开发请求都先完成只读改动量评估，再由用户决定是否使用 Dev Flow。
2. 新请求即使包含精确 selector，也不能跳过评估后的用户确认；明确恢复已有 Task 是唯一例外。
3. 用户选择 Dev Flow 后，必须逐仓确认 remote、base branch 和新建的 target branch。
4. Host 必须成功 fetch 选定远端分支，冻结 fetch 后的 commit，再创建工作树。
5. 每个新 Dev Flow Task 只允许在干净、独立、具名任务分支的 worktree 中创建。
6. 不再保留新 Task 直接绑定共享 checkout 的产品路径，也不保留 ACTIVE_TASK_CONFLICT 后才搬家的
   旧流程。
7. Core 继续只读 Git。fetch、branch、worktree、Host task 创建和 Handoff 由 Host Adapter 负责。
8. 工作树是 Task 的修改归属边界。该工作树内所有 Git 可见变化均进入 Task 的实际修改面。
9. 文件变化由 Core 根据 Git 观察计算；Host 不再自报 changed_paths 或 no_file_changes。
10. Core 继续保存唯一 Task 状态；工作树问题复用 BLOCKED，不建立第二套业务状态机。
11. 普通 Task 节点和业务流转保持不变；本次只改变 Task 创建前流程、仓库状态模型、Blocker、
    relocation、取消和终态工作树处理。
12. 当前旧 Schema、共享 checkout Task 和对应兼容行为直接移除，不增加迁移、fallback 或兼容分支。

## 用户可见的完整流程

### 新请求

1. Host 判断当前消息是新开发请求、明确恢复请求还是并行批次。
2. 新请求只读检查用户要求、仓库规则、候选实现、调用关系、测试、配置和 Git 状态。
3. Host 展示改动级别、已找到的影响面、未知项和是否建议使用 Dev Flow，然后停止。
4. 用户选择直接开发时，Host 退出 Dev Flow；此时没有 Dev Flow tool call、Task、claim、Git 写入或
   provisioning receipt。
5. 用户选择 Dev Flow 时，Host 展示每个仓库的 remote、base branch、target branch 和当前 checkout
   的 dirty 状态，并要求确认。
6. 确认后 Host 逐仓完成预检和精确 fetch，冻结每个 base commit。
7. Host 为全部参与仓库创建隔离 worktree 和 target branch，并验证实际结果。
8. 如果 fetch 后代码使评估结论或范围发生实质变化，Host 在 Core Task 创建前重新展示评估并再次
   确认。
9. 所有仓库验证通过后，目标 Host 会话才执行 Core handshake 和 dev_flow_open_task。
10. Core 从最终 worktree 建立 WorkspaceOrigin 和初始 RepositoryBinding，创建 REQUIREMENTS Action。

### 明确恢复

明确恢复已有 Task 时不重新评估、不创建替代工作树，也不重新选择 profile。Host 回到该 Task 绑定的
原 worktree，Core 观察同一实例后返回当前 Task 和 Action。

原 worktree 不存在或已被替换时，恢复进入 WORKSPACE_UNAVAILABLE。系统不得在同一路径重新创建
目录并把它当成原实例，也不得从同名 branch 猜测未提交内容。

### 并行批次

并行批次先逐项评估，用户一次确认哪些项目使用 Dev Flow，并为每个被选中的项目确认唯一 target
branch。每个独立项目拥有一个 Host task、一个 worktree、一个 Core Task。共享目录 sub-agent
不能替代隔离工作树，也不创建一个父 Core Task。

### 多仓库 Task

一个 Task 包含多个仓库时，每个仓库都必须分别确认 remote、base branch 和 target branch，并全部
完成 fetch、worktree 创建、授权和验证后，才能一次性创建 Core Task。只隔离 primary、继续共享
additional repositories 的请求必须拒绝。

Host 无法为全部 roots 建立和授权隔离工作树时，整个 Dev Flow 请求不可用；不能部分创建、缩小
Repository Scope 或退回共享 checkout。

## 改动量评估

### 职责

改动量评估属于 Host 的代码理解职责。Core 不成为语言相关的工时或复杂度估算器，也不增加
ADMISSION 节点。评估结果帮助用户决定是否承担 Dev Flow 流程成本，不决定业务状态。

### 允许的检查

- 读取用户请求、AGENTS、CONTRIBUTING、PRODUCT 和直接相关技术文档；
- 只读 Git inspection；
- 查询候选符号、调用方、依赖、测试和 package manifest；
- 使用已经可用的代码索引，索引缺失时回退到普通文件和文本搜索；
- 记录查询失败、未覆盖路径和仍然未知的影响面。

评估阶段不得修改文件、运行测试或构建、安装依赖、访问 Dev Flow Core、fetch remote、创建 branch
或 worktree。

### 输出合同

评估固定输出：

    change_level: small | standard | large | uncertain
    observed_repositories
    candidate_components
    candidate_paths
    public_contract_flags
    persistence_or_state_flags
    host_or_platform_flags
    verification_shape
    unknowns
    recommendation: direct | dev_flow | clarify
    reasons

candidate_paths 只是已经找到的下界，不能被描述为最终文件清单。不得预测精确 LOC、工时、缺陷概率
或承诺一轮完成。

### 判断规则

只有以下条件全部成立时才可以判为 small：

- 单仓库、单一职责；
- 目标和主要成功条件明确；
- 候选实现、调用方和测试集中在一个组件；
- 不改变公共 API、CLI、MCP、Schema、持久化、迁移或状态图；
- 不涉及 Host lifecycle、平台差异、权限、安全、构建或发布；
- 只需要少量定向检查；
- 没有独立依赖 work item、跨会话诉求或关键未知项。

任一公共合同、持久化、状态图、多仓库、多 Host、多平台、安全、并发、恢复或真实 Host Journey
变化，都不能因为文件数量少而判为 small。

无法找到真实入口、影响范围或验证方法时使用 uncertain，并先澄清或补充检查。用户始终可以覆盖
recommendation。

### 确认与失效

任何新请求，包括显式 selector 和并行批次，都必须在评估后停止并等待用户选择。已有 Task 的明确
resume 跳过该步骤。

评估绑定当前 request、canonical repository root、HEAD 和 status digest。等待用户期间任一项变化，
旧评估失效，Host 必须重新检查并再次询问。

评估不写入 Core。中断发生在确认前时重新评估，不保存一个没有 Task 的业务游标。

## 工作树创建合同

### 用户必须确认的字段

每个仓库需要：

    repository_key
    remote_name
    base_branch
    target_branch

Host 可以根据当前 upstream、仓库约定和请求生成建议值，但不能把建议当成用户选择。target branch
必须通过 git check-ref-format --branch，并且不能与本地 branch、选定 remote 上的 branch 或其他
worktree 已占用 branch 冲突。

### 源 checkout

源 checkout 可以 dirty，但 staged、tracked dirty 和 untracked 内容不得复制到 Task worktree。
确认界面必须显示有界 dirty path 列表并明确说明这些内容不会进入 Task。

需求依赖这些本地内容时，用户应先自行整理并把需要的内容推送到选定 remote/base，或选择直接开发。
Dev Flow 不自动 stash、commit、reset 或搬运 patch。

### Fetch

Host 通过参数数组执行精确 fetch，不使用 shell 拼接，不执行 git pull，不 fetch 无关 remote，也不
自动 prune：

    fetch <remote> refs/heads/<base>:refs/remotes/<remote>/<base>

fetch 成功后解析并冻结 refs/remotes/<remote>/<base> 的 commit SHA。远端随后继续变化不改变当前
Task 的 base commit。

无 remote、remote branch 不存在、网络不可用或认证失败时停止。此时不得存在 target branch、
worktree 或 Core Task。

### Provisioning receipt

用户确认后、Git 写入开始前，Host Adapter 创建一个窄的 provisioning receipt：

    launch_id
    host
    request_digest
    source_repository_identity
    repository_key
    remote_name
    base_branch
    target_branch
    fetched_commit
    worktree_path
    operation_status
    created_at

receipt 不保存 remote URL、凭据、文件内容或 secret，也不保存 Task 的业务阶段。它只处理 fetch、
worktree 创建、Host task 创建的幂等性和结果不确定。

### 创建和验证

Host 从冻结 commit 创建独立 worktree，在该 worktree 创建并切换到用户确认的 target branch。
随后确认：

- canonical root 与源 checkout 不同；
- Git common dir 属于同一逻辑仓库；
- worktree-specific Git dir 是新的实例；
- HEAD 等于 fetched commit；
- branch 等于 target branch；
- tracked、index 和 worktree 状态 clean；
- 没有 dirty submodule；
- 所有 roots 已获得目标 Host 的写权限。

仅当全部验证成功时，receipt 才进入 provisioned，随后才允许 Core open_task。

### 失败补偿

确定失败时，Host 只能补偿该 receipt 明确创建、仍然 clean、HEAD 未变、没有 Core Task 且没有运行
Host 的工作树。fetch 更新的 remote-tracking ref 可以保留。branch 与 worktree 删除是两个独立动作；
branch 默认保留。

创建结果不确定、目录已经出现内容或 Host task 状态未知时，保留现场并报告，不自动重试、force、
prune 或删除。

## Core 仓库模型

### WorkspaceOrigin

ProcessTask 为每个仓库保存：

    mode: dedicated_worktree
    remote_name
    base_branch
    base_commit
    task_branch
    source_repository_group_digest
    canonical_worktree_root
    worktree_git_dir_digest
    provisioning_receipt_id

Core 在 open_task 时只读核对当前 branch、HEAD、clean 状态、remote-tracking ref、Git common dir 和
worktree-specific Git dir。Host 的文本声明不能替代这些本地事实。

### WorkspaceObservation

RepositoryBinding 拆成明确的观察部分：

    identity_digest
    history_digest
    content_digest
    current_head
    head_tree
    changed_entries
    task_surface
    observed_at
    binding_digest

identity_digest 覆盖 canonical root、Git common dir、worktree-specific Git dir、task branch 和固定
base commit。相同路径删除后重建的工作树不得拥有相同 identity。

history_digest 描述当前 HEAD 和相对上一观察的祖先关系。

content_digest 描述 HEAD tree 加当前 index/worktree 内容。它不因为把完全相同的内容提交成 commit
而变化。

changed_entries 是有界、排序后的逐路径状态，至少包含 path、变更类型、文件模式或 gitlink 状态和
内容摘要，不保存文件正文。

task_surface 是相对 base_commit 的 committed diff 加当前 staged、unstaged 和 untracked 变化。
rename 统一按旧路径删除和新路径新增处理，使两个路径都经过范围检查。

### Action 和测试绑定

每个 Action 绑定 issuance identity、history 和 content digests。Core 根据签发观察和提交观察计算
Action delta，并根据 base_commit 计算完整 Task surface。

TestRecord 和 ComprehensionAssessment 绑定 content_digest，而不是包含 HEAD 的整体 binding digest。
仅把已经测试的内容提交成 commit 不会使测试失效；代码内容变化必须使 Test 和 Comprehension 失效。

### TaskChangedPaths

当前 TaskChangedPaths 的累计 union 改为由当前 task_surface 推导的 CurrentChangedPaths。已经恢复
到 base 内容的文件不继续阻塞交付。历史上曾经修改又恢复的路径保留在 Task events 中，不冒充当前
交付差异。

## Action 提交与文件范围

### Core 计算文件事实

从所有 Action node_result 删除 Host 提交的 changed_paths 和 no_file_changes。Host 只提交语义结果、
证据、artifact 和选择的合法 transition；Core 提交前重新观察 Git 并计算文件效果。

Requirements、Design 和 Tasks 的文件变化必须与当前节点允许的 process artifacts 相符。
Implementation 和 Refactor 的变化必须落在当前 Task Plan ExpectedPaths 或有效的一次性决定中。
Test、Comprehension 和 Delivery 中出现仓库写入时，仍按该 Action 的 allowed effects 和实际路径
判断。

### 处理规则

| 观察结果 | Core 行为 |
| --- | --- |
| 源 checkout 发生变化 | 与 Task 无关 |
| Task worktree 只出现计划内变化 | 正常记录并推进 |
| Task worktree 出现计划外路径 | 创建 file-scope Blocker |
| 同一 task branch 线性新增 commit | 按 base_commit 重新计算 Task surface |
| commit 只保存相同内容 | 内容证据保持有效 |
| commit 同时改变内容 | 使旧 Test/Comprehension 失效 |
| branch switch、detached、HEAD rewind 或未准备的历史重写 | 创建 history conflict Blocker |
| worktree 丢失或 Git dir 被替换 | WORKSPACE_UNAVAILABLE |
| 两次观察期间状态继续变化 | 返回不稳定观察，不写 Task |

专属工作树内不提供“这是外部改动，忽略它”的决定。该工作树中的 Git 可见变化属于 Task；不属于
Task 的文件应恢复。file-scope Blocker继续提供 allow_once、expand_scope 和 reject/restore：

- allow_once 返回原节点，只允许精确路径和写入意图；
- expand_scope 返回 TASKS，更新计划后重新实施和验证；
- reject/restore 要求实际状态恢复后返回原节点。

GetNextAction 和 resume 必须先观察工作树并处理变化，避免在节点提交时才第一次暴露冲突。

## Task 内的正常 Git 行为

### Commit

Core 允许 task branch 上的线性 HEAD 前进，并从 base_commit 重新计算完整 Task surface。工作区因
commit 变 clean 后，Task 仍保留实际修改路径。

Agent 无权自行 commit。只有当前用户明确授权后，Host 才能执行 Git 写入。

### Rebase、merge 和基线同步

Dev Flow 不自动 rebase 或 merge。用户需要更新基线时：

1. Core 创建 workspace history change Blocker并保存当前 content digest 和 task surface；
2. 用户或 Host 在明确授权下完成 Git 操作；
3. Core 重新观察 branch、base、history 和内容；
4. 内容变化时返回相应实现或测试节点；
5. 不能证明等价时保持阻塞或取消。

未经准备的 branch switch、reset、rebase、merge 或历史重写继续停止 Task。

## Handoff 和 relocation

增加一个 Core-owned prepare_task_relocation 操作：

1. prepare 把 Task 放入 BLOCKED，保存 relocation ID、source binding、base commit、content digest、
   task surface 和 resume node；
2. Host 执行 Codex Handoff 或 DeepSeek workspace 切换；
3. resolve_blocker 提交目标 repository paths 和 relocation ID；
4. Core 确认同一 Git common group、同一 base commit、等价 task surface、目标无 claim 冲突；
5. Store 在一个事务内替换 bindings 和 claims，再恢复原节点。

任何失败都保留旧 claim。Host relocation 响应不确定时读取 retained operation和实际 source/target，
禁止盲目重复 Handoff。

仅支持同机 relocation。跨机器需要传输 SQLite Task、操作记录和未提交文件，不在本次范围。

## Codex Adapter

当前 Codex Skill 中的显式并行分派和 ACTIVE_TASK_CONFLICT 后 relocation 都必须移到用户确认和
worktree provisioning 之后。新请求不得先对当前 checkout 调用 dev_flow_open_task。

Codex managed worktree 可以从用户选择的 ref 开始，但默认处于 detached HEAD；目标分支通常在
worktree 创建后建立。本改造要求 coordinator 先 fetch 并冻结 remote/base commit，再创建从该
remote ref 开始的 managed worktree task。child 的第一个仓库动作是核对 HEAD，然后创建并切换到
用户确认的 target branch，验证 clean 后才调用 Core。

不得使用 Host 的 on-missing create-branch fallback，因为它从项目默认分支创建，不能证明使用了
用户选择的 base。

Codex task 创建是异步操作。返回 clientThreadId、排队、timeout 或结果不确定时，coordinator 只读取
launch receipt和 Host task状态，禁止再次 dispatch。

在支持 managed worktree 的 Codex App 中继续使用 Host 的 snapshot、Handoff、工作树位置和
.worktreeinclude 行为，不用插件 shell 重写一套 git worktree add/remove。

Codex CLI 或其他没有 task creation capability 的 Codex surface 使用 receipt 驱动的显式 relaunch：
Host Adapter provision 工作树后输出经过实际 parser验证的进入命令，新会话消费 receipt、核对
worktree 后才 open Task。未完成 relaunch 前没有 Core Task。

## DeepSeek Adapter

DeepSeek 新请求也必须支持只读 suitability assessment。把 Skill 暴露给模型只表示它可被选择，
不能直接宣称所有普通请求都会稳定触发；该行为必须由真实 DSH Journey 证明。未带 /dev-flow 的
assessment turn不得调用任何 Dev Flow tool，现有 selector executable guard继续保护 Core 调用。

用户选择 Dev Flow 后的直接确认 turn仍需满足 DSH 的当前用户授权边界。Skill 必须显示用户需要发送
的精确确认形式，不能从历史消息推断授权。

DeepSeek Adapter 新增窄职责 WorkspaceCoordinator：

- 使用安全 argv执行 fetch和 worktree创建；
- 写入并恢复 provisioning receipt；
- 核对 Workspace Root和文件工具权限；
- 验证 base、branch、HEAD、clean状态；
- 只清理 receipt精确拥有且仍安全的资源。

DSH Workspace Root在启动时固定。安全的 sibling worktree不在当前 Root时，Coordinator不能扩大
权限继续，也不能在源仓库内部创建嵌套 worktree。它应输出经过真实 DSH parser和生命周期测试的
relaunch命令；新会话从 worktree启动、消费 receipt，再创建 Task。

若 DSH不能稳定完成 assessment或 relaunch Journey，本改造不能宣称 DeepSeek具备该能力，也不能以
Skill文案或静态fixture代替。

## 依赖、配置和特殊仓库

### Ignored配置和 secret

插件不读取、复制或持久化 .env、证书、token或其他 secret。Codex已经由用户配置的原生
.worktreeinclude可以继续生效，但 Dev Flow不扩展其内容，也不在日志中显示复制结果的值。

DeepSeek没有等价原生机制时，由用户或项目现有setup负责。缺少配置是环境准备失败，不授权回退到
共享checkout。

### Setup和依赖

只运行 Host或项目已经配置、且用户已授权的 worktree setup。setup完成后必须再次验证 tracked
工作树clean；setup修改lockfile或源码时，不创建 Core Task。

Dev Flow不自动安装依赖、预热node_modules、Maven/Gradle cache，也不管理服务端口、Docker volume
或测试数据库。工作树隔离源码文件，不是进程或基础设施沙箱。

### Submodule

clean gitlink作为主仓库的一个路径观察。dirty submodule继续拒绝。需要在submodule内开发时，用户
必须把它作为显式additional repository加入范围，并满足同样的remote/base/target/worktree合同。

### Git LFS

Dev Flow不获取或保存Git/LFS凭据，也不额外执行git lfs pull。checkout filter或对象缺失导致创建
失败时保留原始错误并且不创建 Core Task。

## 取消、终态和清理

DONE和CANCELLED只结束 Core Task并释放claims，不等于commit、push、PR、Handoff或worktree删除。

终态向用户显示：

    remote/base/base commit
    task branch/current HEAD
    worktree path
    clean/dirty
    current changed paths
    completed verification
    keep/review/handoff/cleanup actions

active、dirty、未推送、来源不明或创建结果不确定的工作树永不自动删除。worktree删除和branch删除
使用两个独立的用户授权。Codex managed worktree的snapshot和清理由Codex Host负责；DeepSeek只处理
WorkspaceCoordinator receipt精确拥有的资源。

当前CancelTask需要先观察仓库。新增dev_flow_abandon_task用于工作树确实丢失时显式终止Task并释放
claim。它要求精确host、task ID、revision和非空reason，保存最后一次已知binding，不尝试访问或
删除Git资源。

## 状态图和完整边集

普通节点与已有业务边保持：

    REQUIREMENTS -> DESIGN -> TASKS -> IMPLEMENT -> TEST
    TEST -> COMPREHENSION_REVIEW -> DELIVERY -> DONE
    DESIGN/TASKS/IMPLEMENT/TEST/COMPREHENSION_REVIEW/REFACTOR/DELIVERY
    按现有定义保留全部返工和失败边

所有normal node可以因workspace guard进入BLOCKED。BLOCKED新增并完整定义：

| Blocker cause | 解除条件 | 目标 |
| --- | --- | --- |
| file_scope_decision + allow_once | exact action/path/intent且worktree仍匹配 | resume node |
| file_scope_decision + expand_scope | 保存决定并使下游记录失效 | TASKS |
| file_scope_decision + reject/restore | 被拒路径恢复且binding重新观察成功 | resume node |
| workspace_history_conflict | branch/base/history满足retained condition | resume node或相应重做节点 |
| task_relocation_pending | destination满足group/base/surface/claim条件 | resume node |
| recovery partial/conflicting | 保留当前五分类恢复规则 | retained resume node |
| verification brake | 保留当前一次性retry规则 | retained resume node |

WORKSPACE_UNAVAILABLE无法通过普通resolve伪造恢复。用户只能恢复原worktree实例，或调用
dev_flow_abandon_task进入CANCELLED。

DONE和CANCELLED继续是终态。任何workspace处理都不能直接产生DONE。

## 公共合同变化

- RepositoryBinding拆分identity、history、content和逐路径观察；
- ProcessTask增加WorkspaceOrigin和当前Task surface；
- ProcessAction绑定issuance workspace digests；
- TestRecord和ComprehensionAssessment绑定content digest；
- 删除所有node-result中的changed_paths和no_file_changes；
- 新增prepare_task_relocation和dev_flow_abandon_task；
- 扩展resolve_blocker的relocation和history payload；
- 增加结构化WORKSPACE_UNAVAILABLE、WORKSPACE_HISTORY_CONFLICT、
  WORKTREE_PROVISIONING_REQUIRED等错误；
- MCP catalog、annotations、closed schemas和fixtures同步；
- 当前SQLite Schema整体替换；
- process definition digest更新；
- 当前Repository claim改为worktree instance identity；
- WebUI增加workspace origin、provisioning、history conflict、relocation和cleanup展示；
- 删除共享checkout新Task、dirty baseline和post-conflict relocation实现、测试与文档。

当前CORE_VERSION为0.6.5。若从该基线实施，本次破坏性0.x合同变化把CORE_VERSION更新为0.7.0。
Codex、DeepSeek和统一lifecycle package的发布版本仍由独立发布流程选择，不在普通功能改造中发布。

## 主要实现位置

Core：

- internal/domain/repository.go
- internal/domain/task.go
- internal/domain/blocker.go
- internal/domain/operation.go
- internal/repository/
- internal/application/open_task.go
- internal/application/apply_action.go
- internal/application/get_task.go
- internal/application/cancel_task.go
- 新的relocation和abandon application service
- internal/recovery/
- internal/workflow/
- internal/store/schema.go、codec、claims和operation journal
- internal/mcp/
- internal/webui/
- protocol/fixtures/
- CORE_VERSION

Codex：

- packages/codex/plugin/skills/dev-flow/SKILL.md
- packages/codex/plugin/skills/dev-flow/agents/openai.yaml
- packages/codex/plugin/.codex-plugin/plugin.json
- packages/codex/lib/lifecycle.mjs
- worktree launch receipt与Host task协调模块
- skill、lifecycle、launcher、package和真实Host Journey测试

DeepSeek：

- packages/deepseek/skills/dev-flow/SKILL.md
- packages/deepseek/lib/index.mjs
- packages/deepseek/lib/authorization.mjs
- 新的WorkspaceCoordinator和receipt模块
- integration、authorization、lifecycle、package 和真实 DSH Journey 测试

文档：

- 全部九个root README locale
- docs/PRODUCT.md和docs/PRODUCT_en.md
- docs/ARCHITECTURE.md和docs/ARCHITECTURE_en.md
- docs/COMMANDS.md和docs/COMMANDS_en.md
- docs/SUPPORT-MATRIX.md和docs/SUPPORT-MATRIX_en.md
- docs/PROJECT-STATUS.md和docs/PROJECT-STATUS_en.md
- docs/ROADMAP.md和docs/ROADMAP_en.md
- packages/codex/README.md
- packages/deepseek/README.md
- internal/README.md和internal/README_en.md
- MANIFEST.md和MANIFEST_en.md

实现完成后本文可以随同实现删除；交付后的长期文档只描述已经实现的当前行为。

## 失败处理

| 失败点 | 必须结果 |
| --- | --- |
| assessment不完整 | uncertain，零Core/Git写入 |
| 用户选择direct | 零Task、零claim、零worktree |
| remote或base不存在 | 无target branch、worktree、Task |
| fetch认证、网络或timeout失败 | 无target branch、worktree、Task |
| target branch非法、已存在或被占用 | 创建前停止 |
| source checkout dirty | 原样保留且不复制 |
| Codex Host task queued | 记录一次dispatch，不重试 |
| worktree创建确定失败 | 仅补偿可证明安全的本次资源 |
| worktree创建不确定 | 保留现场并读取receipt/Host状态 |
| setup修改tracked文件 | 不创建Task |
| dirty submodule或LFS checkout失败 | 不创建Task，不处理凭据 |
| 多仓库任一项失败 | 无部分Core Task；不删除不确定资源 |
| Task worktree额外路径 | file-scope Blocker |
| commit后内容相同 | 测试仍有效 |
| commit后内容变化 | 测试和理解确认失效 |
| branch切换、rewind、rewrite | history conflict Blocker |
| relocation失败 | 旧binding和claims保留 |
| active worktree丢失 | 恢复原实例或显式abandon |
| terminal cleanup失败 | Task仍保持terminal，worktree保留 |

## 验收

### 准入

1. 单文件内部机械修改被判为small，第一次回复后Core调用数和Task数均为零。
2. 单文件公共API、Schema、状态图或安全变化不能判为small。
3. 多仓库、跨package、多Host或影响不明的请求建议Dev Flow或clarify。
4. 显式selector的新请求仍先评估和询问；明确resume不重复评估。
5. request、HEAD或status变化会使旧评估失效。
6. 并行批次在用户确认前没有child dispatch。

### Provisioning

7. clean feature请求从用户确认remote/base的最新fetched SHA创建target branch和worktree。
8. dirty source中的staged、unstaged和untracked内容均不进入child。
9. fetch失败、分支冲突和无效名字均不留下Core Task。
10. Codex queued或响应不确定只产生一次dispatch。
11. child branch初始化失败时不创建Core Task。
12. DeepSeek在Workspace Root外不会扩大权限或创建嵌套worktree。
13. 多仓库全部成功后只创建一个Task；任一失败时没有部分claims。

### Core和漂移

14. 原checkout后续任意变化不改变Task binding。
15. Core能从base commit、commits和worktree计算当前Task surface。
16. Host payload不再包含changed_paths/no_file_changes。
17. 计划外路径进入file-scope Blocker，不能静默忽略。
18. 同branch线性commit后Task继续，修改路径不丢失。
19. 仅commit相同内容不使测试失效；内容变化必须使测试失效。
20. branch切换、HEAD rewind、history rewrite和worktree替换分别得到明确原因。
21. GetNextAction和resume在实际工作前暴露workspace问题。

### Handoff、终态和恢复

22. 同机Codex Local与managed worktree之间的relocation原子替换binding和claims。
23. relocation响应丢失时不会重复Handoff。
24. DONE和CANCELLED只释放claims，不删除branch或worktree。
25. active、dirty、未推送或状态不确定的worktree不会自动清理。
26. worktree丢失后普通cancel不伪造观察，显式abandon可以释放claim。
27. Core/Host重启后provisioning、Action recovery和relocation分别从各自receipt恢复。

### 真实Host Journey

28. Codex macOS稳定Journey覆盖：评估、确认、fetch、managed worktree、target branch、open、修改、
    commit、测试、DONE、Handoff和cleanup。
29. DeepSeek真实Journey覆盖：普通请求assessment、显式确认、fetch、WorkspaceCoordinator、
    relaunch、open、修改、测试、DONE和cleanup。
30. Windows源码能力使用Windows本机Journey验证；fixture和静态测试不得扩大支持声明。

### 文档和交付

31. 所有用户可见文档族和九个root README同步。
32. docs/COMMANDS中的每个新命令与实际parser一致。
33. MCP tool catalog、fixtures、Codex和DeepSeek package contracts完全一致。
34. 删除被新设计取代的共享checkout、dirty baseline、Host changed_paths和post-conflict relocation测试。
35. 所有定向Core、Host、contract和journey检查通过后才报告merge-ready。

## 明确不做

- Core执行fetch、worktree、commit、stash、reset、rebase、merge、push、Tag、PR或发布；
- 自动管理Git、SSH、npm或LFS凭据；
- 自动复制.env、证书、token、私有配置或源checkout的untracked内容；
- 自动安装依赖、预热项目缓存、分配端口或隔离数据库、Docker volume和外部服务；
- 把worktree描述成文件系统、进程或网络安全沙箱；
- 跨机器Task relocation；
- 本地无remote或离线仓库的新Dev Flow Task；
- 历史Task Schema迁移、旧路径fallback或共享checkout兼容模式；
- Task完成时自动commit、push、merge、创建PR或删除工作树。

## 交付判断

本改造直接改善长时任务的可信继续：小任务可以退出流程；采用Dev Flow的任务从用户确认的最新远端
commit开始，并在独立工作树中运行。Core能够从Git事实确定当前修改面、内容是否变化和证据是否仍然
适用，不再把修改归属建立在Agent自报路径上。

误放行可能让任务在错误分支、错误代码或未验证内容上继续；因此remote/base/target、fetched commit、
worktree实例、内容摘要和relocation都必须绑定并复核。误阻塞会增加用户操作；因此普通commit、
原checkout并行修改和只改变Git历史但不改变内容的行为必须能够继续。

只有本文全部验收成立，并完成真实Codex与DeepSeek Journey，才算达到用户可见结果。
