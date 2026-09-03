# Current Core and Host Journeys

本目录验证当前 worktree-first Core 与 Host 合同。测试仓库、remote、worktree 和 SQLite 位于测试框架
管理的临时目录；fixture cleanup 不操作用户仓库、用户工作树、真实 Host 配置或公开制品。

## Core Journey

| 文件 | 当前覆盖 | 证据类型 |
| --- | --- | --- |
| `process_graph_navigation_test.go` | 专属 worktree open、REQUIREMENTS/DESIGN 导航、完整合法出边、invalid edge zero-write | in-process deterministic；real temporary Git/SQLite |
| `process_graph_iteration_test.go` | IMPLEMENT/TEST/COMPREHENSION_REVIEW/REFACTOR/retest/delivery 与返工失效 | in-process deterministic；real temporary Git/SQLite |
| `recovery_uncertainty_test.go` | issuance digests、五分类、Core-retained Action、read-before-retry、blocker/recovery apply | in-process deterministic；real temporary Git/SQLite |
| `process_graph_concurrency_test.go` | 多 Store/Application handle 的 revision CAS 与单次提交 | two-handle deterministic；real temporary Git/SQLite |
| `process_graph_restart_test.go` | 关闭/重开后保留 Task、Action、origin、records 和合法下一步 | subprocess；real temporary Git/SQLite |
| `current_storage_boundary_test.go` | 当前 Schema direct bootstrap、非当前 Schema zero-write 拒绝与 restart | in-process deterministic；real temporary Git/SQLite |
| `multi_repository_scope_test.go` | 全部 roots 先 provision、一次 Task/claim 集、repository-qualified current surface | in-process deterministic；real temporary Git/SQLite |
| `webui_host_parity_test.go` | Codex/DeepSeek 共用 Core Task 与 workspace projection | in-process deterministic；real temporary Git/SQLite |

Core Journey 的 setup helper 可以初始化 remote、commit 和独立 worktree；Task 打开后，Core Observer
只执行有界只读 Git 命令。Host 自报文件变化不是测试输入。

## Host 与 shared Journey

| 文件 | 当前覆盖 | 证据类型 |
| --- | --- | --- |
| `shared/simulated-submission-contract.test.mjs` | dedicated-worktree open、semantic-only node result、Core-owned revision/issuance fields | simulated shared MCP client；source-built Core；real temporary Git/SQLite |
| `codex/simulated-worktree-first.test.mjs` | assessment、确认、fetch、managed descriptor/bootstrap、Task、commit、relocation/Handoff 与双 cleanup | simulated Codex/Core/Host；real temporary Git remote/worktree/receipt |
| `codex/native-runner.mjs` | 校验外部真实 Codex App worktree-first Journey 的闭合事件与 artifact 身份 | explicit-input native validator；无输入时 skipped |
| `deepseek/simulated-graph-journey.test.mjs` | DSH selector/semantic payload、Core graph 与 worktree-first contract | simulated DeepSeek；source-built Core |
| `deepseek/native-runner.mjs` | 普通请求 assessment、确认、provision/relaunch、Task、测试、DONE 与 cleanup | explicit-input real DSH runner |
| `deepseek/multi-repository-runner.mjs` | 多 remote/root 全量 provisioning、一次 open 和零 partial claim | explicit-input real DSH runner |

`packages/codex/tests/task-launch.test.mjs` 与 Codex simulated Journey 使用真实临时 Git，但 Codex task、
Core 和 Handoff 是模拟 Adapter，因此不能标记为 native Codex。`codex/native-runner.mjs` 只校验显式
提供的真实 App 结果，本身不创建 Task 或执行 Handoff。

DeepSeek native runners 只有在 credentials、settings、DSH CLI、source-local artifact、digest 和
确认变量全部显式提供时才运行。缺少条件时的 `skipped` 是 unavailable，不是 passed。

## 证据规则

- `static`、`fixture`、`simulated`、`in-process`、`subprocess`、`native Host` 和 `final artifact`
  保持不同标签；
- response-loss/failure injection 只证明确定性分支，不等于真实 Host crash；
- fake、fixture 或 source test 不能扩大 Support Matrix；
- native validator 没有显式外部结果时不能声明 native evidence；
- 当前 Journey 不证明 registry package、released artifact、Windows native Host 或公开稳定支持；
- Journey 不保存 raw transcript、凭据、用户路径、源文件正文或 secret。
