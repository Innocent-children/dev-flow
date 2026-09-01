# Dev Flow 本地 WebUI

[中文](WEBUI.md) | [English](WEBUI_en.md)

> Dev Flow 持久任务状态的本地可视化与诊断入口。

Control Center 嵌入 Go Core，读取与 Host 相同的本地 Task 数据。浏览器不保存第二份流程状态，所有
读取和操作都经过当前 Core。

## 可以查看什么

- 所有 Host 共用的 Task 概览和筛选列表；
- 当前阶段、范围、revision、Action 和合法下一步；
- 时间线、流程图、测试与理解确认记录，以及最近三次测试尝试；
- Recovery 判断、自动刹车 Blocker 和需要满足的恢复或继续条件；
- Task Plan 预计路径、累计实际修改路径、文件范围决定和没有说明的路径；
- 主仓库、附加仓库以及高级 worktree 视图；
- 当前 Core、数据目录和运行状态。

界面支持简体中文和英文。首次打开时跟随浏览器语言，手工选择只保存在当前浏览器，不进入 Core、
Task 或账号状态。

自动刹车触发后，页面显示具体重复原因、原本要返回的阶段和当前解除条件。页面不会替用户自动解除；
用户可以明确允许一次继续，或取消 Task。解除后如果下一次测试仍然完全重复，Task 会再次暂停。

文件范围 blocker 会预填当前 blocker 身份和仓库观察，展示 `allow_once`、`expand_scope` 与 `reject`
三个选择，并要求填写原因。文件范围卡片同时显示 ExpectedPaths 数量、Task 实际修改路径、决定数量、
Host 写前覆盖的工具和未说明路径。页面明确区分 Host 对结构化工具的写前检查与 Core 在进入测试和
`DONE` 前的最终检查；它不声称能够拦截 Bash、外部进程或所有专用工具。

## 启动、打开、查看状态和停止

推荐使用统一入口：

```bash
dev-flow webui start
dev-flow webui status
dev-flow webui open
dev-flow webui stop
```

`start` 默认打开浏览器；`--no-open` 只启动进程。所有命令支持 `--plain` 或 `--json`。公共
`dev-flow webui start` 可以按 mode `0700` 创建缺失的产品默认数据目录，其他命令不创建目录。

设置显式数据目录时，它必须已经存在、可以 canonicalize 且不经过符号链接：

```bash
export DEV_FLOW_DATA_DIR="/absolute/path/to/existing-directory"
dev-flow webui start
```

## 本机与单用户边界

服务只监听 `tcp4 127.0.0.1` 的系统分配端口，不提供远程监听。页面写操作检查精确 Origin、当前
进程生成的随机 session 值和 Task revision；页面过期或 revision 变化会使旧表单失效。

这些检查用于防止本机误请求和陈旧页面操作，不是账号认证，也不提供多用户隔离。

## runtime receipt 的作用

mode `0600` 的 runtime receipt 记录 PID、进程启动身份、data-root digest 和 loopback URL。Codex 与
DeepSeek 携带的兼容 Core 通过它复用同一个进程和 SQLite 数据，而不是各自创建一份 Task 状态。

停止或卸载时，只有 receipt 中的 PID、启动身份和数据目录全部匹配，才会向进程发送停止信号。
校验失败会中止后续卸载，避免停止或删除不属于当前安装的对象。

## 状态

`status` 区分：

| 状态 | 含义 |
| --- | --- |
| `ready` | 当前 Core 和数据可正常使用 |
| `read_only` | 可以读取，但当前不开放写操作 |
| `reset_required` | 数据 Schema 不兼容，需要先查看 reset 计划 |
| `incompatible` | 当前 Core 或运行实例不兼容 |
| `unavailable` | 没有可用实例或无法读取状态 |

## 旧数据 reset

不兼容或启用前数据采用 `reject-and-reset`。普通启动保持零写入并返回 `reset_required`。reset 只能从
CLI 执行，浏览器没有 reset 操作：

```bash
dev-flow webui reset
dev-flow webui reset --confirm <当前计划返回的 TOKEN>
```

第一条命令只展示当前 canonical database 和现有 SQLite sidecar 的精确目标。token 与这些目标绑定；
确认时 Core 先获得数据库独占访问并再次核对目标。锁失败、token 不匹配或目标变化都不删除数据。
成功后只清理确认的 Task 数据并创建当前空 Schema；Host package、注册、用户配置和无关文件保留。

## 数据与制品

默认 Task 数据位于本机产品数据目录。Codex 与 DeepSeek 共用同一数据，不属于浏览器缓存或 Host
聊天记录。React、TypeScript 和 Vite 只参与构建；HTML、JavaScript、CSS、SVG 和 manifest 都嵌入
Core binary，运行时不需要 Node server、CDN、外部字体或独立 WebUI package。

## 当前不支持

- 远程访问、账号、团队权限或云端同步；
- shell、文件编辑、Git 写入或发布操作；页面只提交 Core 文件范围决定；
- 浏览器内 reset；
- 用户自定义流程图或自动历史数据迁移；
- 把 WebUI 作为另一份 Task 状态来源。

公开稳定 package 是否携带当前源码能力，以[项目状态](PROJECT-STATUS.md)和
[支持矩阵](SUPPORT-MATRIX.md)为准。完整 CLI 参数见[命令参考](COMMANDS.md)，协议原理见
[Architecture](ARCHITECTURE.md)。
