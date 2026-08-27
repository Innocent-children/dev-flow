# Dev Flow 支持矩阵

[中文](SUPPORT-MATRIX.md) | [English](SUPPORT-MATRIX_en.md)

本页只回答一个问题：**哪个公开 package 已经在哪个环境完成验证？**

源码可以构建、测试通过或 beta package 已经发布，都不能单独扩大稳定支持声明。

## 稳定支持

npm `@latest` 当前选择以下 package：

| 产品 | 公开版本 | Bundled Core | 平台 | Host 兼容范围 | 证据 |
| --- | --- | --- | --- | --- | --- |
| `dev-flow-codex` | `0.7.3` | `0.6.2` | macOS arm64、Node.js `>=24` | Codex `>=0.147.0`；最终 Journey 使用 `0.147.0` | [npm](https://www.npmjs.com/package/dev-flow-codex/v/0.7.3) · [codex-v0.7.3](https://github.com/Innocent-children/dev-flow/releases/tag/codex-v0.7.3) · registry lifecycle passed |
| `dev-flow-deepseek` | `0.7.2` | `0.6.1` | macOS arm64、Node.js `>=24` | DSH `>=0.1.0-rc.6`；最终 Journey 使用 `0.1.0-rc.6` | [npm](https://www.npmjs.com/package/dev-flow-deepseek/v/0.7.2) · [deepseek-v0.7.2](https://github.com/Innocent-children/dev-flow/releases/tag/deepseek-v0.7.2) · native registry journey passed |

Codex lifecycle evidence 覆盖 package/Core identity、安装、setup、Core handshake、remove、uninstall
与 repository unchanged。DeepSeek 还覆盖显式触发、restart/resume、`DONE` 和 retained reopen。

## 预览与源码

Feature 014 源码包含共享本机 WebUI、内嵌资产和 `dev-flow webui start|open|status|stop|reset`。该源码
验证不改变上方公开稳定版本或 Bundled Core 声明；只有后续独立 release、registry bytes 回读和最终 Host
lifecycle 才能把它加入稳定制品声明。

| 产品 | npm `beta` | `main` package 版本 | 状态 |
| --- | --- | --- | --- |
| `dev-flow-codex` | `0.7.3-beta.2` | `0.7.3-beta.2` | 可公开评估；不是稳定支持声明 |
| `dev-flow-deepseek` | `0.7.2-beta.1` | `0.7.2-beta.1` | 可公开评估；不是稳定支持声明 |
| `@imotong/create-dev-flow` | 未发布 | `0.1.0` | 仅源码实现与定向测试；等待独立 release 和 registry lifecycle |

稳定支持只能通过独立发布流程、registry bytes 回读和最终 Host Journey 建立，而不是简单移动 npm
dist-tag。

## 尚未声明支持

当前没有 Linux、Windows、Intel Mac、Rosetta 或 remote MCP 支持声明。

若需要了解 beta 中包含的能力、真实 Journey 入口和项目采用状态，请阅读
[项目状态页](PROJECT-STATUS.md)。
