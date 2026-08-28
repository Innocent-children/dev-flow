# Dev Flow 支持矩阵

[中文](SUPPORT-MATRIX.md) | [English](SUPPORT-MATRIX_en.md)

本页只回答一个问题：**哪个公开 package 已经在哪个环境完成验证？**

源码可以构建、测试通过或 beta package 已经发布，都不能单独扩大稳定支持声明。

## 稳定支持

npm `@latest` 当前选择以下 package：

| 产品 | 公开版本 | Bundled Core | 平台 | Host 兼容范围 | 证据 |
| --- | --- | --- | --- | --- | --- |
| `dev-flow-codex` | `0.7.5` | `0.6.4` | macOS arm64、Node.js `>=24` | Codex `>=0.147.0`；最终 Journey 使用 `0.147.0` | [npm](https://www.npmjs.com/package/dev-flow-codex/v/0.7.5) · [codex-v0.7.5](https://github.com/Innocent-children/dev-flow/releases/tag/codex-v0.7.5) · registry lifecycle passed |
| `dev-flow-deepseek` | `0.7.4` | `0.6.3` | macOS arm64、Node.js `>=24` | DSH `>=0.1.0-rc.6`；最终 Journey 使用 `0.1.0-rc.6` | [npm](https://www.npmjs.com/package/dev-flow-deepseek/v/0.7.4) · [deepseek-v0.7.4](https://github.com/Innocent-children/dev-flow/releases/tag/deepseek-v0.7.4) · native registry journey passed |
| `@imotong/dev-flow` | `0.1.1` | 从已安装 Adapter 选择 | macOS arm64、Node.js `>=20` | 目标操作需要已安装的 Codex 或 DSH | [npm](https://www.npmjs.com/package/@imotong/dev-flow/v/0.1.1) · [dev-flow-v0.1.1](https://github.com/Innocent-children/dev-flow/releases/tag/dev-flow-v0.1.1) · registry package smoke passed |

Codex lifecycle evidence 覆盖 package/Core identity、安装、setup、Core handshake、remove、uninstall
与 repository unchanged。DeepSeek 还覆盖显式触发、restart/resume、`DONE` 和 retained reopen。

## 当前源码

当前源码包含共享本机 WebUI、内嵌资产和 `dev-flow webui start|open|status|stop|reset`。源码中的
Host package 版本与上方稳定版本一致：

| 产品 | `main` package 版本 | Bundled Core |
| --- | --- | --- |
| `dev-flow-codex` | `0.7.5` | `0.6.4` |
| `dev-flow-deepseek` | `0.7.4` | `0.6.3` |

新的源码能力或后续 beta 只有经过独立发布流程、registry bytes 回读和最终 Host Journey，才能扩大上方
稳定支持声明。

## 尚未声明支持

当前没有 Linux、Windows、Intel Mac、Rosetta 或 remote MCP 支持声明。

若需要了解当前源码能力、真实 Journey 入口和项目采用状态，请阅读
[项目状态页](PROJECT-STATUS.md)。
