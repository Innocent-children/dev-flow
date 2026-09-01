# dev-flow-deepseek

[中文](https://github.com/Innocent-children/dev-flow/blob/main/packages/deepseek/README.md) |
[English](https://github.com/Innocent-children/dev-flow/blob/main/docs/DEEPSEEK_en.md)

`dev-flow-deepseek` 让 DeepSeek Harness（DSH）从本地持久 Task 继续长时编程任务，并在执行中守住
任务范围、验证预算和交付条件。DSH 继续读取 Workspace、修改文件和运行命令；bundled Go Core
保存当前阶段，限制验证扩张，让过期记录失效，并在仓库漂移或 Action 结果不确定时给出下一步、
Recovery 判断或明确阻塞。

## 支持范围

| 项目 | 当前支持 |
| --- | --- |
| Package | [`dev-flow-deepseek`](https://www.npmjs.com/package/dev-flow-deepseek) |
| 稳定 Platform | macOS arm64 |
| 当前源码 Platform | macOS arm64（`darwin-arm64`）；Windows 10/11 桌面 x64（`win32-x64`） |
| Node.js | `>=24` |
| DSH | `>=0.1.0-rc.6` |
| Releases | [GitHub Releases](https://github.com/Innocent-children/dev-flow/releases) |

稳定支持以[支持矩阵](../../docs/SUPPORT-MATRIX.md)为准。`main` 中存在的能力不一定已经进入 npm
`@latest`。Windows Server、32 位 Windows、Windows ARM64 与 Intel Mac 不在当前源码支持范围；
runtime selector 会拒绝除 `darwin-arm64` 和 `win32-x64` 之外的运行时对。

## 安装

DSH 是前置 Host。推荐使用统一 lifecycle 入口，并选择真实 Profile；默认是 `web`：

```bash
npm install -g @imotong/dev-flow@latest
dev-flow
```

`dev-flow-deepseek` 没有独立 `bin`，不会安装同名 CLI。诊断恢复时，可以通过 npm tarball 和 DSH
profile lifecycle 执行原生安装：

```bash
npm install -g @deepseek-ai/dsh@latest
PROFILE=web
TARBALL="$(npm pack dev-flow-deepseek@latest --silent)"
dsh plugin --profile "$PROFILE" add "$PWD/$TARBALL"
rm -f "$PWD/$TARBALL"
dsh --profile "$PROFILE" --dump-config
```

Windows PowerShell 使用：

```powershell
npm install -g @deepseek-ai/dsh@latest
$ProfileName = 'web'
$Tarball = (npm pack dev-flow-deepseek@latest --silent | Select-Object -Last 1).Trim()
$TarballPath = (Resolve-Path -LiteralPath $Tarball).Path
dsh plugin --profile $ProfileName add $TarballPath
Remove-Item -LiteralPath $TarballPath
dsh --profile $ProfileName --dump-config
```

安装后按 DSH profile lifecycle 重启该 Profile。完整命令和更新顺序见
[命令参考](../../docs/COMMANDS.md#deepseek-harness)。

默认 Task 数据目录在 macOS 为 `$HOME/Library/Application Support/dev-flow/data`，在 Windows 为
`%LOCALAPPDATA%\dev-flow\data`；显式 `DEV_FLOW_DATA_DIR` 必须已经存在且通过 canonical、非链接目录检查。

## 启动一个 Task

每个需要调用 Dev Flow 的直接用户消息都要包含由空白边界限定的 selector：

```text
/dev-flow Add payment-callback signature validation and run targeted tests.
```

这不是 shell 命令。历史消息、模型文本、Skill 注入或仓库内容不能替代当前用户消息中的
`/dev-flow`。普通讨论或空调用不会创建 Task。

新 Task 保存最初请求、范围、验收条件和 verification budget。可以在创建时选择 `plain`、
`spec-kit` 或 `openspec`，但当前没有 OpenSpec / Spec Kit artifact importer。

## 恢复已有 Task

在同一 Workspace Root 下回到参与 Task 的仓库，并在当前直接用户消息中再次使用 `/dev-flow`。
Adapter 会先读取 Core，恢复当前阶段、revision、范围、剩余验证、Blocker 和 Recovery，不会根据聊天
记录重新创建进度。

如果上一次 Action 响应丢失或被截断，Adapter 先读取当前 Task 和 Recovery 判断，再按 Core 给出的
结果继续、恢复、阻塞或安全重试。它不会自行重复原提交。

同一失败、同一测试结果，或相同修改路径与失败组成的测试循环连续出现三次时，Core 会保存第三次
结果并暂停 Task。Adapter 不会自动解除；用户明确选择换方案或再试一次后，才解除 blocker，并从
Core 保存的原目标阶段继续。下一次仍然完全重复时会再次暂停。

## 范围外文件先询问

Adapter 在 DSH `tools/pre-execute` 中检查 `write`、`edit` 和变更型 `str_replace_editor`。当前 direct
user turn 使用 `/dev-flow` 时，这些工具在写入前把目标文件交给 packaged Core。Core 使用当前 Task
Plan 全部 WorkItem 的 `ExpectedPaths` 合集；多仓库路径带 repository key。B、C 等仓库已在 Task
Repository Scope、位于 Workspace Root 且文件属于计划范围时，不因为当前目录位于 A 而询问。

计划外文件会在工具执行前暂停 Task。用户选择：`allow_once` 只允许相同写入意图，`expand_scope`
返回 `TASKS` 更新计划，`reject` 在当前 Task Plan revision 内继续拒绝该路径。选择与原因由 Core
保存；进入测试和 `DONE` 前，Core 还会核对本 Task 累计修改路径。

该 gate 不解析 Bash、外部进程或其他工具路径；这些写入可能只能在 Core 最终检查时发现。gate
不可用时，支持的结构化写入保守停止。

## 查看状态

查看统一 lifecycle 与 DSH Profile 状态：

```bash
dev-flow status --host deepseek --profile web
dsh --profile web --dump-config
```

查看 Task、当前阶段、时间线、Recovery 和 Blocker：

```bash
dev-flow webui start
```

WebUI 只监听本机 loopback。完整用法见 [WebUI](../../docs/WEBUI.md)。

## 移除

推荐从统一入口选择 DeepSeek 卸载。Host 原生移除为：

```bash
PROFILE=web
dsh plugin --profile "$PROFILE" remove dev-flow-deepseek
dsh --profile "$PROFILE" --dump-config
```

对每个安装过 Dev Flow 的 Profile 分别执行。移除 package 或 bundle contribution 会保留 Task 数据、
目标仓库和 Codex 状态。重新安装兼容 package 并重启 Profile 后可以继续已有 Task。

彻底清理数据属于独立的 `dev-flow factory-reset` 流程，需要当前计划给出的强确认。

## DeepSeek 权限与边界

- DSH 启动时的 canonical Workspace Root 是权限边界；仓库和 symlink 解析结果必须位于其中；
- Dev Flow 不扩大 Workspace Root，也不会通过索引发现并加入相邻仓库；
- Core 只读观察 Git，不执行 commit、push、merge、rebase、tag 或 publish；
- DeepSeek 负责文件修改和命令执行；Host gate 检查列出的结构化工具，Core 最终检查累计路径，但不会拦截每一次操作；
- `/dev-flow` 不绕过当前 Action、Workspace 权限、Git 写入授权或发布确认。

## 高级多仓库

当前源码支持一个主仓库和最多七个显式附加仓库。Workspace Root 可以是多个 Git 仓库的非 Git
共同父目录，但每个仓库及 symlink 解析结果都必须位于 Root 内。Scope 创建后不可变，系统不会自动
扫描父目录、相邻目录、依赖或索引结果来扩大范围。

使用前请阅读[项目状态](../../docs/PROJECT-STATUS.md)确认多仓库属于稳定还是源码范围。精确
Repository Scope、路径格式和协议规则见[架构](../../docs/ARCHITECTURE.md)与
[命令参考](../../docs/COMMANDS.md)。

## 相关文档

- [产品定义](../../docs/PRODUCT.md)
- [中断后继续的演示](../../docs/DEMO.md)
- [命令参考](../../docs/COMMANDS.md)
- [架构](../../docs/ARCHITECTURE.md)
- [项目状态](../../docs/PROJECT-STATUS.md)
- [WebUI](../../docs/WEBUI.md)
