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

每个新请求都会先经过只读评估。用户选择 Dev Flow 后，需要确认 remote、base branch 和新的任务
分支；Host 从该远端基线创建干净的专属工作树，Core 随后才创建 Task。源 checkout 的现有改动不会
复制进去。

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

## 快速开始

> 稳定 npm `@latest` 目前已验证 macOS arm64。请使用 Node.js `>=24`，并提前安装受支持的 Codex
> 或 DeepSeek Harness。准确的 Codex、DSH 版本和其他环境状态见[支持矩阵](docs/SUPPORT-MATRIX.md)。

### 1. 安装 Dev Flow

```bash
npm install -g @imotong/dev-flow@latest
dev-flow
```

在交互界面中选择 Codex、DeepSeek 或两者。首次启动任务前，还要完成安装器提示的对应操作：

- **Codex：** 打开 `/hooks`，检查并信任 Dev Flow 随包提供的 hook。信任前，受支持的
  `apply_patch` 写前检查不会生效。
- **DeepSeek Harness：** 安装后重启所选 DSH Profile。

### 2. 启动任务

在 **Codex** 中发送这条用户消息：

```text
$dev-flow-codex:dev-flow 增加登录失败限流。只修改认证相关文件，最多运行 4 项定向检查。
```

或者在 **DeepSeek Harness** 中发送：

```text
/dev-flow 增加登录失败限流。只修改认证相关文件，最多运行 4 项定向检查。
```

这两项是对话 selector，不是 shell 命令。尽量写清目标、验收条件、文件边界和测试上限。第一次回复
只评估影响面并询问直接开发还是使用 Dev Flow；显式 selector 也不会跳过选择。选择 Dev Flow 后，
还要确认建议的 remote、base 和 target branch。Codex 在 Host 支持时打开 managed worktree；DeepSeek
因为当前会话的 Workspace Root 固定，会给出从新工作树重新启动的命令。

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

## 本地构建的桌面宠物

macOS arm64 本地开发包包含桌面宠物。配置好至少一个 Codex 或 DeepSeek Adapter 后，可显示一个所选任务已保存的阶段与阻塞原因，点击进入对应 WebUI。菜单提供任务选择、动画开关和隐藏/显示。阶段表示 Core 保存的状态，不表示 Host 此刻正在执行，也不显示完成百分比。退出保留任务和 WebUI。使用方式见[本地构建说明](docs/COMMANDS.md#桌面宠物本地开发包)，公开支持范围仍以支持矩阵为准。

可以从宠物菜单导入单张 PNG、Dev Flow 动画包或 Codex 精灵图格式 1/2 的形象包；选择和导入素材在升级后保留。制作方式见[形象包说明](docs/DESKTOP-PETS.md)。

```bash
dev-flow pet start
dev-flow pet stop
```

## 文档

- **使用说明：** [Codex](packages/codex/README.md) · [DeepSeek](packages/deepseek/README.md) · [命令参考](docs/COMMANDS.md) · [Control Center](docs/WEBUI.md)
- **项目资料：** [产品定义](docs/PRODUCT.md) · [支持矩阵](docs/SUPPORT-MATRIX.md) · [安全策略](SECURITY.md) · [贡献指南](CONTRIBUTING_zh-CN.md)

## 许可证

[Apache License 2.0](LICENSE)
