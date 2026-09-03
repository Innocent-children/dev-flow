<p align="center">
  <img src="packages/webui/src/assets/dev-flow-app-icon-light.svg" width="112" height="112" alt="Dev Flow 图标" />
</p>

<h1 align="center">Dev Flow</h1>

<p align="center"><strong>让长时间运行的 AI 编程任务守住你定下的改动范围和测试上限。</strong></p>

<p align="center">面向 Codex 与 DeepSeek 的本机约束、持久进度和安全恢复。</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@imotong/dev-flow"><img alt="npm @latest" src="https://img.shields.io/badge/npm-%40latest-CB3837?style=flat-square&logo=npm&logoColor=white" /></a>
  <a href="docs/SUPPORT-MATRIX.md"><img alt="稳定平台：macOS arm64" src="https://img.shields.io/badge/platform-macOS%20arm64-111827?style=flat-square&logo=apple&logoColor=white" /></a>
  <a href="LICENSE"><img alt="Apache License 2.0" src="https://img.shields.io/badge/license-Apache--2.0-3867F5?style=flat-square" /></a>
</p>

<p align="center">
  <a href="README.md">English</a> · <a href="README_zh-CN.md">简体中文</a> · <a href="README_zh-TW.md">繁體中文</a> · <a href="README_ja.md">日本語</a> · <a href="README_ko.md">한국어</a> · <a href="README_es.md">Español</a> · <a href="README_fr.md">Français</a> · <a href="README_de.md">Deutsch</a> · <a href="README_pt-BR.md">Português (Brasil)</a>
</p>

<p align="center">
  <a href="#快速开始">快速开始</a> · <a href="packages/codex/README.md">Codex</a> · <a href="packages/deepseek/README.md">DeepSeek</a> · <a href="docs/WEBUI.md">Control Center</a> · <a href="#文档">文档</a>
</p>

## 把任务守在你同意的范围内

长时间的代码任务很少突然失败，更多时候是逐渐走偏：一个计划外文件变成三个，定向检查变成没有
上限的测试，同一个失败又触发一轮相似修改，或者会话重启后只能从残缺的聊天记录重建进度。

Dev Flow 把已经同意的请求、预计路径、验证预算、当前阶段和结果保存在本机 Task 中。Codex 或
DeepSeek 仍然负责读代码、改文件和跑命令；Dev Flow 让范围变化、重复尝试、恢复和交付都成为
看得见、需要明确决定的事情。

## 它会守住什么

| 关注点 | Dev Flow 的处理方式 |
| --- | --- |
| **改动范围** | 记录预计路径；受支持的计划外写入先暂停；测试与完成前再次核对累计修改路径。 |
| **验证投入** | 保存命令预算；完整测试需要事先允许；同一失败或无变化结果第三次完全重复时暂停。 |
| **持久进度** | Task 不只存在聊天里，新会话可以继续同一阶段、限制、记录和阻塞原因。 |
| **结果是否仍有效** | 请求、计划、实现或仓库变化后，让不再适用的测试与理解确认失效。 |
| **开发者确认** | 交付前检查实际改动、不必要的复杂度和维护风险，由开发者确认结果。 |

## 快速开始

> 稳定 npm `@latest` 目前已验证 macOS arm64；Host Adapter 需要 Node.js `>=24`。
> 其他环境安装前请先看[支持矩阵](docs/SUPPORT-MATRIX.md)。

### 1. 安装并连接 Host

```bash
npm install -g @imotong/dev-flow@latest
dev-flow
```

交互界面可以为 Codex、DeepSeek 或两者安装 Dev Flow。之后也可以从同一入口查看状态、诊断、
升级、修复或移除。

### 2. 启动一个有边界的 Task

在 **Codex** 中发送这条用户消息：

```text
$dev-flow-codex:dev-flow 增加登录失败限流。只修改认证相关文件，最多运行 4 项定向检查。
```

在 **DeepSeek Harness** 中发送：

```text
/dev-flow 增加登录失败限流。只修改认证相关文件，最多运行 4 项定向检查。
```

