# Dev Flow

[中文](README.md) | [English](README_en.md)

> 让 AI 开发始终知道：现在在哪一步、完成什么才算过关、下一步可以去哪里。

[![Codex npm](https://img.shields.io/npm/v/dev-flow-codex?label=dev-flow-codex)](https://www.npmjs.com/package/dev-flow-codex)
[![DeepSeek npm](https://img.shields.io/npm/v/dev-flow-deepseek?label=dev-flow-deepseek)](https://www.npmjs.com/package/dev-flow-deepseek)
[![CI](https://github.com/Innocent-children/dev-flow/actions/workflows/ci.yml/badge.svg)](https://github.com/Innocent-children/dev-flow/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)

Dev Flow 是一个由 Go Core 驱动的本地开发过程管理工具。它把需求、设计、任务拆分、实现、
测试、理解审查、重构和交付组织成一张可回退、可恢复、可验证的状态图，让 Codex、DeepSeek
Harness 等 Host 在执行工作时共享同一份过程事实。

它关注的不是“替你写更多代码”，而是让一次真实开发任务在经历返工、中断和上下文切换后，
仍然能够可靠回答四个问题：

- 当前处于哪个节点？
- 这个节点需要完成什么、留下什么证据？
- 现在有哪些合法下一步？
- 上一次写操作结果不确定时，应该读取、恢复还是重试？

Dev Flow 最适合需要跨越多个开发步骤、可能发生返工、或需要在多次会话之间继续推进的真实
仓库任务。对于一次性问答、无需过程记录的单文件小改动，直接使用 Codex 或 DeepSeek 通常更简单。

## 它在工具链中的位置

Dev Flow 不替代现有 Agent、规格工具或测试系统，而是把它们放进同一条可恢复的开发主线。

| 组件 | 负责什么 |
| --- | --- |
| Codex / DeepSeek Harness | 阅读仓库、修改代码、运行工具，并与开发者协作完成当前节点 |
| Spec Kit / OpenSpec | 为需求、设计、任务等节点提供方法和制品 |
| 测试与 CI | 产生行为是否正确的验证证据 |
| Dev Flow | 保存唯一过程游标、完成条件、合法流转、恢复结论和终态 |

因此，Dev Flow 不是新的大模型、通用编程 Agent 或另一套规格格式。它是位于 Host 与开发方法
之下的本地过程导航与恢复层。

## 为什么值得用

### 一条不会丢失的开发主线

任务状态保存在本地 SQLite 中。聊天被压缩、Host 重启或开发中断后，Core 仍保留当前节点、
需求与设计基线、验证记录、阻塞原因和合法流转。

### 测试通过之后，还有“能否理解”这一关

Dev Flow 把 `COMPREHENSION_REVIEW` 设为正式交付门禁。测试证明行为，开发者确认设计和代码
可以解释、可以维护；复杂实现会进入 `REFACTOR`，并在修改仓库后重新回到 `TEST`。

### 恢复基于事实，不靠重复执行碰运气

当 mutation 响应缺失、取消、截断或损坏时，调用者先读取 Core 的权威状态。Core 会判断操作
尚未开始、已经记录、完成但未记录、部分完成或发生冲突，再给出安全动作。

### 方法可以切换，流程只有一个权威

每个任务可选择 `plain`、`spec-kit` 或 `openspec`。这些方法工具帮助完成当前节点，Go Core
始终独自管理任务、节点、流转、恢复和终态。

## 一次任务如何推进

1. 开发者在当前 Git 仓库中用显式 selector 描述任务。
2. Core 创建或恢复该仓库的 Task，并返回当前节点、完成条件、证据要求和全部合法流转。
3. Host 只执行当前节点授权的工作，把结果和证据提交给 Core。
4. Core 校验精确的 `transition_id`，推进到下一节点；测试失败、理解失败或交付拒绝会回到正确位置。
5. 如果写操作响应不确定，Host 先读取权威状态，再按 Recovery 结论恢复，而不是盲目重试。

开发者始终可以看到任务为什么停在这里、什么才算完成，以及下一步有哪些真实选择。

## 快速开始

当前公开制品支持 macOS arm64、Node.js `>=24`。Core `0.5.0` 独立打包在 Codex `0.5.1` 和
DeepSeek `0.5.1` Host 产品中；三个产品版本分别演进。

### Codex

```bash
npm install -g dev-flow-codex@0.5.1
dev-flow-codex setup
dev-flow-codex --version
```

在 Codex 中使用唯一显式 selector 发起任务：

```text
$dev-flow-codex:dev-flow 为当前仓库实现用户登录失败次数限制。
```

普通对话不会自动启动 Dev Flow。完整的安装、移除、数据保留和调用边界见
[Codex package README](packages/codex/README.md)。

### DeepSeek Harness

先从 npm 获取官方 tarball，再把绝对路径交给 DSH profile：

```bash
npm pack dev-flow-deepseek@0.5.1
dsh plugin --profile <profile> add "$PWD/dev-flow-deepseek-0.5.1.tgz"
```

按 DSH 的 profile 生命周期重启该 profile 后，通过 `/dev-flow` 显式进入 Dev Flow。安装、
重启、移除和数据边界见 [DeepSeek package README](packages/deepseek/README.md)。

## 开发过程图

当前 Core 只提供内建的 `standard-development`：8 个工作节点、`DONE` 终态，以及
`BLOCKED`、`CANCELLED` 两个异常节点。29 条流转覆盖正常推进与真实返工。

```mermaid
flowchart LR
    R[REQUIREMENTS] --> D[DESIGN]
    D --> T[TASKS]
    T --> I[IMPLEMENT]
    I --> V[TEST]
    V --> C[COMPREHENSION_REVIEW]
    C --> L[DELIVERY]
    L --> O[DONE]
    I --> F[REFACTOR]
    C --> F
    F --> V
    V -. 缺口分类 .-> I
    V -. 设计或需求问题 .-> D
    C -. 理解或证据问题 .-> R
    L -. 交付缺口 .-> I
```

虚线用于概括多条受控回退。精确节点、29 条流转、guard 和 reason 规则由
[`internal/workflow/`](internal/workflow/) 定义。Host 只提交 Core 返回的 `transition_id`，
destination 由 Core 推导。

每次读取当前 Action，调用者都能获得：

- 当前 process、node、revision 和 action identity；
- 节点目的、进入假设、完成条件、允许副作用和所需证据；
- 当前 method profile 对应的 semantic method steps；
- 全部合法 transitions 及其 destination、guard、选择条件和 reason 规则。

## 运行边界

Core 通过 local STDIO MCP 暴露恰好六个工具：

```text
dev_flow_server_info
dev_flow_open_task
dev_flow_get_task
dev_flow_get_next_action
dev_flow_apply_action
dev_flow_cancel_task
```

Core 可以有界、只读地观察一个现有 Git 仓库，用于建立 repository binding 和判断变更事实。
Git 修改由获得用户授权的 Host 执行；Core 不提供通用 shell，也不执行 checkout、commit、push、
merge、rebase、tag 或发布操作。

## 数据与恢复

默认任务数据位于 Host 产品管理的本地数据目录，也可以通过 `DEV_FLOW_DATA_DIR` 指向一个已存在、
可用的绝对目录。卸载或移除 Host 集成会保留任务数据。

当前图运行时只接受当前 SQLite Schema 和严格 snapshot。检测到不兼容或 pre-graph 数据时，
Core 返回 `SCHEMA_UNSUPPORTED` 并保持零写入。用户可以选择新的数据目录，或在 Core 外部手工
归档、改名或删除旧目录；任何 lifecycle 命令都不会自动清理它。

## 当前支持

| 产品 | 当前公开版本 | Bundled Core | 已验证环境 |
| --- | --- | --- | --- |
| `dev-flow-codex` | `0.5.1` | `0.5.0` | macOS arm64、Node.js `>=24`、Codex `>=0.147.0` |
| `dev-flow-deepseek` | `0.5.1` | `0.5.0` | macOS arm64、Node.js `>=24`、DSH `>=0.1.0-rc.6` |

两次 `0.5.1` 发布均通过 registry package 安装、真实 Host/Core handshake、移除、卸载和仓库
不变性门禁；DeepSeek 还完成显式触发、重启恢复、`DONE` 与 retained reopen 旅程。精确状态、
制品摘要和证据入口见 [Support Matrix](docs/SUPPORT-MATRIX.md) 与对应 GitHub Release。

## 从这里继续

| 想了解什么 | 文档 |
| --- | --- |
| 产品解决的问题、能力和非目标 | [Product](docs/PRODUCT.md) |
| Core、Adapter、Store 与 Recovery 如何协作 | [Architecture](docs/ARCHITECTURE.md) |
| 当前支持版本和平台 | [Support Matrix](docs/SUPPORT-MATRIX.md) |
| 已交付能力与后续方向 | [Roadmap](docs/ROADMAP.md) |
| 三个产品如何独立版本化 | [Versioning](docs/VERSIONING.md) |
| 本地开发工具链 | [Toolchain Baselines](docs/TOOLCHAIN-BASELINES.md) |
| Feature 开发规范 | [Spec Kit Workflow](docs/SPEC-KIT-WORKFLOW.md) |
| 如何提交问题和 Pull Request | [Contributing](CONTRIBUTING.md) |
| 维护者发布入口 | [Release](release/README.md) |

## 本地开发

需要 Go `>=1.26`、Node.js `>=24` 和 pnpm `>=11 <12`：

```bash
pnpm install --frozen-lockfile
pnpm run validate
```

`pnpm run validate` 运行仓库的有界验证，不安装真实 Host 产品，也不发布 npm、Tag 或 GitHub
Release。目录职责见 [Architecture](docs/ARCHITECTURE.md)，脚本入口见
[Repository Scripts](scripts/README.md)。

## 参与贡献

欢迎提交可复现的缺陷、文档改进、有最终制品证据的平台支持，以及边界明确的产品提案。开始前
请阅读 [贡献指南](CONTRIBUTING.md)；产品行为变更需要完整 Feature 规格，普通文档修正不需要。
版本提升和公开发布由维护者在功能合并后通过独立流程完成。

## License

[Apache License 2.0](LICENSE)
