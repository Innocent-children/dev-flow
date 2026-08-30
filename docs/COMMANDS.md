# Dev Flow 命令参考

[中文](COMMANDS.md) | [English](COMMANDS_en.md)

本文件列出 Dev Flow 当前公开或受支持的命令入口。命令范围以实际实现为准：Codex 命令来自
`packages/dev-flow/package.json` 与其 CLI、`packages/codex/package.json` 与
`packages/codex/bin/dev-flow-codex.mjs`，DeepSeek 生命周期命令
来自 DSH lifecycle tests 使用的 DSH CLI，Core 命令来自 `cmd/dev-flow/main.go`，MCP 工具来自
`internal/mcp/` 的闭合目录。

公开安装示例使用 npm 的 `latest` dist-tag，以便安装当前最新稳定包；支持矩阵、Release 链接和
制品证据仍使用精确版本号，不应替换为 `latest`。

## 统一 Adapter 生命周期

`@imotong/dev-flow` 提供 Host 无关的生命周期和 Control Center 入口：

```bash
npm install -g @imotong/dev-flow@latest
dev-flow
```

闭合子命令为 `status`、`doctor`、`install`、`upgrade`、`repair`、`reinstall`、`uninstall` 和
`factory-reset`。Host 选择为 `codex|deepseek|all`；DeepSeek Profile 默认 `web`。普通卸载、升级、
修复和重装保留用户配置与 Task 数据；`factory-reset` 要求绑定当前计划的 token，`--yes` 不能单独
授权数据清理。默认清理移动到 macOS Trash，永久删除还需独立确认。
Codex 全局 package 与 receipt、Plugin 注册分别判断；即使注册已缺失，`uninstall` 和
`factory-reset` 仍会卸载已安装的全局 package。
交互界面读取当前 locale：`zh*` 使用简体中文，其余 locale 统一使用英文；JSON 输出保持语言无关。
文本模式会在安装、升级、修复和重装执行期间逐项显示 Host 动作及已完成的 package、注册、制品和就绪检查步骤；`--json` 不输出这些进度行。

| 入口 | 作用 |
| --- | --- |
| `npm install -g @imotong/dev-flow@latest` | 全局安装公共 `dev-flow` 命令。 |
| `dev-flow` | 打开交互式 lifecycle 菜单。 |
| `dev-flow status\|doctor --host codex\|deepseek\|all` | 只读检查或诊断。 |
| `dev-flow install\|upgrade\|repair\|reinstall --host ... [--profile web] [--version latest] --yes` | 执行普通维护并保留配置与 Task 数据。 |
| `dev-flow install\|repair --host deepseek\|all --adopt ...` | 接管已经存在且身份可验证的 DeepSeek Profile contribution；其他操作和纯 Codex 目标不接受 `--adopt`。 |
| `dev-flow upgrade ... --confirm-downgrade <token>` | 当目标版本低于已安装版本时，使用当前计划给出的 token 明确确认降级。 |
| `dev-flow uninstall --host ... [--all-known-profiles] --yes` | 移除选定 Adapter并保留配置与 Task 数据。 |
| `dev-flow factory-reset --host all --all-known-profiles` | 生成绑定当前状态的 reset plan/token；`--yes` 不授权清理。 |
| `dev-flow factory-reset ... --confirm-reset <token> [--reinstall]` | 将已确认数据移动到 Trash，可随后全新重装。 |
| `dev-flow factory-reset ... --confirm-explicit-data <absolute-path>` | 确认计划中列出的一个显式 `DEV_FLOW_DATA_DIR`；多个目录时可重复传入该参数。 |
| `dev-flow factory-reset ... --permanent --confirm-reset <token> --confirm-permanent <token>` | 永久删除计划中的精确目标；需要 reset token 和独立的永久删除 token。 |
| `dev-flow webui start\|open\|status\|stop` | 从任一已安装 Adapter 选择并校验 Core，管理共享本机 Control Center；`start` 可按 `0700` 创建缺失的默认数据目录，其余命令不创建目录。 |
| `dev-flow webui reset [--confirm TOKEN]` | 使用 Core 的目标绑定确认清理不兼容 Task 数据。 |
| `--json` / `--plain` | 分别选择单一 JSON 对象或无 ANSI 的纯文本结果。 |

