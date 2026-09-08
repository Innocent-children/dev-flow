# Dev Flow 产品定义

[中文](PRODUCT.md) | [English](PRODUCT_en.md)

## 一句话定位

> Dev Flow 先帮助开发者判断一个请求是否值得进入完整流程；采用 Dev Flow 的新 Task 从用户确认的
> 远端基线进入独立工作树，并由 Core 持续核对实际改动、分析后形成的验证计划和当前进度。

Codex 或 DeepSeek 仍然读代码、改文件和运行命令。Dev Flow 保存唯一 Task 状态；验证投入需要先随
Task Plan 建立，后续扩大必须记录具体的新影响、风险、失败或缺口。范围扩大、无计划的验证结果、
结果过期、工作树历史冲突或操作结果不确定时，Core 拒绝流转或暂停。

## 目标用户和要完成的工作

Dev Flow 面向把 Codex 或 DeepSeek 用于真实代码库、且一个任务可能持续多个会话或多天的开发者。
它适合需要明确文件范围、限制测试投入、保留中断恢复能力，并且不希望共享 checkout 中的其他改动
干扰当前任务的人。

用户可以：

- 在创建 Task 前查看只读改动量评估，并选择直接开发、使用 Dev Flow 或先澄清；
- 为每个仓库确认 remote、base branch 和新的 target branch；
- 从 fetch 后冻结的 base commit 创建干净、独立、具名分支的工作树；
- 保留目标、验收条件、范围外事项和预计路径，并在任务分析完成后保存验证计划与初始预算；
- 在预算不足时保存具体依据、原因、新增检查、增加量和调整后预算，再继续 TEST；
- 让 Core 从 Git 计算当前改动，而不是依赖 Agent 自报路径；
- 对计划外路径选择单次允许、修改计划或恢复文件；
- 允许 task branch 上的正常线性 commit，同时阻止 branch switch、rewind 和未准备的历史重写；
- 在内容变化后让旧测试和理解确认失效，在只提交相同内容时保留它们；
- 在结果不确定时先读取保存的操作，再决定恢复或重试；
- 在同机 Host 交接后继续同一个 Task；
- 让 Host 对每次完整套件、测试文件修改和修改后复核重新判断必要范围；
- 在工作树丢失时显式放弃 Task，并在终态分别决定是否保留、交接或清理工作树和分支。

## 主要要解决的问题

旧流程先把新 Task 绑定到用户正在使用的 checkout。另一个工具、进程或用户产生的 Git 可见变化
会让当前 Task 漂移；而 Agent 自报的文件路径既不能证明修改者，也不能可靠区分同一路径后续发生的
内容变化。

当前流程把工作树作为修改归属边界。新请求先经过只读评估；用户选择 Dev Flow 后，Host 取得明确的
remote/base/target 确认，精确 fetch 远端分支，冻结 commit，并在独立工作树中创建 Task。源 checkout
后续变化与 Task 无关；Task 工作树里的全部 Git 可见变化都属于这个 Task。

Codex 原会话在启动开发会话前整理本次需求的完整相关讨论，保存原始消息、确定要求、术语、范围限制、代码调查、工作要求，以及未采纳建议、假设和待确定问题。桌面任务与 CLI 启动使用同一份保存材料；较长内容通过完整文件传递。用户已有的开发和工作树确认继续有效，不额外要求确认交接摘要。材料整理与发送由 Codex Host 负责，Core 继续决定 Task 状态。

## 任务处理规则

仓库调查和代码索引工具选择遵循当前用户指令及适用的 `AGENTS.md`，优先于插件的代码索引偏好。
用户规则要求检查项目索引时，Host 在创建 Task 前只读检查索引、候选项目说明、相关代码与配置，
形成完整候选范围。每个仓库都经过确认和工作树准备后，范围固定到 Task；调查遵守现有 Host 权限。

| 用户事件 | 产品行为 |
| --- | --- |
| 新请求可能很小 | Host 只读检查影响面并停止等待选择；确认前没有 Core 调用、Task、Git 写入或 child dispatch |
| 用户选择 Dev Flow | Host 显示并确认 remote/base/target 与源 checkout dirty 状态，随后 fetch、冻结 commit、创建并验证专属工作树 |
| Task 工作树发生变化 | Core 计算 identity、history、content、Action delta 和相对 base 的当前 Task surface |
| 改动离开计划 | 受支持的结构化写入先询问；其他写入由下一次观察发现，未说明路径不能继续测试或交付 |
| TASKS 完成分析 | 保存计划检查及理由、初始自动命令预算、完整套件预期和测试代码预期 |
| 预算不足 | TEST 要求调整使用允许的原因类别，并说明具体原因和必要增加量，保存后留在 TEST 继续 |
| 准备完整测试 | Host 每次重新判断广泛影响、定向检查是否足够、待补风险和仓库检查点要求；预算充足不是理由 |
| 测试重复 | 第三次精确重复时暂停 |
| 修改后复核 | 只检查当前 diff、因果影响和验收所需路径，交付只报告相关问题；修复后只做相关定向复核 |
| 旧结果不再适用 | 内容变化使旧 Test/Comprehension 失效；只把相同内容提交成 commit 不会失效 |
| 工作树历史异常 | branch switch、detach、rewind、rewrite 或工作树实例替换进入明确 blocker 或 unavailable 状态 |
| Host 交接 | Core 先准备 relocation blocker；Host 只执行一次 handoff；目标验证通过后原子替换 binding 与 claims |
| 工作树丢失 | 普通 cancel 不伪造观察；显式 abandon 保存最后已知状态并释放 claim |

