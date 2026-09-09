# Dev Flow 本地 WebUI

[中文](WEBUI.md) | [English](WEBUI_en.md)

> Dev Flow 持久 Task、专属工作树和恢复状态的本地可视化与诊断入口。

Control Center 嵌入 Go Core，读取与 Codex、DeepSeek 相同的 SQLite Task。浏览器不保存第二份流程
状态，也不执行 fetch、branch、worktree、handoff 或清理。

## 可查看的信息

- 所有 Host 共用的 Task 概览、筛选列表、当前阶段、revision 和合法下一步；
- 需求、设计、任务计划、实现、测试、理解确认、验证记录和时间线；TASKS 前明确显示验证尚未计划；
- 每个仓库确认的 source/base/base commit、task branch、worktree path 和 repository group；
- 当前 HEAD、clean/dirty、identity/history/content 摘要、Task surface 和当前 changed paths；
- 验证计划中的检查及理由、初始/当前预算、当前计划已用命令、完整套件次数和历次增加原因；
- 文件范围、验证刹车、历史冲突、relocation、Recovery 和 workspace unavailable 状态；
- provisioning receipt 身份、当前 Host、已完成验证，以及 keep/review/handoff/cleanup 后续选择；
- 当前 Core、数据目录和 runtime 状态。

界面支持简体中文和英文。首次跟随浏览器语言；手工选择只保存在浏览器，不进入 Core、Task、receipt
或账号状态。

验证区块显示是否已完成规划、计划检查、完整套件和测试代码预期、当前计划消耗，以及每次有理由的额度增加。旧计划记录保留在时间线中。WebUI 展示 Core 结果，实际检查由 Host 决定并执行。

## 可执行操作的边界

新 Task 由 Codex 或 DeepSeek 完成只读评估、用户确认、来源解析及专属工作树准备，再从目标 Host 创建；页面负责展示和处理已有任务。

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

## 桌面入口与文件错误

桌面宠物可以打开所选 Task 的 WebUI，使用本地开发包与已配置 Adapter 提供的 Core。安装、操作和形象说明见[桌面宠物指南](DESKTOP-PETS.md)。

提交流程文件漏报时，页面分别展示遗漏的仓库路径和请求字段错误。只有 Core 确认零写入并明确允许时，才能仅纠正列出的 artifact 字段一次。工作树与历史异常继续使用对应恢复规则。集成字段见[文件收集与提交](ARTIFACTS.md)。

任务详情展示已确认的工作树来源及本地内容携带选择。创建与来源选择在 Host 中完成，见[工作树来源](WORKTREE-SOURCES.md)。

原计划中的检查可因补做或重跑增加验证额度。页面保存具体原因和增加量，不因此产生通过结果。
