# Core Journeys

本目录验证 shared Go Core 的跨层开发过程行为。所有 repository 和 SQLite 数据均位于测试框架
管理的临时目录；测试完成后不保留用户数据，不修改真实 Git repository 或 Codex 配置。

## 已实现 Journey

| 文件 / Journey | 能力 | 证据类型 |
| --- | --- | --- |
| `process_graph_navigation_test.go` | 创建 Graph Task、REQUIREMENTS/DESIGN 导航、完整合法出边、invalid edge zero-write | in-process deterministic；real temporary Git/SQLite |
| `process_graph_iteration_test.go` | IMPLEMENT/TEST/COMPREHENSION_REVIEW/REFACTOR/retest/delivery、negative comprehension/delivery | in-process deterministic；real temporary Git/SQLite |
| `process_graph_iteration_test.go` rework cases | requirements/design/delivery remediation 和 downstream authority invalidation | in-process deterministic；real temporary Git/SQLite |
| `recovery_uncertainty_test.go` | graph operation probe、五分类、read-before-retry、blocker/recovery apply | in-process deterministic；real temporary Git/SQLite |
| `process_graph_concurrency_test.go` | 两个 Store/Application handle 对同一 mutation 的 CAS 竞争与单次提交 | two-handle deterministic；real temporary Git/SQLite |
| `process_graph_restart_test.go` | COMPREHENSION_REVIEW 跨进程关闭/重开、同一 task/action/baseline/test/profile/transition | subprocess；real temporary Git/SQLite |
| `storage_generation_boundary_test.go` | direct Schema 2 bootstrap、Schema 1 zero-write rejection、显式新目录、restart | in-process deterministic；real temporary Git/SQLite |

测试 helper 可以在 setup 阶段初始化并 commit 临时 repository。进入 Core Journey 后，Repository
Observer 只执行有界只读 Git 观察；测试会比较预期 repository state，并关闭/丢弃旧 Store、DB
handle、observer 和 service 后再证明 restart。

## Adapter 与 native 边界

`packages/codex/tests/journey-harness.test.mjs` 和相关 fixture 验证 simulated Codex Adapter/Harness
控制流、parser 和 evidence closure。它们属于 **simulated Codex adapter** evidence，不属于本目录
Go Journey，也不能标记为 real/native Codex。

Feature 003 历史 native evidence 仍是对应已发布合同的冻结事实。Feature 008 Contract 0.2 的
native attempt 1 在第一条 REQUIREMENTS payload 上失败；explicitly authorized attempt 2 在
`requirements_ready` 提交后因非法 DESIGN payload 失败。Attempt 3 的四个真实 Codex 会话完成
graph workflow 并到达 Core `DONE`，随后 runner 在命令分类阶段误把只读 TEST 模板检查识别为
验证命令，因此 lifecycle 未执行。三个原始外部证据目录均保留，Attempt 3 的 failed marker 不
改写，Attempt 4 禁止执行。

Feature 008 的最终 SC-015 采用同一精确 source-local artifact 的组合证据：Attempt 3 提供
`native Codex graph-flow evidence`；独立的 no-Codex packaged-Core runner 提供
`deterministic exact-artifact lifecycle evidence`，覆盖 setup/remove/repeated remove/npm
uninstall/data retention/exact-artifact reinstall/同一 lifecycle Task retained reopen。两个组件
使用不同 Task，组合记录只绑定共同 artifact identity。T092 仅在离线 native 重验、确定性
lifecycle 和闭合组合证据全部通过后完成。

当前 Journey 不证明 released package、registry artifact 或 public support。

## Evidence rules

- `in-process deterministic`、`real temporary Git/SQLite`、`two-handle`、`subprocess`、
  `simulated Codex adapter` 和 `native Codex` 必须保持不同标签；
- failure injection/response-loss fixtures 只证明其确定性边界，不是 real-host crash；
- fake、fixture、static、user-performed 或 simulated evidence 不能升级为 native evidence；
- deterministic exact-artifact lifecycle evidence 不能升级为 native Codex evidence，也不能
  表示为 Attempt 3 的同一 Task；
- Journey 不写入 repository artifact、用户 HOME、真实数据库路径或真实 Codex state。