## 当前产品承诺

当前源码承诺：

- 每个新 Task 只在用户确认后建立在干净、独立、具名任务分支的工作树中；
- 新请求、显式 selector 和并行批次都先评估并等待用户选择；明确 resume 是唯一跳过评估的路径；
- 源 checkout 的 staged、unstaged 和 untracked 内容不会进入 Task 工作树；
- 多仓库 Task 只有在所有仓库都完成 fetch、隔离、授权和验证后才一次创建；
- Core 只读观察 Git，并保存 WorkspaceOrigin、当前观察、Task surface、Action、记录、blocker 和 outcome；
- Task 创建时不冻结最终测试预算；TASKS 保存初始验证计划，Evidence 按当前 Task Plan revision 计费；
- TEST 可以通过 `verification_budget_increased` 自循环保存有理由的预算增加，而不是因额度耗尽直接结束；
- Host 只提交当前节点的语义结论；Core 从 Git 计算文件效果与当前路径；
- 计划外路径、工作树历史冲突、验证刹车和 Recovery 都复用一个 Core Task 与 `BLOCKED`；
- 正常线性 commit 不丢失实际改动记录；内容相同的 commit 不让验证记录过期；
- provisioning、Action Recovery 和 relocation 各自使用窄的可恢复记录，不形成第二个业务状态机；
- DONE 和 CANCELLED 只结束 Task 并释放 claims，不自动 commit、push、创建 PR 或删除工作树；
- Codex、DeepSeek 与本机 WebUI 读取同一份 Core 状态。

这些承诺不等于拦截 Host 的所有 shell 或文件操作，也不把工作树描述成文件系统、进程、网络或凭据
沙箱。外部写入可能先发生，Core 会在下一次观察时处理。

## 适合与不适合的任务

Dev Flow 适合跨会话、跨天或 Host 重启后继续的任务；涉及公开接口规范、Schema、状态、多个 package、
多个 Host 或复杂恢复的工作；以及需要明确改动范围、按分析结果控制验证投入、工作树隔离或同机交接的任务。少量显式
仓库可以组成一个 Task，但每个仓库都必须先完成独立 provisioning。

一次性问答、解释、状态查询和不改变公开接口规范的机械小改动通常直接使用 Host 更简单。没有可访问
remote/base 的本地仓库，以及需要跨机器交接、安全沙箱、远程执行或自动 Git 发布的工作不适用。

## 与其他工具的关系

| 工具 | 负责什么 |
| --- | --- |
| Codex / DeepSeek | 理解请求和代码、评估新请求是否适合使用 Dev Flow、执行用户确认的 Host/Git 操作、修改代码和运行检查 |
| OpenSpec / Spec Kit | 可选地组织需求、设计和任务；不决定 Core 节点或完成状态 |
| Dev Flow Core | 保存唯一 Task、观察工作树、执行范围/验证/恢复规则并决定合法下一步 |

## 任务执行流程

1. Host 对新请求做只读评估，给出 `small|standard|large|uncertain`、候选影响面、未知项和建议。评估绑定
   request、canonical root、HEAD 和 status；这些事实变化后必须重新评估。
2. 用户确认 remote/base/target 后，Host 精确 fetch 并建立专属工作树。Core 核对实际 worktree、branch、
   HEAD、base 和 clean 状态后才创建 Task。明确 resume 回到原工作树实例。
3. Core 从 base commit、commits、index、worktree 和 untracked 文件计算当前 Task surface；ExpectedPaths、
   allow-once 决定和 TASKS 中的 verification plan 控制后续流转。当前预算只统计当前 Task Plan revision，
   每次增加保存具体原因。Test 与 Comprehension 绑定内容摘要。
4. Core 保存不确定 Action、blocker、relocation 和 outcome。同机 relocation 在 Host handoff 前后保持旧 claim，
   验证目标后一次替换。终态清理需要独立授权。

## 完成条件与操作恢复

