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

| Runtime pair | 当前源码范围 | 已验证的范围 |
| --- | --- | --- |
| `darwin-arm64` | macOS arm64 | 已有稳定安装包的完整流程测试；当前工作树功能仍需在实际宿主中单独验证 |
| `win32-x64` | Windows 10/11 桌面版 x64 | Windows 11 x64 本机 Core/WebUI/MCP、完整 Go 套件、Adapter 接口规范和两个平台的本地打包；尚未验证稳定 `@latest` 安装包的完整流程 |

npm manifest 需要分别列出允许的 OS 和 CPU，因此安装层可能接受交叉组合；package runtime selector 只接受
上表两个精确 pair，并拒绝 `win32-ia32`、`win32-arm64` 与 `darwin-x64`。数据目录见[命令参考](COMMANDS.md)。

新的源码能力或后续 beta 只有经过独立发布流程、下载核对 npm 安装包内容，并在实际宿主中测试最终安装包，才能扩大上方
稳定支持声明。

## 尚未声明支持

当前没有 Linux、Windows Server、Windows 32 位、Windows ARM64、Intel Mac、Rosetta 或 remote MCP
支持声明。Windows 运行时不根据 SKU 主动阻止 Server；这里表达的是没有对应环境的验证、完整流程测试或产品支持承诺。

若需要了解当前源码能力、实际环境的测试入口和项目采用状态，请阅读
[项目状态页](PROJECT-STATUS.md)。

## 桌面宠物功能检查

| 产物 / 环境 | 已记录检查 | 限制 |
| --- | --- | --- |
| macOS arm64 本地开发包 | 应用构建、解包资源、ad-hoc 签名与执行权限；原生导入与选择、开关、缩放和待机活动；观察器、素材及播放定向检查 | 尚未确认最低系统运行、完整鼠标拖动自动化、完整 Codex/DeepSeek Task 会话、Developer ID 签名和公证 |
| Windows 11 Intel x64 本地开发分发包 | Core/WebUI、包装配、原生窗口、图集导入、单实例与停止；隔离环境中的安装、重装和卸载 | Windows 10、AMD 实机、完整鼠标拖放及睡眠唤醒交互、完整 Codex/DeepSeek Task 会话和正式分发签名未验证 |

桌面包面向 macOS arm64 和 Windows 10/11 x64。macOS 部署配置目标为 macOS 14；这是构建目标，不表示已经验证最低系统运行。当前正式制备将两个平台的应用与默认素材加入 `@imotong/dev-flow` npm 包，运行时需要已配置的 Adapter 提供 Core。制备完成不等于已发布或已验证稳定安装包。

历史桌面验证记录通过 Git 历史查询。Windows 的环境、步骤与结果见[Windows 报告](WINDOWS-ADAPTATION.md)。这些本地结果不扩大上方稳定支持表。安装和素材使用见[桌面宠物指南](DESKTOP-PETS.md)。

## 源码 DSH 要求

当前源码的 DeepSeek Adapter 要求 DSH `>=0.1.2-rc.1`。该源码要求不替代上表中稳定安装包的验证环境。
