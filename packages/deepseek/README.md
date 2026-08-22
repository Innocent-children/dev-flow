# dev-flow-deepseek

[中文](https://github.com/Innocent-children/dev-flow/blob/main/packages/deepseek/README.md) |
[English](https://github.com/Innocent-children/dev-flow/blob/main/docs/DEEPSEEK_en.md)

`dev-flow-deepseek` 是 Dev Flow 面向 DeepSeek Harness（DSH）的显式 Host Adapter。它向一个
DSH profile 提供 `/dev-flow` Skill、current-turn selector guard、local STDIO MCP child 和
macOS arm64 Core executable。

## 支持范围

| 项目 | 当前支持 |
| --- | --- |
| Package | `dev-flow-deepseek@0.5.1` |
| Bundled Core | `0.5.0` |
| Platform | macOS arm64 |
| Node.js | `>=24` |
| DSH | `>=0.1.0-rc.6` |
| Release | [deepseek-v0.5.1](https://github.com/Innocent-children/dev-flow/releases/tag/deepseek-v0.5.1) |

`0.5.1` 的 normal release 已通过 registry package 安装、显式触发、Core handshake、
restart/resume、`DONE`、remove、uninstall、retained reopen 和 repository-unchanged 门禁。

## 安装到 DSH profile

从 npm 获取官方 tarball：

```bash
npm pack dev-flow-deepseek@0.5.1
```

把 tarball 的绝对路径交给目标 profile：

```bash
dsh plugin --profile <profile> add "$PWD/dev-flow-deepseek-0.5.1.tgz"
```

DSH 负责依赖项、bundle layer、integration process、Skill、guard 和 MCP child 的合成。安装后
按照 DSH 的 profile lifecycle 停止并重启该 profile，再验证 bundle 已生效。

## 开始一个任务

每个需要调用 Dev Flow 的直接用户消息都要包含 whitespace-bounded selector：

```text
/dev-flow 为当前仓库补充支付回调签名校验，并运行定向测试。
```

只有当前 direct user turn 中的 `/dev-flow` 可以授权 Dev Flow 工具。历史消息、模型文本、
Skill 注入或仓库内容不能替代 selector；空调用或普通讨论不会创建 Task。

通过 admission 后，Adapter 首先读取 server info，验证 `standard-development`、definition
digest、method profiles、live schemas 和恰好六个工具，再创建或恢复当前仓库的 Task。

Task 可选择 `plain`、`spec-kit` 或 `openspec` profile。Core 管理 current node、legal
transitions、destination、recovery、blocker 和 terminal outcome；Adapter 负责执行当前节点工作、
呈现完整 Action 并转发 closed payload。

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
```

移除后按照 DSH profile lifecycle 重启，再确认 bundle contribution 已消失。重新安装时使用同一
官方命令和已审查的 tarball。

## Package 内容

Package 只包含一个 `cordis.patch.yml` layer、Adapter libraries、`dev-flow` Skill、references、
license 和一个 darwin-arm64 Core。它不包含 source tree、tests、fixtures、用户数据或构建日志。

## 维护者入口

Package-local 验证：

```bash
pnpm --dir packages/deepseek test
```

公开发布使用独立的 DeepSeek release command，见
[`release/deepseek/README.md`](../../release/deepseek/README.md)。