进入 TEST 前，当前 Task Plan 的全部工作项必须已经完成。DELIVERY 逐条接收明确的验收结果，每项关联已完成且对应此验收条件的工作项，以及当前 Test 中通过的检查。自动检查、静态检查、Host 观察和明确人工检查均可使用；理解确认仍单独保存，不自动代替验收检查。遗漏、错误或过期引用会使提交被拒绝。

WebUI 与 MCP 共用 Core 的语义提交、操作保存和恢复流程。Core 保存规范化载荷，页面只提交当前 Task revision、Action ID 和语义结果。网络异常先回读 Core；页面重新打开后仍能发现待恢复操作，并按 Action ID 恢复。无效完成结果不会推进任务或保存操作。

## 明确非目标

Dev Flow 不做通用 Agent 或 workflow DSL；Core 不执行 fetch、branch、worktree、commit、stash、reset、
merge、rebase、push、tag、PR 或 publish；系统不复制 `.env`、证书、token、ignored/untracked 文件或
凭据，不自动安装依赖或隔离端口、数据库、Docker volume 和外部服务，也不自动清理 active、dirty、
未推送、来源不明或结果不确定的工作树。跨机器 relocation、未经确认自动加入相邻仓库、部分隔离的多仓库
Task、remote MCP 和云端多用户管理也不在当前范围。

## 已验证的范围

项目提供公开 npm 包、接口规范测试，以及在实际 Codex / DeepSeek 中完成任务流程的测试记录。
每项结果只适用于它实际测试的安装包、平台和操作步骤；测试样例、静态检查或其他平台的结果不能
作为扩大稳定支持范围的理由。

Dev Flow 仍处于早期，尚未用足够外部数据证明降低缺陷率、验证成本或恢复时间。稳定支持、源码能力
和未验证内容见[项目状态](PROJECT-STATUS.md)与[支持矩阵](SUPPORT-MATRIX.md)。运行时以源码、机器可读
Schema、package manifest、CLI parser 和可执行测试为准。

## 桌面任务入口