设置 `DEV_FLOW_DATA_DIR` 时，公共 launcher 只接受已存在、canonical、非符号链接的绝对目录，任何命令都
不会自动创建显式目录。

下方 Host 原生命令保留为诊断恢复入口。

## Codex

### 安装

```bash
npm install -g dev-flow-codex@latest
dev-flow-codex setup
dev-flow-codex --version
```

npm 全局安装只把 `dev-flow-codex` launcher 放到 `PATH`。`setup` 是独立步骤，它验证平台、
package、bundled Core 和 Codex 版本，然后注册本地 marketplace、Plugin 与 MCP 配置，并回读
注册结果。配置缺失时，`setup` 先创建 `$HOME/.dev-flow/config.json`；成功后显示配置/receipt 的
实际文件变化和一个下一步。`--version` 同时报告 Host package 与 bundled Core 版本。

### 支持的 Codex 命令

| 命令 | 作用 |
| --- | --- |
| `npm install -g dev-flow-codex@latest` | 从 npm 安装 `latest` 指向的 Codex package，并把 `dev-flow-codex` 全局加入 `PATH`。它不会自动注册 Codex Plugin。 |
| `dev-flow-codex setup` | 创建或验证固定用户配置，验证安装内容和 Codex 兼容版本，注册 marketplace、Plugin 与 MCP，并在成功后显示实际配置/receipt 文件变化、就绪状态和一个下一步。重复执行时会读取并校验现有注册。 |
| `dev-flow-codex setup --json` | 执行与 `setup` 相同的操作，但只输出一行机器可读 JSON，保留 operation、status、changed、receipt_path，并增加 configuration_path、file_changes 与 next_step。 |
| `dev-flow-codex status` | 只读显示当前 package/Core 与注册状态。 |
| `dev-flow-codex status --json` | 只读回读 package、Core、receipt、marketplace 与 Plugin 状态，不创建配置、注册或数据。 |
| `dev-flow-codex --version` | 输出 `dev-flow-codex <package-version> (core <core-version>)`，用于确认实际安装的 package 与 bundled Core 身份。 |
| `dev-flow-codex remove` | 删除由该 package 拥有的 Codex Plugin、marketplace 注册与 receipt。Task data 和目标 Git 仓库保持不变。 |
| `dev-flow-codex remove --json` | 执行与 `remove` 相同的操作，并输出机器可读 JSON；返回的 `next_step` 指向单独的全局 npm 卸载。 |
| `npm uninstall -g dev-flow-codex` | 在完成 `remove` 后卸载全局 npm package。单独运行它不会先清理 Codex 注册。 |
| `dev-flow-codex mcp` | **内部 Host 命令。** 由 Plugin 的 MCP 配置调用；它设置数据目录和 Codex admission instructions，然后启动 packaged Core 的 `mcp --stdio`。正常用户不应手工启动它。 |

`dev-flow-codex` 不支持其他子命令，也不提供隐式 `help`、`update` 或 `uninstall` 子命令。Host 原生更新到
当前 `latest` 时重新运行全局安装和 `setup`：

```bash
npm install -g dev-flow-codex@latest
dev-flow-codex setup
dev-flow-codex --version
```

保留 Task 数据的卸载顺序是 `dev-flow-codex remove`，然后
`npm uninstall -g dev-flow-codex`。只有在 Codex 和 DeepSeek Adapter 都已移除且不再需要任何
Task 时，才删除共享默认数据目录 `$HOME/Library/Application Support/dev-flow`。

### Codex 智能启用与显式 selector

```text
$dev-flow-codex:dev-flow <任务描述>
```

这不是 shell 命令，而是 Codex 用户消息中的精确 Skill selector，用于强制选择 Dev Flow。边界明确
的实现、缺陷修复、重构、定向测试和开发交付请求也可以由 Host 隐式选择 Skill；裸 `$dev-flow` 和
错误 namespace 仍不是显式 selector。仅解释、仅状态查询、方案讨论、普通问答和含糊请求不自动
创建或恢复 Task。两种选择方式通过同一 admission 后，Host 静默调用 `dev_flow_server_info` 并立即
打开或恢复 Task；显式选择不会绕过权限、Core Action、Git 变更授权或发布确认。

