# Research: Dev Flow WebUI Control Center

## Decision 1：独立前端工程构建后嵌入 Go Core

**Decision**：在 `packages/webui` 使用 React 19、TypeScript 和 Vite 8 建立独立前端工程；生产构建产物由
Go `embed` 进入现有 Core binary，Core 使用标准库提供本地 HTTP API 和静态资源。

**Rationale**：流程图、动态 Action 表单、多状态工作台、主题和高质量动效需要清晰的组件与状态边界；
独立前端工程直接服务当前完整交互。构建后嵌入保持单进程、本地安装和 Core 权威。

**Alternatives considered**：Go template 加少量脚本、独立 backend、单独安装的 WebUI 产品。

**Consequences**：源码分为 `packages/webui` 和 `internal/webui`；pnpm 负责前端构建，Go binary 只携带静态
产物并继续作为唯一运行进程。前端不持久化流程状态。

## Decision 2：Core 命令管理共享 WebUI 进程

**Decision**：用户使用 `dev-flow webui start|open|status|stop|reset`。每个维护中的 Host Adapter package
携带兼容 Core runtime，因此使用相同命令和共享 runtime receipt。

**Rationale**：WebUI 属于 Core，并读取 Host 共享的 Task 数据；命令归属 Core 可以让任一接入 Host 使用
相同能力，同时保持一个进程和一份状态。

**Alternatives considered**：由某一个 Host 独占入口、为每个 Host 建立独立 WebUI、增加独立 WebUI package。

**Consequences**：Host Adapter 只需要携带并调用兼容 `dev-flow` runtime。Runtime receipt 只记录进程复用和数据根识别直接
需要的事实；兼容性由存活进程的 status 响应确认。

## Decision 3：现有 TaskEvent 提供历史

**Decision**：时间线和实际路径读取现有 TaskEvent；当前详情读取 ProcessTask snapshot。

**Rationale**：TaskEvent 已保存 revision、source、destination、transition、reason 和时间，能够直接表达用户
需要的流转历史。

**Alternatives considered**：保存每个 revision 的完整 Task、重放事件重建当前状态。

**Consequences**：不增加历史 snapshot、diff 或 replay 机制。

## Decision 4：轮询读取本机变化

**Decision**：详情每 2 秒、列表和首页每 5 秒读取当前事实；revision 变化后重新读取完整 Task。

**Rationale**：本地单用户页面需要看见 MCP/Host 进程提交的变化，定时读取即可满足五秒可见性。

**Alternatives considered**：SSE、WebSocket、change feed。

**Consequences**：无需持久序列、重连协议或事件广播设施；写入仍由 revision CAS 保护。

## Decision 5：直接复用现有存储事实

**Decision**：Task 列表利用现有列和 snapshot 完成筛选；历史读取 TaskEvent；归档在 `tasks` 增加可空时间；
purge 直接事务删除关联数据。

**Rationale**：本 Feature 面向一个本地用户，现有 current snapshot 已包含筛选和详情所需事实。

**Alternatives considered**：查询镜像列、repository 投影表、管理状态表、purge receipt/ledger。

**Consequences**：Schema 只增加归档字段；不增加同步镜像、不变量 preflight 或请求回执表。

## Decision 6：未来路径按完整图派生

**Decision**：读取 resolved definition，从当前节点计算完整可达节点和边；visited set 终止环路。

**Rationale**：用户需要完整流程位置和未来可能路径，resolved definition 已包含所需事实。

**Alternatives considered**：保存图投影、生成多个固定深度预览。

**Consequences**：图投影只在读取时存在，API 返回一套可达节点和边。

## Decision 7：Action schema 只有一个来源

**Decision**：Workflow 提供当前 Action payload schema；MCP 和 WebUI 分别投影同一来源。

**Rationale**：Web 表单需要精确字段，同时 Core 必须继续承担最终验证。

**Alternatives considered**：前端硬编码表单、自由 JSON 输入、复制 MCP schema builder。

**Consequences**：一组表驱动共享 contract 覆盖全部 Action kind；HTTP 只验证投影映射，WebUI 表单由产品负责人人工验收。

## Decision 8：永久 purge 使用一次确认写入

**Decision**：页面先展示 Task 和删除范围；confirm 请求携带当前 revision、typed Task ID、reason 和不可恢复
确认。事务内重新检查 terminal、revision 和 claims 后删除关联行。

**Rationale**：不可恢复操作需要明确用户确认和提交时校验；这些信息已经足以抵御陈旧页面和误选目标。

**Alternatives considered**：单击删除、持久 prepare token、purge receipt。

**Consequences**：不增加 purge 状态或 ledger；响应不确定时重新读取 Task，存在表示未删除，不存在表示已删除。

## Decision 9：reset 使用一个目标绑定确认

**Decision**：公开 `reset` 命令中的 plan 展示 canonical DB 和 sidecar；confirm token 绑定当前目标集合，
执行前获得数据库独占访问并重新核对文件目标，然后删除并创建空库。plan/confirm 是 Core 内部函数，不是额外 CLI 子命令。

**Rationale**：旧数据无需保留，当前直接安全责任是确保用户知道删除范围、删除时数据库未被其它进程使用，
且实现只能删除已确认目标。独占访问直接保护数据库，不需要建立通用进程登记或多阶段 reset 协议。

**Alternatives considered**：migration、备份/恢复、reset journal、多阶段确认协议。

**Consequences**：中断后重新生成 plan 并确认当前目标；Adapter、registration、配置和其它文件保持不变。

## Decision 10：按权威层分配验证

**Decision**：每项非 UI 要求、合同条款、主要失败路径和已有回归只映射到一个主要权威层；使用表驱动用例合并覆盖多项
要求；全 Feature 只使用一个组合 Host 跨层 Journey 和一次最终仓库验证。UI 由产品负责人人工验收。

**Rationale**：全面覆盖由需求和风险映射保证，不由测试数量或分层复制保证。

**Alternatives considered**：每层覆盖全部场景、每个检查点重复完整回归。

**Consequences**：自动验证闭合为 plan 中的 `V01`–`V08`。tasks 必须把每个非 UI 验收场景映射到唯一主要组，允许一个
表驱动测试覆盖多项要求。`V07` 只证明 Host A 启动、Host B 复用；`V08` 只在最终执行一次。不生成 UI 测试或视觉证据任务。

## Decision 11：建立富有表现力的 Dev Flow 视觉系统

**Decision**：视觉语言参考 Google Material Design 对排版、网格、空间、尺度、色彩和动效的系统化运用，
以及 Apple Human Interface Guidelines 对层级、一致性、适应性、清晰度和可访问性的要求；最终界面使用
Dev Flow 自有的色彩、材质、图形和组件表达。

**Rationale**：控制中心同时承载高密度状态、流程图和复杂操作，需要顶级视觉层级与交互反馈。独立前端
工程允许大胆色彩、层叠材质、数据可视化和高质量动效，同时通过语义 tokens 和组件状态保持一致。

**Alternatives considered**：浏览器默认样式、通用后台模板、直接复制某个 Google/Apple 产品界面。

**Consequences**：视觉文档作为设计指导，覆盖浅色、深色、键盘、对比度和 reduced motion 的目标。不建立 UI 自动化测试、
截图矩阵、像素级回归或 Agent 视觉审查；产品负责人人工验收最终 UI。

**References**：

- [Google Material Design 3](https://m3.material.io/)
- [Google Material Design principles](https://m2.material.io/design/introduction/)
- [Apple Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines)
- [Apple Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility)
