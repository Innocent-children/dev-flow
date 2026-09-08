# Dev Flow 本地 WebUI

[中文](WEBUI.md) | [English](WEBUI_en.md)

> Dev Flow 持久 Task、专属工作树和恢复状态的本地可视化与诊断入口。

Control Center 嵌入 Go Core，读取与 Codex、DeepSeek 相同的 SQLite Task。浏览器不保存第二份流程
状态，也不执行 fetch、branch、worktree、handoff 或清理。

## 可查看的信息

- 所有 Host 共用的 Task 概览、筛选列表、当前阶段、revision 和合法下一步；
- 需求、设计、任务计划、实现、测试、理解确认、验证记录和时间线；TASKS 前明确显示验证尚未计划；
- 每个仓库确认的 remote/base/base commit、task branch、worktree path 和 repository group；
- 当前 HEAD、clean/dirty、identity/history/content 摘要、Task surface 和当前 changed paths；
- 验证计划中的检查及理由、初始/当前预算、当前计划已用命令、完整套件次数和历次增加原因；
- 文件范围、验证刹车、历史冲突、relocation、Recovery 和 workspace unavailable 状态；
- provisioning receipt 身份、当前 Host、已完成验证，以及 keep/review/handoff/cleanup 后续选择；
- 当前 Core、数据目录和 runtime 状态。

界面支持简体中文和英文。首次跟随浏览器语言；手工选择只保存在浏览器，不进入 Core、Task、receipt
或账号状态。

验证区块只显示 Core 保存的结构化状态。TASKS 完成前 `plan` 与 `current_budget` 为空；完成后显示计划
检查、完整套件和测试代码预期。`usage` 只统计当前 Task Plan revision，旧计划记录仍可在事实和时间线
中查看。每条预算增加显示依据、原因、新增检查、增加量和调整后预算。WebUI 不根据剩余额度替 Host
决定是否运行完整套件，也不执行验证命令。

## 可执行操作的边界

WebUI 不再从任意 checkout 创建新 Task。新 Task 必须由 Codex 或 DeepSeek 完成只读评估、用户确认、
fetch、专属工作树创建和验证后，再从目标 Host 调用 Core。

页面可以使用 Core 当前返回的任务和操作标识，提交以下操作：

- 解除文件范围、验证或历史 blocker；
- 使用当前 TEST Action 的 `verification_budget_increased` 保存有具体原因的预算增加；
- 为同机 Host relocation 创建 Core blocker，并在 Host 已完成 handoff 后提交目标路径；
- 在工作树仍可观察时取消 Task；
- 在原工作树确实丢失时，用精确 revision 和非空原因显式 abandon；
- 对终态 Task 进行 archive 或明确的不可逆数据清理。

实际 handoff、worktree 删除和 branch 删除属于 Host。worktree 与 branch 是两个独立授权；页面不会
自动清理 active、dirty、未推送、来源不明或状态不确定的对象。

计划外结构化写入仍由 Host 在写前调用 Core。Bash、外部进程或其他工具的写入可能先发生，Core 在
下一次 Task 读取或 Action 前从 Git 观察中发现。专属工作树内没有“忽略外部改动”的选项。

## 完成条件与操作恢复

进入 TEST 前，当前 Task Plan 的全部工作项必须已经完成。DELIVERY 逐条接收明确的验收结果，每项关联已完成且对应此验收条件的工作项，以及当前 Test 中通过的检查。自动检查、静态检查、Host 观察和明确人工检查均可使用；理解确认仍单独保存，不自动代替验收检查。遗漏、错误或过期引用会使提交被拒绝。

WebUI 与 MCP 共用 Core 的语义提交、操作保存和恢复流程。Core 保存规范化载荷，页面只提交当前 Task revision、Action ID 和语义结果。网络异常先回读 Core；页面重新打开后仍能发现待恢复操作，并按 Action ID 恢复。无效完成结果不会推进任务或保存操作。

### Action HTTP 字段

| 路径 | 请求字段（另含 csrf） |
| --- | --- |
| `POST /api/tasks/{task_id}/actions/submit` | request_id、task_revision、action_id、payload；payload 使用当前表单返回的语义字段 |
| `POST /api/tasks/{task_id}/recovery/assess` | action_id |
| `POST /api/tasks/{task_id}/recovery/apply` | action_id |

详情的 `pending_action_id` 为空时表示当前读取没有待应用操作；存在时页面显示恢复入口。Core 的再次读取和 Action 校验决定实际执行结果。

## 启动、打开、查看状态和停止

