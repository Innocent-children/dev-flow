# Feature Specification: Unified Adapter Lifecycle Manager

**Feature Directory**: `specs/010-create-dev-flow-installer`
**Created**: 2026-08-25
**Status**: Complete
**Input**: 用户通过一个统一入口管理 Codex 与 DeepSeek Dev Flow Adapter 的完整生命周期，不再对照 README 手工编排安装、升级、修复、卸载、数据清理或全新重装命令。

## Problem Statement

Codex Adapter 当前把 npm package、`setup`、版本检查、`remove` 和 npm 卸载暴露为独立步骤；
DeepSeek Adapter 还要求用户管理 DSH Profile、临时 tarball、绝对路径、remove/add 顺序、清理和配置
回读。Task 数据、用户偏好、Codex 注册、DSH Profile contribution 与 Host 自身数据又具有不同 owner，
用户难以安全判断一次升级、修复或清空会影响什么。

统一生命周期管理器以 `npx create-dev-flow@latest` 和等价 npm create 入口呈现真实当前状态，生成
闭合执行计划并在确认后调用既有 Host 权威。它覆盖检查、诊断、安装、升级、修复、保留数据重装、
卸载、恢复出厂状态和清空后重装，执行后回读真实结果并只给出一个与当前状态匹配的下一步。

## User Scenarios & Testing

### User Story 1 - 检查、诊断与安装 Adapter (Priority: P1)

用户运行统一入口，查看 Codex、DeepSeek、已知 Profile、Adapter package、注册、Core 与数据状态，
然后选择一个 Host 或全部 Host 安装。管理器在首次持久化前展示目标、版本、影响和确认。

**Independent Test**: 在隔离 HOME、npm prefix、数据目录和可控子进程中验证 `status`、`doctor`、
Codex 安装、DeepSeek 默认/指定 Profile 安装、全部 Host 安装、拒绝确认和重复运行。

**Acceptance Scenarios**:

1. **Given** 支持的 Host 已存在且 Adapter 未安装，**When** 用户确认安装，**Then** 管理器完成 package、注册或 Profile contribution，并回读 package、Core 与 Host 状态。
2. **Given** 用户选择 DeepSeek 且未输入 Profile，**When** 生成计划，**Then** 目标为 `web`；输入安全名称时只作用于该 Profile。
3. **Given** 相同目标版本已经就绪，**When** 再次安装，**Then** 管理器只验证并以零持久化变化结束。
4. **Given** Host、平台或运行时前置条件不满足，**When** 执行检查或安装，**Then** 首个持久化动作前停止并给出实际值、要求值和一个下一步。
5. **Given** 用户拒绝执行计划，**When** 退出，**Then** package、注册、Profile、配置和数据均不变化。

### User Story 2 - 升级、修复与保留数据重装 (Priority: P1)

用户可以升级到 `latest` 或显式支持版本，修复损坏或不完整的当前安装，也可以在保留 Task 与用户
偏好的情况下强制移除并重装 Adapter。中断后再次运行从真实状态和本次运行记录继续。

**Independent Test**: 使用 npm/Codex/DSH 替身验证 latest/显式版本升级、相同版本修复、保留数据
重装、Codex ownership 冲突、DeepSeek stale `file:` contribution、每个持久化边界失败和中断恢复。

**Acceptance Scenarios**:

1. **Given** 存在较旧且 ownership 可验证的 Adapter，**When** 用户确认升级，**Then** 管理器验证目标制品、完成 Host 迁移并回读目标版本，Task 数据保持不变。
2. **Given** package 已存在但注册、receipt 或 Profile contribution 不完整，**When** 用户选择修复，**Then** 管理器只执行恢复就绪所需的最小动作。
3. **Given** 用户选择保留数据重装，**When** 执行完成，**Then** Adapter 被重新安装，用户偏好与当前 Task 数据目录保持字节不变。
4. **Given** DeepSeek Profile 指向失效的旧 tarball，**When** 升级或修复，**Then** 管理器在目标制品验证后按 remove、add、回读顺序恢复，不要求用户接触 tarball。
5. **Given** 一次运行在持久化边界失败或被信号中断，**When** 输出结果或再次运行，**Then** 管理器区分已完成与未完成动作，并提供或执行唯一安全恢复动作。
6. **Given** ownership 无法证明或状态与 receipt 冲突，**When** 用户请求升级、修复或重装，**Then** 管理器零强制覆盖停止并指出冲突资源。

### User Story 3 - 卸载 Adapter 并保留用户数据 (Priority: P1)

用户可以卸载 Codex、一个已知 DeepSeek Profile 或管理器拥有的全部 Adapter。普通卸载移除 package、
注册和 Profile contribution，保留用户偏好、Task 数据、Codex 相邻配置、DSH 其他插件与 Profile。

