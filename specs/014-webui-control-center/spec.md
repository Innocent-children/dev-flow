# Feature Specification: Dev Flow WebUI Control Center

**Feature Branch**: `feature/webui-control-center`

**Created**: 2026-08-25

**Status**: Complete

**Input**: 为 Dev Flow 提供一个完整的本地单用户 WebUI。用户能够查看每个 Task 的当前状态、历史流转、
完整流程图中的位置和未来可能路径，并能够创建、恢复、取消、归档、恢复归档、永久清除 Task，以及
执行当前 Action 和 Recovery。全部能力属于同一个 Feature，按可独立验收的检查点实施。

## Clarifications

### Session 2026-08-26

- Q: UI 的设计方向是否需要缩减？ → A: 参考 Google、Apple 的生产工具美学，采用克制、清晰、内容优先的 Dev Flow 视觉；去除概念稿式渐变、玻璃拟态、发光和超大宣传文案。
- Q: UI 如何验收？ → A: 不安排 UI 自动化测试、截图矩阵或 Agent 视觉审查，由产品负责人人工验收。
- Q: 安全机制采用什么强度？ → A: 只保留当前本地写入和不可恢复删除直接需要的最小防护，不建立多层防御协议。
- Q: 测试预算如何分配？ → A: 使用尽可能少的测试全面覆盖需求、主要失败路径和已有回归，同一事实只在一个主要权威层验证。
- Q: 列表的 Host、节点和时间筛选是否缩减？ → A: 保留当前完整筛选和分页能力。

## User Scenarios & Testing *(mandatory)*

检查点控制实施顺序。所有场景均属于本 Feature 的完成条件。

### User Story 1 - 查看任务与流程（Priority: P1 / Checkpoint 1）

本机用户可以找到 Task，查看其当前状态、完整详情、历史流转，并理解它在完整流程中的当前位置、
已走路径、当前合法路径和未来可能路径。

**Why this priority**: 准确理解 Core 当前事实是所有管理操作的入口。

**Independent Acceptance**: 使用活动、阻塞、完成、取消和包含重复路径的 Task，核对列表、详情、时间线和
流程图表达同一组 Core 事实；UI 外观和交互由产品负责人人工验收。

**Acceptance Scenarios**:

1. **Given** 存在不同状态的 Task，**When** 用户打开首页，**Then** 可以看到活动、阻塞和终态概览以及最近活动。
2. **Given** 共享数据中存在由不同 Host 创建或执行的 Task，**When** 用户按关键词、Host、仓库、节点、生命周期或更新时间筛选，**Then** 可以在同一列表中稳定浏览匹配结果。
3. **Given** 用户打开 Task 详情，**When** 页面完成读取，**Then** intent、Scope、baselines、records、Evidence、Action、Blocker、Outcome、revision 和时间来自同一次权威读取。
4. **Given** Task 多次经过同一节点或边，**When** 用户查看时间线，**Then** 每次已提交流转按 revision 顺序独立显示。
5. **Given** Task 具有当前 Action，**When** 用户查看流程图，**Then** 已走路径、当前位置、当前合法边和未来可达边具有文字与视觉区分，未来路径不表示 Guard 已满足。
6. **Given** Task 处于 `BLOCKED`，**When** 用户查看流程图，**Then** 当前节点和恢复关系均准确显示。
7. **Given** Task 在页面打开期间变化，**When** 下一次轮询读取到新 revision，**Then** 页面刷新完整 Task，旧操作表单失效。
8. **Given** 用户浏览首页、列表、详情、流程图和操作表单，**When** 页面处于常见桌面窗口或系统浅色/深色外观，**Then** 信息层级、组件、间距、色彩和反馈保持清晰一致，并使用克制的生产工具视觉而非宣传页或概念稿表达。
9. **Given** 用户首次打开 WebUI，**When** 浏览器首选语言为中文，**Then** 页面默认显示中文；其它语言默认显示英文，且用户可以在 shell 中随时切换中英文。
10. **Given** 用户手工选择语言，**When** 刷新或重新打开同一浏览器中的 WebUI，**Then** 继续使用该选择；清除浏览器站点数据后重新按系统语言选择。

---

### User Story 2 - 管理任务生命周期（Priority: P1 / Checkpoint 2）

本机用户可以创建或恢复 Task、取消活动 Task、归档或恢复终态 Task，并永久清除符合条件的终态 Task。

**Why this priority**: WebUI 是完整的 Task 操作入口。

