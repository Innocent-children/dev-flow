# Host Permission and User Configuration Contract

## 配置文件

固定路径：

```text
$HOME/.dev-flow/config.json
```

有效样例：

```json
{
  "codex": {
    "codebase_memory": false
  },
  "deepseek": {
    "codebase_memory": true
  }
}
```

顶层 `codex`、`deepseek` 可省略；Host object 内 `codebase_memory` 可省略。所有省略值均为 false。
如果文件存在，顶层必须是 object，Host 值必须是 object，偏好必须是 JSON boolean；`null` 不表示
缺省。

## 读取行为

Core 启动 MCP 时：

1. 从 HOME 解析唯一固定路径；
2. 在 `store.Open` 之前只读打开文件；
3. 目录或文件不存在时返回 false/false，不创建任何路径；
4. 文件存在时限制为最多 16 KiB，并使用 Go 标准库 closed decode；
5. 拒绝非法 UTF-8/JSON、duplicate member、未知顶层 Host、未知 Host 字段、trailing JSON、null 或
   非布尔偏好；
6. 不可读、超限或格式错误时向 stderr 返回有界、可定位错误并停止启动；
7. 成功值成为该 MCP 进程的只读快照，文件后续变化在下次启动生效。

配置失败发生在 SQLite 打开前，因此不创建数据库，不创建或修改 Task、event、claim。Dev Flow 不
提供配置 CLI、MCP 写接口、热重载或项目级 override。

## server_info 投影

`dev_flow_server_info({})` 返回：

```json
{
  "host_preferences": {
    "codex": { "codebase_memory": false },
    "deepseek": { "codebase_memory": true }
  }
}
```

Host 只读取自己的 entry。该值不证明工具存在，也不授予文件权限；它不进入 Task Snapshot、Action
identity、process digest、repository binding、changed paths、Recovery、Blocker 或 Outcome。

## codebase-memory 行为

### `codebase_memory=false`

- Host 不调用 codebase-memory；
- 使用 Host 自带 Git 只读检查、文件读取和文本检索；
- 不提示安装。

### `codebase_memory=true`

- 如果能力已经安装、可见且适合当前代码发现，Host 可以优先调用；
- 如果缺失、不完整或中途不可用，Host 在当前会话最多提示一次并立即回退内置检索；
- 缺失不会阻止 Task 或改变 Core result；
- Dev Flow 不安装、下载、配置、启动、升级、修复或卸载该工具。

索引结果不能发现/扩展 Repository Scope，不能作为目录权限、repository binding 或 mutation 完成
证据，也不能决定节点、Transition、Recovery 或 Outcome。

## Codex 权限合同

- 当前 Git 仓库是主仓库；
- 附加仓库必须位于用户启动当前 Codex 会话时已经授权的 additional writable roots；
- Host 在调用 `dev_flow_open_task` 创建 Task 前完成该检查，未授权时零 task-bearing Core call；
- Dev Flow 不编辑 Codex 配置、不切换 sandbox、不请求 unrestricted 模式；
- 真实两仓库 Journey 只使用现有 `workspace-write`、`--cd <primary>` 和用户显式的
  `--add-dir <additional>`；
- 已创建 Task 的权限在 Action 前失效时，Codex 报告权限问题并停止该仓库修改，不伪造成功 payload。

## DeepSeek 权限合同

- 当前 DSH `Workspace Root` 是所有参与仓库的 canonical containment boundary；
- Root 可以是非 Git 共同父目录；主仓库和附加仓库分别是其下独立 Git repo；
- 现有 Host authorization guard 在 task-bearing open 调用前校验所有声明路径和 symlink 解析结果；
- 任一仓库位于 Root 外时拒绝调用，Core Task/claim 零写入；
- codebase-memory 的索引覆盖范围不能放宽 Workspace Root；
- 从任一参与仓库恢复时，传入路径仍必须位于同一 Root。

## 共同边界

Codex 与 DeepSeek 使用相同的 Repository Scope、scoped path、Action 和
`repository_binding_digest` 合同。Host 权限结果不写回 Core 为第二流程状态；Core 只观察用户/Host
已经放入请求的仓库，并继续只读 Git。仓库文件修改仅由获得用户授权的 Host 执行。
