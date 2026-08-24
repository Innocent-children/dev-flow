# Tasks: Codex 智能隐式启用

**Input**: `specs/008-smart-implicit-activation/` 中的 spec、plan、research、data-model、activation
contract、quickstart 和 requirements checklist。

**Tests**: 只运行 Codex Skill/lifecycle 的定向 Node 测试；自动验证总预算最多 8 个命令。

## Phase 1: 智能隐式启用完整切片

**Goal**: 一次同步 metadata、Skill、MCP instructions、setup validator、contract tests 和维护文档，
交付可独立验收的双入口行为，不修改 Core、DeepSeek、持久化、版本或发布路径。

- [X] **T001 [US1][US2][US3]** 在 `packages/codex/tests/skill-contract.test.mjs`、
  `packages/codex/tests/lifecycle.test.mjs`、`packages/codex/tests/launcher.test.mjs` 和
  `packages/codex/tests/package-contract.test.mjs` 更新 contract fixtures：锁定
  `allow_implicit_invocation: true`；检查 implementation、bug fix、refactoring、targeted testing、
  delivery 五类正向用途；检查 explanation-only、status-only、design discussion、ordinary question、
  ambiguous request 五类不得自动创建 Task 的负向边界；保留精确 `$dev-flow-codex:dev-flow`、裸
  `$dev-flow` 和错误 namespace 边界；确认 implicit/explicit 共用 startup contract（FR-001～FR-009；
  SC-001～SC-004；`contracts/activation.md`）。

- [X] **T002 [US1][US2][US3]** 在
  `packages/codex/package.json`、`packages/codex/plugin/.codex-plugin/plugin.json`、
  `packages/codex/plugin/skills/dev-flow/agents/openai.yaml`、
  `packages/codex/plugin/skills/dev-flow/SKILL.md`、
  `packages/codex/bin/dev-flow-codex.mjs` 和 `packages/codex/lib/lifecycle.mjs` 实现 T001 合同：启用
  原生隐式选择，同步公开 Plugin metadata，前置正负 description，允许 implicit 或精确 selector 进入
  同一 admission，非任务请求不创建 Task，setup 闭合校验新 metadata/Skill/MCP 一致性；不增加分类器、配置或持久状态
  （FR-001～FR-009、FR-011、FR-012；SC-001～SC-005；`plan.md`「Technical Approach」）。

- [X] **T003 [US1][US2][US3]** 同步以下维护文档，统一说明直接开发请求可智能启用、精确 selector
  是强制入口、非执行型/含糊请求不自动创建 Task，并保持命令、版本、安装和授权事实不变：
  `README.md`、`README_en.md`、`README_zh-TW.md`、`README_ja.md`、`README_ko.md`、
  `README_es.md`、`README_fr.md`、`README_de.md`、`README_pt-BR.md`、`docs/PRODUCT.md`、
  `docs/PRODUCT_en.md`、`docs/ARCHITECTURE.md`、`docs/ARCHITECTURE_en.md`、`docs/COMMANDS.md`、
  `docs/COMMANDS_en.md`、`docs/ROADMAP.md`、`docs/ROADMAP_en.md`、`packages/codex/README.md`、
  `docs/CODEX_en.md`（FR-003～FR-006、FR-010～FR-012；SC-002～SC-005；`docs/I18N.md`）。

- [X] **T004** 在 T001～T003 完成后运行一次
  `node --test packages/codex/tests/skill-contract.test.mjs packages/codex/tests/lifecycle.test.mjs packages/codex/tests/launcher.test.mjs packages/codex/tests/package-contract.test.mjs`；只验收
  metadata、Skill、MCP admission、setup validator 和 fixture 一致性。失败时记录根因和剩余预算后停止，
  不得用 `pnpm run validate`、完整仓库测试、真实 Host/registry Journey、DeepSeek、平台/模型矩阵或
  release command 替代（FR-009～FR-012；SC-001～SC-005；`quickstart.md`）。
  - attempt 1: failed；1/8 automatic commands consumed；70 passed、1 failed
  - failure: `packages/codex/tests/skill-contract.test.mjs` 的中文 README contract 要求
    `plugin namespace 错误` 与 `Skill base name 错误` 分别可定位，当前合并句未匹配第一项
  - classification: implementation failure；返回 IMPLEMENT 做精确文案修复；未重跑
  - attempt 2: failed；2/8 automatic commands consumed；70 passed、1 failed
  - failure: 同一中文 README contract 的正则不允许 Markdown 在“开发”和“交付”之间换行，实际文案
    语义完整且 namespace 修复已通过
  - classification: implementation failure in test assertion；返回 IMPLEMENT 允许空白换行；未运行 attempt 3
  - attempt 3: failed；3/8 automatic commands consumed；70 passed、1 failed
  - failure: 中文负向分类断言未允许需求文案中的“仅解释、仅状态查询”前缀；前两次精确修复均已通过
  - classification: implementation failure in test assertion；返回 IMPLEMENT 允许可选“仅”前缀；未运行 attempt 4
  - attempt 4: failed；4/8 automatic commands consumed；70 passed、1 failed
  - failure: 中文普通仓库工具边界断言未允许 Markdown 在 `Codex` 后换行；前三次精确修复均已通过
  - classification: implementation failure in test assertion；返回 IMPLEMENT 允许空白换行；未运行 attempt 5
  - attempt 5: passed；5/8 automatic commands consumed；71 passed、0 failed；exit code 0
  - result: T004 complete；未运行完整仓库、真实 Host/registry、DeepSeek 或 release 验证

**Checkpoint — STOP REQUIRED**: T004 结果记录后停止。不得提交、推送、修改版本或发布。

## Dependencies

```text
T001 contract tests -> T002 implementation -> T003 maintained docs -> T004 targeted validation
```

T001 先建立确定性 package contract；T002 满足它；T003 只同步已经实现的行为；T004 是唯一计划内
自动验收入口。

## Acceptance traceability

| Acceptance index | Requirement | Work | Verification |
| --- | --- | --- | --- |
| 0 | 五类明确开发请求可隐式选择 | T001、T002、T003 | T004 positive contract assertions |
| 1 | 五类非任务请求不自动创建 Task | T001、T002、T003 | T004 negative contract assertions |
| 2 | 精确 selector 保留且不绕过准入 | T001、T002、T003 | T004 selector/admission assertions |
| 3 | metadata/Skill/MCP/setup/tests/docs 一致 | T001～T003 | T004 combined package tests |
| 4 | 定向预算和排除面保持 | T002～T004 | T004 command record and changed-path review |

## Delivery record

- T001～T004 全部完成；
- 最新自动证据为 Attempt 5：71/71 passed，累计 5/8 commands consumed；
- 开发者明确确认理解并能够维护 Feature 008；
- SC-001～SC-005 均映射到当前实现、Attempt 5 和理解证据；
- 剩余风险限于 Host 隐式匹配的概率性与 metadata/Skill/MCP/tests/docs 长期同步责任；
- 完整仓库、真实 Host/registry、DeepSeek、平台/模型矩阵和 release 验证按预算未运行；
- 未提交、推送、修改版本或发布。
