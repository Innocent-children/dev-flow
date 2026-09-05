# 按任务复杂度控制验证与复核范围

## 用户事件

开发者让 Codex 或 DeepSeek 完成一个小范围改动。Host 已经能够用定向检查确认当前验收条件，却继续
扩大到 package、module 或全仓库测试，为一次性文案要求新增永久测试，并在每次修复后重新扫描整个
仓库。复核中顺便发现的历史问题又进入当前任务，形成“审计—修复—再次全面审计”的循环。

## 当前做法

Task 创建时就在不可变 `TaskIntent` 中保存 verification budget。此时需求、设计、工作拆分、实际影响
和现有测试结构尚未完成分析。TEST 把整个 Task 留存的自动命令永久累计到同一上限；额度不足时 Core
只拒绝结果，Host 只能停止或把剩余工作交给用户，不能保存有理由的调整后继续。

`full_suite` 只受一个创建时布尔值控制。Core 在结果提交前看不到 Host 将要执行的命令，因此无法在
shell 执行前判断完整套件是否必要。Codex 与 DeepSeek Skill 也没有统一写明测试范围、测试文件长期
价值、修改后复核范围和修复后的定向复核规则。

## Dev Flow 可确认的事实

- TASKS 已经位于 Requirements、Design、代码影响和工作拆分分析之后，可以保存当前验证计划。
- Task Plan 能保存计划检查、每项检查与改动的关系、初始预算、是否预计完整套件和是否预计修改测试代码。
- Core 能从当前 Task Plan revision、Evidence 和 VerificationAttempt 计算当前计划的自动命令消耗。
- Core 能校验结构化调整依据、具体原因、增加量、单调增加后的预算和新增检查，并保存全部调整。
- Core 能校验完整套件结果带有本次运行的具体理由，但不能判断任意 shell 文本或拦截全部命令。
- Host 能在实际执行命令或修改测试文件前读取当前 Action、Task Plan、预算、消耗、仓库规则和 diff。
- Core 已经保存 Task Plan `ExpectedPaths` 和真实 Git Task surface，Host 能据此限制修改后复核范围。

## 应作出的判断

1. 新 Task 只保存请求、初始范围、验收条件和 method profile，不保存最终验证预算。
2. TASKS 在现有 baseline 中同时保存初始验证计划。没有计划不能进入 IMPLEMENT。
3. 当前计划预算不足时，Host 先根据新影响、新风险、实际失败或验证缺口决定是否增加；理由充分时，
   使用 TEST 的 `verification_budget_increased` 自循环保存调整，再继续运行命令。
4. 缺少允许的依据类别、具体原因、新增检查或实际预算增加的调整无效。
5. 每次完整套件运行都由 Host 重新判断，并在 Evidence 中记录本次理由；预算允许只表示 Core 接受这类
   结果，不表示本次运行必要。
6. 新检查、测试代码和修改后复核只覆盖当前改动、因果影响、验收条件、实际失败或真实回归。
7. 修复复核发现后，只复查原问题、相关回归、对应验收和定向检查。显式 code review 始终只读，
   交付全部发现后等待单独修复授权。

## 用户可见结果

Task 在 REQUIREMENTS 和 DESIGN 阶段显示“尚未建立验证计划”。TASKS 完成后，Host 与 WebUI 可以回读：

- 准备执行的检查和每项理由；
- 初始与当前自动命令预算；
- 当前 Task Plan revision 已使用的自动命令和完整套件次数；
- 是否预计完整套件、是否预计新增或修改测试代码；
- 每次预算增加的依据、原因、增加量、新增检查和调整后预算。

额度不足不会自动结束任务。Host 可以先提交一个有理由的预算增加，Core 留在 TEST 并签发新 Action；
无理由调整仍被拒绝。普通小改动默认停在定向检查和范围明确的复核完成处，不以“仓库中再也找不到问题”
作为结束条件。

## 错误成本

错误放行会让无关测试、完整套件或历史问题重新进入当前任务，增加时间和改动风险。错误阻塞会让新发现
的真实影响、失败或验证缺口无法得到必要检查。方案因此不把预算当永久停止线：Core 要求结构化、可追溯
的增加，Host 负责在执行前判断这些检查是否必要；两者都不尝试解析任意命令。

## 验收方式

- Domain/Application 定向测试证明 Task 创建无预算、TASKS 保存计划、当前计划消耗独立计算、预算按
  具体调整增加并继续 TEST，以及无效调整零写入拒绝。
- Workflow/MCP 接口规范测试证明 TASKS 与 TEST 的 closed payload、TEST 自循环、完整套件理由和新 Task
  schema。
- Codex/DeepSeek Skill 接口规范测试证明定向检查优先、完整套件逐次判断、一次性 README 检查不生成测试、
  测试代码长期价值判断、范围明确的复核、防循环和显式 review 只读。
