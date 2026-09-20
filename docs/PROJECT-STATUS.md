# Dev Flow 项目状态

[中文](PROJECT-STATUS.md) | [English](PROJECT-STATUS_en.md)

_最后核对：2026 年 9 月 20 日。_

Dev Flow 仍是一个早期开源项目。本页区分已经稳定发布、只在 beta 或源码中出现、尚未验证，以及
产品仍需改进的内容。源码可构建或测试通过不会自动扩大稳定支持。

## 已稳定发布

npm `@latest` 当前选择以下稳定 package：

| 产品 | 已验证环境 |
| --- | --- |
| `dev-flow-codex` | macOS arm64、Node.js `>=24`、Codex `>=0.147.0` |
| `dev-flow-deepseek` | macOS arm64、Node.js `>=24`、DSH `>=0.1.0-rc.6` |
| `@imotong/dev-flow` | macOS arm64、Node.js `>=20` |

稳定版本的测试记录包含 npm 安装包安装、Host/Core 就绪检查、移除、卸载，以及操作前后目标仓库
内容保持不变。DeepSeek 还测试了显式触发、重启恢复、`DONE` 和保留数据后重新打开。具体 Release 和
安装包入口见 [Support Matrix](SUPPORT-MATRIX.md)。

## 当前源码与预览能力

以下为当前源码能力，其中部分可能只在 beta 或源码中：

| 用户可见能力 | 当前内容 |
| --- | --- |
| 新请求评估 | Host 先做只读 `small|standard|large|uncertain` 评估并等待用户选择；显式 selector 也不能跳过 |
| 工作位置选择 | 默认在当前目录新建分支，另可选当前分支或独立工作树；检查目录占用并明确初始修改，全部仓库准备后创建 Task。本地 Host helper 与真实 Core/Git/SQLite 已做定向验证，实际 Host 会话端到端范围仍见下文 |
| 持久 Task | 本地保存请求、范围、当前阶段、分析后形成的验证计划、当前预算/消耗、调整原因、记录、阻塞和结果 |
| 中断后继续 | Codex、DeepSeek、Claude Code 和 ZCode 从同一 Task 恢复当前阶段与下一步 |
| 范围与验证限制 | TASKS 保存初始验证计划；Core 按当前 Task Plan revision 统计消耗，允许 TEST 用具体原因增加，并继续执行 ExpectedPaths 和记录失效规则 |
| 按改动范围测试与复核 | Host 对每次命令、完整套件、测试文件修改和修改后复核判断当前相关性；修复后只做相关定向复核 |
| 自动刹车 | 保存最近三次测试尝试；相同失败、相同结果或相同修改与失败循环第三次精确重复后暂停 |
| 不确定 Action 恢复 | read-before-retry、Recovery 判断、Blocker 和 resume |
| 交付前理解确认 | 测试后进入理解确认；仓库变更后重新测试 |
| 本机查看与诊断 | 共享 loopback WebUI，入口为 `dev-flow webui start|open|status|stop` |
| 当前源码平台 | 精确支持 `darwin-arm64` 与 `win32-x64` runtime；Windows 范围是 Windows 10/11 桌面版 x64 |
| 高级仓库能力 | 一个主仓库加最多七个显式附加仓库；全部 roots 都必须先隔离和授权；同机 relocation 原子替换 bindings 与 claims |
| Host 生命周期 | 统一 `dev-flow` 入口管理 Codex、DeepSeek、Claude Code 与 ZCode 的安装、诊断、维护和移除；ZCode 保留实际所需的 UI 操作 |

多仓库与 worktree 是高级能力，不代表 Dev Flow 的主要用户场景。它们的源码存在也不表示已有对应
稳定最终安装包的完整流程测试。

## ZCode 验收范围

ZCode 是当前源码提供的独立 Host Adapter，Windows x64 与 macOS arm64 为实现目标。源码与本地包不构成稳定 npm 发布。自动检查应分别记录 Core 身份与跨 Host 拒绝、工作区准备与恢复、统一生命周期、最终包、MCP 和 Write/Edit Hook；包级检查不能记为真实 ZCode 会话检查。

