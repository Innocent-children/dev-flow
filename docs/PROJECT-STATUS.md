# Dev Flow 项目状态

[中文](PROJECT-STATUS.md) | [English](PROJECT-STATUS_en.md)

_最后核对：2026 年 9 月 3 日。_

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

以下能力存在于当前源码，其中部分可能只在 beta 或源码中：

| 用户可见能力 | 当前内容 |
| --- | --- |
| 新请求评估 | Host 先做只读 `small|standard|large|uncertain` 评估并等待用户选择；显式 selector 也不能跳过 |
| 工作位置选择 | 默认在当前目录新建分支，另可选当前分支或独立工作树；检查目录占用并明确初始修改，全部仓库准备后创建 Task。本地 Host helper 与真实 Core/Git/SQLite 已做定向验证，实际 Host 会话端到端范围仍见下文 |
| 持久 Task | 本地保存请求、范围、当前阶段、分析后形成的验证计划、当前预算/消耗、调整原因、记录、阻塞和结果 |
| 中断后继续 | Codex 和 DeepSeek 从同一 Task 恢复当前阶段与下一步 |
| 范围与验证限制 | TASKS 保存初始验证计划；Core 按当前 Task Plan revision 统计消耗，允许 TEST 用具体原因增加，并继续执行 ExpectedPaths 和记录失效规则 |
| 按改动范围测试与复核 | Host 对每次命令、完整套件、测试文件修改和修改后复核判断当前相关性；修复后只做相关定向复核 |
| 自动刹车 | 保存最近三次测试尝试；相同失败、相同结果或相同修改与失败循环第三次精确重复后暂停 |
| 不确定 Action 恢复 | read-before-retry、Recovery 判断、Blocker 和 resume |
| 交付前理解确认 | 测试后进入理解确认；仓库变更后重新测试 |
| 任务经验 | 独立 SQLite 修订与用户补充；理解确认时讲解，本地 Markdown 导出及失败补写，WebUI 项目与关键词查找包含归档任务 |
| 本机查看与诊断 | 共享 loopback WebUI，入口为 `dev-flow webui start|open|status|stop` |
| 当前源码平台 | 精确支持 `darwin-arm64` 与 `win32-x64` runtime；Windows 范围是 Windows 10/11 桌面版 x64 |
| 高级仓库能力 | 一个主仓库加最多七个显式附加仓库；全部 roots 都必须先隔离和授权；同机 relocation 原子替换 bindings 与 claims |
| Host 生命周期 | 统一 `dev-flow` 入口管理 Codex 与 DeepSeek 的安装、诊断、维护和移除 |

多仓库与 worktree 是高级能力，不代表 Dev Flow 的主要用户场景。它们的源码存在也不表示已有对应
稳定最终安装包的完整流程测试。

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

## 任务经验验证（2026 年 9 月 15 日）

环境：macOS arm64、Go 1.27.0、Node.js 24.19.0。以下是 9 月 15 日的结果，当时收集时机尚未集中到理解确认；不能代替下方新触发方式的验证，也不代表新的稳定发布。

| 检查 | 实际结果与范围 |
| --- | --- |
| `go test ./internal/domain ./internal/store ./internal/application ./internal/experienceexport ./internal/mcp ./internal/webui ./tests/contract` | 通过。覆盖 SQLite 重开、修订/补充保留、请求重试、Task/Action 不变、完成与恢复导出、损坏记录拒绝和 MCP/WebUI 共享数据 |
| 导出文件测试 | 完整替换、失败清理和仓库目录拒绝通过；临时真实 Git 仓库的状态及文件字节保持不变 |
| WebUI 构建与组件/API 测试 | 构建通过，9 项测试通过，包括补充请求身份保持和响应不确定后的重试 |
| Codex/DeepSeek 适配及共享引用测试 | 25 项测试通过；两种 Host 的完整成功/失败 MCP 示例在固定仓库观察、真实 Core/SQLite 上执行 |
| 打包清单与归档内容 | 4 项定向检查通过；两个源码归档均包含新增的 6 个引用文件，字节与源码一致。这是源码归档检查，不是最终 runtime 安装包或实际 Host 测试 |
| 本机浏览器 | 使用独立的模拟归档任务，验证关键词查找、修订历史、用户补充、Task revision 保持及取消任务 Markdown 导出 |
| 版本与文档 | 版本检查通过；README 维护语言与配对指南同步，共享引用已重新生成并检查 |

任务经验功能尚未在新安装的 Codex/DeepSeek 包中执行完整任务，也未在 Windows 上做原生验证。历史经验仍是辅助判断材料。使用方式与限制见[任务经验](EXPERIENCES.md)。

## 理解确认阶段收集经验的验证（2026 年 9 月 17 日）

环境：macOS arm64、Go 1.27.0、Node.js 24.19.0。当前源码与原 Task 使用的数据分开，Go 场景使用临时 SQLite 和固定仓库观察。

| 检查 | 实际结果与范围 |
| --- | --- |
| `workflow/application/store/experienceexport` 定向 Go 测试 | 通过。选择 Experience、Comprehension、StandardDefinition、StandardProcess、SemanticMethodCatalog、DefinitionDigest 和 MethodEvidence 测试，覆盖新步骤顺序、原完整出边、独立保存、零经验与真实用户确认要求 |
| 理解阶段返回和保存失败 | 真实 Core/SQLite 配合模拟操作顺序，验证返回实现、重新测试、再次进入后更新同一经验；修订、重复请求和用户补充保留，原 Action 不变。注入存储错误验证失败如实返回且不改变已存经验或 Task |
| MCP、当前协议夹具与共享示例 | 完整成功/错误示例、输出 Schema 和当前流程摘要检查通过。首轮发现漏传收集方法结果只返回笼统错误；调整方法校验后，缺失字段及零写入纠正范围的完整响应检查通过。可选浏览器夹具未启用 |
| Host 与引用打包 | 22 项 Node 检查通过，范围为模拟 Core、DeepSeek 注入/连接、共享引用和 package 清单。两种 Host 副本已由共享源生成，`sync-skill-references.mjs --check` 通过 |
| 版本 | `scripts/check-versions.mjs` 通过；本次继续使用当前功能变更的 Core 版本，Host npm 发布版本未修改 |
| 文档与已有改动保留 | 检查 200 份已改 Markdown、409 个本地链接和 39 个保留路径通过；共享源中的 Host 引用按两种包内实际位置解析。九种 README 与受影响双语说明已同步 |

本次没有运行完整仓库套件。WebUI 源码和静态资源保留，已只读核对 Action 表单根据 Core 的 `payload_schema` 和方法列表展示；没有重做浏览器流程。以上不证明 AI 实际提炼质量，也不等同于新安装 Codex/DeepSeek 最终 runtime 包中的完整任务或 Windows 原生验证；这些范围仍未验证。