**Independent Acceptance**: 完成 create/resume、cancel、archive/restore 和 purge，并核对 Task、事件、claim 与
展示状态。

**Acceptance Scenarios**:

1. **Given** Repository Scope 可用，**When** 用户提交请求、范围、验收条件、验证预算、method profile 和执行 Host，**Then** 确认后创建 Task。
2. **Given** 存在兼容活动 Task，**When** 用户选择恢复，**Then** 返回原 Task、revision、Action 和 Scope，不创建重复 Task。
3. **Given** 用户提交当前 revision、原因和确认，**When** 取消成功，**Then** Task 进入 `CANCELLED`、释放 claim，并保留取消事实。
4. **Given** revision 已变化，**When** 用户提交生命周期操作，**Then** 操作不写入并要求刷新。
5. **Given** Task 为 `DONE` 或 `CANCELLED`，**When** 用户归档或恢复归档，**Then** 默认可见性改变，Core revision、节点和 Outcome 不变；重复设置相同状态返回当前结果。
6. **Given** Task 非终态、仍有 claim 或确认信息不匹配，**When** 用户请求永久清除，**Then** 操作不写入并显示拒绝原因。
7. **Given** 终态 Task 满足清除条件，**When** 用户输入精确 Task ID、原因并确认不可恢复，**Then** 系统在一次提交中删除该 Task 的 current、event、claim 和归档数据。

---

### User Story 3 - 执行当前 Action 与 Recovery（Priority: P1 / Checkpoint 3）

本机用户可以查看当前 Action 的目的、条件、允许副作用、所需 Evidence、method steps、合法 transitions
和精确表单，并能够提交 Action、处理校验错误、按 Core 建议恢复不确定操作和解除 Blocker。

**Why this priority**: WebUI 必须能够安全参与流程推进，同时保持 Core 单一权威。

**Independent Acceptance**: 使用各类当前 Action、合法和非法提交、陈旧身份、Guard 失败、Recovery advice 和
Blocker resolution 验证完整操作链。

**Acceptance Scenarios**:

1. **Given** Task 有当前 Action，**When** 用户打开操作面板，**Then** 表单只包含当前 Action 合同和合法 transitions，不提供任意目标节点编辑。
2. **Given** 必填结果、Evidence 或 reason 缺失，**When** 用户提交，**Then** 页面显示字段错误且不声称成功。
3. **Given** 用户提交当前完整身份和合法 payload，**When** Core 接受，**Then** 页面只根据 Core 返回的新 Task 和 Action 更新。
4. **Given** Core 返回字段或 Guard 错误，**When** 页面显示结果，**Then** 用户可以按安全字段路径和 Core 提供的下一步纠正。
5. **Given** mutation 结果不确定，**When** 用户请求恢复，**Then** WebUI 使用原 operation identity 获取并执行 Core Recovery advice。
6. **Given** Task 为 `BLOCKED`，**When** 用户提交当前 Blocker 合同，**Then** Task 进入 Core 返回的恢复节点。

---

### User Story 4 - 共享 WebUI 运行与完整交付（Priority: P1 / Checkpoint 4）

本机用户可以通过 `dev-flow webui` 启动、打开、检查和停止共享 WebUI。页面读取同一 Dev Flow 数据
空间中由所有已接入 Host 创建或执行的 Task。启用新数据格式前，用户可以明确查看并永久清除旧 Task
数据。Core、Host Adapter 制品和维护文档包含完整入口。

**Why this priority**: 本机进程入口、数据起点和安装制品共同构成可使用的软件。

**Independent Acceptance**: 使用一个组合 Host 旅程，由一个维护中的 Host Adapter 携带的 `dev-flow` runtime 启动
WebUI，再由另一个 Host Adapter 读取 status 并打开同一 URL，证明两者复用同一进程、数据根和内嵌资产。

**Acceptance Scenarios**:

