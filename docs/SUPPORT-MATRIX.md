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

当前源码包含共享本机 WebUI、内嵌资产和 `dev-flow webui start|open|status|stop`，并闭合了以下
package runtime pair：

当前源码的新 Task 生命周期先在 Host 中做只读改动量评估，再由用户确认 remote/base/target，从
fetch 后冻结的 commit 建立专属工作树；Core 只读计算工作树 identity、history、content 和当前
Task surface。源码包含确定性临时 Git/receipt Journey 与显式输入的原生 Journey 校验入口；只有
实际原生 Host Journey 通过后才构成该 Host/平台的原生证据，并且独立发布前不改变上方稳定表。

| Runtime pair | 当前源码范围 | 当前证据边界 |
| --- | --- | --- |
| `darwin-arm64` | macOS arm64 | 现有稳定 package Journey；工作树优先源码能力需对应原生 Journey 结果单独确认 |
| `win32-x64` | Windows 10/11 桌面版 x64 | Windows 11 x64 本机 Core/WebUI/MCP、完整 Go 套件、Adapter contract 与双 runtime 本地打包；尚未进入稳定 `@latest` Journey |

npm manifest 需要分别列出允许的 OS 和 CPU，因此安装层可能接受交叉组合；package runtime selector 只接受
上表两个精确 pair，并拒绝 `win32-ia32`、`win32-arm64` 与 `darwin-x64`。Windows 使用
`%LOCALAPPDATA%\dev-flow` 保存产品数据，用户配置仍位于 `%USERPROFILE%\.dev-flow\config.json`。

新的源码能力或后续 beta 只有经过独立发布流程、registry bytes 回读和最终 Host Journey，才能扩大上方
稳定支持声明。

## 尚未声明支持

当前没有 Linux、Windows Server、Windows 32 位、Windows ARM64、Intel Mac、Rosetta 或 remote MCP
支持声明。Windows 运行时不根据 SKU 主动阻止 Server；这里表达的是没有对应验证、Journey 或产品支持承诺。

若需要了解当前源码能力、真实 Journey 入口和项目采用状态，请阅读
[项目状态页](PROJECT-STATUS.md)。
