# Feature Specification: Codex Setup 安装展示

**Feature Branch**: `not-created`（未配置 `before_specify` 分支钩子）

**Created**: 2026-08-24

**Status**: Complete

**Input**: User description: "只优化 dev-flow-codex setup：配置缺失时创建默认配置，安装后展示实际创建或修改的文件，并提供跟随系统语言的炫酷品牌首屏。"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Setup 后立即可用 (Priority: P1)

Codex 用户完成 `dev-flow-codex setup` 后，无需手工创建配置文件即可开始使用。setup 明确展示本次
Dev Flow 直接创建或更新的配置与 registration receipt；重复 setup 没有文件变化时也给出清晰结果。

**Why this priority**: 用户需要在安装完成时立即知道产品是否就绪、文件发生了什么变化，以及下一步
如何开始，而不是再查阅文档或猜测本地状态。

**Independent Test**: 在临时 HOME 中分别执行全新 setup、重复 setup、兼容升级、已有有效配置和
已有无效配置，验证默认配置、文件变化摘要、既有文件保护和 setup 成败结论。

**Acceptance Scenarios**:

1. **Given** 配置目录和文件都不存在，**When** setup 成功，**Then** 创建安全默认配置，并把配置与
   registration receipt 的实际 created/updated 状态展示给用户。
2. **Given** 已存在有效配置，**When** setup 成功，**Then** 配置内容保持原样，文件摘要不把它误报
   为已修改。
3. **Given** registration 与 receipt 已完全匹配，**When** 重复 setup，**Then** 用户看到明确的零文件
   变化结果和可用状态。
4. **Given** 既有配置无效、不可读、不安全或不是普通文件，**When** 执行 setup，**Then** setup 在
   Codex registration mutation 前失败，保持既有路径原状并显示一个恢复步骤。
5. **Given** 默认配置已创建但后续 registration 失败，**When** setup 返回失败，**Then** 错误说明
   配置已创建、registration 未完成，并提供重新执行 setup 的恢复步骤。

---

### User Story 2 - 获得醒目清晰的安装首屏 (Priority: P2)

交互式 setup 成功后，用户看到一个紧凑、有辨识度的 Dev Flow 品牌首屏。首屏展示就绪状态、配置
路径、文件变化和唯一下一步；简体中文与英文跟随系统语言，终端能力不足时使用无装饰纯文本。

**Why this priority**: 品牌首屏把安装结果组织成一个清晰的完成状态，同时保留自动化、窄终端和
机器读取场景的稳定性。

**Independent Test**: 捕获简体中文 rich、英文窄屏无颜色、不支持语言回退英文和 `setup --json`
四个代表结果，验证核心事实一致、无第三方品牌资产、机器输出无终端控制字符。

**Acceptance Scenarios**:

1. **Given** 交互式终端支持颜色和 Unicode，**When** fresh setup 或兼容升级成功，**Then** 在 5～8
   个逻辑行内展示 Dev Flow 自有品牌、ready、文件变化和一个下一步。
2. **Given** 系统语言是简体中文或英文，**When** 展示 setup 结果，**Then** 全部用户文案使用对应
   语言；其他语言整体回退英文。
3. **Given** 非 TTY、`NO_COLOR` 或窄终端，**When** setup 完成，**Then** 使用无 ANSI、无动画、无
   Unicode 边框的纯文本结果，核心字段不缺失。
4. **Given** 用户执行 `setup --json`，**When** setup 成功，**Then** 只输出一行闭合 JSON，保留现有
   operation/status/changed/receipt_path 字段并增加配置路径、文件变化和下一步。
5. **Given** 用户运行 `mcp`、remove 或 `--version`，**When** 命令执行，**Then** 不显示 setup 品牌
   首屏，也不改变这些命令的现有输出合同。

### Edge Cases

- 配置目录存在但文件不存在时，只创建配置文件，不修改相邻文件。
- 配置、receipt 路径包含空格或 Unicode 时，按路径值展示，不拼接为可执行 shell 命令。
- 已有配置包含合法的自定义偏好时，setup 字节级保留，不补写、不排序、不格式化。
- 兼容升级只更新 receipt 时，摘要只报告 receipt 为 `updated`。
- setup 失败时，摘要只报告已经完成的直接文件写入，不报告预计写入或 Codex cache 内容。
- rich 能力检测不确定时使用纯文本；不因展示能力不足而让 setup 失败。

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `dev-flow-codex setup` MUST 在 Codex registration mutation 前确保固定个人配置路径存在
  一份有效配置。
- **FR-002**: 配置缺失时 setup MUST 创建完整默认配置，Codex 与 DeepSeek 的 `codebase_memory`
  偏好均为 false；目录 MUST 仅当前用户可访问，文件 MUST 仅当前用户可读写。
- **FR-003**: 既有有效配置 MUST 字节级保留；setup MUST NOT 补字段、重排、格式化、覆盖、删除或
  改名。
- **FR-004**: 既有配置无效、不可读、权限不安全、符号链接或非普通文件时，setup MUST 在任何
  registration mutation 前失败，并 MUST 提供一个恢复步骤。
- **FR-005**: setup 结果 MUST 只列出当前操作直接负责且实际完成的配置与 registration receipt 文件
  变化；状态闭集为 `created`、`updated`。
- **FR-006**: 没有直接文件变化时 setup MUST 明确报告零变化；npm package、Codex cache、Task data、
  packaged resources 和相邻用户文件 MUST 不出现在摘要中。
