# Implementation Plan: Dev Flow WebUI Control Center

**Branch**: `feature/webui-control-center` | **Date**: 2026-08-26 | **Spec**: [spec.md](spec.md)

## Summary

在现有 Go Core 中增加本地 WebUI adapter，直接复用 Application、Workflow、Recovery 和 SQLite Store；
在 `packages/webui` 建立独立 React/TypeScript 前端工程，构建产物嵌入 Core binary。页面提供完整 Task
浏览、生命周期管理、Action/Recovery 操作和流程图；Core-owned `dev-flow webui`
提供 start/open/status/stop/reset。所有 Host Adapter 携带同一能力并读取共享数据权威。实现使用现有
二进制、现有数据权威和现有并发 revision，不增加独立服务、
通用后台框架或面向规模的存储投影。

## Technical Context

**Language/Version**: Go 1.26；Node.js >=24；pnpm >=11 <12

**Primary Dependencies**: Go 标准库；现有 `modernc.org/sqlite`；React 19、TypeScript、Vite 8；浏览器原生 CSS/SVG；系统字体

**Storage**: 现有 Task snapshot、TaskEvent、repository claims；Task 表增加一个可空归档时间

**Testing**: 最少的 Go 表驱动 package/contract 测试、HTTP 映射与安全边界测试、一个组合 Host 旅程和一次最终全仓验证；前端只做类型与构建检查，UI 由产品负责人人工验收

**Target Platform**: 当前支持的 macOS 本机环境

**Project Type**: 独立前端源码工程 + 现有 Go Core HTTP adapter；交付为 Host packages 内嵌的共享本地 WebUI

**Performance Goals**: 本地用户操作保持可交互；本 Feature 不建立容量或吞吐基准

**Constraints**: 单机单用户；Core 单一权威；所有 Host 共享实例与数据；本机 loopback；现代桌面视觉；浅色/深色与键盘可访问；现有 MCP 兼容；全部功能一次交付

**Scale/Scope**: 一个本地用户、一个 WebUI 进程、现有标准流程、四个实施检查点

## Constitution Check

| 原则 | 结论 |
| --- | --- |
| Go Core Single Authority | PASS：WebUI 读取并提交 Core-owned Task、Action、transition 和 Recovery |
| Hosts and Methods Are Adapters | PASS：WebUI 属于 Core；Host Adapter 只调用相同 runtime，不持久化流程游标 |
| Read-only Core Git | PASS：WebUI 不提供 Git 写入或 shell |
| Incremental Architecture | PASS：复用每个 Host package 已携带的 Core、共享 Store 和现有 adapter，只增加直接需要的 WebUI、查询与归档字段 |
| Optional External Indexes | PASS：产品不依赖外部索引 |
| Acceptance-bound Verification | PASS：每项非 UI 事实在一个主要权威层完整验证，多项要求由表驱动用例合并覆盖，全 Feature 只保留一个跨层 Host 旅程 |
| Feature/Release Separation | PASS：无版本和发布操作 |
| Specification Before Change | PASS：Web、存储、reset 和 Action 合同在实施前闭合 |

Phase 1 设计复核同样通过，无 Constitution violation。

## Architecture

```text
Browser ── loopback HTTP ── WebUI Adapter ── Application/Workflow/Recovery
                                          └── existing SQLite Store
All Host Adapter Core processes ──────────────────────────┘
```

### Web adapter

- `internal/webui` 负责 HTTP API、静态产物服务、本地会话保护和 Core use-case 映射。
- handler 调用 Application/Workflow/Store 的有界能力，不直接决定流程结果。
- `packages/webui` 负责页面 shell、路由、组件、主题、流程图、动态 Action 表单和轮询状态。
- Vite 生产构建输出到 Core embed 输入目录；运行时只加载 binary 内嵌资源，不运行 Node server。
- Task detail 每 2 秒轮询，dashboard/list 每 5 秒轮询；revision 变化后完整 view model 重新读取。

