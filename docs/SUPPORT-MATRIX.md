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

Codex 的安装与移除测试检查安装包和 Core 标识、安装、setup、Core 握手、remove、uninstall，
以及这些操作前后仓库内容保持不变。DeepSeek 还测试了显式触发、重启恢复、`DONE` 和保留数据后重新打开。

## 当前源码

当前源码包含共享本机 WebUI、内嵌资产和 `dev-flow webui start|open|status|stop`，并支持以下
操作系统与 CPU 组合：

当前源码的新 Task 生命周期先在 Host 中做只读改动量评估，再由用户确认 remote/base/target，从
fetch 后冻结的 commit 建立专属工作树；Core 只读计算工作树 identity、history、content 和当前
Task surface。源码测试使用临时 Git 仓库和运行记录，也提供检查外部实际运行记录的入口。只有
在对应 Host 和平台实际完成测试，才能报告该环境已验证；正式发布前，上方稳定支持表保持不变。

| Runtime pair | 当前源码范围 | 已验证的范围 |
| --- | --- | --- |
| `darwin-arm64` | macOS arm64 | 已有稳定安装包的完整流程测试；当前工作树功能仍需在实际宿主中单独验证 |
| `win32-x64` | Windows 10/11 桌面版 x64 | Windows 11 x64 本机 Core/WebUI/MCP、完整 Go 套件、Adapter 接口规范和两个平台的本地打包；尚未验证稳定 `@latest` 安装包的完整流程 |

npm manifest 需要分别列出允许的 OS 和 CPU，因此安装层可能接受交叉组合；package runtime selector 只接受
上表两个精确 pair，并拒绝 `win32-ia32`、`win32-arm64` 与 `darwin-x64`。Windows 使用
`%LOCALAPPDATA%\dev-flow` 保存产品数据，用户配置仍位于 `%USERPROFILE%\.dev-flow\config.json`。

新的源码能力或后续 beta 只有经过独立发布流程、下载核对 npm 安装包内容，并在实际宿主中测试最终安装包，才能扩大上方
稳定支持声明。

## 尚未声明支持

当前没有 Linux、Windows Server、Windows 32 位、Windows ARM64、Intel Mac、Rosetta 或 remote MCP
支持声明。Windows 运行时不根据 SKU 主动阻止 Server；这里表达的是没有对应环境的验证、完整流程测试或产品支持承诺。

若需要了解当前源码能力、实际环境的测试入口和项目采用状态，请阅读
[项目状态页](PROJECT-STATUS.md)。
