# Dev Flow 命令参考

[中文](COMMANDS.md) | [English](COMMANDS_en.md)

> 普通用户通常只需要安装统一入口、运行 `dev-flow`，并在 Host 中使用对应 selector。其余命令
> 主要用于诊断、恢复和集成开发。

本文件列出 Dev Flow 当前公开或受支持的命令入口。命令范围以实际实现为准：Codex 命令来自
`packages/dev-flow/package.json` 与其 CLI、`packages/codex/package.json` 与
`packages/codex/bin/dev-flow-codex.mjs`，DeepSeek 生命周期命令
来自 DSH lifecycle tests 使用的 DSH CLI，Core 命令来自 `cmd/dev-flow/main.go`，MCP 工具来自
`internal/mcp/` 的固定工具列表。

公开安装示例使用 npm 的 `latest` dist-tag，以便安装当前最新稳定包；支持矩阵、Release 链接和
安装包验证结果仍使用精确版本号，不应替换为 `latest`。

当前源码的 launcher 和 bundled Core 只接受两个精确运行时对：`darwin-arm64` 与
`win32-x64`。下方 `@latest` 命令仍描述当前 npm 稳定通道；Windows 10/11 桌面 x64 的源码能力
要通过本仓库构建的 package 验证，直到一次明确确认的发布把对应安装包发布到稳定通道。

## 多数用户需要的推荐入口

```bash
npm install -g @imotong/dev-flow@latest
dev-flow
```

安装后，Codex 使用 `$dev-flow-codex:dev-flow <任务描述>`，DeepSeek Harness 使用
`/dev-flow <任务描述>`。这两项是 Host 对话 selector，不是 shell 命令。

## 统一 Adapter 生命周期

`@imotong/dev-flow` 提供 Host 无关的生命周期和 Control Center 入口：

```bash
npm install -g @imotong/dev-flow@latest
dev-flow
```

支持的子命令为 `status`、`doctor`、`install`、`upgrade`、`repair`、`reinstall`、`uninstall` 和
`factory-reset`。Host 选择为 `codex|deepseek|all`；DeepSeek Profile 默认 `web`。普通卸载、升级、
修复和重装保留用户配置与 Task 数据；`factory-reset` 要求绑定当前计划的 token，`--yes` 不能单独
授权数据清理。默认清理在 macOS 移动到用户 Trash，在 Windows 移动到
`%LOCALAPPDATA%\create-dev-flow\trash` 的可恢复隔离目录；Windows 目标不是系统回收站。永久删除还需
独立确认。
Codex 全局 package 与 receipt、Plugin 注册分别判断；即使注册已缺失，`uninstall` 和
`factory-reset` 仍会卸载已安装的全局 package。
交互界面读取当前 locale：`zh*` 使用简体中文，其余 locale 统一使用英文；JSON 输出保持语言无关。
文本模式会在安装、升级、修复和重装执行期间逐项显示 Host 动作及已完成的 package、注册、构建产物和就绪检查步骤；`--json` 不输出这些进度行。

