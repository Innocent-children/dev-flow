# dev-flow-codex

[中文](https://github.com/Innocent-children/dev-flow/blob/main/packages/codex/README.md) |
[English](https://github.com/Innocent-children/dev-flow/blob/main/docs/CODEX_en.md)

`dev-flow-codex` 把 Dev Flow 状态图接入 Codex CLI。package 包含 Codex Plugin、智能/显式 Skill、
local STDIO MCP 配置和 macOS arm64 Core executable；Task、节点、流转和 Recovery 仍由 bundled
Go Core 独自管理。

## 支持范围

| 项目 | 当前支持 |
| --- | --- |
| Package | [`dev-flow-codex`](https://www.npmjs.com/package/dev-flow-codex) |
| Platform | macOS arm64 |
| Node.js | `>=24` |
| Codex | `>=0.147.0` |
| Releases | [GitHub Releases](https://github.com/Innocent-children/dev-flow/releases) |

## 安装与验证

```bash
npm install -g @imotong/dev-flow@latest
dev-flow
```

`dev-flow` 是默认生命周期和公共 WebUI 入口；诊断恢复时仍可使用以下 Host 原生命令：

```bash
npm install -g dev-flow-codex@latest
dev-flow-codex setup
dev-flow-codex status --json
dev-flow-codex --version
```

npm 全局安装只负责把 package 和 `dev-flow-codex` launcher 放到 `PATH`。`setup` 是独立步骤：
它验证平台、package 内容、bundled Core 与 Codex 兼容版本，然后注册 Plugin、marketplace 与 MCP，
并在写入后回读 ownership。配置缺失时 setup 创建 `$HOME/.dev-flow/config.json`；成功后以简中/英文
品牌首屏或纯文本展示实际配置/receipt 文件变化和一个下一步。`--version` 同时输出实际 package 和
bundled Core 版本。

## 命令参考

`dev-flow-codex` 的生产 CLI 只接受下表中的命令；未知参数会在执行任何注册操作前失败。

| 命令 | 说明 |
| --- | --- |
| `npm install -g dev-flow-codex@latest` | 安装 npm `latest` 指向的 package，并把 launcher 全局加入 `PATH`；不会自动注册 Codex Plugin。 |
| `dev-flow-codex setup` | 创建或验证固定用户配置，校验 package、Core 和 Codex 版本，注册 marketplace、Plugin 与 MCP，并显示实际配置/receipt 文件变化、ready 和一个下一步。重复执行显示零变化，兼容升级通过同一命令完成。 |
| `dev-flow-codex setup --json` | 与 `setup` 行为相同，但只输出一行无装饰 JSON：保留 `operation`、`status`、`changed`、`receipt_path`，增加 `configuration_path`、`file_changes`、`next_step`。 |
| `dev-flow-codex status` | 只读显示当前 package/Core 与注册状态。 |
| `dev-flow-codex status --json` | 只读回读 package、Core、receipt、marketplace 与 Plugin 状态；不会创建配置、注册或数据。 |
| `dev-flow-codex --version` | 输出 `dev-flow-codex <package-version> (core <core-version>)`，用于确认实际安装身份。 |
| `dev-flow-codex remove` | 先按 runtime receipt 停止对应 WebUI，再删除该 package 拥有的 Plugin、marketplace 注册和 receipt；停止失败时保留注册。Task data、未知相邻文件和目标 Git 仓库保持不变。 |
| `dev-flow-codex remove --json` | 与 `remove` 行为相同，并输出机器可读 JSON；`next_step` 提示随后执行全局 npm 卸载。 |
| `npm uninstall -g dev-flow-codex` | 在 `remove` 完成后卸载全局 package。单独执行不会先清理 Codex 注册。 |
| `dev-flow-codex mcp` | **内部 Host 命令。** Plugin 的 MCP 配置调用它来设置数据目录和 admission instructions，再启动 packaged Core 的 `mcp --stdio`；正常用户不应手工运行。 |

当前 CLI 不提供 `help`、`update`、`uninstall` 或其他隐式子命令。统一生命周期入口负责升级、修复、
重装、卸载和清空后重装；Host 原生更新仍可执行：

```bash
npm install -g dev-flow-codex@latest
dev-flow-codex setup
dev-flow-codex --version
```

完整的 Codex、DeepSeek、Core 和 MCP 命令目录见
[命令参考](../../docs/COMMANDS.md)。

## 开始一个 Task

在当前 Git 仓库中，可以直接描述边界明确的实现、缺陷修复、重构、定向测试或开发交付工作，
Codex 会根据 Skill description 智能选择 Dev Flow。需要确定进入时仍可使用精确 selector：

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

Codex 完成当前节点工作后，调用 live Action 的 `submission_tool`，只提交 Task ID、Action ID、
`transition_id`、artifact slots、method results 和节点结果；Core 补齐完整 mutation 输入。
Design、Tasks 与 Implementation 节点结果不发送 `requirements_revision`、`design_revision` 与
`task_plan_revision`；Core 确认当前 Action 身份后从同一 Task 快照填充。已证明零写入的
`required_member_missing` 只可按 `allowed_paths` 和当前节点已有事实修正一次；需要新的用户决定时
Codex 停止并请求输入。

## 独立 worktree Task 分派

用户明确列出两个以上彼此独立的有界任务，并要求在同一逻辑 Git 仓库并行执行时，Skill 在普通
Task admission 之前检查 Host 是否提供 worktree-backed task/thread 创建能力。能力可用时，每个任务
进入一个独立 Git worktree 和 Codex task，并在子 task 中通过 `$dev-flow-codex:dev-flow` 创建自己的
Core Task。协调者不创建父 Core Task，也不调用 Dev Flow MCP。

单个新请求仍在当前物理 worktree 完成 admission、handshake，并调用一次 `dev_flow_open_task`。
只有该调用携带非空 `new_task` 且返回完整 `ACTIVE_TASK_CONFLICT` 时，Skill 才在 Host 能力可用的
前提下创建且只创建一个独立 Codex task。创建调用设置
`target.environment.type="worktree"`，完全省略 `startingState`，因此新 worktree 从项目默认分支的
已提交状态开始。Skill 不读取、复制或应用占用中 checkout 的 index、已跟踪工作区改动、未跟踪
文件、diff 或 Task artifact；子 task 只接收当前有界请求、验收条件、验证权限和精确 selector，
再自行执行完整 Dev Flow 流程。

分派成功后，协调者不再调用 Core，不重试 `dev_flow_open_task`，也不创建父 Task、替代 Task 或恢复
原 Task；原活动 Task、repository claim 和 worktree 保持不变。Host 创建结果不确定时也不重试，
避免创建第二个子 task。显式 resume、`HOST_OWNERSHIP_CONFLICT` 与其他错误仍按原规则停止。

普通 sub-agent 若共享当前工作目录，不属于有效隔离。Host 无法保证每个子 task 使用独立 worktree
时，Skill 会停止并提示用户分别启动 worktree；不会把多个任务合并为一个 Task，也不会自动执行
commit、merge、rebase、push 或冲突处理。每个物理 worktree 仍最多有一个活动 Task。

## 两仓声明、权限与可选索引

启动 Codex 会话时，当前 Git 仓库自动成为主仓库。附加仓库必须先通过 Codex 的 `--add-dir` 成为
当前会话已授权的 writable root；Dev Flow 不修改 sandbox，也不读取全局 Codex 配置来推断授权。
授权完成后，可以直接发送：

```text
$dev-flow-codex:dev-flow Use the current Git repository as primary key core and add repository key docs at /absolute/path/to/docs. Update core::internal/api.go and docs::reference/api.md, then run only the targeted checks.
```

路径必须替换为真实绝对路径。Scope 总数为一至八，创建后不可增加、删除、重命名或替换；系统不
扫描父目录、相邻目录、依赖或索引结果来发现仓库。单仓库请求不需要 key，继续使用普通相对路径。
从附加仓库恢复时，Codex 仍返回原主仓库、ordered Scope、revision 和当前 Action。
Codex 与 DeepSeek 共用同一 Repository Scope、scoped path、Action 和唯一
`repository_binding_digest` Core 合同；Host 权限检查不创建第二套流程状态。

可选代码索引偏好来自只读配置：

```json
{
  "codex": { "codebase_memory": true },
  "deepseek": { "codebase_memory": false }
}
```

文件路径固定为 `$HOME/.dev-flow/config.json`。文件不存在时偏好为 false，Dev Flow 不创建或修改
它。true 只允许使用当前会话中已经可见且可用的 codebase-memory；缺失、不完整或中途不可用时，
Codex 每个 Dev Flow 会话最多提示一次并立即回退到内置 Git、文件和文本检索，不阻塞 Task，也不
安装、配置或启动索引能力。索引结果不能扩大 Scope、证明写权限或决定 Recovery 与流程流转。

## 智能启用与显式入口

Skill metadata 设置 `policy.allow_implicit_invocation: true`。实现、缺陷修复、重构、定向测试和开发
交付这五类边界明确的请求可以由 Host 隐式选择 Dev Flow；下面的精确 selector 继续作为强制入口：

```text
$dev-flow-codex:dev-flow
```

相关名称与边界如下：

- Skill resource/base name 是 `dev-flow`；
- 安装后的 Skill full name 是 `dev-flow-codex:dev-flow`；
- `$dev-flow` 不是别名，不会选择该 Skill；
- plugin namespace 错误不会成为显式选择；
- Skill base name 错误不会成为显式选择；
- 缺少 selector 时，只有 Host 已为任务型开发请求隐式选择该 Skill 才能进入；
- 仅解释、仅状态查询、方案讨论、普通问答和含糊请求不自动创建或恢复 Dev Flow Task；
- 显式强制选择不会绕过实质请求、仓库权限、Core Action、Git 变更授权或发布确认。

两种选择方式进入同一 admission、兼容握手、Task discovery 和 Action loop。这项边界不限制 Codex
的普通仓库工具，也不声称 MCP 的可见性或授权与 selector 绑定。

通过 admission 后，`dev_flow_server_info({})` 必须是第一次 Dev Flow 调用。安装内容、bundled
Core、Codex 兼容性和注册 ownership 已由 `dev-flow-codex setup` 验证；每次 Task 启动只静默确认
Core ready、`standard-development`、definition digest、method profiles 与十五个工具的闭合集合，
成功后立即打开或恢复 Task。正常启动不向用户逐项展示版本、摘要、profile 或工具目录；只有失败
时才报告具体阻塞项和一个可执行的恢复步骤。工具和 method profile 的返回顺序不影响兼容性。

| MCP 工具 | 作用 |
| --- | --- |
| `dev_flow_server_info` | 读取 Core identity、能力、process、method profile、工具目录和 Codex 有效索引偏好；有效 admission 后必须首先调用。 |
| `dev_flow_open_task` | 为当前主仓库和显式附加仓库创建一个 Task，或从任一参与仓库恢复同一 Task。 |
| `dev_flow_get_task` | 读取持久化 Task；存在 Core 保存的提交时自动返回 Recovery assessment。 |
| `dev_flow_get_next_action` | 读取当前 Action、`submission_tool`、验证预算、method steps 和全部合法 transition。 |
| `dev_flow_submit_requirements` | 提交 REQUIREMENTS 节点结果；Core 补齐完整 Action identity 和内部 payload。 |
| `dev_flow_submit_design` | 提交 DESIGN 节点结果。 |
| `dev_flow_submit_tasks` | 提交 TASKS 节点结果。 |
| `dev_flow_submit_implementation` | 提交 IMPLEMENT 节点结果。 |
| `dev_flow_submit_test` | 提交 TEST 节点结果。 |
| `dev_flow_submit_comprehension` | 提交 COMPREHENSION_REVIEW 节点结果。 |
| `dev_flow_submit_refactor` | 提交 REFACTOR 节点结果。 |
| `dev_flow_submit_delivery` | 提交 DELIVERY 节点结果。 |
| `dev_flow_resolve_blocker` | 使用 Task ID 与 Action ID 解除已满足条件的 blocker。 |
| `dev_flow_recover_action` | 使用 Core 保存的规范化提交恢复不确定 Action，不重新发送 payload。 |
| `dev_flow_cancel_task` | 使用当前 revision 和明确 reason 取消一个非终态 Task。 |

`dev_flow_submit_delivery` 只接收 Host 负责的交付判断、未验证项、风险、发现和 mutation envelope。
acceptance、自动/人工 evidence ID 以及 Test/Comprehension record ID 由 Core 从当前 Task 补齐；提交
这些字段会按 `unknown_member` 拒绝。

## 理解审查与 Recovery

`TEST` 通过后，Task 进入 `COMPREHENSION_REVIEW`。Codex 解释当前行为、设计与维护风险，开发者
给出明确 verdict。复杂实现进入 `REFACTOR`；仓库发生变化后必须重新回到 `TEST`。

Core 在推进 Task 前保存规范化 Action 提交。结果缺失、取消、截断、损坏或 transport failure 时，
Adapter 只保留 Task ID 与 Action ID，先读取 Core，再调用 `dev_flow_recover_action` 或按 advice
停止；它不重建原始 payload。

## 数据目录

默认数据目录由 package lifecycle 管理，也可以设置：

```bash
export DEV_FLOW_DATA_DIR="/absolute/path/to/existing-directory"
```

显式目录必须已经存在、可用且可 canonicalize。setup、remove 和 npm uninstall 都保留 Task data
与未知相邻文件，也不会修改目标 Git 仓库。

当前 Core 只读取当前 SQLite Schema。检测到不兼容或 pre-graph data 时普通启动保持零写入并返回
`reset_required`。package 携带的同一 Core 支持 `dev-flow webui start|open|status|stop|reset`；WebUI 只监听
loopback，Codex 与 DeepSeek 复用同一进程和数据。reset 先展示精确 database/sidecar 目标，再要求当前
target-bound token 和数据库独占访问；浏览器没有 reset mutation。界面支持简体中文/英文，首次跟随系统
语言，手工选择只保存在浏览器。完整说明见 [WebUI](../../docs/WEBUI.md)。

## 卸载与彻底清理

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

确认不再使用 DeepSeek Adapter，也不再需要任何 Task 后，才可以删除 Codex 与 DeepSeek 共享的
默认 Dev Flow 数据和残留 registration receipt：

```bash
rm -rf "$HOME/Library/Application Support/dev-flow"
```

这是不可恢复操作。如果使用过 `DEV_FLOW_DATA_DIR`，请确认该变量对应的准确绝对目录后单独删除；
`remove`、npm uninstall 和 Dev Flow Core 都不会自动删除它。不要通过手工修改 Codex 配置代替
`dev-flow-codex remove`，因为 `remove` 会按 ownership receipt 清理 package 拥有的注册并保留相邻配置。

## Package 内容

生产 package 由 `package.json.files` 关闭，只包含 Plugin、Skill、MCP 配置、lifecycle library、
license 和一个内嵌 WebUI 资产的 darwin-arm64 Core。它不包含 source tree、tests、fixtures、specs、`.git`、
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
