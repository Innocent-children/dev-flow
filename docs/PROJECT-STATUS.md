# Dev Flow 项目状态

[中文](PROJECT-STATUS.md) | [English](PROJECT-STATUS_en.md)

_最后核对：2026 年 8 月 28 日。_

Dev Flow 仍是一个早期开源项目，但已经有公开 package 和真实 Host 旅程。本页刻意区分三种证据：

1. **稳定产品证据**：registry package 完成发布和 Host 生命周期门禁；
2. **预览/源码证据**：更新能力已经进入 npm `beta` 或 `main`；
3. **采用证据**：外部用户、贡献者和依赖项目。

前两类证据已经存在；外部采用仍处于早期，本页不会把下载次数、测试数量或维护者自己的 PR
包装成“广泛采用”。

## 稳定版本

npm `@latest` 当前选择以下稳定 package：

| 产品 | 稳定版本 | Bundled Core | 已验证环境 |
| --- | --- | --- | --- |
| `dev-flow-codex` | `0.7.5` | `0.6.4` | macOS arm64、Node.js `>=24`、Codex `>=0.147.0` |
| `dev-flow-deepseek` | `0.7.5` | `0.6.4` | macOS arm64、Node.js `>=24`、DSH `>=0.1.0-rc.6` |
| `@imotong/dev-flow` | `0.1.1` | 从已安装 Adapter 选择 | macOS arm64、Node.js `>=20` |

稳定声明来自 registry package 的安装、Host/Core handshake、移除、卸载与仓库不变性检查；DeepSeek
稳定旅程还覆盖显式触发、重启恢复、`DONE` 与 retained reopen。精确 Release 和 artifact 入口见
[Support Matrix](SUPPORT-MATRIX.md)。

## 当前源码

| 产品 | `main` 中的 package 版本 | 当前能力 |
| --- | --- | --- |
| `dev-flow-codex` | `0.7.5` | 智能选择、setup、Plugin/MCP 注册和多仓库 Task Scope |
| `dev-flow-deepseek` | `0.7.5` | DSH bundle、显式触发和多仓库 Task Scope |
| `@imotong/dev-flow` | `0.1.1` | 统一 Adapter 生命周期与本机 Control Center launcher |

当前源码还包含嵌入 Core 的共享本机 WebUI，公共入口为
`dev-flow webui start|open|status|stop|reset`。源码测试通过不单独扩大平台或 Host 支持范围；公开支持
仍以 registry package 回读和最终 Host Journey 为准。

## 证据导览

| 入口 | 能回答什么问题 |
| --- | --- |
| [Codex 多仓库 Attempt 7](../tests/journeys/codex/evidence/feature-001-multi-repository-attempt-7.json) | Codex 能否在两个独立会话中从附加仓库恢复同一 Task？ |
| [DeepSeek 多仓库 Attempt 5](../tests/journeys/deepseek/evidence/feature-001-multi-repository-attempt-5.json) | DSH 是否真实完成多仓库、重启恢复、定向验证、理解确认和 `DONE`？ |
| [PR #8](https://github.com/Innocent-children/dev-flow/pull/8) | Codex 状态图是否真实覆盖重构、重新测试、理解确认和交付？ |
| [Support Matrix](SUPPORT-MATRIX.md) | 哪些公开稳定 package 与 Host 环境具有最终制品证据？ |
| [Release 目录](../release/README.md) | 维护者如何构建、回读并发布不可变制品？ |

## 当前限制

- 稳定支持仅覆盖 macOS arm64；没有 Linux、Windows、Intel Mac、Rosetta 或 remote MCP 声明。
- 项目创建时间较短，外部 Issue、PR、依赖项目与长期采用证据仍有限。
- Core 不是 Host sandbox，不会拦截 Host 的每一次文件读写或 shell 命令。
- 当前没有遥测、用户自定义流程图或自动历史 Task 迁移；WebUI 只支持本机 loopback，不提供远程访问。

## 评估项目时建议查看

1. 先读[两分钟演示](DEMO.md)，判断问题和使用方式是否清楚；
2. 再读 [Support Matrix](SUPPORT-MATRIX.md)，区分稳定支持与预览能力；
3. 打开上表的 Journey 证据，核对真实 Host 运行范围；
4. 阅读 [Security Policy](../SECURITY.md) 和 [Threat Model](THREAT-MODEL.md)，了解明确剩余风险。
