<p align="center">
  <img src="packages/webui/src/assets/dev-flow-app-icon-light.svg" width="112" height="112" alt="Dev Flow 图标" />
</p>

<h1 align="center">Dev Flow</h1>

<p align="center"><strong>让长时 AI 编程任务的改动范围、验证上限和当前进度不随会话中断而丢失。</strong></p>

<p align="center">
  <a href="README.md">English</a> · <a href="README_zh-CN.md">简体中文</a> · <a href="README_zh-TW.md">繁體中文</a> · <a href="README_ja.md">日本語</a> · <a href="README_ko.md">한국어</a> · <a href="README_es.md">Español</a> · <a href="README_fr.md">Français</a> · <a href="README_de.md">Deutsch</a> · <a href="README_pt-BR.md">Português (Brasil)</a>
</p>

## 让长任务不再悄悄走偏

一个代码任务做得越久，越容易逐渐变形：更多文件进入改动范围，定向检查变成没有上限的测试，
同一个失败又触发一轮相似尝试，或者会话重启后只能从聊天记录重新拼凑进度。

Dev Flow 把已经同意的请求、预计路径、分析后形成的验证计划、当前阶段和结果保存在同一个本机任务中，代码仍由
Codex 或 DeepSeek 完成。

每个新请求都会先经过只读评估。选择 Dev Flow 后，Host 先询问使用本地还是远端分支、起始分支和
新任务分支名。选择本地时，还会询问是否复制已暂存、未暂存及未被 Git 忽略的新增文件，并保留
源工作区和暂存状态。本地创建无需联网，远端创建才执行 fetch。应用改动发生冲突时停止创建 Task，
保留目标工作树供检查。

仓库调查和代码索引工具选择遵循当前用户指令及适用的 `AGENTS.md`。这些指令要求检查项目索引时，
Host 在确认前只读调查候选仓库，再将确认后的范围固定到 Task；这些指令优先于插件的代码索引偏好。

- **范围始终明确。** 记录预计路径；受支持的结构化工具写计划外文件前先询问；测试和交付前再次
  核对实际改动。
- **工作树只有一个修改归属。** Core 从专属工作树的 Git 状态计算当前 Task 修改面；正常线性 commit
  会保留修改面，branch rewrite 或工作树实例替换会停止任务。
- **验证投入与任务匹配。** TASKS 保存检查、理由、初始投入及完整套件/测试代码预期；只有具体的新影响、
  风险、失败或缺口才能增加预算，剩余额度本身不是理由。
- **复核停在当前改动。** 修改后只检查 diff、因果影响和验收所需内容；修复发现后只做相关复查，
  显式 code review 仍然只读。
- **会话中断后可以继续。** 新会话恢复同一个任务、剩余检查和当前决定，不需要从聊天记录重建。
- **只沿用仍然有效的结果。** 请求、计划、实现或仓库变化后，旧检查会失效；交付前由开发者复核
  实际结果。
- **完成结果可以核对。** 所有计划工作项完成、每条验收关联当前有效检查后，才能交付；WebUI 中断后从 Core 恢复保存的提交。

## 文件提交准备

Codex 提交前执行 `dev-flow-codex artifacts collect` 和 `dev-flow-codex artifacts prepare`。Core 完整枚举当前 Action 的改动，Codex 逐项分类后由命令生成 artifact 数组。漏报时返回准确路径和受限纠正指示，工作树、历史及节点权限检查继续执行。详见[文件收集与提交](docs/ARTIFACTS.md)。

在启动 Codex 前，将 `DEV_FLOW_DATA_DIR` 设为已存在的规范化绝对目录，MCP、hook 和文件准备命令使用同一数据目录。`dev-flow-codex artifacts <collect|prepare> --help` 返回 JSON 示例、字段说明、输出和下一步，查询时不启动 Core。

## 快速开始

> 稳定 npm `@latest` 目前已验证 macOS arm64。请使用 Node.js `>=24`，并提前安装受支持的 Codex
> 或 DeepSeek Harness。准确的 Codex、DSH 版本和其他环境状态见[支持矩阵](docs/SUPPORT-MATRIX.md)。

### 1. 安装 Dev Flow

```bash
npm install -g @imotong/dev-flow@latest
dev-flow
```

生命周期菜单显示 Adapter 安装状态，支持返回、退出、输入错误重试和打开 Control Center。确认前展示版本变化与资源路径。`install`、`repair`、`reinstall` 默认保留已安装版本，`upgrade` 选择 `latest`。健康安装的重复安装/修复、已是目标版本的升级和已完成的移除无需变更；重装会再次替换安装包。`doctor` 展示失败检查与处理命令。参数见 `dev-flow repair --help`；JSON 模式不询问。这些命令维护 Adapter，公共入口使用 `npm install -g @imotong/dev-flow@latest` 更新。