| 入口 | 作用 |
| --- | --- |
| `npm install -g @imotong/dev-flow@latest` | 全局安装公共 `dev-flow` 命令。 |
| `dev-flow` | 打开交互式 lifecycle 菜单。 |
| `dev-flow status\|doctor --host codex\|deepseek\|all` | 只读检查或诊断。 |
| `dev-flow install\|upgrade\|repair\|reinstall --host ... [--profile web] [--version latest] --yes` | 执行普通维护并保留配置与 Task 数据。 |
| `dev-flow install\|repair --host deepseek\|all --adopt ...` | 接管已经存在且身份可验证的 DeepSeek Profile contribution；其他操作和纯 Codex 目标不接受 `--adopt`。 |
| `dev-flow upgrade ... --confirm-downgrade <token>` | 当目标版本低于已安装版本时，使用当前计划给出的 token 明确确认降级。 |
| `dev-flow uninstall --host ... [--all-known-profiles] --yes` | 移除选定 Adapter并保留配置与 Task 数据；Codex 会先安全停止对应 WebUI，失败时不移除注册或 package。 |
| `dev-flow factory-reset --host all --all-known-profiles` | 生成绑定当前状态的 reset plan/token；`--yes` 不授权清理。 |
| `dev-flow factory-reset ... --confirm-reset <token> [--reinstall]` | 将已确认数据移动到 Trash，可随后全新重装。 |
| `dev-flow factory-reset ... --confirm-explicit-data <absolute-path>` | 确认计划中列出的一个显式 `DEV_FLOW_DATA_DIR`；多个目录时可重复传入该参数。 |
| `dev-flow factory-reset ... --permanent --confirm-reset <token> --confirm-permanent <token>` | 永久删除计划中的精确目标；需要 reset token 和独立的永久删除 token。 |
| `dev-flow webui start\|open\|status\|stop` | 从任一已安装 Adapter 选择并校验 Core，管理共享本机 Control Center；`start` 可创建缺失的默认数据目录：macOS 使用 `0700`，Windows 继承用户 profile/LocalAppData ACL。其余命令不创建目录。 |
| `--json` / `--plain` | 分别选择单一 JSON 对象或无 ANSI 的纯文本结果。 |

设置 `DEV_FLOW_DATA_DIR` 时，公共 launcher 只接受已存在、canonical、非符号链接的绝对目录，任何命令都
不会自动创建显式目录。

默认本机路径按平台固定：

| 路径 | macOS arm64 | Windows 10/11 x64 |
| --- | --- | --- |
| Task 数据 | `$HOME/Library/Application Support/dev-flow/data` | `%LOCALAPPDATA%\dev-flow\data` |
| 用户配置 | `$HOME/.dev-flow/config.json` | `%USERPROFILE%\.dev-flow\config.json` |
| 生命周期管理状态 | `$HOME/Library/Application Support/create-dev-flow` | `%LOCALAPPDATA%\create-dev-flow` |

PowerShell 中设置显式数据目录的形式为：

```powershell
$env:DEV_FLOW_DATA_DIR = 'C:\absolute\existing\dev-flow-data'
dev-flow status --host all
```

下方 Host 原生命令保留为诊断恢复入口。

## 桌面宠物本地开发包

macOS arm64 源码开发包提供 `dev-flow pet start` 和 `dev-flow pet stop`，交互菜单复用同一入口。
至少一个 Codex 或 DeepSeek Adapter 必须已经安装并配置；宠物读取同一个 Core 的 WebUI 接口。
它显示所选任务已保存的阶段、阻塞原因、更新时间和同步时间，点击打开相应详情页。任务选择面板按需
分页，所选任务完成后仍保留关注；取消不庆祝。菜单提供动画开关、隐藏/显示和退出，语言跟随系统中文或英文。

开启可启动尚未运行的 WebUI；后台连接检查只读。隐藏和睡眠取消请求，显示和唤醒重新读取；旧请求
不能覆盖新选择。动画开关及系统减少动态效果使用静态帧。关闭只结束宠物并保留 WebUI、Task 与偏好；
维护当前供给 Core 的 Adapter 前先停止宠物，停止失败时中止维护。factory-reset 的确认计划包含
`productRoot/pet`，继续使用既有数据目录确认与清理规则。其他平台拒绝宠物命令。

两项命令仅接受所示参数，结果为纯文本；退出码为成功 `0`、运行失败 `1`、参数错误 `2`。
`pet status` 和 `pet start --json` 不是公开入口。

源码构建需要 macOS arm64、Node.js `>=24` 和提供 Swift `>=6.0` 的 Xcode 命令行工具。构建目标为
macOS 14，但最低系统运行尚未验证。构建器在仓库外生成带 ad-hoc 签名的本地 npm tarball，并在解包后
检查应用、资源、执行权限与签名。此流程用于本机功能检查，不执行公开发布或 Apple 公证。

