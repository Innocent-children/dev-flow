# 完成条件与 Action 恢复验证

## 实现结果

- IMPLEMENT→TEST 和 REFACTOR→TEST 要求当前计划全部工作项完成。
- DELIVERY 接收明确的逐条验收关联；工作项必须已完成且对应当前验收索引，检查必须属于当前 Test 并已通过。理解确认单独检查。
- 提交检查、mutation 构造和持久化快照复用 Domain 完成约束。
- WebUI 普通提交和 blocker 解除使用 Core 的语义入口及 Action operation 保存流程。恢复请求只有 Action ID；任务详情投影待恢复 ID，页面重开可继续恢复。
- 浏览器网络异常先查询 Core；旧 Action 的迟到异常不能覆盖已刷新的 Action。
- Core 产品版本按接口变化增加 MINOR；流程仍为 11 个节点、30 条普通转换。SQLite 表结构保持当前布局。

## 已执行检查

环境为 macOS arm64、Go 1.27、Node.js 24。以下检查均通过。

| 检查 | 实际覆盖 |
| --- | --- |
| `go test -mod=readonly ./internal/domain ./internal/workflow ./internal/application ./internal/store ./internal/mcp ./internal/webui ./tests/contract -count=1` | 完成约束、所有当前节点的载荷、持久化与操作恢复、MCP/HTTP 输入输出、公开接口样例 |
| `go test -mod=readonly ./tests/contract ./tests/journeys -run '^Test(FinalLocal\|ProcessGraph\|RecoveryUncertainty\|MultiRepository)' -count=1` | 当前流程迭代、并发提交、恢复分类、重启、多仓库和交付；使用临时 Git 与 SQLite |
| `TestControlCenterBlockerSubmissionRetainsCoreAssembledPayload` | WebUI 的 blocker 解除同样由 Core 组装并保存操作，恢复后回到原节点 |
| `pnpm --dir packages/webui test` | 5 项模拟组件/HTTP 检查：语义字段、网络异常、重开后的待恢复状态、迟到响应、按 ID 恢复及 nullable 字段 |
| `pnpm --dir packages/webui typecheck`、`pnpm run build:webui` | TypeScript 检查与实际嵌入资源构建；生成 JS、HTML 和 manifest 已同步 |
| 两个 Host 的 `skill-contract.test.mjs` | Codex 11 项、DeepSeek 5 项；当前 Skill、方法说明、工具和 ServerInfo 样例 |
| `tests/journeys/shared/simulated-submission-contract.test.mjs` | 模拟 Codex MCP 客户端使用源码 Core，提交时省略 Core 填充的 revision |
| `tests/journeys/deepseek/simulated-graph-journey.test.mjs` | 模拟 DeepSeek Host 使用源码 Core，经过重启、恢复、返工与明确验收关联到达 DONE |
| DeepSeek `native-runner.mjs self-test`、`multi-repository-runner.mjs self-test` | Runner 自检及新提交说明；未执行真实 DSH 会话 |
| `node scripts/check-versions.mjs`、`git diff --check` | 当前版本文件一致性与改动空白检查 |

新增 Application 回归确认：空集合、部分完成和重复完成项均被拒绝且零写入；缺少验收、工作项不匹配、历史检查、理解确认代替验收检查及重复检查引用均被拒绝；有效的自动/人工检查关联可保存并重开。

## 实际浏览器检查

使用临时工作树、临时 SQLite 和源码构建的 Core。通过 Store 的受控提交失败创建已保存但未应用的 REQUIREMENTS 操作，再打开本机 WebUI：

1. 初次打开与刷新后均显示恢复入口，普通提交表单被隐藏。
2. 点击恢复后，Task 从 `r1/REQUIREMENTS` 进入 `r2/DESIGN`。
3. DESIGN 表单不要求填写 Requirements revision、process digest 或仓库摘要；补齐决策与方法结果后，普通提交进入 `r3/TASKS`。
4. 数据库包含 3 条事件，最新 Action operation 的 expected_revision 为 2、applied_revision 为 3。
5. 临时浏览器、服务、数据库和工作树已清理。

这是实际浏览器操作与实际 Git/SQLite 检查。待恢复记录由故障注入构造；浏览器网络异常由模拟测试覆盖，没有把该准备过程描述成真实网络丢包。

## 验证边界

本次没有运行完整仓库矩阵、Windows 原生流程、实际 Codex/DeepSeek 会话、安装或发布操作。当前公开平台与 Host 支持声明保持原有范围。复核只检查本次完成规则、提交恢复及其直接使用方；两个 P2 的实现未修改。

