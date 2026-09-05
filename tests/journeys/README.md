# Core 与编程工具的完整流程测试

本目录测试创建专属工作树后，Core 与 Codex / DeepSeek 如何推进任务。测试仓库、remote、worktree
和 SQLite 都放在测试框架管理的临时目录中。清理样例时不操作用户仓库、用户工作树、实际 Host
配置或公开安装包。

## Core 完整流程测试

| 文件 | 当前覆盖 | 测试方式 |
| --- | --- | --- |
| `process_graph_navigation_test.go` | 在专属工作树打开任务、REQUIREMENTS/DESIGN 切换、全部合法下一步，以及拒绝非法转换且不写入数据 | 进程内测试；实际临时 Git/SQLite |
| `process_graph_iteration_test.go` | IMPLEMENT/TEST/COMPREHENSION_REVIEW/REFACTOR、重新测试、交付，以及返工后旧结果失效 | 进程内测试；实际临时 Git/SQLite |
| `recovery_uncertainty_test.go` | Action 签发时的摘要、五种恢复分类、保存的 Action、重试前读取结果，以及应用阻塞/恢复操作 | 进程内测试；实际临时 Git/SQLite |
| `process_graph_concurrency_test.go` | 多个 Store/Application 实例用 revision CAS 保证一次提交 | 两个实例并发测试；实际临时 Git/SQLite |
| `process_graph_restart_test.go` | 关闭并重开后保留 Task、Action、来源、记录和合法下一步 | 子进程测试；实际临时 Git/SQLite |
| `current_storage_boundary_test.go` | 初始化当前 Schema，拒绝非当前 Schema 且不写入数据，以及重启 | 进程内测试；实际临时 Git/SQLite |
| `multi_repository_scope_test.go` | 先创建全部工作树，再一次建立 Task/占用记录；每项改动带仓库标识 | 进程内测试；实际临时 Git/SQLite |
| `webui_host_parity_test.go` | Codex/DeepSeek 共用 Core Task，并读取一致的工作树数据 | 进程内测试；实际临时 Git/SQLite |

Core 测试的准备代码可以初始化 remote、commit 和独立 worktree。Task 打开后，Core 只执行范围
受限的 Git 查询。文件变化从 Git 读取，不采用 Host 自报的路径。

## 编程工具接入与共用流程测试

| 文件 | 当前覆盖 | 测试方式 |
| --- | --- | --- |
| `shared/simulated-submission-contract.test.mjs` | 在专属工作树打开任务、提交步骤结果，以及由 Core 填充 revision 和 Action 签发字段 | 模拟 MCP 客户端；源码构建的 Core；实际临时 Git/SQLite |
| `codex/simulated-worktree-first.test.mjs` | 评估、确认、fetch、托管工作树启动参数与初始化、Task、commit、迁移/交接，以及分别清理工作树和分支 | 模拟 Codex/Core/Host；实际临时 Git remote/worktree/运行记录 |
| `codex/native-runner.mjs` | 检查外部实际 Codex App 流程记录是否包含规定事件，以及安装包标识是否匹配 | 显式提供实际记录后检查；无输入时 skipped |
| `deepseek/simulated-graph-journey.test.mjs` | DSH 触发指令、提交字段、Core 流程图，以及创建专属工作树后的行为 | 模拟 DeepSeek；源码构建的 Core |
| `deepseek/native-runner.mjs` | 普通请求的评估、确认、工作树创建/会话重启、Task、测试、DONE 和清理 | 显式提供环境参数后运行实际 DSH |
| `deepseek/multi-repository-runner.mjs` | 创建全部 remote/root 的工作树，再一次打开 Task；失败时不留下部分仓库占用记录 | 显式提供环境参数后运行实际 DSH |

`packages/codex/tests/task-launch.test.mjs` 和 Codex 模拟测试使用实际临时 Git，但任务创建、Core
和 Handoff 使用模拟 Adapter。因此这些结果不表示已经运行实际 Codex。`codex/native-runner.mjs`
只检查显式提供的实际 App 运行结果，本身不创建 Task 或执行 Handoff。

DeepSeek 实际环境测试只有在显式提供凭据、设置、DSH CLI、本地源码安装包、摘要和确认变量时
才运行。缺少条件时返回的 `skipped` 表示无法执行，不表示通过。

## 测试结果说明

- `static`、`fixture`、`simulated`、`in-process`、`subprocess`、`native Host` 和 `final artifact`
  保持不同标签；
- 注入响应丢失或失败，只能检查对应处理分支，不表示发生过实际 Host 崩溃；
- 模拟测试、样例或源码测试不能扩大 Support Matrix 的支持范围；
- 没有提供实际运行记录时，检查器不能报告实际环境测试通过；
- 当前测试不能代替 npm 安装包、已发布程序或 Windows 实际 Host 的测试，也不能据此声明稳定支持；
- 测试记录不保存完整会话原文、凭据、用户路径、源文件正文或密钥。