**Independent Test**: 验证 Codex remove→npm uninstall、DeepSeek 指定/已记录 Profile remove、全部
Adapter 卸载、重复卸载、部分失败和相邻资源保留。

**Acceptance Scenarios**:

1. **Given** Codex Adapter ownership 可验证，**When** 用户确认卸载，**Then** 管理器先删除 Plugin、marketplace 与 receipt，再卸载 package，并回读注册不存在。
2. **Given** DeepSeek Adapter 位于显式或已记录 Profile，**When** 用户确认卸载，**Then** 只删除该 Profile 的 Dev Flow contribution并回读不存在。
3. **Given** 用户选择全部 Host，**When** 卸载完成，**Then** 所有管理器拥有的 Adapter 都被移除，Task 数据和 `$HOME/.dev-flow/config.json` 保留。
4. **Given** 目标已经不存在，**When** 再次卸载，**Then** 管理器以零变化成功结束。

### User Story 4 - 恢复出厂状态与清空后重装 (Priority: P1)

用户可以在明确看到影响后移除全部已知 Adapter、用户偏好、manager-owned 记录以及当前共享 Task
数据。默认清理把已确认数据移动到 macOS 废纸篓中的唯一时间戳目录；永久删除需要独立的强确认。
用户可以在同一运行中重新安装指定 Host，得到全新配置与数据目录。

**Independent Test**: 在隔离 HOME 和显式临时数据目录中验证计划、双重确认、另一 Host 使用保护、
默认可恢复清理、永久清理拒绝/确认、清空后重装和每个失败边界；不得操作真实用户目录。

**Acceptance Scenarios**:

1. **Given** 用户请求恢复出厂状态，**When** 展示计划，**Then** 管理器逐项列出 Adapter、Profile、配置、默认数据、显式数据和可恢复性，普通 `--yes` 不足以授权数据清理。
2. **Given** 两个 Host 共享当前 Task 数据，**When** 用户只选择一个 Host 清理共享数据，**Then** 管理器阻止操作并要求选择全部相关 Host 或保留共享数据。
3. **Given** 用户完成破坏性确认，**When** 执行默认清理，**Then** 先移除全部相关 Adapter并回读，再把精确确认的数据移动到本次运行拥有的废纸篓目录。
4. **Given** 使用显式 `DEV_FLOW_DATA_DIR`，**When** 用户未确认其 canonical absolute path，**Then** 管理器不移动或删除该目录。
5. **Given** 用户选择清空后重装，**When** 清理完成，**Then** 管理器创建新的配置/默认数据状态、安装指定 Adapter并通过与首次安装相同的回读。
6. **Given** 清理或重装中断，**When** 再次运行，**Then** 管理器依据真实状态和保留的运行记录继续；已移入废纸篓的数据不被自动永久删除。

### User Story 5 - 交互、脚本与多 Profile 管理 (Priority: P2)

真实 TTY 提供键盘可操作的 Host、动作、Profile、版本、确认和进度；自动化调用者使用显式子命令
和参数获得确定性 JSON。管理器只管理显式 Profile和由自己的 ownership receipt 记录的 Profile。

**Independent Test**: 验证 rich/plain/`NO_COLOR`/JSON、非 TTY 参数闭合、已记录多 Profile、手工安装
接管、未知 Profile 和输出事实一致性。

**Acceptance Scenarios**:

1. **Given** 真实 TTY，**When** 运行无参数入口，**Then** 首页只显示安装 Codex、安装 DeepSeek、安装两者和管理已有安装四项；前三项直接生成安装计划，第四项才进入完整生命周期菜单。
2. **Given** 非 TTY 且参数完整，**When** 执行 supported 子命令，**Then** 无等待完成；参数不足时在持久化前稳定失败。
3. **Given** JSON 模式，**When** 任一操作成功或失败，**Then** 标准输出恰好一个可解析对象，stderr 不包含结果 JSON。
4. **Given** 管理器曾在多个 DeepSeek Profile 安装 Adapter，**When** 用户选择全部已知 Profile，**Then** 只作用于 receipt 闭集。
5. **Given** Profile 中存在可验证的手工 Dev Flow 安装，**When** 用户显式选择接管，**Then** 管理器记录 ownership 后才能在未来把它纳入“全部已知 Profile”。

### Edge Cases