```bash
node scripts/build-desktop-pet.mjs --output "/absolute/pet-build"
npm install --prefix "/absolute/pet-install" "/absolute/pet-build/<generated-tarball>.tgz"
node "/absolute/pet-install/node_modules/@imotong/dev-flow/bin/dev-flow.mjs" pet start
node "/absolute/pet-install/node_modules/@imotong/dev-flow/bin/dev-flow.mjs" pet stop
```

将 `<generated-tarball>` 替换为构建输出中的文件名。安装后的宠物使用包内应用与资源，运行不需要
Swift/Xcode。更新或移除统一入口包前先关闭宠物。此开发包与普通稳定通道安装分别说明，公开支持范围
以支持矩阵为准。

## Codex

### 安装

```bash
npm install -g dev-flow-codex@latest
dev-flow-codex setup
dev-flow-codex --version
```

npm 全局安装只把 `dev-flow-codex` launcher 放到 `PATH`。`setup` 是独立步骤，它验证平台、
package、bundled Core 和 Codex 版本，然后注册本地 marketplace、Plugin 与 MCP 配置，并回读
注册结果。配置缺失时，`setup` 在 macOS 创建 `$HOME/.dev-flow/config.json`，在 Windows 创建
`%USERPROFILE%\.dev-flow\config.json`；成功后显示配置/receipt 的
实际文件变化和一个下一步。`--version` 同时报告 Host package 与 bundled Core 版本。

### 支持的 Codex 命令

| 命令 | 作用 |
| --- | --- |
| `npm install -g dev-flow-codex@latest` | 从 npm 安装 `latest` 指向的 Codex package，并把 `dev-flow-codex` 全局加入 `PATH`。它不会自动注册 Codex Plugin。 |
| `dev-flow-codex setup` | 创建或验证固定用户配置，验证安装内容和 Codex 兼容版本，注册 marketplace、Plugin、MCP 与 packaged hook，并在成功后提示先用 Codex `/hooks` 审核并信任当前 hook。重复执行时会读取并校验现有注册。 |
| `dev-flow-codex setup --json` | 执行与 `setup` 相同的操作，但只输出一行机器可读 JSON，保留 operation、status、changed、receipt_path，并增加 configuration_path、file_changes 与 next_step。 |
| `dev-flow-codex status` | 只读显示当前 package/Core 与注册状态。 |
| `dev-flow-codex status --json` | 只读回读 package、Core、receipt、marketplace 与 Plugin 状态，不创建配置、注册或数据。 |
| `dev-flow-codex --version` | 输出 `dev-flow-codex <package-version> (core <core-version>)`，用于确认实际安装的 package 与 bundled Core 身份。 |
| `dev-flow-codex remove` | 先按 runtime receipt 停止对应 WebUI，再删除由该 package 拥有的 Codex Plugin、marketplace 注册与 receipt。停止失败时不注销；Task data 和目标 Git 仓库保持不变。 |
| `dev-flow-codex remove --json` | 执行与 `remove` 相同的操作，并输出机器可读 JSON；返回的 `next_step` 指向单独的全局 npm 卸载。 |
| `npm uninstall -g dev-flow-codex` | 在完成 `remove` 后卸载全局 npm package。单独运行它不会先清理 Codex 注册。 |
| `dev-flow-codex mcp` | **内部 Host 命令。** 由 Plugin 的 MCP 配置调用；它设置数据目录和 Codex admission instructions，然后启动 packaged Core 的 `mcp --stdio`。正常用户不应手工启动它。 |
| `dev-flow-codex hook pre-tool-use` | **内部 Host 命令。** Codex packaged hook 通过 `PATH` 中 package-owned launcher 调用它；该命令读取一个 Hook 事件，提取 `apply_patch` 目标并执行写前检查。正常用户不应手工启动它。 |
| `dev-flow-codex host-check pre-file-write` | **内部 Host 命令。** `hook pre-tool-use` 的实现调用它；launcher 定位 package-local Core，并原样转发 stdin/stdout 与精确的 `host-check pre-file-write` 参数。正常用户不应手工启动它。 |
| `dev-flow-codex host-launch <operation>` | **内部 Host 命令。** 从 stdin 接收一个 closed JSON 对象，并输出一个 JSON 对象。`operation` 只允许 `inspect|prepare|status|dispatch-start|dispatch-result|bootstrap|cli-provision|handoff-start|handoff-result|handoff-status|cleanup-decision|cleanup-worktree|cleanup-branch`；它执行或记录当前用户已经确认的 assessment、provisioning、relaunch、handoff 与 cleanup 步骤，不是通用 Git CLI。 |

