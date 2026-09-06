<p align="center">
  <img src="https://raw.githubusercontent.com/Innocent-children/dev-flow/main/packages/webui/src/assets/dev-flow-app-icon-light.svg" width="112" height="112" alt="Dev Flow" />
</p>

# dev-flow-codex

[中文](https://github.com/Innocent-children/dev-flow/blob/main/packages/codex/README.md) |
[English](https://github.com/Innocent-children/dev-flow/blob/main/docs/CODEX_en.md)

`dev-flow-codex` 让 Codex 在独立工作树中使用一个持久 Core Task。新请求先评估、再接触 Core；用户
选择 Dev Flow 后，Task 从确认的 remote、base 和 target branch 开始，Core 通过只读 Git 推导当前
改动面。

## 支持范围

| 项目 | 当前支持 |
| --- | --- |
| Package | [`dev-flow-codex`](https://www.npmjs.com/package/dev-flow-codex) |
| 稳定 Platform | macOS arm64 |
| 当前源码 Platform | macOS arm64（`darwin-arm64`）；Windows 10/11 桌面 x64（`win32-x64`） |
| Node.js | `>=24` |
| Codex | `>=0.147.0` |
| Releases | [GitHub Releases](https://github.com/Innocent-children/dev-flow/releases) |

稳定支持以[支持矩阵](../../docs/SUPPORT-MATRIX.md)为准。`main` 中存在的能力不一定已经进入 npm
`@latest`。Windows Server、32 位 Windows、Windows ARM64 与 Intel Mac 不在当前源码支持范围；
launcher 会拒绝除 `darwin-arm64` 和 `win32-x64` 之外的运行时对。

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

`setup` 在缺少固定用户配置时创建 macOS 的 `$HOME/.dev-flow/config.json` 或 Windows 的
`%USERPROFILE%\.dev-flow\config.json`，验证 package、bundled Core 和 Codex 兼容性，再注册
marketplace、Plugin 与 MCP，并在 macOS arm64 上自动将预置的桌面宠物安装至 `$HOME/.dev-flow/pet/`。默认 Task 数据在 macOS 位于 `$HOME/.dev-flow/data`，Windows 位于 `%LOCALAPPDATA%\dev-flow\data`。所有参数和机器可读输出见
[命令参考](../../docs/COMMANDS.md#codex)。

`setup` 完成后先在 Codex `/hooks` 中审核并信任 Dev Flow packaged hook；未信任时 Codex 会跳过
`apply_patch` 写前检查。

## 评估并启动一个 Task

仓库调查遵循当前用户指令和适用的 `AGENTS.md`。需要项目索引时，Codex 在现有权限内只读检查索引、
候选项目说明及相关代码与配置，形成完整候选范围，再逐仓确认并准备工作树；Task 创建后范围固定。
选择代码检索工具时，这些指令优先于 `host_preferences.codex.codebase_memory` 默认偏好。

在 Git 仓库中描述实现、缺陷修复、重构、定向测试或开发交付请求后，Codex 先只读检查候选代码、
调用关系、测试、配置、HEAD 和工作区状态，并给出 `small | standard | large | uncertain` 的改动量判断。
用户随后选择直接开发、使用 Dev Flow 或先澄清；第一次评估不会调用 Core、fetch、创建 Task、branch
或 worktree。需要明确选择本 Skill 时使用精确 selector：

```text
$dev-flow-codex:dev-flow Fix idempotency in the order-creation endpoint and run targeted tests.
```

这不是 shell 命令。`$dev-flow` 不是它的别名；精确 selector 也不会跳过评估和用户选择。只解释、
只查询状态、方案讨论、普通问答和含糊请求不会创建 Task。

用户选择 Dev Flow 后，Codex 会逐仓显示并要求再次确认 remote、base branch、全新的 target branch
以及源 checkout 的 dirty 路径。确认后，Host 只 fetch 选定 remote/base 并冻结 commit；源 checkout
中的 staged、unstaged 和 untracked 内容不会进入任务工作树。只有独立工作树、目标分支、HEAD、clean
状态和写权限全部通过检查后，才执行 Core handshake 并创建 Task。

新 Task 从需求阶段开始，只保存最初请求、范围、验收条件和 method profile，不在分析前冻结最终
verification budget。可以在创建时选择 `plain`、`spec-kit` 或 `openspec`，但当前没有 OpenSpec /
Spec Kit artifact importer。

## 恢复已有 Task

明确恢复已有 Task 时不重新评估或选择 profile。回到同一个已参与的物理 worktree，在新 Codex 会话
中继续原任务或使用精确 selector；Adapter 读取 Core 状态并恢复当前阶段、revision、范围、剩余验证、
Blocker 和 Recovery。原 worktree 丢失或已被另一个实例替换时会得到 `WORKSPACE_UNAVAILABLE`，不会
按同名路径或 branch 猜测未提交内容。

如果上一次 Action 的响应丢失或被截断，Adapter 先读取当前 Task 和 Recovery 判断，再按 Core 给出的
结果继续、恢复、阻塞或安全重试。它不会自行重复原提交。

同一失败、同一测试结果，或相同修改路径与失败组成的测试循环连续出现三次时，Core 会保存第三次
结果并暂停 Task。Codex 不会自动解除；用户明确选择换方案或再试一次后，Adapter 才解除 blocker，
并从 Core 保存的原目标阶段继续。下一次仍然完全重复时会再次暂停。

## 验证投入和修改后复核

Codex 在 TASKS 已经读完需求、设计、工作拆分、影响面和现有测试结构后，才写入初始
`verification_plan`：准备执行的检查、每项理由、预计自动命令数、是否预计完整套件、是否预计新增或
修改测试代码。小范围改动先选与 diff 最近的定向检查，不因为仍有额度就扩大到 package、module 或
全仓库。

额度不足不会直接结束 Task。Codex 在额外命令执行前，使用当前 TEST Action 返回的
`verification_budget_increased`，说明 `new_impact`、`new_risk`、`verification_failure` 或
`verification_gap` 中的实际依据，只增加当前需要的检查、命令或权限。Core 保存原因和调整前后预算，
然后留在 TEST 继续。为了更全面、提高信心、保险起见或“还有预算”都不是有效原因。

每次准备完整测试套件时，Codex 都重新判断改动是否广泛、定向或包级检查是否已经足够、完整套件补足
什么具体风险、仓库是否要求当前检查点运行，并把本次理由记录为 `full_suite_reason`。小修复后的重跑
不能沿用上一次理由。

修改测试代码前先判断它是否保护稳定产品行为、公开接口规范、重要失败路径或真实回归；一次性 README
词语要求只做一次文本搜索。普通实现后的复核只覆盖当前 diff、直接或间接影响及验收所需路径。修复
复核发现后只确认原问题、相关回归和对应定向检查，不重新启动全仓库审计。显式 code review 阶段只读，
完整交付发现后等待用户另行授权修复。

普通修改后的复核和交付只报告与当前改动有因果关系的问题，无关历史问题不进入报告。

## 范围外文件先询问

Plugin 自带 `PreToolUse` hook。用户通过 Codex `/hooks` 信任当前 hook 后，每次 `apply_patch` 执行前
都会先通过 `PATH` 中 package-owned `dev-flow-codex hook pre-tool-use` 入口解析事件，再由内部
`host-check pre-file-write` 入口把目标文件交给 packaged Core；launcher 负责定位 package-local Core，
不依赖 Codex Plugin 缓存目录结构。Core 使用当前 Task Plan 所有 WorkItem 的 `ExpectedPaths` 合集；
多仓库路径带 repository key。B、C 等附加仓库只要已在 Task Repository Scope 中、已通过 `--add-dir`
授权且文件属于计划范围，就直接修改，不因为当前工作目录位于 A 而询问。

计划外文件会在 `apply_patch` 运行前暂停 Task。用户选择：`allow_once` 只允许相同写入意图，
`expand_scope` 返回 `TASKS` 更新计划，`reject` 要求实际恢复路径后返回原节点。选择与原因由 Core
保存。Core 在 Action 提交和读取下一步前重新观察 Git，并从冻结 base commit 推导当前 Task surface；
Host 不再自行声明文件变化。

该 hook 不解析 Bash、外部进程或绕过 Codex tool hook 的专用工具；这些写入可能只能在 Core 最终
检查时发现。未信任、被禁用或不可用的 hook 不能被描述成可靠写前检查。

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
- Core 只读观察 Git，不执行 fetch，不创建 worktree 或 branch，也不执行 commit、merge、rebase、push、tag 或 publish；
- Codex 负责文件修改和命令执行；Host hook 检查 `apply_patch`，Core 观察完整 Task surface，但不会拦截每一次操作；
- selector 不绕过仓库权限、当前 Action、Git 写入授权或发布确认；
- 工作树是源码改动归属边界，不是进程、网络、凭据、端口、数据库或容器沙箱；
- 多仓库 Task 只有在每个 root 都独立 provision 并授权后才创建，部分隔离会整体拒绝；
- 共享目录 sub-agent 不能替代独立 Host worktree，也不再保留 `ACTIVE_TASK_CONFLICT` 后搬家；
- 可选代码索引只帮助检索，不能扩大 Scope 或决定 Recovery 和流程状态。

## 高级多仓库与 worktree

当前源码支持一个主仓库和最多七个显式附加仓库。附加仓库必须先通过 Codex `--add-dir` 成为当前
会话已授权的 writable root；Scope 创建后不可变，系统不会扫描相邻目录自动扩大范围。

并行批次会先逐项评估，用户一次确认要进入 Dev Flow 的项目和每个唯一 target branch，确认前没有
child dispatch。Codex 只有在 Host 能为每个项目提供独立 worktree-backed task/thread 时才分派；每个
child 有一个 Host task、一个 worktree 和一个 Core Task。`ACTIVE_TASK_CONFLICT` 现在只会停止，不再
触发事后搬家。

Codex App managed worktree 从精确 `refs/remotes/<remote>/<base>` 创建，child 在 Core 调用前建立用户
确认的 target branch。无 task creation 能力的 Codex CLI 使用 receipt 返回的 `codex -C` / `--add-dir`
argv descriptor 重新进入。managed worktree 的 snapshot、Handoff 和清理由 Codex Host 负责；CLI
工作树与 branch 的删除分别需要用户授权，且不会使用 force。

同机 relocation 先由 Core 的 `dev_flow_prepare_task_relocation` 保存 blocker，再由另一个 coordinator
执行一次 Codex Handoff；结果不确定时只读 receipt 和 Host 状态，不重复 Handoff。工作树确实丢失且
无法恢复时，用户可以通过 `dev_flow_abandon_task` 释放 claim。`DONE` / `CANCELLED` 本身不会删除
branch 或 worktree。

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

## 桌面宠物本地开发包

macOS arm64 可另外使用按源码构建的 `@imotong/dev-flow` 桌面宠物包。已配置的 Codex 或 DeepSeek
Adapter 提供 Core；宠物通过 `dev-flow pet start` / `dev-flow pet stop` 开启和关闭，读取共享任务并
点击跳转 WebUI。原生应用只放在统一入口包内，Host package 提供 Core。构建与使用见
[命令参考](https://github.com/Innocent-children/dev-flow/blob/main/docs/COMMANDS.md#桌面宠物本地开发包)。

自定义形象从宠物菜单的“选择形象 → 导入形象…”导入本地文件夹，支持单张 PNG、Dev Flow 动画包和
Codex 精灵图格式 1/2 的本地宠物包。形象与任务分别选择和保存，升级保留用户素材；同 ID 重导入更新，
校验失败保留原形象。导入 Codex 时转换为统一 PNG 帧，任务阶段与跳转仍由 Dev Flow 决定。格式与示例见
[形象包说明](https://github.com/Innocent-children/dev-flow/blob/main/docs/DESKTOP-PETS.md)。
