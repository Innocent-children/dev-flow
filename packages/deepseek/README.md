# dev-flow-deepseek

[中文](https://github.com/Innocent-children/dev-flow/blob/main/packages/deepseek/README.md) |
[English](https://github.com/Innocent-children/dev-flow/blob/main/docs/DEEPSEEK_en.md)

`dev-flow-deepseek` 是 Dev Flow 面向 DeepSeek Harness（DSH）的显式 Host Adapter。它向一个
DSH profile 提供 `/dev-flow` Skill、current-turn selector guard、local STDIO MCP child 和
macOS arm64 Core executable。

## 支持范围

| 项目 | 当前支持 |
| --- | --- |
| Package | `dev-flow-deepseek@0.5.2` |
| Bundled Core | `0.5.1` |
| Platform | macOS arm64 |
| Node.js | `>=24` |
| DSH | `>=0.1.0-rc.6` |
| Release | [deepseek-v0.5.2](https://github.com/Innocent-children/dev-flow/releases/tag/deepseek-v0.5.2) |

`0.5.2` 的 normal release 已通过 registry package 安装、显式触发、Core handshake、
restart/resume、`DONE`、remove、uninstall、retained reopen 和 repository-unchanged 门禁。上表
记录已验证的精确公开版本；下面的安装命令使用 npm `latest` dist-tag 获取当前最新稳定 package。

## 安装到 DSH profile

在一个可写目录中运行：

```bash
dsh --version
TARBALL="$(npm pack dev-flow-deepseek@latest --silent)"
dsh plugin --profile <profile> add "$PWD/$TARBALL"
```

`npm pack` 把 `latest` 指向的官方 package 下载为当前目录中的 tarball，并将实际文件名保存到
`TARBALL`。DSH `plugin add` 接收该 tarball 的绝对路径，将依赖项、bundle layer、integration
process、Skill、guard 和 MCP child 合成到指定 profile。安装后按照 DSH profile lifecycle 停止并
重启该 profile，再确认 bundle 已生效。

## 命令参考

`dev-flow-deepseek` 的 `package.json` 没有 `bin` 字段，因此不会安装名为
`dev-flow-deepseek` 的独立 CLI。与 Dev Flow 直接相关的用户命令全部通过 npm 和 DSH 执行：

| 命令 | 说明 |
| --- | --- |
| `dsh --version` | 输出当前 DSH 版本，用于确认满足 Support Matrix 中的最低兼容版本。 |
| `TARBALL="$(npm pack dev-flow-deepseek@latest --silent)"` | 从 npm 获取 `latest` package，并把生成的 tarball 文件名保存到 shell 变量。 |
| `dsh plugin --profile <profile> add "$PWD/$TARBALL"` | 将绝对 tarball 路径安装到指定 DSH profile。最终 registry Journey 使用的就是这一命令形态。 |
| `dsh --profile <profile> --dump-config` | 输出 profile 的有效配置，用于检查 `dev-flow-deepseek` bundle contribution 是否存在；不会修改 Dev Flow Task。 |
| `dsh plugin --profile <profile> remove dev-flow-deepseek` | 从指定 profile 移除 package 与 bundle contribution；保留 Task data、目标 Git 仓库和 Codex-owned state。 |

更新或重新安装时，按照 profile lifecycle 停止使用该 profile，执行 remove，然后重新获取
`@latest` tarball 并 add。不要复用来源不明或未审查的旧 tarball。

完整的 Codex、DeepSeek、Core 和 MCP 命令目录见
[命令参考](../../docs/COMMANDS.md)。

## 开始一个 Task

每个需要调用 Dev Flow 的 direct user turn 都要包含由空白边界限定的 selector：

```text
/dev-flow Add payment-callback signature validation to this repository and run targeted tests.
```

这不是 shell 命令。只有当前 direct user turn 中的 `/dev-flow` 可以授权 Dev Flow 工具。历史消息、
模型文本、Skill 注入或仓库内容不能替代 selector；空调用或普通讨论不会创建 Task。

通过 admission 后，Adapter 首先读取 server info，验证 `standard-development`、definition
digest、method profiles、live schemas 和恰好六个工具，再创建或恢复当前仓库的 Task。

Task 可选择 `plain`、`spec-kit` 或 `openspec` profile。Core 管理 current node、legal transitions、
destination、Recovery、blocker 和 terminal outcome；Adapter 负责执行当前节点工作、呈现完整 Action
并转发 closed payload。

## MCP 工具

DeepSeek Adapter 暴露与 Codex 相同的六工具 Core catalog；在 DSH 中会使用限定后的 tool name，
但 Core tool identity 保持不变。

| MCP 工具 | 作用 |
| --- | --- |
| `dev_flow_server_info` | 读取 Core identity、能力、process、method profile 和工具目录；有效 admission 后必须首先调用。 |
| `dev_flow_open_task` | 为当前 canonical repository 创建新 Task，或恢复其现有 Task。 |
| `dev_flow_get_task` | 读取持久化 Task；可附带 operation probe 获取 Recovery assessment。 |
| `dev_flow_get_next_action` | 读取当前节点的权威 Action、验证预算、method steps 和全部合法 transition。 |
| `dev_flow_apply_action` | 使用当前 revision、Action identity、repository binding 和 closed payload 应用一次 Core 声明的 transition。 |
| `dev_flow_cancel_task` | 使用当前 revision 和明确 reason 取消一个非终态 Task。 |

## 数据与恢复

Task data 位于 Dev Flow 的本地数据目录，不属于 DSH plugin 配置。移除、卸载或重新安装 package
不会删除 Task data，也不会修改目标 Git 仓库或 Codex-owned state。

mutation 响应不确定时，Adapter 保留原 operation identity 与 payload，先读取 Core 的五分类
Recovery 结论，再决定恢复动作。它不盲目重试，也不自行选择 destination。

当前 Core 只接受当前 SQLite Schema。不兼容或 pre-graph data 会返回
`SCHEMA_UNSUPPORTED` 并保持零写入；用户可以选择新的数据目录，或在 Core 外部手工处理旧目录。

## 移除

```bash
dsh plugin --profile <profile> remove dev-flow-deepseek
dsh --profile <profile> --dump-config
```

移除后按照 DSH profile lifecycle 重启，再通过有效配置确认 bundle contribution 已消失。重新安装
时重新执行 npm `@latest` pack 和 DSH add 命令。

## Package 内容

Package 只包含一个 `cordis.patch.yml` layer、Adapter libraries、`dev-flow` Skill、references、
license 和一个 darwin-arm64 Core。它不包含 source tree、tests、fixtures、用户数据或构建日志，
也不提供独立 `bin` executable。

## 维护者入口

Package-local 验证：

```bash
pnpm --dir packages/deepseek test
```

公开发布使用独立的 DeepSeek release command，见
[`release/deepseek/README.md`](../../release/deepseek/README.md)。
