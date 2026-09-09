<p align="center">
  <img src="https://raw.githubusercontent.com/Innocent-children/dev-flow/main/packages/webui/src/assets/dev-flow-app-icon-light.svg" width="112" height="112" alt="Dev Flow" />
</p>

# dev-flow-codex

[中文](https://github.com/Innocent-children/dev-flow/blob/main/packages/codex/README.md) |
[English](https://github.com/Innocent-children/dev-flow/blob/main/docs/CODEX_en.md)

`dev-flow-codex` 让 Codex 在独立工作树中使用一个持久 Core Task。新请求先评估、再接触 Core；用户
选择 Dev Flow 后，Task 从确认的来源、起始分支、目标分支和携带选择 开始，Core 通过只读 Git 推导当前
改动面。

## 支持范围

| 项目 | 当前支持 |
| --- | --- |
| Package | [`dev-flow-codex`](https://www.npmjs.com/package/dev-flow-codex) |
| 稳定 Platform | macOS arm64 |
| 当前源码 Platform | macOS arm64（`darwin-arm64`）；Windows 10/11 桌面 x64（`win32-x64`） |
| Node.js | `>=24` |
| Codex | `>=0.147.0` |
| Releases | [GitHub Releases](https://github.com/Innocent-children/dev-flow/releases) |

稳定支持以[支持矩阵](../../docs/SUPPORT-MATRIX.md)为准。`main` 中存在的能力不一定已经进入 npm
`@latest`。Windows Server、32 位 Windows、Windows ARM64 与 Intel Mac 不在当前源码支持范围；
launcher 会拒绝除 `darwin-arm64` 和 `win32-x64` 之外的运行时对。

## 安装

推荐使用统一 lifecycle 入口：

```bash
npm install -g @imotong/dev-flow@latest
dev-flow
```

安装向导负责安装 Codex package、注册 Plugin 和 MCP，并回读就绪状态。Host 原生命令只用于诊断或
恢复：

```bash
npm install -g dev-flow-codex@latest
dev-flow-codex setup
dev-flow-codex status --json
dev-flow-codex --version
```

`setup` 在缺少固定用户配置时创建 macOS 的 `$HOME/.dev-flow/config.json` 或 Windows 的
`%USERPROFILE%\.dev-flow\config.json`，验证 package、bundled Core 和 Codex 兼容性，再注册
marketplace、Plugin 与 MCP。桌面宠物另按本文的本地开发包说明获取与启动。默认 Task 数据在 macOS 位于 `$HOME/.dev-flow/data`，Windows 位于 `%LOCALAPPDATA%\dev-flow\data`。所有参数和机器可读输出见
[命令参考](../../docs/COMMANDS.md#codex)。

`setup` 完成后先在 Codex `/hooks` 中审核并信任 Dev Flow packaged hook；未信任时 Codex 会跳过
`apply_patch` 写前检查。

## 评估并启动一个 Task

Codex 沿用当前请求和评估下仍有效的明确选择与授权；没有待决定事项或必需输入时直接继续，不为进度说明或技能规则解释增加“确认后继续”的暂停。需要输入时，在同一回复中提出具体问题；开发方式、工作树参数、理解确认、独立操作授权及阻塞处理仍按各自规则执行。

仓库调查遵循当前用户指令和适用的 `AGENTS.md`。需要项目索引时，Codex 在现有权限内只读检查索引、
候选项目说明及相关代码与配置，形成完整候选范围，再逐仓确认并准备工作树；Task 创建后范围固定。
选择代码检索工具时，这些指令优先于 `host_preferences.codex.codebase_memory` 默认偏好。

在 Git 仓库中描述实现、缺陷修复、重构、定向测试或开发交付请求后，Codex 先只读检查候选代码、
调用关系、测试、配置、HEAD 和工作区状态，并给出 `small | standard | large | uncertain` 的改动量判断。
尚未选择时，用户选择直接开发、使用 Dev Flow 或先澄清；选择前不会调用 Core、fetch、创建 Task、branch
或 worktree。需要明确选择本 Skill 时使用精确 selector：

```text
$dev-flow-codex:dev-flow Fix idempotency in the order-creation endpoint and run targeted tests.
```

这不是 shell 命令。`$dev-flow` 不是它的别名；精确 selector 也不会跳过评估和用户选择。只解释、
只查询状态、方案讨论、普通问答和含糊请求不会创建 Task。

用户选择 Dev Flow 后，Codex 逐仓询问本地或远端来源、起始分支、目标分支，并在选择本地时询问是否
携带暂存、未暂存和非 ignored 的未跟踪内容。Host 固定起点后建立独立工作树，按选择复制内容并验证；
本地创建无需 remote 或联网，源工作区保持原样。规则与验收见[工作树来源](../../docs/WORKTREE-SOURCES.md)。

新 Task 从需求阶段开始，只保存最初请求、范围、验收条件和 method profile，不在分析前冻结最终
verification budget。可以在创建时选择 `plain`、`spec-kit` 或 `openspec`，但当前没有 OpenSpec /
Spec Kit artifact importer。

## 恢复已有 Task

明确恢复已有 Task 时不重新评估或选择 profile。回到同一个已参与的物理 worktree，在新 Codex 会话
中继续原任务或使用精确 selector；Adapter 读取 Core 状态并恢复当前阶段、revision、范围、剩余验证、
Blocker 和 Recovery。原 worktree 丢失或已被另一个实例替换时会得到 `WORKSPACE_UNAVAILABLE`，不会
按同名路径或 branch 猜测未提交内容。

如果上一次 Action 的响应丢失或被截断，Adapter 先读取当前 Task 和 Recovery 判断，再按 Core 给出的
结果继续、恢复、阻塞或安全重试。它不会自行重复原提交。

同一失败、同一测试结果，或相同修改路径与失败组成的测试循环连续出现三次时，Core 会保存第三次
结果并暂停 Task。Codex 不会自动解除；用户明确选择换方案或再试一次后，Adapter 才解除 blocker，
并从 Core 保存的原目标阶段继续。下一次仍然完全重复时会再次暂停。

## 验证投入和修改后复核

Codex 在 TASKS 已经读完需求、设计、工作拆分、影响面和现有测试结构后，才写入初始
`verification_plan`：准备执行的检查、每项理由、预计自动命令数、是否预计完整套件、是否预计新增或
修改测试代码。小范围改动先选与 diff 最近的定向检查，不因为仍有额度就扩大到 package、module 或
全仓库。

额度不足不会直接结束 Task。Codex 在额外命令执行前，使用当前 TEST Action 返回的
`verification_budget_increased`，说明 `new_impact`、`new_risk`、`verification_failure` 或
`verification_gap` 中的实际依据，只增加当前需要的检查、命令或权限。Core 保存原因和调整前后预算，
然后留在 TEST 继续。为了更全面、提高信心、保险起见或“还有预算”都不是有效原因。

每次准备完整测试套件时，Codex 都重新判断改动是否广泛、定向或包级检查是否已经足够、完整套件补足
什么具体风险、仓库是否要求当前检查点运行，并把本次理由记录为 `full_suite_reason`。小修复后的重跑
不能沿用上一次理由。

修改测试代码前先判断它是否保护稳定产品行为、公开接口规范、重要失败路径或真实回归；一次性 README
词语要求只做一次文本搜索。普通实现后的复核只覆盖当前 diff、直接或间接影响及验收所需路径。修复
复核发现后只确认原问题、相关回归和对应定向检查，不重新启动全仓库审计。显式 code review 阶段只读，
完整交付发现后等待用户另行授权修复。

普通修改后的复核和交付只报告与当前改动有因果关系的问题，无关历史问题不进入报告。

## 范围外文件先询问

Plugin 自带 `PreToolUse` hook。用户通过 Codex `/hooks` 信任当前 hook 后，每次 `apply_patch` 执行前
都会先通过 `PATH` 中 package-owned `dev-flow-codex hook pre-tool-use` 入口解析事件，再由内部
`host-check pre-file-write` 入口把目标文件交给 packaged Core；launcher 负责定位 package-local Core，
不依赖 Codex Plugin 缓存目录结构。Core 使用当前 Task Plan 所有 WorkItem 的 `ExpectedPaths` 合集；
多仓库路径带 repository key。B、C 等附加仓库只要已在 Task Repository Scope 中、已通过 `--add-dir`
授权且文件属于计划范围，就直接修改，不因为当前工作目录位于 A 而询问。

计划外文件会在 `apply_patch` 运行前暂停 Task。用户选择：`allow_once` 只允许相同写入意图，
`expand_scope` 返回 `TASKS` 更新计划，`reject` 要求实际恢复路径后返回原节点。选择与原因由 Core
保存。Core 在 Action 提交和读取下一步前重新观察 Git，并从冻结 base commit 推导当前 Task surface；
Host 不再自行声明文件变化。

该 hook 不解析 Bash、外部进程或绕过 Codex tool hook 的专用工具；这些写入可能只能在 Core 最终
检查时发现。未信任、被禁用或不可用的 hook 不能被描述成可靠写前检查。

## 查看状态

查看安装和注册状态：

```bash
dev-flow status --host codex
dev-flow-codex status --json
```

查看 Task、当前阶段、时间线、Recovery 和 Blocker：

```bash
dev-flow webui start
```

WebUI 只监听本机 loopback。完整用法见 [WebUI](../../docs/WEBUI.md)。

## 移除

推荐从统一入口选择 Codex 卸载。Host 原生保留数据卸载为：

```bash
dev-flow-codex remove
npm uninstall -g dev-flow-codex
```

`remove` 会先核对 runtime receipt 并停止对应 WebUI，再删除该 package 拥有的 Plugin、marketplace
注册和 receipt。停止失败时会保留后续对象。Task 数据和目标 Git 仓库默认保留，重新安装兼容 package
并运行 `setup` 后可以继续已有 Task。

彻底清理数据属于独立的 `dev-flow factory-reset` 流程，需要当前计划给出的强确认；不要手工删除
不明确的数据目录。

## Codex 权限与边界

- Codex 会话中的仓库权限仍由 Codex 和用户授权决定；Dev Flow 不扩大 sandbox；
- Core 只读观察 Git，不执行 fetch，不创建 worktree 或 branch，也不执行 commit、merge、rebase、push、tag 或 publish；
- Codex 负责文件修改和命令执行；Host hook 检查 `apply_patch`，Core 观察完整 Task surface，但不会拦截每一次操作；
- selector 不绕过仓库权限、当前 Action、Git 写入授权或发布确认；
- 工作树是源码改动归属边界，不是进程、网络、凭据、端口、数据库或容器沙箱；
- 多仓库 Task 只有在每个 root 都独立 provision 并授权后才创建，部分隔离会整体拒绝；
- 共享目录 sub-agent 不能替代独立 Host worktree，也不再保留 `ACTIVE_TASK_CONFLICT` 后搬家；
- 可选代码索引只帮助检索，不能扩大 Scope 或决定 Recovery 和流程状态。

## 高级多仓库与 worktree

启动新会话前，原会话保存本次需求的相关讨论原文和结构化交接材料，保留确定要求、术语、范围限制、
代码调查、工作要求，并单独列出未采纳建议、假设和待确定问题。已有开发及工作树确认不会把助手建议
自动变成要求，也不新增交接摘要确认步骤。

交接中的工作要求仅包含会话专属指示和授权。
全局及仓库 `AGENTS.md` 由目标 Codex 会话正常加载，交接材料不重复其正文或摘要，也不将自动注入的规则块保存为原始需求讨论。
用户在对话中提出的规则修改仍保留为真实需求。
目标无法自动加载的适用规则注明来源路径、适用范围和具体原因，优先引用可读取的源文件；源文件不可读取时仅补充本次需要的规则文本并排除凭据。
可用性尚未核实时记入 `open_questions`，不预防性复制整份文件。

内部 `host-launch prepare` 必须提供 `handoff_file`，指向已有确认后写在已评估仓库之外的 UTF-8 JSON
草稿。helper 在 fetch 前将完整材料保存到 Host 产品目录，并在 receipt 中关联 `handoff_digest`。
`dispatch-start` 只接收 `launch_id`、`repository_key`、`project_id`；`cli-provision` 只接收 `launch_id`、
`repository_key`、`additional_worktree_paths`、`source_repository_path`。两个入口直接使用保存的材料，
不再接收另一段请求摘要。完整结构化 Prompt 超过 24 KiB UTF-8 时提供完整文件路径及读取说明，材料不截断。
完整参数与格式见[命令参考](../../docs/COMMANDS.md)和[发送端交接格式](plugin/skills/dev-flow/references/task-handoff.md)。

当前源码支持一个主仓库和最多七个显式附加仓库。附加仓库必须先通过 Codex `--add-dir` 成为当前
会话已授权的 writable root；Scope 创建后不可变，系统不会扫描相邻目录自动扩大范围。

并行批次会先逐项评估，用户一次确认要进入 Dev Flow 的项目和每个唯一 target branch，确认前没有
child dispatch。Codex 只有在 Host 能为每个项目提供独立 worktree-backed task/thread 时才分派；每个
child 有一个 Host task、一个 worktree 和一个 Core Task。`ACTIVE_TASK_CONFLICT` 现在只会停止，不再
触发事后搬家。

Codex App managed worktree 从固定 `base_commit` 创建，child 在 Core 调用前建立用户
确认的 target branch。无 task creation 能力的 Codex CLI 使用 receipt 返回的 `codex -C` / `--add-dir`
argv descriptor 重新进入。managed worktree 的 snapshot、Handoff 和清理由 Codex Host 负责；CLI
工作树与 branch 的删除分别需要用户授权，且不会使用 force。

同机 relocation 先由 Core 的 `dev_flow_prepare_task_relocation` 保存 blocker，再由另一个 coordinator
执行一次 Codex Handoff；结果不确定时只读 receipt 和 Host 状态，不重复 Handoff。工作树确实丢失且
无法恢复时，用户可以通过 `dev_flow_abandon_task` 释放 claim。`DONE` / `CANCELLED` 本身不会删除
branch 或 worktree。

使用前请阅读[项目状态](../../docs/PROJECT-STATUS.md)确认这些能力属于稳定还是源码范围。精确
Repository Scope、worktree 分派和协议规则见[架构](../../docs/ARCHITECTURE.md)与
[命令参考](../../docs/COMMANDS.md)。

## 相关文档

- [产品定义](../../docs/PRODUCT.md)
- [中断后继续的演示](../../docs/DEMO.md)
- [命令参考](../../docs/COMMANDS.md)
- [架构](../../docs/ARCHITECTURE.md)
- [项目状态](../../docs/PROJECT-STATUS.md)
- [WebUI](../../docs/WEBUI.md)

## 桌面宠物本地开发包

macOS arm64 的桌面宠物通过包含 `DevFlowPet.app` 的本地开发包使用，运行时复用已配置的 Codex 或 DeepSeek Adapter 提供的 Core。
当前常规 npm 清单与正式制备流程不包含原生应用，获取方式以[桌面宠物指南](https://github.com/Innocent-children/dev-flow/blob/main/docs/DESKTOP-PETS.md#本地构建与安装)为准。
宠物显示一个所选 Task 的保存状态并打开对应 WebUI；Core 决定任务状态，展示不代表 Host 实时活动或完成百分比。

形象可使用单张 PNG、原生动画包、Codex 标准格式 1/2 图集或 Dev Flow 高分辨率扩展。五类任务动作是基础要求，附加素材决定能否散步、挥手或思考；
只有 Codex 布局图集固定提取九类、57 帧。待机活动有独立开关，任务提示优先，自动位移保留手动摆放位置。
程序更新、已有应用副本替换和素材重导入分别处理；安装、全部动作规则与常见问题统一见[桌面宠物指南](https://github.com/Innocent-children/dev-flow/blob/main/docs/DESKTOP-PETS.md)。

本地宠物包保留默认形象；鲸鱼娘等自定义形象作为独立素材包，通过“导入形象…”安装。素材保存在用户目录，程序更新保留已导入形象。

## Windows 平台适配

Windows 10/11 x64 面向普通 Intel、AMD 64 位桌面电脑。三个 Node 包的路径、权限、命令和清理规则分别由 `lib/platform/windows/` 与 `lib/platform/macos/` 实现，选择入口只按当前平台分派。Core 的平台中立任务语义保持共享；Windows Git 进程隐藏控制台窗口。Codex 的 `--version` 与 `status` 使用所选平台的可执行文件检查，Windows PowerShell 启动器输出 UTF-8。本次只执行 Windows 原生测试；Windows 10、AMD 实机和 macOS 未测试，稳定支持声明保持不变。详见[Windows 适配报告](../../docs/WINDOWS-ADAPTATION.md)。

Windows 10/11 x64 的桌面宠物提供与 macOS 对齐的任务选择与状态气泡、WebUI 跳转、托盘/右键菜单、PNG/SVG 静态和原生动画形象、Codex PNG/WebP 图集导入、九类动作、拖动、六档缩放、隐藏恢复与独立启停。Windows 使用独立 Electron 实现，macOS 保留 Swift/AppKit；两者只读取 Core 状态。Windows 本地包由 `scripts/build-desktop-pet-windows.mjs` 构建，用户数据位于 `%LOCALAPPDATA%\dev-flow\pet`。构建、安装、更新与验证见[桌面宠物指南](../../docs/DESKTOP-PETS.md)。

Windows 会将已有 AppData 目录解析为实际路径，包括打包桌面宿主提供的目录别名；仍拒绝符号链接。

Windows Codex 注册回读按当前宿主的 marketplace `name`、`root` 与 Plugin 身份校验，并在 Windows 平台实现中规范化 `\\?\` 路径前缀；macOS 保留自己的回读规则。

当前 Windows 开发包同时包含两个 Adapter 包和桌面应用。安装统一入口包后，使用 `dev-flow install --host all --yes` 与 `dev-flow pet start`。修复、重装均通过同一入口执行，校验内置包摘要、更新桌面应用，并保留 Task 数据、设置和形象。

## 完成条件与操作恢复

进入 TEST 前，当前 Task Plan 的全部工作项必须已经完成。DELIVERY 逐条接收明确的验收结果，每项关联已完成且对应此验收条件的工作项，以及当前 Test 中通过的检查。自动检查、静态检查、Host 观察和明确人工检查均可使用；理解确认仍单独保存，不自动代替验收检查。遗漏、错误或过期引用会使提交被拒绝。

WebUI 与 MCP 共用 Core 的语义提交、操作保存和恢复流程。Core 保存规范化载荷，页面只提交当前 Task revision、Action ID 和语义结果。网络异常先回读 Core；页面重新打开后仍能发现待恢复操作，并按 Action ID 恢复。无效完成结果不会推进任务或保存操作。

`dev-flow-codex host-launch <operation>` 从 stdin 流读取最多 1 MiB 的 UTF-8 JSON 对象，支持分块输入及跨块中文字符。读取失败、非法 UTF-8、重复成员、非法 JSON、数组或 null 均在执行操作前拒绝；错误写入 stderr，成功结果以 JSON 写入 stdout。

## 文件提交准备

Codex 在普通提交前执行 `dev-flow-codex artifacts collect` 和 `dev-flow-codex artifacts prepare`，复用 Core 对当前 Action 的完整 Git 观察。Codex 只补充文件用途和说明，准备命令检查清单与当前观察一致后生成 artifact 数组。流程文件漏报返回具体路径和仅修改 artifact 字段的一次纠正指示；实际仓库异常继续按原有恢复规则处理。详见[文件收集与提交](../../docs/ARTIFACTS.md)。

在启动 Codex 前，将 `DEV_FLOW_DATA_DIR` 设为已存在的规范化绝对目录，MCP、hook 和文件准备命令使用同一数据目录。`dev-flow-codex artifacts <collect|prepare> --help` 返回 JSON 示例、字段说明、输出和下一步，查询时不启动 Core。

## 调用说明与结果恢复

`dev-flow-codex --help` 列出命令；`dev-flow-codex host-launch <operation> --help` 返回该操作的完整输入 Schema、字段来源、输出字段和下一步。帮助查询不读取 stdin 或执行工作区操作。所有仓库准备完成后，`host-launch scope` 汇总同一 launch 的创建记录供 Core 使用。

MCP 提供结果 Schema，并在 `structuredContent` 和文本中返回同一 JSON。Skill 按工具类型读取 Task 或 Action，并在恢复会话中优先处理已有恢复建议；创建、取消、放弃和迁移准备使用各自的结果回读规则。正常执行仅展示简短状态。详见[命令参考](../../docs/COMMANDS.md)。

`host-launch prepare` 省略 `launch_id` 时自动生成 ID，并使用该 ID 核对启动记录。重试时传入返回的 `receipt.launch_id`，继续同一次启动；记录已为 `prepared` 时跳过 fetch。显式传入的 ID 必须与保存记录一致。

`host-launch dispatch-result` 接收 Codex 创建任务的完整返回值，包括 `content[].text` 中的 JSON。它将 `clientThreadId` 保存为 `host_client_thread_id`，阶段设为 `queued`；以相同 `launch_id` 和 `repository_key` 重新提交保留的结果，可以恢复 `uncertain` 记录。后续检查继续跟踪同一次创建，不重复派发。


Codex 启动先由 `dispatch-start` 将完整 `host_request` 保存到 `receipt.operation_status.host_request`，进入 `dispatch_prepared`；重复调用和 `status` 均可回读。`dispatch-call` 使用当前 `dispatch_attempt_id` 将阶段改为 `dispatching`，仅首次返回 `should_dispatch=true` 时允许调用一次创建工具。调用方将命令完整 stdout 写入私有文件，检查退出码并从文件解析 JSON，再原样转发请求，避免显示长度限制截断内容。

确认原调用方已停止且创建工具尚未调用时，`dispatch-recover` 接收当前派发 ID、`host_call_not_made=true`、`previous_caller_stopped=true` 和具体 `reason`，保留原请求并换发调用许可 ID；随后执行 `dispatch-call`。空任务 ID 本身不能证明未调用。已经调用但结果未知时，Host 按保存的启动标题、启动 ID 和仓库标识查找任务及归档任务，读取候选任务完整初始消息，将 `candidates`（`thread_id`、`initial_prompt`）交给 `dispatch-reconcile`。唯一完整消息匹配才保存任务 ID；零匹配、多个匹配或查询不可用均不允许重新创建。Core Task 状态保持由 Core 管理。

## 携带内容的规划与检查

Codex 携带本地改动时，会在 REQUIREMENTS 中记录保留要求，在 TASKS 中将完整的 `current_changed_paths` 与 `expected_paths` 及已保留的流程文件逐项核对。新开发工作和已有内容保留分别安排工作项与检查；当前 Action 的空文件清单不能代替完整 Task 路径核对。保留检查比较启动快照，不代表已有业务功能已经验证。已发生的文件范围阻塞仍通过现有 Core 选择与转移处理。

## 已有检查的验证额度

增加验证额度时，`additional_checks` 可以引用原计划或此前增加记录中的检查名称，使用 `rationale` 说明本次补做或重跑。单次提交内名称仍需唯一，具体原因、实际增加量和上限继续校验；追加额度本身不生成通过结果。