Windows 真实 Host 验收仍须完成插件 UI 安装与启用、新会话加载 Skill/MCP/Hook、计划内与计划外 Write/Edit、任务创建与恢复，以及 UI 移除后的关闭会话和确认清理。缺少客户端、认证或界面操作能力时，记录具体未执行步骤，不用独立 Core 握手替代。

macOS 实机验证留待后续：在 arm64 Mac 安装最终包，核验 executable 权限与路径，重复上述 UI、Hook 和任务流程，再检查维护、两阶段移除以及保留无关配置和 Task 数据。Windows 检查、交叉编译和 macOS 平台分支模拟均不能完成这份清单。操作入口见 [ZCode 指南](ZCODE.md)。

## 验证记录

### 2026-09-20：ZCode Windows 本地包

环境：Windows x64、Node.js 24.18.0、Go 1.27.0；检查当前源码和包含 Core 0.18.0 的最终本地 tarball，未发布 npm 包。

| 检查 | 实际结果与范围 |
| --- | --- |
| Core 与协议 | Host 身份、跨 Host 拒绝、协议和四个 Host 的完整成功/错误示例定向检查通过；`internal/mcp` 与 `cmd/dev-flow` 包完整检查通过 |
| 最终 ZCode 包 | 最终 tarball 解包后，本地 setup 幂等、原生 stdio MCP、Task 创建与同目录恢复、跨 Host 拒绝通过；fixture 确认计划后，计划内 Edit 放行、越界 Write 拒绝，拒绝范围请求后取消 Task 并释放占用，普通移除保留数据 |
| 管理器 | 73 项定向检查通过；菜单回归修复后 2 项定向检查通过。完整管理器套件仍有 3 项既有文件符号链接用例因本机 `EPERM` 权限限制无法完成，不计为通过 |
| 构建与界面 | Windows x64、macOS arm64 两个 Core 目标编译及 WebUI 构建通过；macOS 产物未原生执行 |

代表性入口为 `go test ./internal/mcp ./cmd/dev-flow`、`node tests/zcode/verify-package.mjs <解包后的绝对包目录>` 和 `pnpm --dir packages/dev-flow test`。最终包检查使用隔离数据、临时 Git 仓库和预设输入，实际执行包内 Core、CLI 与 Hook；它没有操作真实 ZCode UI，也没有运行已认证模型会话。管理器的符号链接限制不构成被测行为通过，以上结果不代表全仓库或 GitHub CI 最终通过。真实 Host 与 macOS 后续检查仍按上方清单保留。

### 2026-09-20：职责边界与失败恢复

环境：macOS arm64、Node.js 24.19.0、Go 1.27.0。检查当前源码，未发布安装包，未操作真实用户安装或数据。

| 检查 | 实际结果与范围 |
| --- | --- |
| Core 恢复 | Application/Recovery 定向检查通过；真实 SQLite 覆盖单仓与多仓的 allow_once、expand_scope、已确认历史，共六组暂存后中断、重开恢复及重复恢复；仓库观察使用测试 fixture |
| SQLite 预检 | 真实两连接受控提交验证跨表读取同一快照；损坏快照/Schema 拒绝、数据库与 WAL 内容不变及 sidecar 集合/大小检查通过；活跃 WAL 读取允许 SQLite 更新已有 shm 读者标记 |
| HTTP/MCP | 共享纠正资格、HTTP 字段投影与缺失用户决定拒绝通过；三个 Host 的完整请求/响应示例、错误传输和共享错误示例复验通过 |
| Host 快照 | 三个 Host 的临时 Git 仓库相关检查 57 项通过；包含状态文本不变而内容变化时拒绝混合快照、源文件及暂存状态保留 |
| 维护与记录 | 维护、目录去重、DeepSeek 记录及包依赖检查 67 项通过；追加跨调用重试、缓存 Core 定位和私有维护记录检查 22 项通过 |
| 发布与前端 | 发布校验 66 项通过，均为临时产物和模拟远端；前端恢复 7 项、类型检查与构建、版本引用和三 Host 生成一致性检查通过 |

