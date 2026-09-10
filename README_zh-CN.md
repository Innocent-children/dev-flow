<p align="center">
  <img src="packages/webui/src/assets/dev-flow-app-icon-light.svg" width="112" height="112" alt="Dev Flow 图标" />
</p>

<h1 align="center">Dev Flow</h1>

<p align="center"><strong>让长时 AI 编程任务的改动范围、验证上限和当前进度不随会话中断而丢失。</strong></p>

<p align="center">
  <a href="README.md">English</a> · <a href="README_zh-CN.md">简体中文</a> · <a href="README_zh-TW.md">繁體中文</a> · <a href="README_ja.md">日本語</a> · <a href="README_ko.md">한국어</a> · <a href="README_es.md">Español</a> · <a href="README_fr.md">Français</a> · <a href="README_de.md">Deutsch</a> · <a href="README_pt-BR.md">Português (Brasil)</a>
</p>

## Dev Flow 能帮你做什么

Dev Flow 帮助你在 Codex 或 DeepSeek 中管理长时间运行的 AI 编程任务。它在本机保存已确定的
需求、文件范围、验证计划、进度和结果，方便会话中断后继续工作。

- **明确改动范围：** 记录预计修改的文件，并按计划检查实际改动。
- **安排验证投入：** 选择与任务相关的检查，设置验证投入上限。
- **恢复任务：** 回到原工作目录，继续同一任务中尚未完成的工作。
- **查看结果：** 查看当前进度、检查结果，以及任务需要处理的问题。

适合跨会话、需要明确文件范围和测试投入的仓库任务。一次性问答、代码解释和不需要保存进度的
小型修改，直接使用 Codex 或 DeepSeek 通常更简单。

## 快速开始

> 稳定 npm `@latest` 目前已验证 macOS arm64。请使用 Node.js `>=24`，并提前安装受支持的
> Codex 或 DeepSeek Harness。Host 版本要求和其他环境状态见[支持矩阵](docs/SUPPORT-MATRIX.md)。

### 1. 安装 Dev Flow

```bash
npm install -g @imotong/dev-flow@latest
dev-flow
```

在交互界面中选择 Codex、DeepSeek 或两者，并完成安装器提示的操作：

- **Codex:** 打开 `/hooks`，检查并信任 Dev Flow hook，启用受支持的写入前检查。
- **DeepSeek Harness:** 安装后重启所选 DSH Profile。

### 2. 启动任务

在 **Codex** 中发送：

```text
$dev-flow-codex:dev-flow 增加登录失败限流。只修改认证相关文件，最多运行 4 项定向检查。
```

或者在 **DeepSeek Harness** 中发送：

```text
/dev-flow 增加登录失败限流。只修改认证相关文件，最多运行 4 项定向检查。
```

这两条消息发送到对话中，不在终端执行。尽量写清目标、验收条件、文件范围和测试上限。

首次回复会评估请求，并询问直接开发还是使用 Dev Flow。选择 Dev Flow 后，默认从当前 HEAD
在当前目录新建任务分支。确认新分支及是否将已有未提交修改纳入任务；现有依赖、本地配置、文件和
暂存状态保留。当前会话能访问全部参与目录时，直接在原会话继续。

你也可以明确选择使用当前分支，或创建独立 Git 工作树。独立工作树还需选择本地或远端来源及起始
分支；Codex 在宿主支持时打开新目录，DeepSeek 提供相应的重新启动命令。

同一目录只能有一个活动 Task。手工或其他工具的本地编辑也会被观察，任务中切分支会暂停流程。
本地目录和分支在任务结束后保留；开始下一任务时仍需明确未提交修改的归属。

实现前，先查看并讨论需求、方案、任务、预计文件和验证安排。完整计划得到你的明确认可后才开始开发；方案修订或文件范围扩大后需要再次确认。选择 Dev Flow 或工作树参数不代替方案确认。

### 3. 恢复和查看进度

会话重启后，回到任务的原工作目录，明确请求继续该任务。Dev Flow 会从已保存的进度继续。
原工作目录丢失或被替换时，任务会暂停，直到你恢复它或明确放弃任务。

在 DeepSeek Harness 中，继续任务的消息也要带上 `/dev-flow`。

```bash
# 查看已安装的集成
dev-flow status --host all

# 打开本机任务界面
dev-flow webui start
```

非交互安装、自定义 DSH Profile、升级、修复和移除方式见[命令参考](docs/COMMANDS.md)。

## 桌面宠物

桌面宠物通过叠加气泡展示多个任务，并可分别打开对应 WebUI。它优先展示受阻任务，当前任务完成后自动关注其他未完成任务，也支持固定关注。你可以自定义形象、控制动画、调整大小，以及独立启动或停止宠物。使用前先完成上面的安装与 Codex 或 DeepSeek 配置。

```bash
dev-flow pet start
dev-flow pet stop
```

桌面应用面向 macOS arm64 和 Windows 10/11 x64。安装与操作见[桌面宠物指南](docs/DESKTOP-PETS.md)，
已验证的可用范围见[支持矩阵](docs/SUPPORT-MATRIX.md)。

## 使用限制

专属工作树用于分开代码改动。进程、网络、凭据和外部服务仍与当前环境共享。

完成任务不会自动提交代码、推送或删除工作树；这些操作需要你另外授权。

## 文档

- **使用说明：** [Codex](packages/codex/README.md) · [DeepSeek](packages/deepseek/README.md) · [命令参考](docs/COMMANDS.md) · [Control Center](docs/WEBUI.md)
- **项目资料：** [产品定义](docs/PRODUCT.md) · [支持矩阵](docs/SUPPORT-MATRIX.md) · [安全策略](SECURITY.md)
- **开发与贡献：** [文档目录](MANIFEST.md) · [贡献指南](CONTRIBUTING_zh-CN.md)

## 许可证

[Apache License 2.0](LICENSE)