### Visual system

- 一个语义化 CSS token 层统一 surface、text、border、accent、status、spacing、radius、shadow、type 和 motion；
  浅色与深色外观只替换语义值。
- 页面采用具有品牌辨识度的桌面 shell、清晰主次层级、充足留白和可调节的信息密度。视觉可以使用
  大胆色彩、渐变、层叠材质、光影、图形化数据表达和高质量动效；列表、详情、图、时间线与 Action
  面板共享同一排版和组件语言。
- 状态色同时配合文字、图标或线型；交互控件拥有一致的 hover、focus-visible、active、disabled、loading
  和 destructive 表达。
- 使用系统字体和内嵌图标/SVG；不加载外部字体、组件库或设计资源。
- 动画覆盖状态反馈、内容连续性和品牌化微交互，通过 `prefers-reduced-motion` 提供低动效表现。
- 实施以 [`contracts/visual-design.md`](contracts/visual-design.md) 为设计指导；Google Material Design 和
  Apple HIG 提供原则参考，不复制任何具体产品界面。UI 不生成自动化测试、截图证据或 Agent 视觉审查，
  最终由产品负责人人工验收。

### Frontend build and package closure

- `packages/webui` 是 pnpm workspace 中 `private: true` 的构建项目，不单独发布或安装。
- TypeScript client types 由闭合 HTTP view-model 合同维护；前端不读取 Go 内部结构或 Feature Markdown。
- Vite 输出带内容哈希的静态产物和入口 manifest；受控构建步骤将产物放入 `internal/webui/assets` 供
  `go:embed` 使用。
- 开发模式允许 Vite dev server 代理 loopback Core API；验收和制品只使用 Core binary 内嵌资源。
- 根构建、Codex 构建和 DeepSeek 构建复用同一前端产物生成步骤；package contract 验证两类 Host 的 Core
  均包含入口 HTML、JavaScript、CSS、SVG 和 asset manifest。

### Application and Store

- 在 `internal/application` 增加 WebUI 所需的读取和操作 use cases。
- 在现有 SQLite 实现上增加 Task 列表、事件读取、归档和 purge 方法；不建立通用 Control Center 存储框架。
- 列表先利用现有索引缩小候选集，再解码现有 Task snapshot 完成其它本地筛选与排序。
- `tasks.archived_at` 保存终态展示状态；重复 archive/restore 直接返回目标状态。
- purge 在一个事务内重新检查 terminal、revision 和 claims，然后删除 Task 及关联行；不保留 purge ledger。
- Task 历史继续使用现有 TaskEvent，不增加历史 snapshot、operation ledger 或查询镜像表。

### Graph and Action

- definition 来自 `workflow.ResolveDefinition`，实际路径来自 TaskEvent，当前合法边来自 current Action。
- 未来路径从当前节点遍历 resolved definition，返回可达节点和边；visited set 保证环路终止。
- Workflow 暴露 Action payload schema 的单一构造入口；MCP 保持现有 wire projection，WebUI 使用同一来源生成表单。
- WebUI 调用现有 Recovery assessment/application 行为，不复制 Recovery 分类表。

### Shared runtime and reset

- Core 的 `dev-flow webui start|open|status|stop|reset` 管理共享 WebUI 子进程和 mode-0600 runtime receipt。
- 每个维护中的 Host Adapter package 继续携带兼容 Core binary，并通过现有 runtime resolver 以相同
  `webui` 参数调用它；Host 不增加专属 WebUI 状态或命令语义。
- runtime receipt 只保存复用和停止共享进程直接需要的 PID、进程启动身份、data-root digest 和 loopback URL。
- `start` 使用当前调用方携带的兼容 Core；已存在实例的 data root 匹配且实时 status 报告兼容时直接复用，否则返回 incompatible。
- Core 只保留 `dev-flow webui serve` 作为子进程入口；公开 `reset` 命令直接调用 Core 内部 plan/confirm 函数，不增加内部 reset CLI 子命令。
- reset plan 展示精确数据库与 SQLite sidecar 目标；一次永久确认绑定这些目标。confirm 前获得数据库独占访问并重新检查目标。
- reset confirm 先获得 Task 数据库的独占访问；无法获得时零删除停止，获得后只删除确认范围并创建可通过 current preflight 的空数据库。