`dev-flow-codex` 不支持其他子命令，也不提供隐式 `help`、`update` 或 `uninstall` 子命令。Host 原生更新到
当前 `latest` 时重新运行全局安装和 `setup`：

```bash
npm install -g dev-flow-codex@latest
dev-flow-codex setup
dev-flow-codex --version
```

保留 Task 数据的卸载顺序是 `dev-flow-codex remove`，然后
`npm uninstall -g dev-flow-codex`。只有在 Codex 和 DeepSeek Adapter 都已移除且不再需要任何
Task 时，才删除共享默认产品目录：macOS 为 `$HOME/Library/Application Support/dev-flow`，Windows
为 `%LOCALAPPDATA%\dev-flow`。

### Codex 智能启用与显式 selector

```text
$dev-flow-codex:dev-flow <任务描述>
```

这不是 shell 命令，而是 Codex 用户消息中的精确 Skill selector。边界明确的开发请求也可以由 Host
隐式选择 Skill；裸 `$dev-flow` 和错误 namespace 不是显式 selector。无论隐式还是显式，新请求都先
做只读 assessment，输出改动级别、候选影响面、未知项和建议，然后停止等待用户选择。确认前不调用
Core、不创建 Task/receipt/child，也不写 Git；request、root、HEAD 或 status 变化会使评估失效。

选择 Dev Flow 后，用户逐仓确认 remote/base/target。Codex Host 执行精确 fetch、冻结 commit，并
创建或启动专属 worktree；源 checkout 的 staged、unstaged 和 untracked 内容不会进入 child。并行
批次的每个项目各有一个 branch、worktree、Host task 和 Core Task。共享目录 sub-agent 不能代替。
旧的 `ACTIVE_TASK_CONFLICT` 后搬家路径已经删除。

明确 resume 是唯一跳过 assessment 的路径，它回到原 worktree instance，不选择替代 branch/worktree。

## DeepSeek Harness

`dev-flow-deepseek` 的 `package.json` 没有 `bin` 字段，因此它不提供名为
`dev-flow-deepseek` 的独立 CLI。安装、检查和移除都由 DSH profile 生命周期完成。

### 安装

先安装 DSH，再在可写目录中把 Dev Flow 安装到一个真实 profile。下面使用 `web`；需要其他
profile 时修改 `PROFILE`，不要把 `<profile>` 原样输入 shell：

```bash
npm install -g @deepseek-ai/dsh@latest
dsh --version
PROFILE=web
TARBALL="$(npm pack dev-flow-deepseek@latest --silent)"
dsh plugin --profile "$PROFILE" add "$PWD/$TARBALL"
rm -f "$PWD/$TARBALL"
dsh --profile "$PROFILE" --dump-config
```

Windows PowerShell 使用同一个 DSH profile lifecycle，但必须把 `npm pack` 结果解析为绝对路径：

```powershell
npm install -g @deepseek-ai/dsh@latest
dsh --version
$ProfileName = 'web'
$Tarball = (npm pack dev-flow-deepseek@latest --silent | Select-Object -Last 1).Trim()
$TarballPath = (Resolve-Path -LiteralPath $Tarball).Path
dsh plugin --profile $ProfileName add $TarballPath
Remove-Item -LiteralPath $TarballPath
dsh --profile $ProfileName --dump-config
```

`npm pack` 下载 `latest` 指向的官方 package，并把 tarball 写入当前目录；命令替换保存实际文件名。
DSH `plugin add` 接收该 tarball 的绝对路径，将 package、bundle layer、Skill、guard 与 MCP child
加入指定 profile。安装后按 DSH 的 profile lifecycle 停止并重启该 profile。

