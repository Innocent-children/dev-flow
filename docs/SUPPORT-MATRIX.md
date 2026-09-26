# TaskBelay 支持矩阵

[中文](SUPPORT-MATRIX.md) | [English](SUPPORT-MATRIX_en.md)

本页列出公开 package、已验证的环境和仍待完成的检查。

源码可以构建、测试通过或 beta package 已经发布，都不能单独扩大稳定支持声明。

## 发布与验证范围

下表列出已发布的 package 及其组件已记录的环境验证范围。具体检查和待验证的流程见下文；安装与启用步骤见各 Host 指南。

| TaskBelay 包名 | 平台 | Host 兼容范围 | 发布入口 |
| --- | --- | --- | --- |
| `taskbelay-codex` | macOS arm64、Node.js `>=24` | Codex `>=0.147.0` | [npm](https://www.npmjs.com/package/taskbelay-codex) · [Releases](https://github.com/Innocent-children/taskbelay/releases) |
| `taskbelay-deepseek` | macOS arm64、Node.js `>=24` | DSH `>=0.1.0-rc.6` | [npm](https://www.npmjs.com/package/taskbelay-deepseek) · [Releases](https://github.com/Innocent-children/taskbelay/releases) |
| `taskbelay` | macOS arm64、Node.js `>=20` | 目标操作需要已安装的 Codex 或 DSH | [npm](https://www.npmjs.com/package/taskbelay) · [Releases](https://github.com/Innocent-children/taskbelay/releases) |

Codex 的安装与移除测试检查安装包和 Core 标识、安装、setup、Core 握手、remove、uninstall，
以及这些操作前后仓库内容保持不变。DeepSeek 还测试了显式触发、重启恢复、`DONE` 和保留数据后重新打开。

## 当前源码

当前源码包含共享本机 WebUI、内嵌资产和 `taskbelay webui start|open|status|stop`，并支持以下
操作系统与 CPU 组合：

| Runtime pair | 当前源码范围 | 已验证的范围 |
| --- | --- | --- |
| `darwin-arm64` | macOS arm64 | 已有稳定安装包的完整流程测试；当前工作树功能仍需在实际宿主中单独验证 |
| `win32-x64` | Windows 10/11 桌面版 x64 | Windows 11 x64 本机 Core/WebUI/MCP、完整 Go 套件、Adapter 接口规范和两个平台的本地打包；尚未验证稳定 `@latest` 安装包的完整流程 |

npm manifest 需要分别列出允许的 OS 和 CPU，因此安装层可能接受交叉组合；package runtime selector 只接受
上表两个精确 pair，并拒绝 `win32-ia32`、`win32-arm64` 与 `darwin-x64`。数据目录见[命令参考](COMMANDS.md)。

新的源码能力或后续 beta 只有经过独立发布流程、下载核对 npm 安装包内容，并在实际宿主中测试最终安装包，才能扩大上方
稳定支持声明。

### Claude Code

`taskbelay-claude` 已发布。本节列出组件验证范围；完整的模型开发会话仍未验证，不扩大上方的稳定支持声明。

| 平台 | 实现目标与构建 | 原生验证 | 未验证 |
| --- | --- | --- | --- |
| Windows x64 | 包含对应 Core 和 Claude Adapter | Claude CLI 插件安装、缓存核对、重复安装/移除；包内 Core 的独立 stdio 握手 | 已认证模型开发会话及从模型发起的完整工作流 |
| macOS arm64 | 已生成包含两个平台 Core 的本地 Adapter 包 | Claude CLI 插件安装、缓存逐文件核对、重复安装/移除及包内独立 Core 握手；真实 Core/Git 的单仓库与多仓库创建、迁移、恢复 | 已认证模型开发会话及从模型发起的完整工作流 |

Windows 原生记录对应 2026-09-14 产物；2026-09-19 的统一管理器维护改动在 macOS 上进行了 Windows 平台分支模拟，尚未进行原生 Windows 复验。macOS 原生检查使用 Claude Code 2.1.274，未涵盖从 npm 下载并安装的最终包。

2026-09-20 的职责与恢复修正完成源码定向检查；macOS 进程停止使用隔离测试进程，Windows 仍为命令模拟。该次检查未重新执行真实 Claude 安装或模型会话，不替代上表的产物验证；范围见[验证记录](PROJECT-STATUS.md)。

Adapter 要求 Node.js `>=24` 和 Claude Code `>=2.1.270`。安装方法见 [Claude 指南](CLAUDE.md)，日期、检查入口及其他限制见[验证记录](PROJECT-STATUS.md)。独立 Core 握手不等于模型已经调用插件工具。

### ZCode

`taskbelay-zcode` 已发布。Adapter 要求 Node.js `>=24`、Git 和具备原生插件、Skills、MCP、Hooks 的 ZCode；以下检查范围不扩大上方的稳定支持声明。

| 平台 | 当前实现目标 | 验证边界 |
| --- | --- | --- |
| Windows x64 | 自包含插件、包内 Core、统一生命周期、Write/Edit Hook 和工作区操作 | 自动包级检查与真实 ZCode UI、已认证模型会话分别记录；不能互相替代 |
| macOS arm64 | 同一插件及对应 Core、macOS 路径和进程实现 | 本次未做 macOS 实机验证；交叉构建或静态检查不代表原生验收 |

本地准备成功仍返回 `action_required`，ZCode 中的安装、启用、缓存刷新及移除需按返回步骤完成；没有自动 Host 就绪声明。安装和两阶段移除见 [ZCode 指南](ZCODE.md)，实际结果与后续原生验收清单见[项目状态](PROJECT-STATUS.md)。

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

桌面包面向 macOS arm64 和 Windows 10/11 x64。macOS 部署配置目标为 macOS 14；这是构建目标，不表示已经验证最低系统运行。当前正式制备将两个平台的应用与默认素材加入 `taskbelay` npm 包，运行时需要已配置的 Adapter 提供 Core。制备完成不等于已发布或已验证稳定安装包。

历史桌面验证记录通过 Git 历史查询。Windows 的环境、步骤与结果见[Windows 报告](WINDOWS-ADAPTATION.md)。这些本地结果不扩大上方稳定支持表。安装和素材使用见[桌面宠物指南](DESKTOP-PETS.md)。

## 源码 DSH 要求

当前源码的 DeepSeek Adapter 要求 DSH `>=0.1.2-rc.1`。该源码要求不替代上表中稳定安装包的验证环境。