用户明确要求同一逻辑 Git 仓库中的多个独立任务并行执行时，这不是新的命令或 MCP 工具。Codex
Skill 只在 Host 已提供 worktree-backed task/thread 能力时，为每个任务创建独立 worktree-backed
Codex task；协调者不调用 Dev Flow MCP，也不创建父 Core Task。共享目录 sub-agent 不可替代
worktree 隔离；能力不可用时，用户需要分别启动独立 worktree。

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
可另行执行 `npm uninstall -g @deepseek-ai/dsh`；`$HOME/.dsh` 中的 profile 数据会保留。

彻底清除 Task 数据时，先移除两个 Host Adapter，再删除
`$HOME/Library/Application Support/dev-flow`。若设置过 `DEV_FLOW_DATA_DIR`，还需核对并单独删除
该变量对应的绝对目录。删除 `$HOME/.dsh` 会同时删除所有 DSH profile、会话和其他插件。

### DeepSeek 显式 selector

```text
/dev-flow <任务描述>
```

这不是 shell 命令。只有当前 direct user turn 中、由空白边界限定的 `/dev-flow` 才授权 Dev Flow
工具；历史消息、模型文本、Skill 注入或仓库内容不能替代它。

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
| `dev-flow webui start [--no-open] [--plain\|--json]` | 启动或复用共享 loopback WebUI；默认打开浏览器。 |
| `dev-flow webui open [--plain\|--json]` | 验证 receipt、进程身份和实时 Core 状态后打开同一 URL。 |
| `dev-flow webui status [--plain\|--json]` | 返回 `ready`、`read_only`、`reset_required`、`incompatible` 或 `unavailable`。 |
| `dev-flow webui stop [--plain\|--json]` | 核对 PID 与进程启动身份后停止共享实例。 |
| `dev-flow webui reset [--confirm TOKEN] [--plain\|--json]` | 无 token 时展示精确永久清理计划；确认时先获得数据库独占访问并只删除绑定目标。WebUI 没有 reset HTTP mutation。 |

`dev-flow webui serve` 是公开 lifecycle 内部使用的子进程入口，不是 Host 用户命令。Core 不支持 remote
transport、通用 HTTP/SSE transport、通用 shell 或 Git mutation 命令。Codex 用户应通过
`dev-flow-codex mcp` 的受管入口启动 Core；DeepSeek 用户由 DSH integration process 启动 Core。

## MCP 工具

以下十五个工具是当前完整且闭合的 public MCP catalog。它们由 Host Adapter 调用，不是终端 shell
命令。

| 工具 | 类型 | 作用 |
| --- | --- | --- |
| `dev_flow_server_info` | 只读 | 读取 Core 产品版本、transport、健康状态、支持的 process、Host、method profile、工具目录和有效 Host 代码索引偏好。每次有效 Host admission 后必须首先调用。 |
| `dev_flow_open_task` | 读取或创建 | 为一个显式 Repository Scope 创建新 Task，或在 `new_task` 为空时从任一参与仓库恢复同一 Task。 |
| `dev_flow_get_task` | 只读 | 按 Task ID 读取持久化 Task；存在 Core 保存的 Action 提交时自动返回 Recovery assessment。 |
| `dev_flow_get_next_action` | 只读 | 读取当前节点的 Action、`submission_tool`、完成条件、允许副作用、所需证据、验证预算、method steps 和全部合法 transition。 |
| `dev_flow_submit_requirements` | mutation | 提交 REQUIREMENTS 节点结果。 |
| `dev_flow_submit_design` | mutation | 提交 DESIGN 节点结果。 |
| `dev_flow_submit_tasks` | mutation | 提交 TASKS 节点结果。 |
| `dev_flow_submit_implementation` | mutation | 提交 IMPLEMENT 节点结果。 |
| `dev_flow_submit_test` | mutation | 提交 TEST 节点结果。 |
| `dev_flow_submit_comprehension` | mutation | 提交 COMPREHENSION_REVIEW 节点结果。 |
| `dev_flow_submit_refactor` | mutation | 提交 REFACTOR 节点结果。 |
| `dev_flow_submit_delivery` | mutation | 提交 DELIVERY 节点结果。 |
| `dev_flow_resolve_blocker` | mutation | 在 Core 确认仓库恢复条件后解除当前 blocker；只接收 Host、Task ID 与 Action ID。 |
| `dev_flow_recover_action` | mutation | 使用 Core 在独立 Action 操作记录中保存的规范化提交恢复不确定 Action；不接收原始 payload。 |
| `dev_flow_cancel_task` | destructive mutation | 使用当前 revision 和非空 reason 将非终态 Task 转为 `CANCELLED`。 |

