<p align="center">
  <img src="packages/webui/src/assets/dev-flow-app-icon-light.svg" width="112" height="112" alt="Dev Flow" />
</p>

<h1 align="center">Dev Flow</h1>

<p align="center"><strong>让长时 AI 编程任务从持久任务状态继续，而不是从聊天记录重新猜测。</strong></p>

<p align="center">
  <a href="https://www.npmjs.com/package/dev-flow-codex"><img src="https://img.shields.io/npm/v/dev-flow-codex?label=dev-flow-codex" alt="Codex npm" /></a>
  <a href="https://www.npmjs.com/package/dev-flow-deepseek"><img src="https://img.shields.io/npm/v/dev-flow-deepseek?label=dev-flow-deepseek" alt="DeepSeek npm" /></a>
  <a href="https://github.com/Innocent-children/dev-flow/actions/workflows/ci.yml"><img src="https://github.com/Innocent-children/dev-flow/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-Apache--2.0-blue.svg" alt="Apache 2.0 License" /></a>
</p>

<p align="center">
  <a href="README.md">简体中文</a> · <a href="README_en.md">English</a> · <a href="README_zh-TW.md">繁體中文</a> · <a href="README_ja.md">日本語</a> · <a href="README_ko.md">한국어</a> · <a href="README_es.md">Español</a> · <a href="README_fr.md">Français</a> · <a href="README_de.md">Deutsch</a> · <a href="README_pt-BR.md">Português (Brasil)</a>
</p>

Dev Flow 是长时 AI 编程任务的本地过程控制与恢复层。它在聊天记录之外保存任务目标、范围、当前
阶段、验证预算、已有验证、阻塞原因和恢复状态，让 Codex 或 DeepSeek 在会话压缩、Host 重启或
操作结果不确定后继续同一个任务。

## 你是不是遇到过这个问题

一个代码任务已经完成实现，正在跑最后一项定向测试。会话却被压缩，或者 Host 重启了。新会话只
看到部分聊天和当前仓库，不知道哪些步骤已经完成、测试是否仍然有效，于是重新扫描、重复修改，
或者直接跳过剩余工作。

Dev Flow 把这份进度保存为本地 Task。新会话先读取 Task，再从保存的阶段和下一步继续。

## Dev Flow 保存什么

- 最初请求、验收条件和明确不做的内容；
- 当前处于需求、设计、实现、测试、理解确认还是交付；
- verification budget，以及哪些验证已经完成；
- 当前阻塞原因和需要满足的恢复条件；
- Action 结果不确定时的 Recovery 判断。

Codex 和 DeepSeek 仍然负责读代码、改文件和运行命令。Dev Flow 不替代编程 Agent，只保存并检查
同一个开发任务如何继续。

## 30 秒理解

| 直接使用 Agent 时 | Dev Flow 增加的能力 |
| --- | --- |
| 会话中断后重新猜测进度 | 恢复同一个本地 Task |
| 局部任务逐渐扩大范围 | 保存最初目标和明确边界 |
| 定向测试不断扩大 | 保存 verification budget |
| 操作响应丢失后直接重试 | 先读取当前 Task 和 Recovery 状态 |
| 测试结果与后续代码变化混在一起 | 保存当前阶段和相应证据 |

## 适合什么任务

Dev Flow 适合会跨会话、跨天或在 Host 重启后继续的真实仓库任务，尤其是需要明确范围、定向验证、
返工路径或交付前理解确认的修改。一个主仓库加少量显式附加仓库属于高级用法。

一次性问答、代码解释、状态查询，或无需保留进度的机械性小改动，直接使用 Codex 或 DeepSeek
通常更简单。Dev Flow 也不是通用任务编排器、远程执行平台或安全沙箱。

## 与其他工具的关系

| 工具 | 负责什么 |
| --- | --- |
| Codex / DeepSeek | 读取仓库、修改代码和运行命令 |
| OpenSpec / Spec Kit | 帮助组织需求、设计和任务 |
| Dev Flow | 保存当前 Task 的阶段、范围、验证预算、恢复状态和合法下一步 |