## 文档路径

- `README.md`
- `README_de.md`
- `README_es.md`
- `README_fr.md`
- `README_ja.md`
- `README_ko.md`
- `README_pt-BR.md`
- `README_zh-CN.md`
- `README_zh-TW.md`
- `docs/ARCHITECTURE.md`
- `docs/ARCHITECTURE_en.md`
- `docs/CODEX_en.md`
- `docs/COMMANDS.md`
- `docs/COMMANDS_en.md`
- `docs/DEEPSEEK_en.md`
- `docs/NEXT-FEATURES.md`
- `docs/PRODUCT.md`
- `docs/PRODUCT_en.md`
- `docs/ROADMAP.md`
- `docs/ROADMAP_en.md`
- `docs/WEBUI.md`
- `docs/WEBUI_en.md`
- `internal/README.md`
- `internal/README_en.md`
- `packages/codex/README.md`
- `packages/codex/plugin/skills/dev-flow/SKILL.md`
- `packages/codex/plugin/skills/dev-flow/references/method-profiles.md`
- `packages/codex/plugin/skills/dev-flow/references/node-payloads.md`
- `packages/deepseek/README.md`
- `packages/deepseek/skills/dev-flow/SKILL.md`
- `packages/deepseek/skills/dev-flow/references/method-profiles.md`
- `packages/deepseek/skills/dev-flow/references/node-payloads.md`
- `scripts/README.md`
- `scripts/README_en.md`
- `specs/018-completion-and-action-recovery/plan.md`
- `specs/018-completion-and-action-recovery/validation.md`

## 实现、测试与资源路径

- `CORE_VERSION`
- `internal/application/action_result_validation.go`
- `internal/application/apply_action_results.go`
- `internal/application/completion_test.go`
- `internal/application/control_center_action.go`
- `internal/application/control_center_read.go`
- `internal/application/control_center_test.go`
- `internal/application/phase5b_test.go`
- `internal/application/phase5d_hardening_test.go`
- `internal/application/recover_action.go`
- `internal/application/submit_action.go`
- `internal/application/submit_action_test.go`
- `internal/application/types.go`
- `internal/domain/completion.go`
- `internal/domain/errors.go`
- `internal/domain/outcome_criterion.go`
- `internal/domain/phase5d_hardening_test.go`
- `internal/domain/task.go`
- `internal/mcp/host_projection_test.go`
- `internal/mcp/schemas.go`
- `internal/mcp/submission_boundary_test.go`
- `internal/store/future_corrupt_matrix_test.go`
- `internal/store/store.go`
- `internal/webui/action_handlers.go`
- `internal/webui/assets/generated/assets/index-C550w0rZ.js`（删除）
- `internal/webui/assets/generated/assets/index-g1j4lmbR.js`
- `internal/webui/assets/generated/index.html`
- `internal/webui/assets/generated/manifest.json`
- `internal/webui/handlers_test.go`
- `internal/webui/read_handlers.go`
- `internal/webui/types.go`
- `internal/workflow/action_schema.go`
- `internal/workflow/definitions_test.go`
- `internal/workflow/standard_process.go`
- `internal/workflow/standard_process_test.go`
- `internal/workflow/submission_contract_test.go`
- `internal/workflow/submission_schema.go`
- `packages/codex/tests/fixtures/graph-method-profiles.json`
- `packages/webui/package.json`
- `packages/webui/src/components/ActionPanel.tsx`
- `packages/webui/src/components/BlockerPanel.tsx`
- `packages/webui/src/components/RecoveryPanel.tsx`
- `packages/webui/src/components/SchemaField.tsx`
- `packages/webui/src/lib/api.ts`
- `packages/webui/src/lib/i18n.tsx`
- `packages/webui/src/pages/TaskDetailPage.tsx`
- `packages/webui/tests/action-recovery.test.mjs`
- `protocol/fixtures/graph-host-parity-codex.json`
- `protocol/fixtures/graph-host-parity-deepseek.json`
- `protocol/fixtures/graph-multi-repository-open.json`
- `protocol/fixtures/graph-server-info.json`
- `scripts/validate-repository.sh`
- `tests/contract/testdata/final-local-payloads.json`
- `tests/journeys/deepseek/multi-repository-runner.mjs`
- `tests/journeys/deepseek/native-runner.mjs`
- `tests/journeys/deepseek/simulated-graph-journey.test.mjs`
- `tests/journeys/process_graph_iteration_test.go`