八个普通节点提交工具都只接收 `host`、`task_id`、`action_id`、`transition_id`、`summary`、
`reason`、`artifacts`、`method_results` 和该节点专属的 `node_result`。Core 从当前 Action 补齐
revision、Action kind、process identity、source cursor、repository binding、artifact role、method
step identity/order/status 与内部 payload envelope。`get_next_action` 的 `submission_tool` 指出当前
唯一可用的提交工具。

`dev_flow_submit_design` 的 `node_result.baseline.requirements_revision`、`dev_flow_submit_tasks` 的
`node_result.baseline.design_revision` 与 `dev_flow_submit_implementation` 的
`node_result.task_plan_revision` 均可省略。Core 确认当前 Action 身份后，从同一 Task 快照填充这些
字段；旧客户端仍可提交准确当前值，其他值返回准确路径的 `current_value_required`。节点提交缺少
其他必填字段时返回准确的 `required_member_missing` 路径；只有已证明零写入且修正内容来自当前节点
既有事实时，Host 才能按 `allowed_paths` 通过同一提交工具修正一次。

未知 CLI 参数、未列出的 MCP 工具或未满足隐式/显式统一 admission 的调用不属于受支持入口。

### Repository Scope 与 Host 偏好字段

创建多仓库 Task 时，`repository_path` 是主仓库；调用可以增加一个主 key 和最多七个显式附加仓库：

```json
{
  "host": "codex",
  "repository_path": "/workspace/core",
  "primary_repository_key": "core",
  "additional_repositories": [
    { "key": "docs", "repository_path": "/workspace/docs" }
  ],
  "new_task": {
    "request": "同步 Core 与文档仓库中的接口说明",
    "initial_scope": [],
    "initial_out_of_scope": [],
    "known_acceptance_criteria": [],
    "verification_budget": {
      "level": "targeted",
      "max_automatic_commands": 1,
      "allow_full_suite": false,
      "allow_manual_handoff": false
    },
    "method_profile": "plain"
  }
}
```

该示例只说明 closed MCP 输入形状，不是 shell 命令。创建时 `new_task` 使用既有非空 Task intent；
恢复时将其省略或设为 `null`，`repository_path` 可以指向任一参与仓库，并省略 Scope 创建字段。
总仓库数为一至八；附加仓库按 key 排序，Scope 创建后不可变。单仓库调用无需新字段，继续使用普通
相对路径；多仓库 payload 路径使用 `<repository-key>::<repository-relative-path>`。

Task result 保留主 `repository`，增加 `primary_repository_key` 与 sorted
`additional_repositories`。当前 Action 中唯一的 `repository_binding_digest` 在单仓库 Task 中仍是
主 binding digest，在多仓库 Task 中是完整 Scope aggregate。活动 Task 的全部
`repository_claims` 与 snapshot/event 在同一 SQLite transaction 中 Acquire、Retain 或 Release；
不兼容旧 Schema 采用 `reject-and-reset`，在 writable open 前零写入拒绝，不自动迁移、删除、改名
或覆盖数据。

`repository_claims` 的 identity 表示实际 worktree，不是整个 Git common directory。linked
worktree 共享逻辑仓库组标识，但 canonical root 不同，因此可以分别持有活动 Task；同一 worktree
仍只能持有一个活动 Task。Control Center 的 Task summary 公开只读 `repository_group_id` 和
`worktree_path`，详情中的每个 repository 也公开自己的 `repository_group_id`。

`dev_flow_server_info({})` 的结果包含：

```json
{
  "host_preferences": {
    "codex": { "codebase_memory": false },
    "deepseek": { "codebase_memory": false }
  }
}
```

这些值来自只读 `$HOME/.dev-flow/config.json` 的进程启动快照，仅表示偏好，不表示索引能力已经安装
或可用。文件不存在时两者都为 false；Dev Flow 不创建或修改配置文件。