### Dev Flow 相关的 DSH 命令

| 命令 | 作用 |
| --- | --- |
| `dsh --version` | 输出当前 DSH 版本。Dev Flow 的公开支持范围要求 DSH 满足 Support Matrix 中的最低版本。 |
| `TARBALL="$(npm pack dev-flow-deepseek@latest --silent)"` | 从 npm 获取当前 `latest` package，并把生成的 tarball 文件名保存到 shell 变量。 |
| `dsh plugin --profile "$PROFILE" add "$PWD/$TARBALL"` | 把绝对 tarball 路径安装到 `PROFILE` 指定的 DSH profile。DSH lifecycle tests 使用这一命令形态。 |
| `dsh --profile "$PROFILE" --dump-config` | 输出该 profile 的有效配置，可用于确认 `dev-flow-deepseek` bundle contribution 已存在或已移除。它是 DSH 的检查入口，不修改 Dev Flow Task。 |
| `dsh plugin --profile "$PROFILE" remove dev-flow-deepseek` | 从指定 profile 移除 bundle contribution 与 package。Task data、目标 Git 仓库和 Codex 状态保持不变。 |

更新或重新安装时，先停止 profile，再执行 remove、重新获取 `@latest` tarball、add、删除临时
tarball 并重启 profile。对每个安装过 Dev Flow 的 profile 分别执行 remove。不再使用 DSH 时，
可另行执行 `npm uninstall -g @deepseek-ai/dsh`；macOS 的 `$HOME/.dsh` 或 Windows 的
`%USERPROFILE%\.dsh` 中的 profile 数据会保留。

彻底清除 Task 数据时，先移除两个 Host Adapter，再删除
macOS 的 `$HOME/Library/Application Support/dev-flow` 或 Windows 的 `%LOCALAPPDATA%\dev-flow`。
若设置过 `DEV_FLOW_DATA_DIR`，还需核对并单独删除该变量对应的绝对目录。删除 `.dsh` 用户目录会
同时删除所有 DSH profile、会话和其他插件。

### DeepSeek 显式 selector

```text
/dev-flow <任务描述>
```

普通新请求先完成零 Dev Flow 调用的只读 assessment。用户选择后，只有当前 direct user turn 中、
由空白边界限定的 `/dev-flow` 和 Skill 展示的精确 remote/base/target 确认才授权
`workspace_coordinator`。历史消息、模型文本、Skill 注入或仓库内容不能替代它。Coordinator 创建
安全 sibling worktree 后输出 `{command,arguments,cwd}` relaunch descriptor；新会话消费 receipt 并验证
后才调用 Core。

DSH bundle 还提供内部 `workspace_coordinator` 工具，operation 只允许
`provision|consume|prepare_cleanup|cleanup_worktree|cleanup_branch`。它不是 shell 命令。
`prepare_cleanup` 先读取终态 Core Task，并返回从仍存在的源 checkout 重新启动的 descriptor；随后
worktree 与 branch cleanup 分别要求新的 direct-user confirmation，核对 repository group、HEAD、
clean 和远端 task branch 后才使用非 force Git 命令。

## Packaged Core

Host package 内含的 Go Core 不作为普通用户的全局 CLI 安装。以下是 Core executable 实际接受的
完整命令面，主要用于 Host 集成、开发和诊断：