- 未知、重复或冲突参数在首个持久化动作前被拒绝。
- Profile 为空、为 `.`/`..`、包含路径分隔符或路径语义时被拒绝。
- 显式版本不存在、不是稳定版本或与 Support Matrix 不兼容时不降低当前安装可用性。
- 当前 package 比目标新时必须显示降级计划并单独确认，不能把降级呈现为普通升级。
- Codex package 安装成功但 setup/readback 失败时，结果区分“package 已安装”和“Host 未就绪”。
- `SCHEMA_UNSUPPORTED` 只作为诊断结果；除显式 factory-reset 外不迁移、删除、改名或覆盖旧数据。
- 默认数据目录、显式数据目录、用户配置、Codex receipt、manager receipt和临时制品分别记录 owner。
- 子进程使用参数数组启动，用户输入不经过 shell 拼接。
- rich、plain 与 JSON 表达相同的 operation、Host、Profile、版本、状态、影响、完成动作和下一步。

## Requirements

### Functional Requirements

- **FR-001**: MUST 提供等价的 `npx create-dev-flow@latest` 与 `npm create dev-flow@latest` 入口，并提供 `status`、`doctor`、`install`、`upgrade`、`repair`、`reinstall`、`uninstall` 和 `factory-reset` 闭合子命令集。
- **FR-002**: MUST 支持且仅支持 Codex、DeepSeek 和 `all` Host 选择；DeepSeek 默认 `web`，允许安全的显式 Profile和 manager-owned receipt 闭集。
- **FR-003**: MUST 提供 Host、Profile、版本、确认、数据策略、plain 和 JSON 所需的闭合参数；非 TTY 参数不足时直接失败。
- **FR-023**: 无参数真实 TTY 首页 MUST 以安装目标为主：Codex、DeepSeek、两者、管理已有安装；普通安装不得要求用户先选择 lifecycle operation。
- **FR-024**: `install --host ... --yes` 等完整参数 MUST 保持为非交互、CI 与高级用户入口，公开入门文档默认只展示 `npx create-dev-flow@latest`。
- **FR-004**: 管理器 MUST 能在低于 Adapter package 要求的 Node.js 上启动，并在持久化前检查平台、Node.js、npm、Host executable、Host compatibility 和目标制品可用性。
- **FR-005**: Codex 操作 MUST 通过 npm 与现有 `dev-flow-codex setup/remove --json`、`--version` 和 Codex readback完成；管理器不得复制或绕过 registration ownership 实现。
- **FR-006**: DeepSeek 操作 MUST 只调用公开 DSH version、`plugin add/remove` 与 `--dump-config`；制品必须在唯一临时根获取并验证，用户不处理 tarball、绝对制品路径或 `PROFILE` 环境变量。
- **FR-007**: 管理器 MUST 记录它安装或显式接管的 DeepSeek Profile ownership；不得扫描 DSH 内部目录或声称枚举未记录的全部 Profile。
- **FR-008**: 每个 mutation MUST 先读取真实状态并生成包含目标、版本、持久化影响、数据策略和 restart requirement 的执行计划；用户拒绝确认时零持久化变化。
- **FR-009**: 重复操作 MUST 幂等；相同版本已就绪、目标已不存在或状态已满足时不得无必要地安装、注册、remove/add 或清理。
- **FR-010**: `upgrade` 默认目标为 npm `latest` 稳定版本并允许显式兼容版本；降级必须作为独立风险事实展示并单独确认。
- **FR-011**: `repair` MUST 执行恢复当前目标就绪所需的最小动作；`reinstall` MUST 明确移除并重建 Adapter，默认字节保留用户配置和 Task 数据。
- **FR-012**: 普通 `uninstall` MUST 删除选定 Adapter package、Codex owned registration 或 DeepSeek selected contribution，并保留用户配置、Task 数据、目标仓库、Codex 相邻配置、DSH 其他 Profile/插件/会话、Host executable 与 npm 共享缓存。
- **FR-013**: `factory-reset` MUST 只在全部共享数据使用者已纳入计划后处理用户配置、manager records和当前 Task 数据；默认移动到本次运行拥有的 macOS Trash 目录，永久删除要求独立强确认。
- **FR-014**: 显式 `DEV_FLOW_DATA_DIR` MUST 是现有 canonical absolute non-symlink directory；任何移动或永久删除必须再次展示并确认精确路径，管理器不得扫描或猜测历史显式目录。
- **FR-015**: `factory-reset --reinstall` MUST 在清理回读完成后使用首次安装流程创建全新状态并安装选定 Adapter；旧 Trash 数据不得自动恢复为当前数据。
- **FR-016**: 管理器 MUST 保存每次 mutation 的 operation identity、计划摘要、完成动作、失败动作、owned temporary roots 和唯一恢复动作；再次运行必须先与真实状态核对。
- **FR-017**: ownership 缺失、冲突或无法回读时 MUST 零强制覆盖停止；清理仅限 receipt、当前计划和精确用户确认共同证明的 closed owned targets。
- **FR-018**: MUST 使用参数数组启动子进程，稳定处理非零退出、信号、不可执行、无效 JSON、registry absence和 Host readback 不一致。
- **FR-019**: 真实 TTY MUST 提供键盘可操作的选择与进度；plain、`NO_COLOR` 和 JSON MUST 无 ANSI、动画或 Unicode 边框，JSON 标准输出恰好一个对象。
- **FR-020**: Codex、DSH Host 安装/卸载和 `$HOME/.codex`、`$HOME/.dsh` 共享根不属于 manager cleanup ownership；缺失 Host 只报告一个可执行下一步。
- **FR-021**: 受影响的全部维护文档 MUST 以统一入口为默认 Adapter 生命周期路径，并保留 Host 原生命令作为诊断与恢复权威；Feature 阶段不得宣称未发布 package 已稳定可用。
- **FR-022**: 产品实现、构建、测试和 release tooling MUST NOT 读取 Feature Markdown 决定运行行为；公开版本、Tag、npm publication 和 GitHub Release 仍由独立 release flow 管理。