macOS arm64 的桌面宠物通过包含 `DevFlowPet.app` 的本地开发包使用，运行时复用已配置的 Codex 或 DeepSeek Adapter 提供的 Core。
当前常规 npm 清单与正式制备流程不包含原生应用，获取方式以[桌面宠物指南](DESKTOP-PETS.md#本地构建与安装)为准。
宠物显示一个所选 Task 的保存状态并打开对应 WebUI；Core 决定任务状态，展示不代表 Host 实时活动或完成百分比。
未选中任务时，宠物持续查找新任务，优先选择最近更新的受阻任务，其次选择最近更新的进行中任务；选中后保持当前关注对象，直到手动更换。
菜单栏使用 Dev Flow 流线标识的单色图标，随系统外观调整颜色。“宠物大小”提供 50%～200% 六档缩放并保存选择，气泡文字大小保持不变。

形象可使用单张 PNG/SVG、PNG/SVG 原生动画包、Codex 标准格式 1/2 图集或 Dev Flow 高分辨率扩展。五类任务动作是基础要求，附加素材决定能否散步、挥手或思考；
只有 Codex 布局图集固定提取九类、57 帧。待机活动有独立开关，任务提示优先，自动位移保留手动摆放位置。
程序更新、已有应用副本替换和素材重导入分别处理；安装、全部动作规则与常见问题统一见[桌面宠物指南](DESKTOP-PETS.md)。

本地宠物包以独立素材目录保留默认形象，包含九类动作、312 个 SVG 帧；鲸鱼娘等自定义形象作为独立素材包，通过“导入形象…”安装。素材保存在用户目录，程序更新保留已导入形象。

## Windows 平台边界与验证

Windows 10/11 x64 面向普通 Intel、AMD 64 位桌面电脑。三个 Node 包的路径、权限、命令和清理规则分别由 `lib/platform/windows/` 与 `lib/platform/macos/` 实现，选择入口只按当前平台分派。Core 的平台中立任务语义保持共享；Windows Git 进程隐藏控制台窗口。Codex 的 `--version` 与 `status` 使用所选平台的可执行文件检查，Windows PowerShell 启动器输出 UTF-8。本次只执行 Windows 原生测试；Windows 10、AMD 实机和 macOS 未测试，稳定支持声明保持不变。详见[Windows 适配报告](WINDOWS-ADAPTATION.md)。

## Windows 桌面功能

Windows 10/11 x64 的桌面宠物提供与 macOS 对齐的任务选择与状态气泡、WebUI 跳转、托盘/右键菜单、PNG/SVG 静态和原生动画形象、Codex PNG/WebP 图集导入、九类动作、拖动、六档缩放、隐藏恢复与独立启停。Windows 使用独立 Electron 实现，macOS 保留 Swift/AppKit；两者只读取 Core 状态。Windows 本地包由 `scripts/build-desktop-pet-windows.mjs` 构建，用户数据位于 `%LOCALAPPDATA%\dev-flow\pet`。构建、安装、更新与验证见[桌面宠物指南](DESKTOP-PETS.md)。
Windows 调整大小时会结束当前待机活动，并恢复正常调度。

Windows 会将已有 AppData 目录解析为实际路径，包括打包桌面宿主提供的目录别名；仍拒绝符号链接。

当前 Windows 开发包同时包含两个 Adapter 包和桌面应用。安装统一入口包后，使用 `dev-flow install --host all --yes` 与 `dev-flow pet start`。修复、重装均通过同一入口执行，校验内置包摘要、更新桌面应用，并保留 Task 数据、设置和形象。

## 当前 DSH 接口

当前源码的 DeepSeek Adapter 要求 DSH `>=0.1.2-rc.1`。Adapter 通过 Session 的 `snapshotEvents()` 读取当前轮次和用户直接输入，核对 `/dev-flow`、工作树确认及结构化文件写入；Core 继续负责 Task 状态。

## 生命周期入口

公共 `dev-flow` 管理 Adapter 安装与维护，菜单先显示状态，确认前展示版本与资源路径。安装、修复和重装默认保留已安装版本，升级默认选择 `latest`；已满足的安装、修复、升级和移除无需重复变更，重装每次执行。诊断显示失败项目和处理命令，错误保留具体原因及已完成步骤，安装结果提示 hook 信任和 Profile 重启。JSON 模式不询问。终端交互、版本选择和安装记录由 launcher 负责，Core 继续独立拥有 Task 状态。命令参数与重复执行规则见[命令参考](COMMANDS.md#生命周期命令行为)。

`dev-flow-codex host-launch <operation>` 从 stdin 流读取最多 1 MiB 的 UTF-8 JSON 对象，支持分块输入及跨块中文字符。读取失败、非法 UTF-8、重复成员、非法 JSON、数组或 null 均在执行操作前拒绝；错误写入 stderr，成功结果以 JSON 写入 stdout。

## 文件提交准备

Codex 在普通提交前执行 `dev-flow-codex artifacts collect` 和 `dev-flow-codex artifacts prepare`，复用 Core 对当前 Action 的完整 Git 观察。Codex 只补充文件用途和说明，准备命令检查清单与当前观察一致后生成 artifact 数组。流程文件漏报返回具体路径和仅修改 artifact 字段的一次纠正指示；实际仓库异常继续按原有恢复规则处理。详见[文件收集与提交](ARTIFACTS.md)。

Codex 可通过 `dev-flow-codex --help` 和工作区操作帮助查询参数 Schema、字段来源及下一步，并从同一批已准备的工作区记录生成完整仓库参数。MCP 提供结果 Schema 和结构化返回；恢复会话先处理 Core 保存的未完成提交，再执行当前节点。创建、取消、放弃和迁移准备分别按自身标识回读结果。

`host-launch prepare` 省略 `launch_id` 时自动生成 ID，并使用该 ID 核对启动记录。重试时传入返回的 `receipt.launch_id`，继续同一次启动；记录已为 `fetched` 时跳过 fetch。显式传入的 ID 必须与保存记录一致。

`host-launch dispatch-result` 接收 Codex 创建任务的完整返回值，包括 `content[].text` 中的 JSON。它将 `clientThreadId` 保存为 `host_client_thread_id`，阶段设为 `queued`；以相同 `launch_id` 和 `repository_key` 重新提交保留的结果，可以恢复 `uncertain` 记录。后续检查继续跟踪同一次创建，不重复派发。


Codex 启动先由 `dispatch-start` 将完整 `host_request` 保存到 `receipt.operation_status.host_request`，进入 `dispatch_prepared`；重复调用和 `status` 均可回读。`dispatch-call` 使用当前 `dispatch_attempt_id` 将阶段改为 `dispatching`，仅首次返回 `should_dispatch=true` 时允许调用一次创建工具。调用方将命令完整 stdout 写入私有文件，检查退出码并从文件解析 JSON，再原样转发请求，避免显示长度限制截断内容。

确认原调用方已停止且创建工具尚未调用时，`dispatch-recover` 接收当前派发 ID、`host_call_not_made=true`、`previous_caller_stopped=true` 和具体 `reason`，保留原请求并换发调用许可 ID；随后执行 `dispatch-call`。空任务 ID 本身不能证明未调用。已经调用但结果未知时，Host 按保存的启动标题、启动 ID 和仓库标识查找任务及归档任务，读取候选任务完整初始消息，将 `candidates`（`thread_id`、`initial_prompt`）交给 `dispatch-reconcile`。唯一完整消息匹配才保存任务 ID；零匹配、多个匹配或查询不可用均不允许重新创建。Core Task 状态保持由 Core 管理。