在交互界面中选择 Codex、DeepSeek 或两者。首次启动任务前，还要完成安装器提示的对应操作：

- **Codex：** 打开 `/hooks`，检查并信任 Dev Flow 随包提供的 hook。信任前，受支持的
  `apply_patch` 写前检查不会生效。
- **DeepSeek Harness：** 安装后重启所选 DSH Profile。

当前源码 Adapter 要求 DSH `>=0.1.2-rc.1`；每次 Dev Flow 操作都核对当前用户直接输入的授权。

### 2. 启动任务

在 **Codex** 中发送这条用户消息：

```text
$dev-flow-codex:dev-flow 增加登录失败限流。只修改认证相关文件，最多运行 4 项定向检查。
```

Codex 沿用已有且仍有效的选择与授权，不额外要求“确认后继续”；遇到尚未决定的事项或缺少必需输入时，仍会提出具体问题。

或者在 **DeepSeek Harness** 中发送：

```text
/dev-flow 增加登录失败限流。只修改认证相关文件，最多运行 4 项定向检查。
```

这两项是对话 selector，不是 shell 命令。尽量写清目标、验收条件、文件边界和测试上限。第一次回复
只评估影响面并询问直接开发还是使用 Dev Flow；显式 selector 也不会跳过选择。选择 Dev Flow 后，
还要确认上述来源、分支和携带改动的选择。Codex 在 Host 支持时打开 managed worktree；DeepSeek
因为当前会话的 Workspace Root 固定，会给出从新工作树重新启动的命令。