1. **Given** 数据格式可用，**When** 用户启动 WebUI，**Then** 服务只接受本机连接并打开本机页面。
2. **Given** WebUI 已由任一兼容 `dev-flow` runtime 启动，**When** 用户再次执行 start、open 或 status，**Then** Core 识别并复用同一实例。
3. **Given** 请求不是当前本机页面发起或缺少写操作保护信息，**When** 请求到达 WebUI，**Then** 写操作被拒绝且不改变 Task。
4. **Given** 存在启用前 Task 数据，**When** 用户普通启动，**Then** 启动以零写入方式返回 reset-required。
5. **Given** 用户在 CLI reset plan 中查看精确清理目标并完成永久确认，**When** Core 获得 Task 数据库的独占访问，**Then** Core 只删除 Task 数据并建立可用的空数据存储，保留 Adapter、registration 和用户配置。
6. **Given** reset 中断或目标发生变化，**When** 用户再次执行 reset，**Then** 系统重新展示和确认当前目标后继续，不扩大删除范围。
7. **Given** WebUI 和 Host 同时提交同一 Task revision，**When** 两个操作到达 Core，**Then** 只有一个成功，另一个收到陈旧 revision 错误。
8. **Given** 当前维护的 Host Adapter packages 已构建，**When** 用户从任一 package 使用其携带的 `dev-flow` runtime，**Then** 相同 WebUI 命令、能力、数据和错误语义均成立。

### Edge Cases

- 两个本机标签页或 Host 同时提交同一旧 revision。
- 流程路径重复经过节点或边，未来路径遍历仍能结束。
- Task 引用未知流程定义，或事件顺序无法与当前 Task 对齐。
- 轮询期间连续跨过多个 revision。
- purge 确认前 Task 状态、revision 或 claim 发生变化。
- reset 时无法获得数据库独占访问、目标发生变化或数据库 sidecar 类型异常。
- WebUI 与 packaged Core 不兼容，或数据存储只能读取。

## Requirements *(mandatory)*

### Core authority

- **FR-001**: Core MUST remain the sole authority for Task identity, process definition, current/resume node, Action, revision, claims, Recovery, Blocker, legal transitions and Outcome.
- **FR-002**: WebUI MUST read and mutate Task only through Core-owned application and workflow behavior; it MUST NOT persist a workflow cursor or derive a transition, Guard result, Recovery class or completion result independently.
- **FR-003**: Every Task mutation MUST bind the current identity required by Core and return zero workflow writes when stale or invalid.
- **FR-004**: WebUI MUST NOT expose arbitrary node editing, force-complete, Git mutation or shell execution.
- **FR-005**: Archive state MUST affect presentation visibility only and preserve Core revision, node and Outcome.

### Task discovery and detail

- **FR-006**: WebUI MUST provide an overview of active, blocked and terminal Tasks plus recent committed activity.
- **FR-007**: Task browsing MUST support keyword, Core-supported Host identity, repository, node, lifecycle and updated-time filters, deterministic ordering and bounded pages. Node filter choices MUST come from the current Core process definition rather than a frontend-maintained node list.
- **FR-008**: Task detail MUST present intent, Scope, baselines, records, Evidence, current Action, Blocker, Outcome, revision and timestamps from one consistent read.
- **FR-009**: Repository Scope MUST display primary and additional repositories in deterministic order with bounded path disclosure.
- **FR-010**: Empty, loading, stale, read-only, incompatible and unavailable states MUST be explicit.
- **FR-011**: WebUI MUST periodically read current state and reload the complete Task before enabling mutation after a revision change.

### Graph and history

- **FR-012**: Graph MUST display every node and transition in the Task's resolved process definition.
- **FR-013**: Graph MUST distinguish current node, committed traversals, current legal transitions, future reachable transitions, Blocked resume relation and terminal states using text and visual style.
- **FR-014**: Historical status MUST come from committed Task events in revision order and preserve repeated traversals, reason and time.
- **FR-015**: Current legal transitions MUST come only from the current Action; future reachability MUST come from the resolved definition and terminate when the graph contains cycles.
- **FR-016**: Future reachability MUST be labeled as possibility, not prediction or proof that a Guard passes.
- **FR-017**: Unknown process definitions or inconsistent event history MUST produce a safe read-only view.

### Lifecycle management

- **FR-018**: The local user MUST be able to create a Task with request, Scope, acceptance criteria, verification budget, method profile and an execution Host accepted by Core, or resume a compatible active Task. The ordinary form MUST ask for repository paths, not internal repository keys: the primary key uses Core's default and additional keys are generated deterministically by the client.
- **FR-019**: Cancellation MUST require current revision, nonempty reason and explicit confirmation, then produce `CANCELLED` and release claims.
- **FR-020**: Archive and restore MUST require a terminal Task and be idempotent by target state.
- **FR-021**: Purge MUST require a terminal Task, zero claims, current revision, typed Task ID, reason and irreversible confirmation.
- **FR-022**: Purge MUST recheck eligibility in the delete transaction and remove all Task-linked current, event, claim and archive data.

### Action and Recovery

