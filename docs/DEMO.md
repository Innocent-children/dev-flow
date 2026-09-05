# 中断后继续：两分钟看懂 Dev Flow

[中文](DEMO.md) | [English](DEMO_en.md)

本页用一个具体中断场景说明 Dev Flow 如何保留任务边界和剩余工作。这是产品的一项重要能力，
不代表全部价值；节点、命令和 MCP 工具的精确定义见 [Architecture](ARCHITECTURE.md) 与
[Command Reference](COMMANDS.md)。

## 1. 用户提出请求并选择是否进入 Dev Flow

开发者对 Codex 说：

```text
增加登录失败次数限制。修改范围只限认证模块，只运行验证该行为所需的定向测试。
```

Host 先只读检查候选实现、调用方、测试和 Git 状态，给出改动级别、已知影响面、未知项和建议，然后
停止。此时没有 Core 调用、Task 或 Git 写入。开发者选择 Dev Flow 后，确认 remote、base branch 和
新的 target branch；Host 精确 fetch、冻结 base commit，并创建干净的专属工作树。源 checkout 的
staged、unstaged 和 untracked 内容不会复制进去。只有目标工作树验证成功后，Core 才创建本地 Task，
保存请求、范围、验收条件、WorkspaceOrigin 和 method profile；此时尚未冻结最终验证预算。

## 2. 实现完成，进入测试

Codex 在 TASKS 分析完需求、设计、影响和现有测试结构后，保存这项定向认证测试、选择它的理由、预计
一条自动命令、不需要完整套件且不需要新测试文件。完成实现并进入 `TEST` 后，当前 Task 显示：

```text
Task: auth-rate-limit
State: TEST
Revision: 5
Completed: implementation
Remaining: targeted auth test
```

这些内容保存在本地 Task 状态中，不只存在于聊天记录。

## 3. 会话被压缩或 Host 重启

如果没有持久状态，新会话只能重新检查仓库和残缺聊天，猜测实现是否完成、测试是否跑过、是否还
应该扩大验证。

Dev Flow 不从聊天记录重建进度。新会话回到 Task 绑定的同一个工作树实例并明确 resume；Core 先观察
identity、history 和 content，再恢复当前节点、revision、范围和剩余验证：

```text
重启前
Task: auth-rate-limit
State: TEST
Revision: 5
Completed: implementation
Remaining: targeted auth test

重启后
Task: auth-rate-limit
State: TEST
Revision: 5
Next: run the remaining targeted auth test
```

上面的文本是用户故事的简化展示，不是某个真实 Host 的逐字输出。关键行为是恢复前后仍然指向同一
Task、同一工作树实例、同一阶段和同一剩余工作。原路径被删除后重新创建，或只找到同名 branch，
都不能冒充原实例；此时 Task 进入 workspace unavailable，等待恢复原实例或显式 abandon。

## 4. 新会话继续剩余验证

Agent 运行剩余的定向认证测试，不重新扫描并发明一套新计划，也不把验证扩大成完整回归。预算不足
时，只有新影响、风险、失败或验证缺口支持的具体增加会先写入 Task，再继续运行。每次完整套件都要
重新说明定向检查为什么不够和要补什么风险；剩余额度本身不是理由。测试失败时，Task 回到对应实现
工作；测试通过后，进入开发者理解确认。

Core 从固定 base commit、当前 commits、index、worktree 和 untracked 内容计算 Task surface。正常的
同 branch 线性 commit 不会丢失修改路径；只提交完全相同内容也不会让测试记录失效。内容真的变化、
branch switch、rewind 或 history rewrite 则会在继续工作前触发相应处理。

理解确认要求当前实现能够被解释和维护。普通修改后只复核 diff、实际影响和验收所需内容；修复发现
后只做相关定向复核。若需要修改仓库进行重构，Task 会重新经过 `TEST`，但不会自动重启全仓库审计。

## 5. 完成理解确认和交付

测试记录与理解确认都对应当前实现后，Task 进入交付并最终到达 `DONE`。如果中途发现需求、范围或
实现发生实质变化，旧的下游记录不会继续充当当前结果。

## 较短的 Recovery 场景

另一个常见中断发生在 Dev Flow Action 提交时：Host 已发出写请求，但响应丢失或被截断。此时
Adapter 不直接重复提交，而是用 Task ID 和 Action ID 读取当前 Task 与 Recovery 状态，再按照结果
继续、恢复、阻塞或安全重试。

这只适用于 Dev Flow 可以识别和记录的 Action。它不表示 Dev Flow 能恢复任意 Host 文件写入、shell
命令或外部系统副作用。

## 现有验证记录与范围

以下是相互独立的记录路径，每一项只说明表格中的范围：

| 记录 | 说明的范围 |
| --- | --- |
| [PR #8 的 Codex 状态图验收](https://github.com/Innocent-children/dev-flow/pull/8) | 真实 Codex 旅程覆盖重启、重构、重新测试、理解确认、交付和 Core `DONE` |
| [Support Matrix](SUPPORT-MATRIX.md) | 哪些稳定 registry package 与 Host 环境具有最终生命周期记录 |

不同完整流程测试分别说明不同能力；不要把多份记录描述成一次运行证明全部能力。源码测试也不等于
最终公开安装包支持。稳定、源码和未验证内容见 [Project Status](PROJECT-STATUS.md)。

## 试用稳定入口

```bash
npm install -g @imotong/dev-flow@latest
dev-flow
```

安装后使用 Codex 的 `$dev-flow-codex:dev-flow` 或 DeepSeek Harness 的 `/dev-flow` selector。Host
差异和完整命令见 [Codex 使用说明](../packages/codex/README.md)、
[DeepSeek 使用说明](../packages/deepseek/README.md)和[命令参考](COMMANDS.md)。