- WebUI handler 与前端定向构建证明计划、消耗和调整原因可读。
- 文档搜索和 locale 对照确认中英文技术文档与九个根 README 同步当前行为。

## 明确不做

- 不增加新的流程节点、第二状态机、通用测试框架或 shell 命令解析器。
- 不声称 Core 能拦截 Host 的所有命令或文件写入。
- 不自动批准完整套件，不因预算充足推导运行必要性。
- 不为一次性编辑细节建立永久测试，也不穷举理论组合。
- 不扫描、修复或测试与当前 diff 没有直接或间接因果关系的历史问题。
- 不改变 Repository Scope、Git 写入边界、发布流程或公开 npm 版本。

## 职责与数据设计

### Core Domain

`TaskIntent` 移除 `verification_budget`。`TaskPlanBaseline` 新增一个 `verification_plan`：

```text
checks[]: name + rationale
initial_budget: level + max_automatic_commands + allow_full_suite + allow_manual_handoff
full_suite_expected
test_code_changes_expected
```

`ProcessTask` 保存数量受限的 `verification_budget_adjustments[]`。每项绑定 Task Plan revision，并保存依据
`new_impact | new_risk | verification_failure | verification_gap`、具体原因、新增检查、增加的自动命令数、
新开放的 full-suite/manual-handoff 权限、调整前后预算和时间。当前预算由当前 Task Plan 的初始预算及
该 revision 的调整链得出。

`EvidenceSummary` 绑定 `task_plan_revision`。预算只统计当前 Task Plan revision 的 Evidence；新 Task Plan
建立新预算和消耗窗口，旧 Evidence 与调整记录继续作为历史保留。完整套件 Evidence 额外保存非空
`full_suite_reason`，非完整套件不得伪填该字段。

### Workflow

TASKS 新增必需 method step `tasks.plan_verification`，完成条件新增
`task_verification_plan_defined`。`tasks_ready` 仍是 TASKS 的前进边，现有回退边不变。

TEST 保留所有现有成功和失败边，并新增一条自循环：

```text
transition_id: verification_budget_increased
source: TEST
destination: TEST
guard: verification_budget_adjustment_justified
reason_required: true
```

该边只接受 `problem_class=none`、非空具体 reason、一个有效 `budget_adjustment`、空 checks/失败/未验证/
handoff/findings。普通 TEST 边必须提交 `budget_adjustment=null`。调整提交不生成 Evidence、TestRecord 或
VerificationAttempt，也不触发重复验证刹车；Core 更新 Task 后在 TEST 签发新 Action。

### MCP 与持久化

`dev_flow_open_task.new_task` 删除 `verification_budget`。`dev_flow_submit_tasks` 的 baseline 增加
`verification_plan`；`dev_flow_submit_test` 增加必需的 nullable `budget_adjustment`，check 增加
`full_suite_reason`。工具数量不变。

当前 snapshot 只接受新结构；SQLite Schema 版本随持久布局变化更新，不增加迁移、旧 reader 或 fallback。
Task 投影增加当前 verification plan、current budget、当前计划 usage 与 adjustment history。

### Host Skills

Codex 与 DeepSeek 在 TASKS 完成任务分析后自行建立初始计划。每次命令前先确认它对应计划、当前验收、
当前改动或实际失败；容量不足时先走有理由的调整，不因额度耗尽直接结束。

每次完整套件前重新回答影响范围、定向/包级检查是否已足够、完整套件补足的具体风险和仓库当前检查点
要求，并把本次理由写入 Evidence。修改测试文件前判断是否是稳定行为、公开接口规范、重要失败路径或真实
回归；一次性约束只做一次性检查。

普通实现后的复核只读当前 diff、因果影响路径和验收所需内容。修复复核发现后只做定向复核。显式
review/audit 阶段不修改任何文件，完整交付问题后停止等待授权。

### WebUI 与文档

WebUI 用一个 verification 区块展示“尚未计划”或当前计划、已用/当前命令预算、full-suite/test-code
预期和每次调整原因。文档只描述新约定，并同步产品、架构、命令、WebUI、Host、状态、路线图、威胁
模型、演示和九个根 README。

## 当前设计风险

- Host 对“与改动直接相关”和“具有长期测试价值”的判断仍需要结合当前工作判断；Core 只能校验已结构化的计划、
  依据、原因和结果，不能证明 Host 的自然语言判断正确。
- 未经过 Host hook 的 shell 或专用工具仍可能先执行；Core 只能在结果提交与后续 Git 观察中拒绝不合
  当前约定的状态。
- 当前计划的命令消耗按 Evidence 记录计算；Host 必须在运行前读取最新 Task，避免并发或过期视图下重复
  使用同一剩余额度。