- **FR-023**: Current Action MUST expose complete identity, purpose, conditions, allowed effects, required Evidence, method steps, legal transitions and its exact payload contract from Core-owned authority.
- **FR-024**: WebUI MUST generate the Action form from that contract and reject fields outside it before Core performs final validation.
- **FR-025**: Field and Guard errors MUST show safe field paths and the next step supplied by Core.
- **FR-026**: Uncertain mutation handling MUST preserve only the original operation identity and retained payload required by Core, read Core Recovery advice before another write, and follow only that advice; it MUST NOT retain or resend an obsolete browser-session credential.
- **FR-027**: A `BLOCKED` Task MUST expose only its current blocker-resolution contract and use the Core-returned resume node.
- **FR-028**: The existing MCP tool catalog and wire requests MUST remain compatible with the shared Action contract authority.

### Local runtime and data reset

- **FR-029**: The Core CLI contract MUST be `dev-flow webui start|open|status|stop|reset`; every maintained Host Adapter that carries Core MUST expose that exact operation through its existing runtime invocation mechanism.
- **FR-030**: WebUI MUST accept requests only through its loopback listener and current local browser session; mutation requests MUST validate origin and an unguessable session value.
- **FR-031**: Web assets MUST ship inside the existing installed product and load without an external runtime service.
- **FR-032**: One WebUI instance and all compatible Host processes MUST share the same Task authority; WebUI MUST show Tasks from every Host identity accepted by Core and resolve concurrent writes using current Task revision.
- **FR-033**: Pre-existing Task data disposition MUST be `reject-and-reset`: normal startup reports reset-required with zero writes.
- **FR-034**: Core CLI reset MUST obtain exclusive access to the Task database, display exact Task-data targets, require one target-bound permanent confirmation, and preserve Adapter packages, registrations, configuration and unrelated files; failure to obtain exclusive access MUST stop with zero deletes. WebUI MUST NOT expose reset mutation and MUST only present reset-required status with the exact CLI command guidance.
- **FR-035**: Runtime status MUST distinguish ready, read-only, reset-required, incompatible and unavailable states.

### Delivery

- **FR-036**: Every maintained Host Adapter package that carries Core MUST contain a compatible `dev-flow webui` command and the embedded Web assets required by this Feature.
- **FR-037**: Maintained user and technical documentation MUST describe the delivered commands, local boundary, reset behavior and error semantics.
- **FR-038**: Automated verification MUST be limited to the closed `V01`–`V08` validation inventory in `plan.md`; each non-UI acceptance scenario maps to one primary group, and adding another group or command requires an approved specification amendment. UI acceptance remains product-owner manual acceptance.

### Visual design and accessibility

- **FR-039**: WebUI MUST use one coherent, polished and restrained production-tool visual system across dashboard, list, detail, graph, timeline, forms, dialogs and runtime states, with clear hierarchy and a distinctive but quiet Dev Flow identity; operational surfaces MUST NOT use decorative gradients, glass translucency, glow, oversized marketing headlines or excessive pill shapes.
- **FR-040**: Typography MUST use a legible system-font scale with distinct page title, section title, body, label and code/identity roles; normal body text MUST remain at least 14 CSS pixels at default browser zoom.
- **FR-041**: Layout MUST use a consistent spacing grid, aligned content regions and bounded information density; primary journeys MUST remain usable at desktop viewport widths from 1024 CSS pixels upward.
- **FR-042**: Color MUST be semantic and consistent across surfaces, text, interaction and lifecycle states; text and essential controls MUST meet WCAG AA contrast, and no workflow fact or action state may rely on color alone.
- **FR-043**: Interactive controls MUST provide consistent default, hover, focus-visible, active, disabled, loading, success, warning, error and destructive states; every operation MUST remain keyboard reachable with visible focus. All selection controls MUST use the same WebUI-owned combobox/listbox presentation and keyboard behavior instead of browser-native select popups.
- **FR-044**: WebUI MUST follow the user's light or dark system appearance and preserve the same hierarchy, contrast and state meaning in both appearances.
- **FR-045**: Motion MUST be limited to short functional state feedback, MUST NOT delay work or add decorative spatial movement, and MUST respect reduced-motion preferences.
- **FR-046**: WebUI MUST provide complete Simplified Chinese and English client-owned interface copy. On first use it MUST select Chinese when the browser's ordered language preferences contain a Chinese locale first among supported locales, and English otherwise.
- **FR-047**: The application shell MUST expose a keyboard-accessible Chinese/English switch. A manual choice MUST persist only in the current browser's local site storage and override system-language selection until that site data is cleared; it MUST NOT create Core, Task or user-account state.
- **FR-048**: Navigation, page headings, labels, controls, loading/empty/stale states, lifecycle and destructive confirmations, runtime guidance and frontend-owned correction text MUST follow the selected language and read as native product copy rather than literal translations of internal architecture terms. Chinese UI copy MUST use ordinary user-facing wording and MUST NOT expose phrases such as “权威”“边界” or “runtime” as section copy. Core-owned identifiers, enum values, paths, payload facts and original Core error text MUST remain exact, with localized surrounding guidance where needed.

