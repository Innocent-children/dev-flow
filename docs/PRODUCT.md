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

macOS arm64 的本地开发包提供桌面宠物，需要至少一个已配置的 Codex 或 DeepSeek Adapter。
`dev-flow pet start` 开启，`dev-flow pet stop` 关闭；它展示所选 Task 已保存的阶段和阻塞信息，点击
打开对应 WebUI。宠物只读任务，Core 继续决定流程状态；阶段不代表 Host 实时活动，也不计算完成比例。
菜单支持选择任务、动画开关和隐藏/显示，退出保留任务与 WebUI。
当前交付以功能可用为准，沿用已有素材。构建、使用与本地开发包限制见[命令参考](COMMANDS.md#桌面宠物本地开发包)。

自定义形象从宠物菜单的“选择形象 → 导入形象…”导入本地文件夹，支持单张 PNG、Dev Flow 动画包和
Codex 精灵图格式 1/2 的本地宠物包。形象与任务分别选择和保存，升级保留用户素材；同 ID 重导入更新，
校验失败保留原形象。导入 Codex 时转换为统一 PNG 帧，任务阶段与跳转仍由 Dev Flow 决定。格式与示例见
[形象包说明](DESKTOP-PETS.md)。
