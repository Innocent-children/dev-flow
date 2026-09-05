<p align="center">
  <img src="https://raw.githubusercontent.com/Innocent-children/dev-flow/main/packages/webui/src/assets/dev-flow-app-icon-light.svg" width="112" height="112" alt="Dev Flow" />
</p>

# dev-flow-deepseek

[中文](https://github.com/Innocent-children/dev-flow/blob/main/packages/deepseek/README.md) |
[English](https://github.com/Innocent-children/dev-flow/blob/main/docs/DEEPSEEK_en.md)

`dev-flow-deepseek` 让 DeepSeek Harness（DSH）在独立工作树中运行一个持久 Core Task。普通开发请求
先只读评估，不调用 Dev Flow；后续精确确认才授权创建工作树和重启会话。Core 随后通过只读 Git
观察计算当前 Task surface，DSH 继续负责用户授权的 fetch、branch、worktree、文件修改和命令执行。

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

先把开发请求正常发给 DSH。Adapter 只读检查候选实现、调用关系、测试、配置和 Git 状态，返回
`small|standard|large|uncertain`、已经找到的影响面、未知项和建议；这一轮不调用 Core、不修改 Git、
不运行测试，也不创建 Task。即使第一条消息已经包含 `/dev-flow`，新请求也不能跳过评估和确认。

选择 Dev Flow 后，逐仓确认 remote、base branch 和新的 target branch。确认消息必须使用 Adapter
显示的精确形式，例如：

```text
/dev-flow confirm-worktree
repository=primary;remote=origin;base=main;target=feature/payment-callback-signature
```

WorkspaceCoordinator 随后精确 fetch 选定 remote/base，冻结 commit，并从该 commit 创建干净、独立、
具名分支的 worktree。源 checkout 可以 dirty，但 staged、tracked dirty 和 untracked 内容都不会复制。
fetch、分支校验或 worktree 创建失败时不会创建 Core Task。

DSH 的 Workspace Root 在进程启动时固定，因此 Adapter 不会扩大当前 Root。它返回由 command、argv 和
cwd 分开的 relaunch 信息；新会话从隔离 workspace 启动，使用返回的
`/dev-flow resume-worktree launch=<launch_id>` 消费 receipt，复核 branch、HEAD 和 clean 状态，然后
才创建 Task。新 Task 保存最初请求、范围、验收条件和 method profile，不在分析前冻结最终
verification budget；profile 可以是 `plain`、`spec-kit` 或 `openspec`。

## 恢复已有 Task

回到 Task 原来绑定的同一 worktree 实例，并在当前直接用户消息中再次使用 `/dev-flow`。Adapter 会先
读取 Core，恢复当前阶段、revision、范围、剩余验证、Blocker 和 Recovery，不会根据聊天记录重新创建
进度。原 worktree 丢失或被替换时进入 `WORKSPACE_UNAVAILABLE`；同路径重建目录或同名 branch 不能冒充
原实例。此时只能恢复原实例，或明确 abandon Task。

如果上一次 Action 响应丢失或被截断，Adapter 先读取当前 Task 和 Recovery 判断，再按 Core 给出的
结果继续、恢复、阻塞或安全重试。它不会自行重复原提交。

同一失败、同一测试结果，或相同修改路径与失败组成的测试循环连续出现三次时，Core 会保存第三次
结果并暂停 Task。Adapter 不会自动解除；用户明确选择换方案或再试一次后，才解除 blocker，并从
Core 保存的原目标阶段继续。下一次仍然完全重复时会再次暂停。

## 验证投入和修改后复核

Adapter 在 TASKS 完成需求、设计、工作拆分、影响面和现有测试结构分析后，才保存初始
`verification_plan`，包括计划检查及理由、预计自动命令数、完整套件预期和测试代码预期。小改动先用
离当前 diff 最近的定向检查；剩余额度不能作为扩大到 package、module 或全仓库的理由。

额度不足时不直接结束 Task，也不先运行额外命令。Adapter 使用当前 TEST Action 的
`verification_budget_increased`，用 `new_impact`、`new_risk`、`verification_failure` 或
`verification_gap` 说明具体事实，只增加当前需要的检查、命令或权限。Core 保存原因和调整前后预算并
留在 TEST。为了更全面、提高信心、保险起见或“还有预算”都不能支持增加。

每次完整套件前都重新判断广泛影响、定向/包级检查是否足够、待补的具体风险和仓库当前检查点要求，
本次理由写入 `full_suite_reason`，小修复后不自动沿用旧理由。测试代码只为稳定行为、公开接口规范、重要
失败路径或真实回归保留；一次性 README 词语要求只做一次文本搜索。

普通实现后的复核只看当前 diff、直接或间接影响和验收所需路径。修复复核发现后只检查原问题、相关
回归和对应定向检查，不重启全仓库审计。显式 code review 阶段只读，交付完整发现后等待单独修复授权。

## 范围外文件先询问

Adapter 在 DSH `tools/pre-execute` 中检查 `write`、`edit` 和变更型 `str_replace_editor`。当前 direct
user turn 使用 `/dev-flow` 时，这些工具在写入前把目标文件交给 packaged Core。Core 使用当前 Task
Plan 全部 WorkItem 的 `ExpectedPaths` 合集；多仓库路径带 repository key。B、C 等仓库已在 Task
Repository Scope、位于 Workspace Root 且文件属于计划范围时，不因为当前目录位于 A 而询问。

计划外文件会在工具执行前暂停 Task。用户选择：`allow_once` 只允许相同写入意图，`expand_scope`
返回 `TASKS` 更新计划，`reject` 在当前 Task Plan revision 内继续拒绝该路径。选择与原因由 Core
保存；Core 根据 frozen base、commit、index、worktree 和 untracked 内容重新计算当前 Task surface。

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
- Dev Flow 不扩大 Workspace Root，也不会通过索引发现并加入相邻仓库；需要 sibling worktree 时重启到
  Coordinator 返回的新 Root；
- Core 只读观察 Git，不执行 fetch、branch、worktree、commit、push、merge、rebase、tag 或 publish；
- DeepSeek 负责用户确认后的 fetch、branch、worktree、文件修改和命令执行；Host gate 检查列出的
  结构化工具，Core 计算当前 Task surface，但不会拦截每一次操作；
- `/dev-flow` 不绕过当前 Action、Workspace 权限、Git 写入授权或发布确认。

`DONE` 和 `CANCELLED` 只结束 Core Task并释放 claim，不会 commit、push、创建 PR、handoff 或删除
worktree/branch。终态会显示 remote/base/frozen commit、task branch/HEAD、路径、clean 状态、当前改动和
验证结果。worktree 删除与 branch 删除需要两次独立授权；active、dirty、未推送或状态不确定的资源不
自动清理。

DeepSeek 的清理仍由 WorkspaceCoordinator 执行。它先在不删除资源的 `prepare_cleanup` 操作中核对
receipt、终态 Task 和同 Git group 的源 checkout，并返回从该源 checkout 重启 DSH 的 descriptor，避免
原地删除当前 Workspace Root。重启后，第一次独立确认只删除 receipt 拥有、Core 已终态、clean 且
terminal HEAD 已精确推送的 worktree，并保留 task branch。第二次独立确认使用非 force 的
`git branch -d` 删除 branch；未合并、仍被 worktree 使用、HEAD/remote 不一致或 Core 读取失败都会
保留资源。源 checkout 路径只在调用中使用，不写入 receipt。

## 高级多仓库

当前源码支持一个主仓库和最多七个显式附加仓库。每个仓库都要分别确认 remote、base branch 和唯一
target branch；只有全部仓库完成 fetch、独立 worktree 创建和验证后，才一次创建一个 Core Task。
新 DSH 会话使用 Coordinator 返回的非 Git 共同 Workspace Root，所有 worktree 和 symlink 解析结果
都必须位于该 Root 内。任一仓库失败时不能只使用部分 Scope、退回共享 checkout 或留下部分 Core
claim。Scope 创建后不可变，系统不会扫描父目录、相邻目录、依赖或索引结果扩大范围。

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