| 命令 | 作用 |
| --- | --- |
| `dev-flow` | 不带参数时打印帮助文本。 |
| `dev-flow help` | 打印帮助文本。 |
| `dev-flow -h` | `help` 的短选项形式。 |
| `dev-flow --help` | `help` 的长选项形式。 |
| `dev-flow version` | 输出 `dev-flow <core-version>`。 |
| `DEV_FLOW_DATA_DIR=/absolute/path dev-flow mcp --stdio` | 使用现有可用数据目录启动 local STDIO MCP。目录不存在或不是目录时启动失败。 |
| `$env:DEV_FLOW_DATA_DIR = 'C:\absolute\existing\data'; dev-flow.exe mcp --stdio` | Windows PowerShell 中使用现有可用数据目录启动 local STDIO MCP。 |
| `dev-flow host-check pre-file-write` | **Host 受管命令。** 从 stdin 读取规范化的结构化写入目标，检查活动 Task 的跨仓库 ExpectedPaths，并输出 `allow` 或在写入前持久化 file-scope blocker 后输出 `deny`。Codex/DeepSeek Adapter 调用，普通用户不手工运行。 |
| `dev-flow webui start [--no-open] [--plain\|--json]` | 启动或复用共享 loopback WebUI；默认打开浏览器。 |
| `dev-flow webui open [--plain\|--json]` | 验证 receipt、进程身份和实时 Core 状态后打开同一 URL。 |
| `dev-flow webui status [--plain\|--json]` | 返回 `ready`、`read_only`、`incompatible` 或 `unavailable`。 |
| `dev-flow webui stop [--plain\|--json]` | 核对 PID 与进程启动身份后停止共享实例。 |

`dev-flow host-check pre-file-write` 与 `dev-flow webui serve` 都是 Adapter/lifecycle 内部入口，不是 Host 用户命令。Core 不支持 remote
transport、通用 HTTP/SSE transport、通用 shell 或 Git mutation 命令。Codex 用户应通过
`dev-flow-codex mcp` 的受管入口启动 Core；DeepSeek 用户由 DSH integration process 启动 Core。

## MCP 工具

以下十七个工具是当前全部公开 MCP 工具。它们由 Host Adapter 调用，不是终端 shell
命令。

| 工具 | 类型 | 作用 |
| --- | --- | --- |
| `dev_flow_server_info` | 只读 | 读取 Core 产品版本、transport、健康状态、支持的 process、Host、method profile、工具目录和有效 Host 代码索引偏好。每次有效 Host admission 后必须首先调用。 |
| `dev_flow_open_task` | 读取或创建 | 在全部 `workspace_origin` 通过专属 worktree 核验后创建 Task；`new_task` 为空时从原 worktree instance 恢复并先检查 workspace。 |
| `dev_flow_get_task` | 只读 | 按 Task ID 读取持久化 Task，包括 verification plan、当前预算/消耗、调整原因和最多三条近期测试尝试；存在 Core 保存的 Action 提交时自动返回 Recovery assessment。 |
| `dev_flow_get_next_action` | 观察/可能 mutation | 先观察 workspace；必要时幂等创建 workspace blocker，否则返回当前 Action、`submission_tool` 和全部合法 transition。 |
| `dev_flow_submit_requirements` | mutation | 提交 REQUIREMENTS 节点结果。 |
| `dev_flow_submit_design` | mutation | 提交 DESIGN 节点结果。 |
| `dev_flow_submit_tasks` | mutation | 提交 TASKS 节点结果；baseline 必须包含分析后的 `verification_plan`。 |
| `dev_flow_submit_implementation` | mutation | 提交 IMPLEMENT 节点结果。 |
| `dev_flow_submit_test` | mutation | 提交 TEST 节点结果；`verification_budget_increased` 用具体原因增加预算并留在 TEST，普通结果发送 `budget_adjustment=null`；第三次精确重复时暂停。 |
| `dev_flow_submit_comprehension` | mutation | 提交 COMPREHENSION_REVIEW 节点结果。 |
| `dev_flow_submit_refactor` | mutation | 提交 REFACTOR 节点结果。 |
| `dev_flow_submit_delivery` | mutation | 提交 Host 负责的 DELIVERY 判断、风险和发现；acceptance、验证记录 ID 与 Test/Comprehension record ID 由 Core 补齐，提交这些字段会按 `unknown_member` 拒绝。 |
| `dev_flow_resolve_blocker` | mutation | 在 Core 确认当前 blocker 条件后解除阻塞；文件范围使用 `choice` 与 `reason`，history 使用 `history_resolution:{choice:"accept_current_history",reason}`，relocation 使用 `relocation_id` 与全部 `relocation_destinations[{key,repository_path}]`，验证/Recovery blocker 使用当前身份字段。 |
| `dev_flow_recover_action` | mutation | 使用 Core 在独立 Action 操作记录中保存的规范化提交恢复不确定 Action；不接收原始 payload。 |
| `dev_flow_cancel_task` | destructive mutation | 使用当前 revision 和非空 reason 将非终态 Task 转为 `CANCELLED`。 |
| `dev_flow_prepare_task_relocation` | mutation | 保存 relocation ID、源 workspace/content/surface 和 resume node；Host handoff 期间保留原 claims。 |
| `dev_flow_abandon_task` | destructive mutation | 原 worktree 确实不可用时，用精确 host/task/revision 和非空 reason 进入 `CANCELLED` 并释放 claims；不访问 Git。 |

