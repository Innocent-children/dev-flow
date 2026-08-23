# Dev Flow 命令参考

[中文](COMMANDS.md) | [English](COMMANDS_en.md)

本文件列出 Dev Flow 当前公开或受支持的命令入口。命令范围以实际实现为准：Codex 命令来自
`packages/codex/package.json` 与 `packages/codex/bin/dev-flow-codex.mjs`，DeepSeek 生命周期命令
来自最终制品 Journey 使用的 DSH CLI，Core 命令来自 `cmd/dev-flow/main.go`，MCP 工具来自
`internal/mcp/` 的闭合目录。

公开安装示例使用 npm 的 `latest` dist-tag，以便安装当前最新稳定包；支持矩阵、Release 链接和
制品证据仍使用精确版本号，不应替换为 `latest`。

## Codex

### 安装

```bash
npm install -g dev-flow-codex@latest
dev-flow-codex setup
dev-flow-codex --version
```

npm 全局安装只把 `dev-flow-codex` launcher 放到 `PATH`。`setup` 是独立步骤，它验证平台、
package、bundled Core 和 Codex 版本，然后注册本地 marketplace、Plugin 与 MCP 配置，并回读
注册结果。`--version` 同时报告 Host package 与 bundled Core 版本。

### 支持的 Codex 命令

| 命令 | 作用 |
| --- | --- |
| `npm install -g dev-flow-codex@latest` | 从 npm 安装 `latest` 指向的 Codex package，并把 `dev-flow-codex` 全局加入 `PATH`。它不会自动注册 Codex Plugin。 |
| `dev-flow-codex setup` | 验证安装内容和 Codex 兼容版本，注册 marketplace、Plugin 与 MCP，并在成功后写入 ownership receipt。重复执行时会读取并校验现有注册。 |
| `dev-flow-codex setup --json` | 执行与 `setup` 相同的操作，但只输出机器可读 JSON，包含 operation、status、changed 与 receipt path。 |
| `dev-flow-codex --version` | 输出 `dev-flow-codex <package-version> (core <core-version>)`，用于确认实际安装的 package 与 bundled Core 身份。 |
| `dev-flow-codex remove` | 删除由该 package 拥有的 Codex Plugin、marketplace 注册与 receipt。Task data 和目标 Git 仓库保持不变。 |
| `dev-flow-codex remove --json` | 执行与 `remove` 相同的操作，并输出机器可读 JSON；返回的 `next_step` 指向单独的全局 npm 卸载。 |
| `npm uninstall -g dev-flow-codex` | 在完成 `remove` 后卸载全局 npm package。单独运行它不会先清理 Codex 注册。 |
| `dev-flow-codex mcp` | **内部 Host 命令。** 由 Plugin 的 MCP 配置调用；它设置数据目录和 Codex admission instructions，然后启动 packaged Core 的 `mcp --stdio`。正常用户不应手工启动它。 |

`dev-flow-codex` 不支持其他子命令，也不提供隐式 `help`、`update` 或 `uninstall` 子命令。更新到
当前 `latest` 时重新运行全局安装和 `setup`：

```bash
npm install -g dev-flow-codex@latest
dev-flow-codex setup
dev-flow-codex --version
```

保留 Task 数据的卸载顺序是 `dev-flow-codex remove`，然后
`npm uninstall -g dev-flow-codex`。只有在 Codex 和 DeepSeek Adapter 都已移除且不再需要任何
Task 时，才删除共享默认数据目录 `$HOME/Library/Application Support/dev-flow`。

### Codex 显式 selector

```text
$dev-flow-codex:dev-flow <任务描述>
```

这不是 shell 命令，而是 Codex 用户消息中的精确 Skill selector。裸 `$dev-flow`、错误 namespace、
缺少 selector 或普通对话都不会启动 Dev Flow。通过 admission 后，Host 静默调用
`dev_flow_server_info` 并立即打开或恢复 Task；成功检查不逐项展示，失败时只报告具体阻塞项和
一个恢复步骤。

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
| `dsh plugin --profile "$PROFILE" add "$PWD/$TARBALL"` | 把绝对 tarball 路径安装到 `PROFILE` 指定的 DSH profile。最终制品 Journey 使用的就是这一命令形态。 |
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

Core 不支持 remote transport、HTTP/SSE、通用 shell 或 Git mutation 命令。Codex 用户应通过
`dev-flow-codex mcp` 的受管入口启动 Core；DeepSeek 用户由 DSH integration process 启动 Core。

## MCP 工具

以下六个工具是当前完整且闭合的 public MCP catalog。它们由 Host Adapter 调用，不是终端 shell
命令。

| 工具 | 类型 | 作用 |
| --- | --- | --- |
| `dev_flow_server_info` | 只读 | 读取 Core 产品版本、transport、健康状态、支持的 process、Host、method profile 和工具目录。每次有效 Host admission 后必须首先调用。 |
| `dev_flow_open_task` | 读取或创建 | 为 canonical repository 创建新 Task，或在提供现有仓库且 `new_task` 为空时恢复当前 Task。 |
| `dev_flow_get_task` | 只读 | 按 Task ID 读取持久化 Task；可附带 operation probe，以获取不确定 mutation 的 Recovery assessment。 |
| `dev_flow_get_next_action` | 只读 | 读取当前节点的权威 Action，包括完成条件、允许副作用、所需证据、验证预算、method steps 和全部合法 transition。 |
| `dev_flow_apply_action` | mutation | 使用当前 revision、Action identity、process identity、repository binding 与闭合 payload 应用一次 Core 声明的 transition；也承担显式 recovery apply。 |
| `dev_flow_cancel_task` | destructive mutation | 使用当前 revision 和非空 reason 将非终态 Task 转为 `CANCELLED`。 |

未知 CLI 参数、未列出的 MCP 工具或未满足 selector admission 的调用不属于受支持入口。
