# Dev Flow 项目状态

[中文](PROJECT-STATUS.md) | [English](PROJECT-STATUS_en.md)

_最后核对：2026 年 9 月 1 日。_

Dev Flow 仍是一个早期开源项目。本页区分已经稳定发布、只在 beta 或源码中出现、尚未验证，以及
产品仍需改进的内容。源码可构建或测试通过不会自动扩大稳定支持。

## 已稳定发布

npm `@latest` 当前选择以下稳定 package：

| 产品 | 已验证环境 |
| --- | --- |
| `dev-flow-codex` | macOS arm64、Node.js `>=24`、Codex `>=0.147.0` |
| `dev-flow-deepseek` | macOS arm64、Node.js `>=24`、DSH `>=0.1.0-rc.6` |
| `@imotong/dev-flow` | macOS arm64、Node.js `>=20` |

稳定 lifecycle 记录覆盖 registry package 安装、Host/Core 就绪检查、移除、卸载和目标仓库不变性。
DeepSeek 稳定 Journey 还覆盖显式触发、重启恢复、`DONE` 和保留数据后的重新打开。准确 Release 与
制品入口见 [Support Matrix](SUPPORT-MATRIX.md)。

## 当前源码与预览能力

以下能力存在于当前 `main`，其中部分可能只在 beta 或源码中：

| 用户可见能力 | 当前内容 |
| --- | --- |
| 持久 Task | 本地保存请求、范围、当前阶段、验证预算、记录、阻塞和结果 |
| 中断后继续 | Codex 和 DeepSeek 从同一 Task 恢复当前阶段与下一步 |
| 范围与验证限制 | 明确 Repository Scope、verification budget 和记录失效规则 |
| 自动刹车 | 保存最近三次测试尝试；相同失败、相同结果或相同修改与失败循环第三次精确重复后暂停 |
| 不确定 Action 恢复 | read-before-retry、Recovery 判断、Blocker 和 resume |
| 交付前理解确认 | 测试后进入理解确认；仓库变更后重新测试 |
| 本机查看与诊断 | 共享 loopback WebUI，入口为 `dev-flow webui start|open|status|stop` |
| 当前源码平台 | 精确支持 `darwin-arm64` 与 `win32-x64` runtime；Windows 范围是 Windows 10/11 桌面版 x64 |
| 高级仓库能力 | 一个主仓库加最多七个显式附加仓库；Codex 在 Host 支持时可分派独立 worktree Task |
| Host 生命周期 | 统一 `dev-flow` 入口管理 Codex 与 DeepSeek 的安装、诊断、维护和移除 |

多仓库与 worktree 是高级能力，不代表 Dev Flow 的主要用户场景。它们的源码存在也不表示已有对应
稳定最终制品 Journey。

## 尚未验证

- Windows 10/11 x64 已有本机 Core/WebUI/MCP、Adapter contract 和本地打包证据，但尚未完成稳定
  `@latest` 最终制品 Host Journey；
- Linux、Windows Server、Windows 32 位与 ARM64、Intel Mac、Rosetta 和 remote MCP 没有稳定支持声明；
- Codex 的显式并行批次和 `ACTIVE_TASK_CONFLICT` 后 worktree 分派仍缺少最终制品 Journey；
- verification budget 尚未通过外部使用数据证明能够减少无效测试；
- 自动刹车尚未通过真实 Host Journey 和外部使用数据确认误阻塞率；
- comprehension gate 尚未通过长期项目数据证明能够降低维护成本或缺陷率；
- 外部采用、长期重复使用和依赖项目仍然有限。

## 当前记录导览

| 入口 | 能回答什么问题 |
| --- | --- |
| [PR #8](https://github.com/Innocent-children/dev-flow/pull/8) | Codex 状态图是否真实覆盖重构、重新测试、理解确认和交付？ |
| [Support Matrix](SUPPORT-MATRIX.md) | 哪些公开稳定 package 与 Host 环境完成最终制品验证？ |
| [Release 目录](../release/README.md) | 维护者如何构建、回读并发布制品？ |

不同记录分别说明不同范围。不能把它们合并描述成“一次运行证明全部能力”。

## 外部采用情况

当前公开 Issue、外部 Pull Request、依赖项目和长期重复使用记录仍然很少。npm 下载次数、仓库测试
数量和维护者自己的 Journey 不能单独说明外部用户已经持续使用并获得效果。本页目前只能确认公开
package 可用和已有的具体 Host Journey，不能据此推导缺陷率、验证成本或长期维护结果。

## 当前产品缺口

- 当前内部状态仍需要更短、更直接的用户摘要；
- Recovery 需要更直接的公开故障注入演示；
- verification budget 尚未通过外部使用数据证明能减少无效测试；
- 尚未量化中断后恢复耗时、自动刹车错误阻塞率和重复使用率；
- 当前还不能清楚展示验证预算如何消耗，以及为什么扩大；
- 多仓库与 worktree 是高级能力，不代表主要用户场景；
- 外部 Issue、Pull Request、依赖项目和长期采用仍然有限。

这些缺口是后续评估方向，不是已经交付的功能。优先级见 [Roadmap](ROADMAP.md)。

## 当前限制

- Core 不是 Host sandbox，不会拦截每一次文件读写或 shell 命令；
- Core 只读观察 Git，不执行 commit、push、merge、rebase、tag 或 publish；
- 当前没有遥测或用户自定义流程图；
- WebUI 只支持本机 loopback，不提供远程访问或多用户权限；
- 稳定支持范围只以 [Support Matrix](SUPPORT-MATRIX.md) 为准。

## 如何评估

1. 先读[中断后继续的演示](DEMO.md)，判断主要问题是否适合自己的任务；
2. 再读 [Support Matrix](SUPPORT-MATRIX.md)，区分稳定支持与源码能力；
3. 按需打开上表中的真实 Journey，核对每项记录的准确范围；
4. 阅读 [Security Policy](../SECURITY.md) 和 [Threat Model](THREAT-MODEL.md)，了解剩余风险。