八个普通节点提交工具都只接收 `host`、`task_id`、`action_id`、`transition_id`、`summary`、
`reason`、`artifacts`、`method_results` 和只含语义事实的节点专属 `node_result`；其中没有
`changed_paths` 或 `no_file_changes`。Core 从 Git 计算 Action delta/current surface，并从当前 Action 补齐
revision、Action kind、process identity、source cursor、repository binding、artifact role、method
step identity/order/status 与内部 payload envelope。`get_next_action` 的 `submission_tool` 指出当前
唯一可用的提交工具。

`method_results` 以当前 `method_steps[].step_id` 为键，每个值只含 `capability` 和 `summary`。
外部工具完成步骤时填写实际 capability ID，普通等价工作完成后填写空字符串；Core 生成内部
`MethodEvidence` 的步骤、顺序和状态。artifact 按当前 Schema 放入 `artifacts.current` 或
`artifacts.other_process`，每项只含 `path`、`digest` 和 `summary`，`role` 由 Core 根据槽位和节点赋值。

`dev_flow_submit_design` 的 `node_result.baseline.requirements_revision`、`dev_flow_submit_tasks` 的
`node_result.baseline.design_revision` 与 `dev_flow_submit_implementation` 的
`node_result.task_plan_revision` 均不属于 Host 可提交的字段。Core 确认当前 Action 身份后，从同一 Task
快照填充这些字段；提交任一字段会返回准确路径的 `unknown_member`。节点提交缺少
其他必填字段时返回准确的 `required_member_missing` 路径；只有已证明零写入且修正内容来自当前节点
既有事实时，Host 才能按 `recovery.allowed_paths` 通过同一提交工具修正一次。

新 Task 的 `new_task` 不包含 `verification_budget`。TASKS 的 `baseline.verification_plan` 包含
`checks[{name,rationale}]`、`initial_budget`、`full_suite_expected` 和
`test_code_changes_expected`。TEST 容量不足时可以选择同一 Action 返回的
`verification_budget_increased`，提交 `budget_adjustment`：`basis`、`additional_checks`、
`additional_automatic_commands`、`allow_full_suite`、`allow_manual_handoff`；transition `reason`
说明具体的新影响、风险、失败或验证缺口。没有实际增加、没有新增检查或没有具体原因会被拒绝。

每个 TEST check 还必须提交 `full_suite_reason`。`full_suite=false` 时它是空字符串；完整套件则记录本次
运行补足的具体风险。Core 保存该结果，但 Host 仍需在命令执行前判断本次完整套件是否必要。

未知 CLI 参数、未列出的 MCP 工具或未满足隐式/显式统一 admission 的调用不属于受支持入口。

### Repository Scope 与 Host 偏好字段

创建 Task 前，Host 按当前用户指令和适用的 `AGENTS.md` 只读调查仓库。需要项目索引时，结合索引、
候选项目说明及代码与配置确定完整候选范围，再逐仓确认并准备工作树。所有读取遵守现有 Host 权限，
Core 保存经过确认的固定 Scope。

创建多仓库 Task 时，`repository_path` 是主仓库；调用可以增加一个主 key 和最多七个显式附加仓库：

