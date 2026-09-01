# dev-flow-codex

[中文](https://github.com/Innocent-children/dev-flow/blob/main/packages/codex/README.md) |
[English](https://github.com/Innocent-children/dev-flow/blob/main/docs/CODEX_en.md)

`dev-flow-codex` 让 Codex 从本地持久 Task 继续长时编程任务，并在执行中守住任务范围、验证预算和
交付条件。Codex 继续读取仓库、修改文件和运行命令；bundled Go Core 保存当前阶段，限制验证扩张，
让过期记录失效，并在仓库漂移或 Action 结果不确定时给出下一步、Recovery 判断或明确阻塞。

## 支持范围

| 项目 | 当前支持 |
| --- | --- |
| Package | [`dev-flow-codex`](https://www.npmjs.com/package/dev-flow-codex) |
| Platform | macOS arm64 |
| Node.js | `>=24` |
| Codex | `>=0.147.0` |
| Releases | [GitHub Releases](https://github.com/Innocent-children/dev-flow/releases) |

稳定支持以[支持矩阵](../../docs/SUPPORT-MATRIX.md)为准。`main` 中存在的能力不一定已经进入 npm
`@latest`。

## 安装

推荐使用统一 lifecycle 入口：

```bash
npm install -g @imotong/dev-flow@latest
dev-flow
```

安装向导负责安装 Codex package、注册 Plugin 和 MCP，并回读就绪状态。Host 原生命令只用于诊断或
恢复：

```bash
npm install -g dev-flow-codex@latest
dev-flow-codex setup
dev-flow-codex status --json
dev-flow-codex --version
```

`setup` 在缺少固定用户配置时创建 `$HOME/.dev-flow/config.json`，验证 package、bundled Core 和
Codex 兼容性，再注册 marketplace、Plugin 与 MCP。所有参数和机器可读输出见
[命令参考](../../docs/COMMANDS.md#codex)。

## 启动一个 Task

在 Git 仓库中直接描述边界明确的实现、缺陷修复、重构、定向测试或开发交付请求，Codex 可以智能
选择 Dev Flow。需要明确进入时使用精确 selector：

```text
$dev-flow-codex:dev-flow Fix idempotency in the order-creation endpoint and run targeted tests.
```

这不是 shell 命令。`$dev-flow` 不是它的别名。只解释、只查询状态、方案讨论、普通问答和含糊请求
不会自动创建或恢复 Task。

新 Task 从需求阶段开始并保存最初请求、范围、验收条件和 verification budget。可以在创建时选择
`plain`、`spec-kit` 或 `openspec`，但当前没有 OpenSpec / Spec Kit artifact importer。

## 恢复已有 Task

回到同一个已参与的物理 worktree，在新 Codex 会话中继续原任务或使用精确 selector。Adapter 会先
读取 Core 状态并恢复当前阶段、revision、范围、剩余验证、Blocker 和 Recovery；不会从聊天记录
重新创建进度。

如果上一次 Action 的响应丢失或被截断，Adapter 先读取当前 Task 和 Recovery 判断，再按 Core 给出的
结果继续、恢复、阻塞或安全重试。它不会自行重复原提交。

## 查看状态

查看安装和注册状态：

```bash
dev-flow status --host codex
dev-flow-codex status --json
```

查看 Task、当前阶段、时间线、Recovery 和 Blocker：

```bash
dev-flow webui start
```

WebUI 只监听本机 loopback。完整用法见 [WebUI](../../docs/WEBUI.md)。

## 移除

推荐从统一入口选择 Codex 卸载。Host 原生保留数据卸载为：

```bash
dev-flow-codex remove
npm uninstall -g dev-flow-codex
```

`remove` 会先核对 runtime receipt 并停止对应 WebUI，再删除该 package 拥有的 Plugin、marketplace
注册和 receipt。停止失败时会保留后续对象。Task 数据和目标 Git 仓库默认保留，重新安装兼容 package
并运行 `setup` 后可以继续已有 Task。

彻底清理数据属于独立的 `dev-flow factory-reset` 流程，需要当前计划给出的强确认；不要手工删除
不明确的数据目录。

## Codex 权限与边界

- Codex 会话中的仓库权限仍由 Codex 和用户授权决定；Dev Flow 不扩大 sandbox；
- Core 只读观察 Git，不执行 commit、push、merge、rebase、tag 或 publish；
- Codex 负责文件修改和命令执行，Core 不拦截每一次操作；
- selector 不绕过仓库权限、当前 Action、Git 写入授权或发布确认；
- 可选代码索引只帮助检索，不能扩大 Scope 或决定 Recovery 和流程状态。

## 高级多仓库与 worktree

当前源码支持一个主仓库和最多七个显式附加仓库。附加仓库必须先通过 Codex `--add-dir` 成为当前
会话已授权的 writable root；Scope 创建后不可变，系统不会扫描相邻目录自动扩大范围。

用户明确要求多个独立任务并行，或新请求遇到 `ACTIVE_TASK_CONFLICT` 时，Codex 只有在 Host 提供
worktree-backed task/thread 能力时才分派独立 Task。子 Task 从默认分支已提交状态开始，不接收占用中
checkout 的未提交改动；Core 不创建、切换、合并或清理 worktree。

使用前请阅读[项目状态](../../docs/PROJECT-STATUS.md)确认这些能力属于稳定还是源码范围。精确
Repository Scope、worktree 分派和协议规则见[架构](../../docs/ARCHITECTURE.md)与
[命令参考](../../docs/COMMANDS.md)。

## 相关文档

- [产品定义](../../docs/PRODUCT.md)
- [中断后继续的演示](../../docs/DEMO.md)
- [命令参考](../../docs/COMMANDS.md)
- [架构](../../docs/ARCHITECTURE.md)
- [项目状态](../../docs/PROJECT-STATUS.md)
- [WebUI](../../docs/WEBUI.md)