启动新的 Codex 会话前，原会话保存本次需求的相关讨论原文和结构化交接材料，区分已确定要求、未采纳建议和待确定问题。桌面新任务与 CLI 启动使用同一份保存内容；长内容通过完整文件传递，不截断需求。详见[架构说明](docs/ARCHITECTURE.md#codex-需求交接)。

交接保留会话专属指示和授权；适用的全局及仓库 `AGENTS.md` 由 Codex 正常加载，正文不在交接中重复。目标会话无法自动加载的必要规则补充注明来源和适用范围。

### 3. 恢复和查看进度

会话重启后，请在 Task 绑定的原工作树中明确请求继续该任务。系统会校验原工作树，并从已保存的
任务状态继续处理，无需重新评估请求或再次选择是否使用 Dev Flow。原工作树丢失或被替换时，任务会
暂停，需要恢复原工作树或明确放弃任务（abandon）；系统不会改用其他工作树。

```bash
# 查看已安装的集成
dev-flow status --host all

# 打开本机任务界面
dev-flow webui start
```

非交互安装、自定义 DSH Profile、升级、修复和移除方式见[命令参考](docs/COMMANDS.md)。

## 适用场景

Dev Flow 适合会跨会话、需要明确文件范围、必须限制测试投入，或可能返工且不能沿用旧结果的真实
仓库任务。

一次性问答、代码解释、状态查询和不需要保存进度的小型机械修改，直接使用 Codex 或 DeepSeek
通常更简单。

## 桌面宠物（macOS arm64）

本地宠物包保留默认形象；鲸鱼娘等自定义形象通过“导入形象…”单独安装，程序更新保留已导入素材。

桌面宠物通过包含 `DevFlowPet.app` 的 macOS arm64 本地开发包使用；常规 npm 清单与正式制备流程不包含原生应用。运行已构建的包无需 Swift/Xcode，由已配置的 Codex 或 DeepSeek Adapter 提供 Core。宠物显示一个 Task 的保存状态并打开对应 WebUI，不推断 Host 实时活动或完成百分比；退出保留 Task 和 WebUI。

形象支持静态 PNG/SVG、PNG/SVG 原生动画包和 Codex 标准格式 1/2 图集。原生包要求五类任务动作，可增加四类附加动作；Codex 布局图集固定提取九类、57 帧。Dev Flow 高分辨率扩展在 Codex 中使用时需另备标准尺寸图集。可用素材决定待机散步、挥手和思考，菜单可独立关闭待机活动，任务提示优先。程序更新与素材重导入分别处理。

菜单栏使用 Dev Flow 流线标识的单色图标，随系统外观调整颜色。“宠物大小”提供 50%～200% 六档缩放，保持气泡文字大小。默认形象作为独立素材包交付，包含九类动作、312 个 SVG 帧。

未选中任务时，宠物持续查找新任务，优先选择最近更新的受阻任务，其次选择最近更新的进行中任务；选中后保持当前关注对象，直到手动更换。

获取应用、安装更新、触发规则、限制和排查统一见[桌面宠物指南](docs/DESKTOP-PETS.md)，公开支持范围以支持矩阵为准。

```bash
dev-flow pet start
dev-flow pet stop
```

## 文档

- **使用说明：** [Codex](packages/codex/README.md) · [DeepSeek](packages/deepseek/README.md) · [命令参考](docs/COMMANDS.md) · [Control Center](docs/WEBUI.md)
- **项目资料：** [产品定义](docs/PRODUCT.md) · [支持矩阵](docs/SUPPORT-MATRIX.md) · [安全策略](SECURITY.md) · [贡献指南](CONTRIBUTING_zh-CN.md)

## 许可证

[Apache License 2.0](LICENSE)

## Windows 桌面适配

Windows 10/11 x64 面向普通 Intel、AMD 64 位桌面电脑。Host 的路径、权限、命令与清理规则分别位于 `platform/windows/` 和 `platform/macos/`；Core 共享平台中立的任务语义。Windows 命令启动器使用 UTF-8，Core 的 Git 观察隐藏控制台窗口。原生 Windows 验证及限制见[适配报告](docs/WINDOWS-ADAPTATION.md)，这些结果不扩大稳定安装包的支持声明。

Windows 现已提供桌面宠物：任务选择与状态气泡、托盘菜单、PNG/SVG 形象、原生动画、Codex PNG/WebP 图集、九类动作、拖动、六档大小、隐藏恢复和独立启停。使用 `node scripts/build-desktop-pet-windows.mjs --output "C:\pet-build"` 构建 Windows 本地包；依赖准备与安装见[桌面宠物指南](docs/DESKTOP-PETS.md)。Windows 与 macOS 桌面实现保持独立。
Windows 调整大小时会结束当前待机活动，并恢复正常调度。

Windows 会将已有 AppData 目录解析为实际路径，包括打包桌面宿主提供的目录别名；仍拒绝符号链接。

当前 Windows 开发包同时包含两个 Adapter 包和桌面应用。安装统一入口包后，使用 `dev-flow install --host all --yes` 与 `dev-flow pet start`。修复、重装均通过同一入口执行，校验内置包摘要、更新桌面应用，并保留 Task 数据、设置和形象。

`dev-flow-codex host-launch <operation>` 从 stdin 流读取最多 1 MiB 的 UTF-8 JSON 对象，支持分块输入及跨块中文字符。读取失败、非法 UTF-8、重复成员、非法 JSON、数组或 null 均在执行操作前拒绝；错误写入 stderr，成功结果以 JSON 写入 stdout。

## 命令帮助与任务恢复

Codex 的命令帮助提供工作区操作参数、返回字段和下一步。全部仓库准备完成后，Host 汇总保存的工作区范围。MCP 结果 Schema 说明 Task 和 Action 的读取位置；恢复会话先处理未完成提交，再继续执行。

```bash
dev-flow-codex --help
dev-flow-codex host-launch prepare --help
dev-flow-codex artifacts --help
dev-flow-codex artifacts collect --help
dev-flow-codex artifacts prepare --help
```

参数和恢复规则见[命令参考](docs/COMMANDS.md)。

`host-launch prepare` 省略 `launch_id` 时自动生成 ID，并使用该 ID 核对启动记录。重试时传入返回的 `receipt.launch_id`，继续同一次启动；记录已为 `prepared` 时跳过 fetch。显式传入的 ID 必须与保存记录一致。

`host-launch dispatch-result` 接收 Codex 创建任务的完整返回值，包括 `content[].text` 中的 JSON。它将 `clientThreadId` 保存为 `host_client_thread_id`，阶段设为 `queued`；以相同 `launch_id` 和 `repository_key` 重新提交保留的结果，可以恢复 `uncertain` 记录。后续检查继续跟踪同一次创建，不重复派发。

Codex 保存完整工作区创建请求供回读。`dispatch-start` 准备请求，`dispatch-call` 允许一次调用，`dispatch-recover` 恢复确认尚未调用的操作，`dispatch-reconcile` 在结果未知时匹配已有任务。调用方从完整 JSON 文件解析；缺少结果不能作为重复创建的理由。

## Codex 携带文件的任务规划

Codex 携带本地改动时，会在 REQUIREMENTS 中记录保留要求，在 TASKS 中将完整的 `current_changed_paths` 与 `expected_paths` 及已保留的流程文件逐项核对。新开发工作和已有内容保留分别安排工作项与检查；当前 Action 的空文件清单不能代替完整 Task 路径核对。保留检查比较启动快照，不代表已有业务功能已经验证。已发生的文件范围阻塞仍通过现有 Core 选择与转移处理。

## 为已有检查补充额度

增加验证额度时，`additional_checks` 可以引用原计划或此前增加记录中的检查名称，使用 `rationale` 说明本次补做或重跑。单次提交内名称仍需唯一，具体原因、实际增加量和上限继续校验；追加额度本身不生成通过结果。