```json
{
  "host": "codex",
  "repository_path": "/workspace/core",
  "workspace_origin": {
    "mode": "dedicated_worktree",
    "remote_name": "origin",
    "base_branch": "main",
    "base_commit": "<fetched-commit>",
    "task_branch": "feature/core-docs",
    "provisioning_receipt_id": "launch-core-docs"
  },
  "primary_repository_key": "core",
  "additional_repositories": [
    {
      "key": "docs",
      "repository_path": "/workspace/docs",
      "workspace_origin": {
        "mode": "dedicated_worktree",
        "remote_name": "origin",
        "base_branch": "main",
        "base_commit": "<fetched-commit>",
        "task_branch": "feature/docs",
        "provisioning_receipt_id": "launch-core-docs"
      }
    }
  ],
  "new_task": {
    "request": "同步 Core 与文档仓库中的接口说明",
    "initial_scope": [],
    "initial_out_of_scope": [],
    "known_acceptance_criteria": [],
    "method_profile": "plain"
  }
}
```

该示例只说明 closed MCP 输入形状，不是 shell 命令。`<fetched-commit>` 必须替换为实际 object ID。
创建时每个 repository 都必须带 receipt 证明的 `workspace_origin` 和非空 `new_task`；Core 从本地 Git
核对并补齐 source group、canonical root 与 worktree Git-dir。恢复时省略或设 `new_task=null`，
`repository_path` 指向原参与 worktree，并省略全部 Scope/origin 创建字段。总仓库数为一至八；附加
仓库按 key 排序，Scope 创建后不可变。多仓库 payload 路径使用
`<repository-key>::<repository-relative-path>`。

Task result 保留主 `repository`，增加 `primary_repository_key` 与 sorted
`additional_repositories`。当前 Action 中唯一的 `repository_binding_digest` 在单仓库 Task 中仍是
主 binding digest，在多仓库 Task 中是完整 Scope aggregate。活动 Task 的全部
`repository_claims` 与 snapshot/event 在同一 SQLite transaction 中 Acquire、Retain 或 Release。

`repository_claims` 使用可直接观察的 worktree-instance identity，不是整个 Git common directory。
linked worktree 共享逻辑仓库组标识，但 canonical root/worktree Git-dir 不同，因此可以分别持有活动
Task；同一实例只能持有一个活动 Task。Control Center 的 Task summary 公开只读 `repository_group_id` 和
`worktree_path`，详情中的每个 repository 也公开自己的 `repository_group_id`。

Task result 的 `verification` 同时返回 `plan`、`current_budget`、当前 Task Plan revision 的 `usage` 和
`adjustments`；在 TASKS 完成前，`plan` 与 `current_budget` 为 `null`。

`dev_flow_server_info({})` 的结果包含：

```json
{
  "host_preferences": {
    "codex": { "codebase_memory": false },
    "deepseek": { "codebase_memory": false }
  }
}
```

这些值来自只读用户配置的进程启动快照：macOS 为 `$HOME/.dev-flow/config.json`，Windows 为
`%USERPROFILE%\.dev-flow\config.json`。它们仅表示偏好，不表示索引能力已经安装或可用。文件不存在时
两者都为 false；Dev Flow 不创建或修改配置文件。

Host 选择检索工具时，当前用户指令和适用的 `AGENTS.md` 优先于这些默认偏好。没有相应指令时，
false 选择普通文件和文本搜索，true 可优先使用当前可用的代码索引。索引不可用或结果不完整时，
Host 在当前会话中至多提示一次并回到普通搜索；索引结果不改变已创建 Task 的 Scope。

自定义形象从宠物菜单的“选择形象 → 导入形象…”导入本地文件夹，支持单张 PNG、Dev Flow 动画包和
Codex 精灵图格式 1/2 的本地宠物包。形象与任务分别选择和保存，升级保留用户素材；同 ID 重导入更新，
校验失败保留原形象。导入 Codex 时转换为统一 PNG 帧，任务阶段与跳转仍由 Dev Flow 决定。格式与示例见
[形象包说明](DESKTOP-PETS.md)。
