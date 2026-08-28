# Dev Flow 支持矩阵

[中文](SUPPORT-MATRIX.md) | [English](SUPPORT-MATRIX_en.md)

本页只回答一个问题：**哪个公开 package 已经在哪个环境完成验证？**

源码可以构建、测试通过或 beta package 已经发布，都不能单独扩大稳定支持声明。

## 稳定支持

npm `@latest` 当前选择以下 package：

| 产品 | 平台 | Host 兼容范围 | 发布入口 |
| --- | --- | --- | --- |
| `dev-flow-codex` | macOS arm64、Node.js `>=24` | Codex `>=0.147.0` | [npm](https://www.npmjs.com/package/dev-flow-codex) · [Releases](https://github.com/Innocent-children/dev-flow/releases) |
| `dev-flow-deepseek` | macOS arm64、Node.js `>=24` | DSH `>=0.1.0-rc.6` | [npm](https://www.npmjs.com/package/dev-flow-deepseek) · [Releases](https://github.com/Innocent-children/dev-flow/releases) |
| `@imotong/dev-flow` | macOS arm64、Node.js `>=20` | 目标操作需要已安装的 Codex 或 DSH | [npm](https://www.npmjs.com/package/@imotong/dev-flow) · [Releases](https://github.com/Innocent-children/dev-flow/releases) |

Codex lifecycle evidence 覆盖 package/Core identity、安装、setup、Core handshake、remove、uninstall
与 repository unchanged。DeepSeek 还覆盖显式触发、restart/resume、`DONE` 和 retained reopen。

## 当前源码

当前源码包含共享本机 WebUI、内嵌资产和 `dev-flow webui start|open|status|stop|reset`。

新的源码能力或后续 beta 只有经过独立发布流程、registry bytes 回读和最终 Host Journey，才能扩大上方
稳定支持声明。

## 尚未声明支持

当前没有 Linux、Windows、Intel Mac、Rosetta 或 remote MCP 支持声明。

若需要了解当前源码能力、真实 Journey 入口和项目采用状态，请阅读
[项目状态页](PROJECT-STATUS.md)。