```bash
dev-flow webui start
dev-flow webui status
dev-flow webui open
dev-flow webui stop
```

`start` 默认打开浏览器；`--no-open` 只启动进程。所有命令支持 `--plain` 或 `--json`。默认数据目录
缺失时，只有 `start` 可以创建它：macOS 使用 mode `0700`，Windows 使用当前用户 LocalAppData ACL。
显式 `DEV_FLOW_DATA_DIR` 必须已经存在、可以 canonicalize 且不经过符号链接。

```bash
export DEV_FLOW_DATA_DIR="/absolute/path/to/existing-directory"
dev-flow webui start
```

```powershell
$env:DEV_FLOW_DATA_DIR = "C:\absolute\existing-directory"
dev-flow webui start
```

## 本机单用户边界

服务只监听系统分配的 `tcp4 127.0.0.1` 端口。页面 mutation 检查精确 Origin、当前进程生成的随机
session 值和 Task revision；过期页面不能提交旧操作。这些检查防止本机误请求，不是账号认证或
多用户隔离。同一用户或管理员权限的进程仍在本地信任边界内。

runtime receipt 绑定 PID、进程启动身份、data-root digest 和 loopback URL。停止或卸载只操作 receipt
精确匹配的进程。它与 Host 的 provisioning receipt、Core Action operation 和 relocation record
职责不同，互不代替。

## 状态和数据

`status` 返回 `ready`、`read_only`、`incompatible` 或 `unavailable`。默认 Task 数据在 macOS 位于
`$HOME/.dev-flow/data`，Windows 位于 `%LOCALAPPDATA%\dev-flow\data`。
Codex 与 DeepSeek 共用这份数据。

React、TypeScript 和 Vite 只参与构建；静态资产嵌入 Core binary，运行时不需要 Node server、CDN、
外部字体或独立 WebUI package。完整命令见[命令参考](COMMANDS.md)，协议见
[Architecture](ARCHITECTURE.md)，稳定范围见[支持矩阵](SUPPORT-MATRIX.md)。

## 当前不支持

- 远程访问、账号、团队权限或云端同步；
- 由浏览器执行 shell、文件编辑、Git mutation、Host handoff 或发布；
- 由浏览器创建共享 checkout Task 或自动补建丢失的工作树；
- 用户自定义流程图或第二份 Task 状态。

## 桌面任务入口

macOS arm64 的桌面宠物通过包含 `DevFlowPet.app` 的本地开发包使用，运行时复用已配置的 Codex 或 DeepSeek Adapter 提供的 Core。
当前常规 npm 清单与正式制备流程不包含原生应用，获取方式以[桌面宠物指南](DESKTOP-PETS.md#本地构建与安装)为准。
宠物显示一个所选 Task 的保存状态并打开对应 WebUI；Core 决定任务状态，展示不代表 Host 实时活动或完成百分比。

形象可使用单张 PNG、原生动画包、Codex 标准格式 1/2 图集或 Dev Flow 高分辨率扩展。五类任务动作是基础要求，附加素材决定能否散步、挥手或思考；
只有 Codex 布局图集固定提取九类、57 帧。待机活动有独立开关，任务提示优先，自动位移保留手动摆放位置。
程序更新、已有应用副本替换和素材重导入分别处理；安装、全部动作规则与常见问题统一见[桌面宠物指南](DESKTOP-PETS.md)。

本地宠物包保留默认形象；鲸鱼娘等自定义形象作为独立素材包，通过“导入形象…”安装。素材保存在用户目录，程序更新保留已导入形象。

## Windows 桌面功能

Windows 10/11 x64 的桌面宠物提供与 macOS 对齐的任务选择与状态气泡、WebUI 跳转、托盘/右键菜单、PNG/SVG 静态和原生动画形象、Codex PNG/WebP 图集导入、九类动作、拖动、六档缩放、隐藏恢复与独立启停。Windows 使用独立 Electron 实现，macOS 保留 Swift/AppKit；两者只读取 Core 状态。Windows 本地包由 `scripts/build-desktop-pet-windows.mjs` 构建，用户数据位于 `%LOCALAPPDATA%\dev-flow\pet`。构建、安装、更新与验证见[桌面宠物指南](DESKTOP-PETS.md)。

当前 Windows 开发包同时包含两个 Adapter 包和桌面应用。安装统一入口包后，使用 `dev-flow install --host all --yes` 与 `dev-flow pet start`。修复、重装均通过同一入口执行，校验内置包摘要、更新桌面应用，并保留 Task 数据、设置和形象。