macOS 进程检查用隔离 Node 可执行文件模拟 STDIO 参数，实际验证停止与保留其他参数进程；没有用该检查替代真实 Core/Host 会话。Windows 维护仅作命令模拟，不是原生 Windows 验证。未运行全仓库套件或真实发布，本记录不扩大稳定支持。

### 2026-09-19：Host 职责修正与 macOS Claude 本地包

环境：macOS arm64、Node.js 24.19.0、Go 1.27.0、Claude Code 2.1.274。检查对象为本次源码和本地构建包，没有发布 npm 包。

| 检查 | 实际结果与范围 |
| --- | --- |
| Core | userconfig、CLI、domain、application、repository、mcp 和公开契约定向检查通过；新增配置命令复用 Core 解析，覆盖三 Host 配置、默认值及主要非法输入 |
| 管理器 | 驱动、运行时、安装维护和打包依赖 54 项通过；菜单、Windows 接口与本地包 20 项通过、3 项原生 Windows 检查跳过；配置桥接 4 项通过，包含真实 Core 子进程 |
| 既有 Adapter | Codex 配置与启动 36 项通过；Codex/DeepSeek 工作区回归 45 项通过 |
| Claude 工作区 | 14 项通过；默认 macOS 临时目录下，真实 Core/Git 覆盖自定义主仓库 key 的单仓库、三仓库创建、迁移和原 Task 恢复，非法大写 key 在 Git 写入前拒绝 |
| Claude 本地包 | 双平台 Core 构建和打包通过；隔离 HOME、配置和数据后，真实 CLI 安装、缓存逐文件核对、重复 setup、独立 Core 握手、移除及无关配置保留通过 |
| 生成内容 | 三端共享 Skill、版本检查、生成器定向测试和 WebUI 构建通过 |

Windows 管理器维护流程由 macOS 上的 Windows 平台分支模拟验证，不能代替原生 Windows 验收。没有执行已认证 Claude 模型开发会话；插件安装和独立 Core 握手不代表模型已完成任务。未执行全仓库测试，本记录不扩大稳定支持声明。

### 2026-09-14：Windows 源码产物

产物：包含 Codex、DeepSeek 和 Claude Adapter 的本地 Windows 桌面分发包。环境：Windows x64、Claude Code 2.1.270、Node.js >=24、Go 1.27.0。该产物不是稳定 npm 发布。

| 检查 | 实际结果与范围 |
| --- | --- |
| Claude Adapter | 10 项通过；覆盖三种工作区模式、本地与远端来源、携带暂存/未暂存/新增内容、多仓库部分失败、实例替换、会话身份、迁移及独立清理授权 |
| 统一管理器与构建 | 95 项定向检查通过；包含原生 Windows Claude-only Core 发现、菜单、安装维护、残留注册、配置保留及源码打包规则 |
| 共享 Git 操作 | 48 项 Codex/DeepSeek 相关回归通过；LF fixture 使用仅对测试进程生效的 core.autocrlf=false，全局 Git 配置不变 |
| Core | domain/application/mcp/userconfig/CLI 定向检查通过；公开契约检查通过 |
| 仓库观察 | 原有回归、300 文件场景及 SHA-1/SHA-256 原始 blob 与 Git 对照通过；实际任务产物收集约 1.12 秒，在既有 30 秒期限内完成 |
| Windows 最终包 | 完整桌面源码包构建成功，内含三个 Adapter；摘要回读通过，Claude 包由真实 CLI 安装，缓存逐文件一致，重复安装无变化，包内 Core 握手通过，卸载保留无关配置且可重复执行 |
| 文档 | 根 README 九语言同步、共享 Skill 三端生成一致、版本检查与链接检查通过 |

验证限制：未执行已认证的 Claude 模型开发会话；本机认证状态为未登录。macOS 仅构建对应 Core，没有原生运行验收。Windows 上的其他检查包括未改动的 macOS 宠物测试失败和两个 Codex handoff 路径字符串断言失败；表中通过范围不包含这些测试，不代表全仓库通过。原生安装验证入口为 tests/claude/verify-package.mjs，逐项结果必须和真实模型会话、模拟接口测试分开理解。