### Persistence and Compatibility

- **Product schema disposition**: `not-applicable`；本 Feature 不改变 Core、Task Schema、Process、MCP 或 Host Adapter 内部持久化合同。
- Factory reset 是用户显式触发的产品数据生命周期操作，不是旧 Schema 自动迁移或启动时清理。
- Existing Codex receipt保持 registration authority；manager records只记录 manager operation 与 DeepSeek Profile ownership，不成为 Core、Task 或 Host registration 的第二权威。

### Key Entities

- **Lifecycle Request**: Operation、Host、Profile、目标版本、数据策略、确认与输出模式。
- **Observed State**: Host、package、Core、registration、Profile contribution、数据与 receipt 的只读快照。
- **Lifecycle Plan**: 基于 Observed State生成的目标状态、ordered actions、持久化影响、restart requirement和确认要求。
- **Lifecycle Run**: Operation identity、计划摘要、完成动作、失败动作、临时 ownership和唯一恢复动作。
- **Host Target**: Codex 注册目标或一个显式/manager-owned DeepSeek Profile。
- **Ownership Receipt**: 管理器可管理的 DeepSeek Profile 或运行资源的闭合身份，不代表 DSH 全局枚举。
- **Data Target**: 默认数据、显式数据或用户配置的 canonical identity、共享使用关系和可恢复性。

## Non-Goals

- GUI、后台服务、遥测、自动定时升级或 Host 启动/停止控制。
- DSH Profile 全量内部枚举、未授权 Profile 接管或删除 `$HOME/.dsh`。
- Codex/DSH Host 本体安装或卸载、删除 `$HOME/.codex` 或 npm 共享缓存。
- Core、MCP、Task 状态图、Task Schema、Host Adapter运行合同或 repository mutation行为变更。
- Support Matrix 外的平台、架构、Node.js 或 Host 版本。
- npm 发布、公开版本修改、Tag、GitHub Release、提交、推送或 PR。

## Success Criteria

- **SC-001**: 普通用户只运行一个入口并在不超过四个选择内完成任一支持生命周期操作，或得到一个明确失败结果。
- **SC-002**: Codex 与 DeepSeek 成功旅程均只暴露统一入口；DeepSeek 向用户暴露零个 tarball 路径和零个 Profile 环境变量。
- **SC-003**: 所有前置失败发生在首个持久化动作前，并包含实际值、要求值和一个下一步。
- **SC-004**: 每个支持操作连续运行两次，第二次产生零个不必要 mutation；`reinstall` 的显式强制语义除外。
- **SC-005**: 每个受测持久化边界失败都能准确列出完成动作、未完成动作和唯一恢复建议，且不清理所有权外路径。
- **SC-006**: 普通卸载、repair、upgrade 和保留数据重装后，用户配置与 Task 数据保持不变。
- **SC-007**: Factory reset 的所有删除目标均同时具有 ownership、计划和显式确认；另一 Host 或未确认显式目录使共享数据清理安全停止。
- **SC-008**: 清空后重装得到新的活动配置/数据和 ready Adapter，旧数据仅保留在已报告 Trash target或经永久确认删除。
- **SC-009**: 非 TTY、plain、`NO_COLOR`、JSON 均无人工输入结束；JSON 可单次解析且无额外 stdout 文本。
- **SC-010**: 默认生命周期文档命令与 package manifest、bin、参数合同和 Host executable权威逐项一致。

## Assumptions

- npm 公共 registry 提供 `latest` 稳定 manager 与 Adapter packages；精确版本由独立 release 流程管理。
- 当前 Support Matrix、Codex setup/remove 和 DSH plugin/dump-config 是执行权威。
- 用户确认后授权执行计划中展示的全局 Adapter package、Codex registration和 DSH Profile变更。
- 测试使用隔离 HOME、npm prefix、数据目录与可控子进程，不执行真实用户 Host 的破坏性生命周期。