## Checkpoints and Test Budget

Automated validation is closed to the following inventory. One table-driven suite may satisfy multiple rows inside its
assigned group, but no new group or command may be added without a specification amendment.

| ID | Primary authority | Closed coverage | Checkpoint |
| --- | --- | --- | --- |
| V01 | Workflow/Core | resolved graph projection, cycles, committed traversals, current legal edges and every Action schema kind | CP1/CP3 |
| V02 | Store/Application | list/detail/event reads, archive state, revision CAS, purge transaction and reset atomicity including zero-write failures | CP1/CP2/CP4 |
| V03 | Application/HTTP | create/resume/cancel/action/recovery/blocker mapping plus closed success and error envelopes | CP2/CP3 |
| V04 | Web HTTP boundary | loopback listener, exact Origin, process-local session value, stale-page mutation disablement and no reset mutation route | CP1/CP4 |
| V05 | Core CLI | `start|open|status|stop|reset`, receipt reuse, exclusive reset access and target-bound confirmation | CP4 |
| V06 | Package contract | embedded HTML/JavaScript/CSS/SVG/manifest closure and compatible Core entry in every maintained Host package | CP4 |
| V07 | Installed Host journey | Host A starts; Host B reports and opens the same process, URL, data root and embedded assets | CP4 |
| V08 | Repository gate | one final `pnpm run validate` after V01–V07; this is the only repository-wide validation | CP4 final |

Validation ownership rules:

- V01–V06 are the only targeted automated groups. Tasks map each non-UI acceptance scenario to one of them and reuse a
  table instead of adding scenario-specific commands.
- V07 proves only the Host/package boundary. It does not repeat Task operations, full CLI lifecycle or reset behavior.
- V08 is a final repository gate, not a second primary evidence owner. No V01–V06 command is explicitly rerun immediately
  before V08.
- UI appearance, layout, component interaction, light/dark themes and motion have no automated or Agent-performed test;
  the product owner performs manual acceptance.
- A failed group records its root cause. After correction, rerun only that group; rerun V08 only when the failed final gate
  itself requires it.

## Project Structure

```text
specs/014-webui-control-center/
├── README.md
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
├── checklists/requirements.md
└── tasks.md

cmd/dev-flow/                 # public webui lifecycle and internal serve/reset commands
internal/application/        # WebUI read and mutation use cases
internal/store/              # existing SQLite queries, archive field and purge/reset operations
internal/workflow/           # graph projection and shared Action schema source
internal/webui/              # local JSON API and embedded frontend build assets
packages/webui/              # private React/TypeScript/Vite frontend source project
packages/codex/              # packaged Core parity
packages/deepseek/           # packaged Core parity
tests/contract/              # HTTP, package and documentation contracts
tests/journeys/              # one combined installed-Host journey for the complete Feature
```

## Documentation Impact

同步 `docs/I18N.md` 定义的根 README locale，以及受影响的 PRODUCT、ARCHITECTURE、COMMANDS、
SUPPORT-MATRIX、THREAT-MODEL 和 ROADMAP 文档族；新增 WEBUI 文档族；同步所有维护中的 Host README
和 Core 技术说明。每个文档只记录其读者需要的入口、能力或边界。

## Complexity Tracking

无 Constitution violation。语义 CSS tokens 直接服务跨页面一致性和浅色/深色外观，不形成独立组件框架。
Action schema 单一来源、loopback 写保护、revision CAS、purge 事务和 reset 目标确认分别对应当前表单
正确性、浏览器写安全、实际多进程并发、不可恢复删除和数据清理边界。