## 尚未验证

- Windows 10/11 x64 已有本机 Core/WebUI/MCP、Adapter 接口规范测试和本地打包结果，但尚未完成稳定
  `@latest` 最终安装包在实际宿主中的完整流程测试；
- Linux、Windows Server、Windows 32 位与 ARM64、Intel Mac、Rosetta 和 remote MCP 没有稳定支持声明；
- 创建工作树前的请求评估、provisioning、同机 relocation 和 abandon 尚未进入稳定 `@latest` 最终安装包的完整流程测试；
- verification budget 尚未通过外部使用数据证明能够减少无效测试；
- 自动刹车尚未通过实际 Codex / DeepSeek 中的完整流程测试和外部使用数据确认误阻塞率；
- 交付前的理解确认尚未通过长期项目数据证明能够降低维护成本或缺陷率；
- 外部采用、长期重复使用和依赖项目仍然有限。

## 当前记录导览

| 入口 | 能回答什么问题 |
| --- | --- |
| [PR #8](https://github.com/Innocent-children/dev-flow/pull/8) | Codex 状态图是否真实覆盖重构、重新测试、理解确认和交付？ |
| [Support Matrix](SUPPORT-MATRIX.md) | 哪些公开稳定 package 与 Host 环境完成最终安装包验证？ |
| [Release 目录](../release/README.md) | 维护者如何构建、下载核对并发布安装包？ |

不同记录分别说明不同范围。不能把它们合并描述成“一次运行证明全部能力”。

## 外部采用情况

当前公开 Issue、外部 Pull Request、依赖项目和长期重复使用记录仍然很少。npm 下载次数、仓库测试
数量和维护者自己的完整流程测试不能单独说明外部用户已经持续使用并获得效果。本页目前只能确认公开
package 可用和已有的具体的宿主完整流程测试，不能据此推导缺陷率、验证成本或长期维护结果。

## 当前产品缺口

- 当前内部状态仍需要更短、更直接的用户摘要；
- Recovery 需要更直接的公开故障注入演示；
- verification budget 尚未通过外部使用数据证明能减少无效测试；
- 尚未量化中断后恢复耗时、自动刹车错误阻塞率和重复使用率；
- Host 对验证相关性、永久测试价值和复核因果范围的判断准确率尚未形成外部数据；
- Host 对 change-level 的误判率、provisioning 失败恢复耗时和 relocation 可用性尚未形成外部数据；
- 多仓库、worktree 与 relocation 是高级能力，不代表主要用户场景；
- 外部 Issue、Pull Request、依赖项目和长期采用仍然有限。

这些缺口是后续评估方向，不是已经交付的功能。优先级见 [Roadmap](ROADMAP.md)。

## 当前限制

- Core 不是 Host sandbox，不会拦截每一次文件读写或 shell 命令；
- Core 只读观察 Git，不执行 commit、push、merge、rebase、tag 或 publish；
- 当前没有遥测或用户自定义流程图；
- WebUI 只支持本机 loopback，不提供远程访问或多用户权限；
- 稳定支持范围只以 [Support Matrix](SUPPORT-MATRIX.md) 为准。

## 评估方法

1. 先读根 [README](../README_zh-CN.md) 和[产品定义](PRODUCT.md)，判断任务是否需要限制改动范围并按分析结果规划验证投入；
2. 需要了解中断后继续时，再看对应的 [Demo](DEMO.md)；
3. 阅读 [Support Matrix](SUPPORT-MATRIX.md)，区分稳定支持与源码能力，并按需打开上表中的实际运行记录；
4. 阅读 [Security Policy](../SECURITY.md) 和 [Threat Model](THREAT-MODEL.md)，了解剩余风险。

## 源码 DSH 要求

当前源码的 DeepSeek Adapter 要求 DSH `>=0.1.2-rc.1`。该要求描述源码兼容范围，稳定安装包的验证环境仍由[支持矩阵](SUPPORT-MATRIX.md)单独记录。
