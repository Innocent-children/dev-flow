# Dev Flow 本地 WebUI

[中文](WEBUI.md) | [English](WEBUI_en.md)

> Dev Flow 持久 Task、专属工作树和恢复状态的本地可视化与诊断入口。

Control Center 嵌入 Go Core，读取与 Codex、DeepSeek 相同的 SQLite Task。浏览器不保存第二份流程
状态，也不执行 fetch、branch、worktree、handoff 或清理。

## 可以查看什么

- 所有 Host 共用的 Task 概览、筛选列表、当前阶段、revision 和合法下一步；
- requirements、design、Task Plan、实现、测试、理解确认、evidence 和时间线；
- 每个仓库确认的 remote/base/base commit、task branch、worktree path 和 repository group；
- 当前 HEAD、clean/dirty、identity/history/content 摘要、Task surface 和当前 changed paths；
- 文件范围、验证刹车、历史冲突、relocation、Recovery 和 workspace unavailable 状态；
- provisioning receipt 身份、当前 Host、已完成验证，以及 keep/review/handoff/cleanup 后续选择；
- 当前 Core、数据目录和 runtime 状态。

界面支持简体中文和英文。首次跟随浏览器语言；手工选择只保存在浏览器，不进入 Core、Task、receipt
或账号状态。

## 可执行操作的边界

WebUI 不再从任意 checkout 创建新 Task。新 Task 必须由 Codex 或 DeepSeek 完成只读评估、用户确认、
fetch、专属工作树创建和验证后，再从目标 Host 调用 Core。

页面可以提交当前 Core 身份要求的语义操作：

- 解除文件范围、验证或历史 blocker；
- 为同机 Host relocation 创建 Core blocker，并在 Host 已完成 handoff 后提交目标路径；
- 在工作树仍可观察时取消 Task；
- 在原工作树确实丢失时，用精确 revision 和非空原因显式 abandon；
- 对终态 Task 进行 archive 或明确的不可逆数据清理。

实际 handoff、worktree 删除和 branch 删除属于 Host。worktree 与 branch 是两个独立授权；页面不会
自动清理 active、dirty、未推送、来源不明或状态不确定的对象。

计划外结构化写入仍由 Host 在写前调用 Core。Bash、外部进程或其他工具的写入可能先发生，Core 在
下一次 Task 读取或 Action 前从 Git 观察中发现。专属工作树内没有“忽略外部改动”的选项。

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
`$HOME/Library/Application Support/dev-flow/data`，Windows 位于 `%LOCALAPPDATA%\dev-flow\data`。
Codex 与 DeepSeek 共用这份数据。

React、TypeScript 和 Vite 只参与构建；静态资产嵌入 Core binary，运行时不需要 Node server、CDN、
外部字体或独立 WebUI package。完整命令见[命令参考](COMMANDS.md)，协议见
[Architecture](ARCHITECTURE.md)，稳定范围见[支持矩阵](SUPPORT-MATRIX.md)。

## 当前不支持

- 远程访问、账号、团队权限或云端同步；
- 由浏览器执行 shell、文件编辑、Git mutation、Host handoff 或发布；
- 由浏览器创建共享 checkout Task 或自动补建丢失的工作树；
- 用户自定义流程图或第二份 Task 状态。
