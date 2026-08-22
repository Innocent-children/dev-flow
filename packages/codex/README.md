# dev-flow-codex

[中文](https://github.com/Innocent-children/dev-flow/blob/main/packages/codex/README.md) |
[English](https://github.com/Innocent-children/dev-flow/blob/main/docs/CODEX_en.md)

`dev-flow-codex` 把 Dev Flow 状态图接入 Codex CLI。package 包含 Codex Plugin、显式 Skill、
local STDIO MCP 配置和 macOS arm64 Core executable；Task、节点、流转和 Recovery 仍由 bundled
Go Core 独自管理。

## 支持范围

| 项目 | 当前支持 |
| --- | --- |
| Package | `dev-flow-codex@0.5.3` |
| Bundled Core | `0.5.1` |
| Platform | macOS arm64 |
| Node.js | `>=24` |
| Codex | `>=0.147.0` |
| Release | [codex-v0.5.3](https://github.com/Innocent-children/dev-flow/releases/tag/codex-v0.5.3) |

`0.5.3` 的 normal release 已通过 registry package 安装、package/Core identity、setup、Core
handshake、remove、uninstall 和 repository-unchanged 门禁。上表记录已经验证的精确公开版本；
下面的安装命令使用 npm `latest` dist-tag 获取当前最新稳定 package。

## 安装

```bash
npm install -g dev-flow-codex@latest
dev-flow-codex setup
dev-flow-codex --version
```

npm 全局安装只负责把 package 和 `dev-flow-codex` launcher 放到 `PATH`。`setup` 是独立步骤：
它验证平台、package 内容、bundled Core 与 Codex 兼容版本，然后注册 Plugin、marketplace 与 MCP，
并在写入后回读 ownership。`--version` 同时输出实际 package 和 bundled Core 版本。

## 命令参考

`dev-flow-codex` 的生产 CLI 只接受下表中的命令；未知参数会在执行任何注册操作前失败。

| 命令 | 说明 |
| --- | --- |
| `npm install -g dev-flow-codex@latest` | 安装 npm `latest` 指向的 package，并把 launcher 全局加入 `PATH`；不会自动注册 Codex Plugin。 |
| `dev-flow-codex setup` | 校验 package、Core 和 Codex 版本，注册 marketplace、Plugin 与 MCP，并回读最终状态。重复执行会验证现有 ownership，兼容 package 升级也通过该命令完成。 |
| `dev-flow-codex setup --json` | 与 `setup` 行为相同，但只输出机器可读 JSON：`operation`、`status`、`changed` 和 `receipt_path`。 |
| `dev-flow-codex --version` | 输出 `dev-flow-codex <package-version> (core <core-version>)`，用于确认实际安装身份。 |
| `dev-flow-codex remove` | 删除该 package 拥有的 Plugin、marketplace 注册和 receipt；保留 Task data、未知相邻文件和目标 Git 仓库。 |
| `dev-flow-codex remove --json` | 与 `remove` 行为相同，并输出机器可读 JSON；`next_step` 提示随后执行全局 npm 卸载。 |
| `npm uninstall -g dev-flow-codex` | 在 `remove` 完成后卸载全局 package。单独执行不会先清理 Codex 注册。 |
| `dev-flow-codex mcp` | **内部 Host 命令。** Plugin 的 MCP 配置调用它来设置数据目录和 admission instructions，再启动 packaged Core 的 `mcp --stdio`；正常用户不应手工运行。 |

当前 CLI 不提供 `help`、`update`、`uninstall` 或其他隐式子命令。更新到当前最新版本时执行：

```bash
npm install -g dev-flow-codex@latest
dev-flow-codex setup
```

完整的 Codex、DeepSeek、Core 和 MCP 命令目录见
[命令参考](../../docs/COMMANDS.md)。

## 开始一个 Task

在当前 Git 仓库中，用唯一的精确 selector 描述工作：

```text
$dev-flow-codex:dev-flow Fix idempotency in the order-creation endpoint and run targeted tests.
```

这不是 shell 命令。新 Task 从 `REQUIREMENTS` 开始，默认使用 `plain` profile；也可以在同一请求
中明确选择 `spec-kit` 或 `openspec`。Task 创建后 profile 保持不变。

Core 会持续返回：

- 当前 node、purpose、entry/completion conditions；
- 当前 revision、action identity 和 repository binding；
- `allowed_effects`、`required_evidence` 和 verification budget；
- method profile 对应的 semantic steps；
- 全部合法 transitions、guard、destination 与 reason rule。

Codex 完成当前节点工作后，只提交 live Action 允许的 `transition_id` 和 closed payload。

## 显式调用边界

Skill metadata 设置 `policy.allow_implicit_invocation: false`，因此只有下面这个精确 selector 可以
进入 Dev Flow：

```text
$dev-flow-codex:dev-flow
```

相关名称与边界如下：

- Skill resource/base name 是 `dev-flow`；
- 安装后的 Skill full name 是 `dev-flow-codex:dev-flow`；
- `$dev-flow` 不是别名，不会选择该 Skill；
- plugin namespace 错误、Skill base name 错误或缺少 selector 都不会选择该 Skill；
- 普通提示词必须产生零次 Dev Flow 调用；
- 非精确 selector 不得完成任何携带 Task 的操作。

这项边界不限制 Codex 的普通仓库工具，也不声称 MCP 的可见性或授权与 selector 绑定；它只约束
当前 Skill 是否可以发起 Dev Flow 调用。

通过 admission 后，`dev_flow_server_info({})` 必须是第一次 Dev Flow 调用。安装内容、bundled
Core、Codex 兼容性和注册 ownership 已由 `dev-flow-codex setup` 验证；每次 Task 启动只静默确认
Core ready、`standard-development`、definition digest、method profiles 与六个工具的闭合集合，
成功后立即打开或恢复 Task。正常启动不向用户逐项展示版本、摘要、profile 或工具目录；只有失败
时才报告具体阻塞项和一个可执行的恢复步骤。工具和 method profile 的返回顺序不影响兼容性。

| MCP 工具 | 作用 |
| --- | --- |
| `dev_flow_server_info` | 读取 Core identity、能力、process、method profile 和工具目录；有效 admission 后必须首先调用。 |
| `dev_flow_open_task` | 为当前 canonical repository 创建新 Task，或恢复其现有 Task。 |
| `dev_flow_get_task` | 读取持久化 Task；可附带 operation probe 获取 Recovery assessment。 |
| `dev_flow_get_next_action` | 读取当前节点的权威 Action、验证预算、method steps 和全部合法 transition。 |
| `dev_flow_apply_action` | 使用当前 revision、Action identity、repository binding 和 closed payload 应用一次 Core 声明的 transition。 |
| `dev_flow_cancel_task` | 使用当前 revision 和明确 reason 取消一个非终态 Task。 |

## 理解审查与 Recovery

`TEST` 通过后，Task 进入 `COMPREHENSION_REVIEW`。Codex 解释当前行为、设计与维护风险，开发者
给出明确 verdict。复杂实现进入 `REFACTOR`；仓库发生变化后必须重新回到 `TEST`。

每次 mutation 前，Adapter 保留 request/operation ID、source cursor、revision、action、
repository binding 和原始 payload。结果缺失、取消、截断、损坏或 transport failure 时，Adapter
先读取 Core，再遵循五分类 Recovery 和 advice；它不自行判断 retry safety 或 destination。

## 数据目录

默认数据目录由 package lifecycle 管理，也可以设置：

```bash
export DEV_FLOW_DATA_DIR="/absolute/path/to/existing-directory"
```

显式目录必须已经存在、可用且可 canonicalize。setup、remove 和 npm uninstall 都保留 Task data
与未知相邻文件，也不会修改目标 Git 仓库。

当前 Core 只读取当前 SQLite Schema。检测到不兼容或 pre-graph data 时返回
`SCHEMA_UNSUPPORTED` 并保持零写入。请选择新的数据目录，或在 Core 外部手工归档、改名或删除
旧目录。

## 移除

先删除 Codex 注册，再卸载全局 npm package：

```bash
dev-flow-codex remove
npm uninstall -g dev-flow-codex
```

需要机器可读结果时使用：

```bash
dev-flow-codex remove --json
```

重新安装兼容 package 并再次运行 `setup` 后，可以从保留的当前数据目录继续 Task。

## Package 内容

生产 package 由 `package.json.files` 关闭，只包含 Plugin、Skill、MCP 配置、lifecycle library、
license 和一个 darwin-arm64 Core。它不包含 source tree、tests、fixtures、specs、`.git`、
`node_modules`、用户数据、构建日志或绝对路径，也没有 install/uninstall hook。

## 维护者入口

Package-local 验证：

```bash
pnpm --dir packages/codex test
```

Source-local 最终制品构建：

```bash
ARTIFACT_ROOT="${TMPDIR:-/tmp}/dev-flow-codex-artifacts"
mkdir -p "$ARTIFACT_ROOT"
SOURCE_COMMIT="$(git rev-parse HEAD)"

pnpm --dir packages/codex run build:local \
  --output "$ARTIFACT_ROOT" \
  --final \
  --source-commit "$SOURCE_COMMIT" \
  --report "$ARTIFACT_ROOT/artifact-evidence.json"
```

构建输出必须位于仓库外。公开发布使用根目录的 standalone release command，见
[`release/codex/README.md`](../../release/codex/README.md)。
