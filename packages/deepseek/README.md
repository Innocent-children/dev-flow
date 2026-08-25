# dev-flow-deepseek

[中文](https://github.com/Innocent-children/dev-flow/blob/main/packages/deepseek/README.md) |
[English](https://github.com/Innocent-children/dev-flow/blob/main/docs/DEEPSEEK_en.md)

`dev-flow-deepseek` 是 Dev Flow 面向 DeepSeek Harness（DSH）的显式 Host Adapter。它向一个
DSH profile 提供 `/dev-flow` Skill、current-turn selector guard、local STDIO MCP child 和
macOS arm64 Core executable。

## 支持范围

| 项目 | 当前支持 |
| --- | --- |
| Package | `dev-flow-deepseek@0.7.1` |
| Bundled Core | `0.6.0` |
| Platform | macOS arm64 |
| Node.js | `>=24` |
| DSH | `>=0.1.0-rc.6` |
| Release | [deepseek-v0.7.1](https://github.com/Innocent-children/dev-flow/releases/tag/deepseek-v0.7.1) |

`0.7.1` 的 normal release 已通过 registry package 安装、显式触发、Core handshake、
restart/resume、`DONE`、remove、uninstall、retained reopen 和 repository-unchanged 门禁。上表
记录已验证的精确公开版本；下面的安装命令使用 npm `latest` dist-tag 获取当前最新稳定 package。

## 安装与验证

DSH 是前置 Host。`create-dev-flow` 独立发布后，用户只需指定真实 Profile，默认使用 `web`：

```bash
npx create-dev-flow@latest
```

当前公开稳定制品尚未包含该新 manager package。发布前或诊断恢复时继续使用以下 Host 原生命令；
需要其他 Profile 时修改 `PROFILE` 的值，不要把 `<profile>` 原样输入 shell：

```bash
npm install -g @deepseek-ai/dsh@latest
dsh --version
PROFILE=web
TARBALL="$(npm pack dev-flow-deepseek@latest --silent)"
dsh plugin --profile "$PROFILE" add "$PWD/$TARBALL"
rm -f "$PWD/$TARBALL"
dsh --profile "$PROFILE" --dump-config
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
| `dsh plugin --profile "$PROFILE" add "$PWD/$TARBALL"` | 将绝对 tarball 路径安装到 `PROFILE` 指定的 DSH profile。最终 registry Journey 使用的就是这一命令形态。 |
| `dsh --profile "$PROFILE" --dump-config` | 输出 profile 的有效配置，用于检查 `dev-flow-deepseek` bundle contribution 是否存在；不会修改 Dev Flow Task。 |
| `dsh plugin --profile "$PROFILE" remove dev-flow-deepseek` | 从指定 profile 移除 package 与 bundle contribution；保留 Task data、目标 Git 仓库和 Codex-owned state。 |

统一生命周期入口负责升级、修复、重装、卸载和清空后重装。Host 原生更新或重新安装仍按以下顺序：

```bash
PROFILE=web
dsh plugin --profile "$PROFILE" remove dev-flow-deepseek
TARBALL="$(npm pack dev-flow-deepseek@latest --silent)"
dsh plugin --profile "$PROFILE" add "$PWD/$TARBALL"
rm -f "$PWD/$TARBALL"
dsh --profile "$PROFILE" --dump-config
```

随后重启 profile。更新 DSH 本身可执行 `npm install -g @deepseek-ai/dsh@latest`。

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

## 两仓声明、Workspace Root 与可选索引

启动 DSH 时的 canonical `Workspace Root` 是完整权限边界，可以是两个 Git 仓库的非 Git 共同父
目录。主仓库、附加仓库和 symlink 解析结果都必须位于该 Root 内。以 `/workspace` 为 Root、
`/workspace/core` 和 `/workspace/docs` 为两个仓库时，可以发送：

```text
/dev-flow Use /workspace/core as primary repository key core and add repository key docs at /workspace/docs. Update core::internal/api.go and docs::reference/api.md, then run only the targeted checks.
```

路径必须替换为真实绝对路径。Scope 总数为一至八，创建后不可变；Adapter 在 task-bearing open 前
拒绝 Root 外路径和 symlink escape。系统不扫描父目录、相邻目录、依赖或索引结果来发现仓库。
单仓库请求不需要 key，继续使用普通相对路径；从任一参与仓库恢复仍返回同一 Task。
DeepSeek 与 Codex 共用同一 Repository Scope、scoped path、Action 和唯一
`repository_binding_digest` Core 合同；Host 权限检查不创建第二套流程状态。

可选代码索引偏好来自只读配置：

```json
{
  "codex": { "codebase_memory": false },
  "deepseek": { "codebase_memory": true }
}
```

文件路径固定为 `$HOME/.dev-flow/config.json`。文件不存在时偏好为 false，Dev Flow 不创建或修改
它。true 只允许使用当前 DSH 会话中已经可见且可用的 codebase-memory；缺失、不完整或中途不可用
时，DeepSeek 每个 Dev Flow 会话最多提示一次并立即回退到内置检索，不阻塞 Task，也不安装、配置
或启动索引能力。索引覆盖不能放宽 Workspace Root，也不能决定 Scope、权限、Recovery 或流程流转。

## MCP 工具

DeepSeek Adapter 暴露与 Codex 相同的六工具 Core catalog；在 DSH 中会使用限定后的 tool name，
但 Core tool identity 保持不变。

| MCP 工具 | 作用 |
| --- | --- |
| `dev_flow_server_info` | 读取 Core identity、能力、process、method profile、工具目录和 DeepSeek 有效索引偏好；有效 admission 后必须首先调用。 |
| `dev_flow_open_task` | 为 Workspace Root 内显式声明的主/附加仓库创建一个 Task，或从任一参与仓库恢复同一 Task。 |
| `dev_flow_get_task` | 读取持久化 Task；可附带 operation probe 获取 Recovery assessment。 |
| `dev_flow_get_next_action` | 读取当前节点的权威 Action、验证预算、method steps 和全部合法 transition。 |
| `dev_flow_apply_action` | 使用当前 revision、Action identity、repository binding 和 closed payload 应用一次 Core 声明的 transition；允许写入的 node result 提交精确 `changed_paths` 或 `no_file_changes`，artifact references 只作为证据。 |
| `dev_flow_cancel_task` | 使用当前 revision 和明确 reason 取消一个非终态 Task。 |

## 数据与恢复

Task data 位于 Dev Flow 的本地数据目录，不属于 DSH plugin 配置。移除、卸载或重新安装 package
不会删除 Task data，也不会修改目标 Git 仓库或 Codex-owned state。

mutation 响应不确定时，Adapter 保留原 operation identity 与 payload，先读取 Core 的五分类
Recovery 结论，再决定恢复动作。它不盲目重试，也不自行选择 destination。

当前 Core 只接受当前 SQLite Schema。不兼容或 pre-graph data 会返回
`SCHEMA_UNSUPPORTED` 并保持零写入；用户可以选择新的数据目录，或在 Core 外部手工处理旧目录。

## 卸载与彻底清理

```bash
PROFILE=web
dsh plugin --profile "$PROFILE" remove dev-flow-deepseek
dsh --profile "$PROFILE" --dump-config
```

移除后按照 DSH profile lifecycle 重启，再通过有效配置确认 bundle contribution 已消失。重新安装
时重新执行 npm `@latest` pack 和 DSH add 命令。

对每个安装过 Dev Flow 的 profile 分别执行一次。不再使用 DSH 时，可另行运行
`npm uninstall -g @deepseek-ai/dsh`；这会保留 `$HOME/.dsh` 中的 profile、会话和其他插件。

确认 Codex Adapter 也已移除，并且不再需要任何 Task 后，可以删除两个 Host 共享的默认数据：

```bash
rm -rf "$HOME/Library/Application Support/dev-flow"
```

这是不可恢复操作。使用过 `DEV_FLOW_DATA_DIR` 时，请确认准确绝对路径后单独删除。只有在还要
删除全部 DSH profile、会话和其他插件时，才在卸载 DSH 后删除 `$HOME/.dsh`；它不是 Dev Flow
专用目录。

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