这两项是对话 selector，不是 shell 命令。尽量写清目标、验收条件、文件边界和测试上限。

### 3. 恢复或查看进度

会话重启后，回到参与 Task 的仓库，再次使用同一个 Host selector。Dev Flow 会读取已保存的 Task，
从当前阶段继续，不需要根据聊天记录重新猜进度。

```bash
# 只读查看 Adapter 状态
dev-flow status --host all

# 打开本机 Control Center
dev-flow webui start
```

Control Center 会展示当前阶段、计划路径与实际路径、检查历史、阻塞、恢复建议和下一项决定。
Codex、DeepSeek 与页面读取的是同一份本机 Task 数据。

非交互安装、Host 原生命令、自定义 DeepSeek Profile、升级和移除方式见[命令参考](docs/COMMANDS.md)。

## Task 运行时会发生什么

1. **先定边界。** Task 保存请求、参与仓库、预计路径、工作项和验证预算。
2. **由 Host 执行。** Codex 或 DeepSeek 修改代码；受支持的结构化文件工具在写入计划外路径前询问。
3. **核对真实改动。** 测试和完成前，Core 再核对本 Task 的累计修改路径，包括没有经过写前检查的改动。
4. **停止无效循环。** 第三次完全重复时暂停，要求换一种做法或明确允许继续。
5. **只交付当前结果。** 代码后来发生变化，旧检查就会失效；测试和开发者理解确认必须对应最终实现。

如果一次操作没有返回明确结果，集成会先读取已保存的 Action 和当前仓库，再判断能否安全重试。

## 什么时候适合使用

| 适合使用 Dev Flow | 直接使用 Host 更简单 |
| --- | --- |
| 任务可能跨会话、重启或多天 | 一次性问答或代码解释 |
| 需要明确限制修改文件和测试投入 | 小型机械修改，不需要保存进度 |
| 返工时不能沿用已经过期的结果 | 只想查询状态或讨论方案 |
| 交付前需要开发者清楚复核 | 不需要持久 Task 或恢复状态 |

## 支持范围

| 稳定 npm `@latest` 产品 | 已验证环境 |
| --- | --- |
| `dev-flow-codex` | macOS arm64、Node.js `>=24`、Codex `>=0.147.0` |
| `dev-flow-deepseek` | macOS arm64、Node.js `>=24`、DSH `>=0.1.0-rc.6` |
| `@imotong/dev-flow` | macOS arm64、Node.js `>=20` |

当前源码还包含本机 WebUI 和精确的 `win32-x64` runtime，但 Windows 尚未完成稳定 `@latest`
Host Journey。稳定平台声明以[支持矩阵](docs/SUPPORT-MATRIX.md)为准；[项目状态](docs/PROJECT-STATUS.md)
集中说明稳定发布、仅源码能力、公开 Journey 和当前缺口。

## 边界

- Dev Flow 是控制层，不是编程 Agent；文件修改和命令执行仍由用户授权的 Codex 或 DeepSeek 完成。
- Go Core 只读观察 Git，不执行 commit、push、merge、rebase、tag 或 publish。
- 写前检查只覆盖列出的 Host 结构化工具。Bash 和外部工具可能先写入，因此 Dev Flow 不是 shell
  或文件系统沙箱。
- Control Center 只监听本机 loopback，面向单用户，不提供远程访问、云同步或团队权限。

## 文档

- **先了解产品：** [产品定义](docs/PRODUCT.md) · [演示](docs/DEMO.md) · [项目状态](docs/PROJECT-STATUS.md)
- **开始使用：** [Codex](packages/codex/README.md) · [DeepSeek](packages/deepseek/README.md) · [命令](docs/COMMANDS.md) · [Control Center](docs/WEBUI.md)
- **了解实现：** [架构](docs/ARCHITECTURE.md) · [支持矩阵](docs/SUPPORT-MATRIX.md) · [路线图](docs/ROADMAP.md)
- **安全与贡献：** [安全策略](SECURITY.md) · [威胁模型](docs/THREAT-MODEL.md) · [贡献指南](CONTRIBUTING.md)

## 许可证

[Apache License 2.0](LICENSE)