OpenSpec 和 Spec Kit 是可选的工作方法，不是 Dev Flow 的主定位。当前没有 OpenSpec / Spec Kit
artifact importer；更薄的集成仍是[未来方向](docs/ROADMAP.md)。

## 一次中断后如何继续

```text
重启前
Task: auth-rate-limit
State: TEST
Revision: 5
Completed: implementation
Remaining: targeted auth test

重启后
Task: auth-rate-limit
State: TEST
Revision: 5
Next: run the remaining targeted auth test
```

恢复时，Host 读取同一个 Task 的当前阶段、范围、剩余验证和恢复状态。它继续剩余验证，不需要从
聊天记录重新推断。完整故事见[中断后继续的两分钟演示](docs/DEMO.md)。

## 最短安装路径

当前稳定制品支持 macOS arm64。Host、Node.js 与稳定 package 的准确范围见
[Support Matrix](docs/SUPPORT-MATRIX.md)。

```bash
npm install -g @imotong/dev-flow@latest
dev-flow
```

安装完成后，在 Git 仓库中使用对应入口。

Codex 可以智能选择 Dev Flow；需要明确进入时使用：

```text
$dev-flow-codex:dev-flow 修复登录失败次数限制，只运行定向测试。
```

DeepSeek Harness 每个需要调用 Dev Flow 的直接用户消息都使用：

```text
/dev-flow 修复登录失败次数限制，只运行定向测试。
```

Host 原生命令只用于诊断和恢复。完整安装、状态、恢复与移除方式见
[Codex 使用说明](packages/codex/README.md)、[DeepSeek 使用说明](packages/deepseek/README.md)和
[命令参考](docs/COMMANDS.md)。

## 当前支持与边界

| 产品 | 已验证环境 |
| --- | --- |
| `dev-flow-codex` | macOS arm64、Node.js `>=24`、Codex `>=0.147.0` |
| `dev-flow-deepseek` | macOS arm64、Node.js `>=24`、DSH `>=0.1.0-rc.6` |
| `@imotong/dev-flow` | macOS arm64、Node.js `>=20` |

Dev Flow 仍处于早期，外部采用有限。当前边界包括：

- Core 只读观察 Git，不执行 commit、push、merge、rebase、tag 或 publish；
- 文件修改和命令执行由用户授权的 Codex 或 DeepSeek 完成；
- Core 不拦截 Host 的每一次文件读写，不是 shell 或文件系统沙箱；
- WebUI 是本机 loopback 的单用户查看与诊断入口，不是云端项目管理平台；
- 稳定支持只以 Support Matrix 中的公开制品和真实 Host Journey 为准。

## 详细文档

| 想了解什么 | 入口 |
| --- | --- |
| 产品定位、目标用户和非目标 | [Product](docs/PRODUCT.md) |
| 中断后继续的真实用户故事 | [Demo](docs/DEMO.md) |
| 稳定、源码、未验证和当前缺口 | [Project Status](docs/PROJECT-STATUS.md) |
| 未来优先级 | [Roadmap](docs/ROADMAP.md) |
| Core、Adapter、Store、Recovery 与协议 | [Architecture](docs/ARCHITECTURE.md) |
| 完整 CLI、selector 和 MCP 工具 | [Command Reference](docs/COMMANDS.md) |
| 本机 WebUI | [WebUI](docs/WEBUI.md) |
| 支持平台与 Host | [Support Matrix](docs/SUPPORT-MATRIX.md) |
| 文档和源码各自负责什么 | [Manifest](MANIFEST.md) |
| 安全边界 | [Security](SECURITY.md) · [Threat Model](docs/THREAT-MODEL.md) |
| 参与贡献 | [Contributing](CONTRIBUTING.md) |

## 本地开发

仓库开发需要 Go `>=1.26`、Node.js `>=24` 和 pnpm `>=11 <12`：

```bash
pnpm install --frozen-lockfile
pnpm run validate
```

## License

[Apache License 2.0](LICENSE)