- **FR-007**: 配置创建后 registration 失败时，错误 MUST 说明已完成的配置变化、registration 未完成
  和一个重新执行 setup 的恢复步骤，MUST NOT 声明 ready。
- **FR-008**: 交互式 fresh setup 和兼容升级成功时 MUST 展示 5～8 逻辑行的 Dev Flow 自有品牌首屏，
  包含 ready、配置路径、文件变化和唯一下一步。
- **FR-009**: 首屏 MUST 跟随系统语言；首期完整支持简体中文和英文，其他语言整体回退英文，同一
  结果 MUST NOT 混用两种用户文案语言。
- **FR-010**: 非 TTY、`NO_COLOR`、窄终端或 Unicode 能力不足时 MUST 使用无 ANSI、动画和 Unicode
  边框的纯文本表达；信息含义 MUST NOT 只依赖颜色或图形。
- **FR-011**: `setup --json` MUST 保留现有 success 字段并增加 `configuration_path`、有序
  `file_changes` 和一个 `next_step`；输出 MUST 是一行闭合 JSON 且不包含首屏装饰。
- **FR-012**: `mcp`、remove、`--version`、Core 配置读取、Task/SQLite、目标 Git 仓库和 DeepSeek
  package 行为 MUST 保持不变。
- **FR-013**: 首屏 MAY 借鉴成熟开源 CLI 的信息层级、真实文件动作和单一下一步，但 MUST 使用
  Dev Flow 自有名称、文案和视觉标识，不得复制第三方商标、Logo、吉祥物、ASCII 标志或口号。
- **FR-014**: Product Feature 阶段 MUST NOT 修改产品版本、发布 npm、创建或移动 Git Tag，或创建
  或完成 GitHub Release。

### Key Entities

- **Setup File Change**: setup 直接写入的配置或 registration receipt 文件事实，包含绝对路径和
  `created`/`updated` 状态，不包含文件内容。
- **Setup Success Result**: 现有 setup success 字段加配置路径、有序文件变化和唯一下一步。
- **Setup Presentation**: 同一 success result 的 rich、plain 或 JSON 表达；展示模式不改变事实。

## Persistence Disposition

- **Task/SQLite data**: `not-applicable`。Feature 不改变 Task Schema、snapshot、claim 或数据目录。
- **Existing user configuration**: 原样保留。只有固定配置文件缺失时创建默认配置。
- **Registration receipt**: 延续现有 ownership、兼容升级和 remove 合同，只为本次 setup 结果提供
  created/updated 文件事实，不增加展示状态字段。

## Non-Goals

- DeepSeek 安装、激活、日志或 package 改动；
- 首次 Task 展示、跨进程 presentation identity 或额外 presentation receipt；
- 配置编辑器、配置 CLI、项目级配置或配置热重载；
- 新 MCP/Core 命令、流程节点、Transition、Recovery 或 Task 状态；
- 扫描 HOME、npm、Codex cache 或相邻文件来推断安装变化；
- 动画延时、联网素材、第三方品牌资产或 UI framework；
- 产品版本、npm、Tag、GitHub Release 或支持声明变化。

## Verification Budget

本 Feature 的验收证据限定为：

1. Codex install-experience 配置单元场景：fresh、existing、invalid/unsafe、symlink/非普通文件；
2. Codex setup lifecycle：fresh、repeat、compatible upgrade、配置创建后 registration failure；
3. 四个展示代表结果：简中 rich、英文窄屏无色、不支持语言回退英文、`setup --json`；
4. package closure、remove retention 和 MCP stdout 现有合同的直接回归；
5. 文档完成后 `pnpm run validate` 最多两次；Attempt 2 仅用于验证 Attempt 1 直接暴露的 reviewed
   package allowlist 修复。

不运行 DeepSeek 新场景、真实 Host/registry/codebase-memory、平台/终端/语言组合矩阵、压力/性能/fuzz
或 release command。每次最终门禁启动即消费预算；失败后停止，不自动追加第三次运行。

T019 Attempt 1 已启动并失败，修订后预算为 1/2 consumed。失败为 Codex package manifest 的 reviewed Go
contract allowlist 未同步新 production module。T021 已修复该镜像，T022 直接合同测试通过；Feature
修复已完成且定向合同通过；Attempt 2 已执行并通过，最终预算 2/2 consumed，Feature 为
`Complete`。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: fresh setup 代表场景 100% 生成有效默认配置，用户无需手工创建文件。
- **SC-002**: existing/重复/升级代表场景中，既有配置字节变化数为 0。
- **SC-003**: setup 摘要中的配置/receipt created/updated 与文件前后事实 100% 一致，误报和漏报均
  为 0。
- **SC-004**: 用户能在一个 setup 结果中识别 ready/failed、配置路径、文件变化和唯一下一步，无需
  查看外部文档。
- **SC-005**: 简中、英文、fallback 和 JSON 四个代表结果的核心字段完整率为 100%，JSON/纯文本中
  ANSI 控制符数量为 0。
- **SC-006**: 全部验收场景中，DeepSeek 文件变化数、目标 Git 变化数、Task 数据变化数和新增 Core
  流程状态数均为 0。

## Assumptions

- “安装后展示”指 `dev-flow-codex setup` 的命令结果；npm install 本身和第一个普通 Task 不展示。
- 系统语言按标准环境语言偏好选择；无法确定或不受支持时使用英文，不新增语言参数或配置项。
- setup 可准确报告的直接文件限定为共享用户配置和 Codex registration receipt；Codex CLI 自有 cache
  与 npm 文件由各自工具管理。
- 展示使用 Node.js 标准能力，不增加生产依赖或人为等待。