### Explicit Non-Goals

- Remote access, accounts, authentication, permissions, roles or team sharing.
- Historical aggregate snapshots, arbitrary revision comparison or time-travel views.
- Labels, notes, saved views, batch administration, audit center or history export.
- Streaming updates, custom process editing, subtasks or per-repository workflow cursors.
- Backup/restore product capabilities, a standalone WebUI package, a separate daemon, or a separate WebUI instance/data store per Host.
- Visual imitation of a specific Google or Apple product, externally loaded runtime assets, or a separately installed/published WebUI runtime product.
- Git writes, version changes, publication or deployment.

### Key Entities

- **ProcessTask**: Existing Core workflow aggregate and current-state authority.
- **TaskEvent**: Existing committed revision event used for timeline and actual traversals.
- **ArchiveState**: Terminal Task presentation state, separate from Core workflow revision.
- **ProcessGraphProjection**: Read-time combination of definition, events and current Action.
- **RuntimeReceipt**: Shared Core WebUI process identity, data-root identity and loopback URL.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A local user can find a known Task and identify its current node, revision, Action and Blocker from the WebUI in one journey.
- **SC-002**: Reference Tasks containing forward progress, repeated traversal, `BLOCKED`, `DONE` and `CANCELLED` show graph and timeline facts that agree with Core data.
- **SC-003**: A committed revision becomes visible by the next scheduled refresh, no later than five seconds, and a stale form cannot write.
- **SC-004**: The local user can complete create/resume, cancel, archive/restore and eligible purge without using a shell command for the Task operation.
- **SC-005**: Invalid, stale, ineligible and uncertain mutations return a distinct next step and produce no unreported workflow write.
- **SC-006**: Purge removes every record linked to the selected Task while preserving unrelated Tasks and product configuration.
- **SC-007**: Requests outside the current local page session cannot perform a Task mutation.
- **SC-008**: One deterministic concurrent scenario proves one winner for two writes using the same revision and a stable stale result for the other.
- **SC-009**: One combined Host-parity journey proves that one maintained Host Adapter package can start the embedded WebUI and another can report and open the same live process, URL, data root and embedded assets; Core-level tests own the complete command lifecycle and reset behavior.
- **SC-010**: All four checkpoints pass before the Feature is marked `Complete`.
- **SC-011**: Dashboard, Task list, Task detail, graph/Action view, destructive confirmation and system-state screens follow the approved Dev Flow visual direction and are presented to the product owner for manual UI acceptance.
- **SC-012**: UI completion is decided by product-owner acceptance; automated UI tests, screenshot matrices and Agent-performed visual review are outside this Feature's verification budget.
- **SC-013**: Validation groups `V01`–`V07` pass at their assigned checkpoints and the final repository gate `V08` runs once; no additional automated verification is required for Feature completion.
- **SC-014**: Product-owner acceptance confirms that Chinese-system default, English fallback, manual switching and retained browser choice cover dashboard, list, open Task, Task detail and system-state surfaces without mixed frontend-owned language.
- **SC-015**: Product-owner acceptance confirms that the delivered UI reads as a calm production tool: content hierarchy leads, page titles remain operational in scale, and decorative gradient/glass/glow treatments are absent from operational surfaces.

## Assumptions

- The standard development graph is the only process delivered by this Feature.
- The local user launches the WebUI with `dev-flow webui`; any currently maintained Host Adapter may supply the compatible Core runtime, and all use the same Task data authority.
- Existing Task data may be permanently discarded after explicit confirmation.
- Desktop browser use is primary; controls remain keyboard accessible and state is not conveyed only by color.
- Google Material Design and Apple Human Interface Guidelines are design references for hierarchy, consistency, clarity and accessibility; Dev Flow uses its own product identity and components.
- Local data volume is handled with the simplest implementation that keeps browsing responsive during normal personal use; this Feature does not establish a scale benchmark.
- Git and release authorization boundaries remain unchanged.
