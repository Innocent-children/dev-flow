# dev-flow-codex

[中文](https://github.com/Innocent-children/dev-flow/blob/main/packages/codex/README.md) |
[English](https://github.com/Innocent-children/dev-flow/blob/main/docs/CODEX_en.md)

`dev-flow-codex` 把 Dev Flow 的状态图带进 Codex CLI。安装包包含一个 Codex Plugin、一个显式
Skill、local STDIO MCP 配置和 macOS arm64 Core executable；Task、节点、流转和 Recovery 仍由
bundled Go Core 独自管理。

## 支持范围

| 项目 | 当前支持 |
| --- | --- |
| Package | `dev-flow-codex@0.5.1` |
| Bundled Core | `0.5.0` |
| Platform | macOS arm64 |
| Node.js | `>=24` |
| Codex | `>=0.147.0` |
| Release | [codex-v0.5.1](https://github.com/Innocent-children/dev-flow/releases/tag/codex-v0.5.1) |

`0.5.1` 的 normal release 已通过 registry package 安装、package/Core identity、setup、Core
handshake、remove、uninstall 和 repository-unchanged 门禁。

## 安装

```bash
npm install -g dev-flow-codex@0.5.1
dev-flow-codex setup
dev-flow-codex --version
```

`setup` 注册 Plugin、marketplace 与 MCP，并在写入后回读 ownership。npm 安装和 Codex 注册是
两个独立步骤，因此安装 package 后需要显式运行一次 `setup`。

如需机器可读结果：

```bash
dev-flow-codex setup --json
```

## 开始一个任务

在当前 Git 仓库中，用唯一的显式 selector 描述工作：

```text
$dev-flow-codex:dev-flow 修复订单创建接口的幂等性问题，并运行定向测试。
```

新 Task 从 `REQUIREMENTS` 开始，默认使用 `plain` profile。也可以在同一请求中明确选择
`spec-kit` 或 `openspec`。Task 创建后 profile 保持不变。

Core 会持续返回：

- 当前 node、purpose、entry/completion conditions；
- 当前 revision、action identity 和 repository binding；
- allowed effects、required evidence 和 verification budget；
- method profile 对应的 semantic steps；
- 全部合法 transitions、guard、destination 与 reason rule。

Codex 完成当前节点工作后，只提交 live Action 允许的 `transition_id` 和 closed payload。

## Explicit invocation boundary

Skill metadata 设置 `policy.allow_implicit_invocation: false`。

Skill resource/base name 是 `dev-flow`。

installed Skill full name 是 `dev-flow-codex:dev-flow`。

only exact explicit selector 是 `$dev-flow-codex:dev-flow`。

bare `$dev-flow` is not an alias and does not select this Skill。

wrong plugin namespace、wrong Skill base name 或 missing selector 也不会选择它。

ordinary prompt 必须产生 zero Dev Flow calls。
non-exact selectors must not complete a task-bearing operation。

This boundary does not disable ordinary Codex repository tools.

The package does not make or claim selector-bound MCP visibility or authorization；它只约束当前
Skill 是否可以发起 Dev Flow 调用。

通过 admission 后，`dev_flow_server_info({})` 必须是第一次 Dev Flow 调用。Host 验证
`standard-development`、definition digest、method profiles、live schemas 与恰好六个工具：

```text
dev_flow_server_info
dev_flow_open_task
dev_flow_get_task
dev_flow_get_next_action
dev_flow_apply_action
dev_flow_cancel_task
```

## 理解审查与 Recovery

`TEST` 通过后，任务进入 `COMPREHENSION_REVIEW`。Codex 解释当前行为、设计与维护风险，
开发者给出明确 verdict。复杂实现进入 `REFACTOR`，仓库发生变化后必须重新回到 `TEST`。

每次 mutation 前，Adapter 保留 request/operation ID、source cursor、revision、action、
repository binding 和原始 payload。结果缺失、取消、截断、损坏或 transport failure 时，Adapter
先读取 Core，再遵循五分类 Recovery 和 advice；它不自行判断 retry safety 或 destination。

## 数据目录

默认数据目录由 package lifecycle 管理，也可以设置：

```bash
export DEV_FLOW_DATA_DIR="/absolute/path/to/existing-directory"
```

目录必须已经存在、可用且可 canonicalize。setup、remove 和 npm uninstall 都保留 Task data 与
未知相邻文件，也不会修改目标 Git 仓库。

当前 Core 只读取当前 SQLite Schema。检测到不兼容或 pre-graph data 时返回
`SCHEMA_UNSUPPORTED` 并保持零写入。请选择新的数据目录，或在 Core 外部手工归档、改名或
删除旧目录。

## 移除

先删除 Codex 注册，再卸载 npm package：

```bash
dev-flow-codex remove
npm uninstall -g dev-flow-codex
```

如需机器可读结果：

```bash
dev-flow-codex remove --json
```

重新安装兼容 package 并再次运行 `setup` 后，可以从保留的当前数据目录继续任务。

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
