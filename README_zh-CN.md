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

Dev Flow 把已经同意的请求、预计路径、验证上限、当前阶段和结果保存在同一个本机任务中，代码仍由
Codex 或 DeepSeek 完成。

- **范围始终明确。** 记录预计路径；受支持的结构化工具写计划外文件前先询问；测试和交付前再次
  核对实际改动。
- **验证投入有上限。** 自动检查限制命令数量，完整测试需要事先允许，第三次完全重复时暂停任务。
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

这两项是对话 selector，不是 shell 命令。尽量写清目标、验收条件、文件边界和测试上限。

### 3. 恢复和查看进度

会话重启后，回到参与任务的同一仓库目录，再次使用相同 selector。Dev Flow 会读取已保存的任务，
从当前阶段继续。

```bash
# 查看已安装的集成
dev-flow status --host all

# 打开本机任务界面
dev-flow webui start
```

非交互安装、自定义 DSH Profile、升级、修复和移除方式见[命令参考](docs/COMMANDS.md)。

## 适合什么任务

Dev Flow 适合会跨会话、需要明确文件范围、必须限制测试投入，或可能返工且不能沿用旧结果的真实
仓库任务。

一次性问答、代码解释、状态查询和不需要保存进度的小型机械修改，直接使用 Codex 或 DeepSeek
通常更简单。

## 文档

- **使用说明：** [Codex](packages/codex/README.md) · [DeepSeek](packages/deepseek/README.md) · [命令参考](docs/COMMANDS.md) · [Control Center](docs/WEBUI.md)
- **项目资料：** [产品定义](docs/PRODUCT.md) · [支持矩阵](docs/SUPPORT-MATRIX.md) · [安全策略](SECURITY.md) · [贡献指南](CONTRIBUTING_zh-CN.md)

## 许可证

[Apache License 2.0](LICENSE)
