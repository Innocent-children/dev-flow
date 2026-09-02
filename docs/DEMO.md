# 中断后继续：两分钟看懂 Dev Flow

[中文](DEMO.md) | [English](DEMO_en.md)

本页用一个具体失败场景解释 Dev Flow 的主要价值。它不是完整协议说明；节点、命令和 MCP 工具的
精确定义见 [Architecture](ARCHITECTURE.md) 与 [Command Reference](COMMANDS.md)。

## 1. 用户提出一个有边界的任务

开发者对 Codex 说：

```text
增加登录失败次数限制。修改范围只限认证模块，只运行验证该行为所需的定向测试。
```

Dev Flow 创建本地 Task，保存请求、范围、验收条件和 verification budget。Codex 仍然负责读取代码、
修改文件和运行命令。

## 2. 实现完成，进入测试

Codex 完成实现并进入 `TEST`。当前 Task 已记录实现阶段完成，剩下一项定向认证测试：

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

Dev Flow 不从聊天记录重建进度。新会话打开同一个 Task，恢复当前节点、revision、范围和剩余验证：

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
Task、同一阶段和同一剩余工作。

## 4. 新会话继续剩余验证

Agent 运行剩余的定向认证测试，不重新扫描并发明一套新计划，也不把验证扩大成完整回归。测试失败
时，Task 回到对应实现工作；测试通过后，进入开发者理解确认。

理解确认要求当前实现能够被解释和维护。若需要修改仓库进行重构，Task 会重新经过 `TEST`。

## 5. 完成理解确认和交付

测试记录与理解确认都对应当前实现后，Task 进入交付并最终到达 `DONE`。如果中途发现需求、范围或
实现发生实质变化，旧的下游记录不会继续充当当前结果。

## 较短的 Recovery 场景

另一个常见中断发生在 Dev Flow Action 提交时：Host 已发出写请求，但响应丢失或被截断。此时
Adapter 不直接重复提交，而是用 Task ID 和 Action ID 读取当前 Task 与 Recovery 状态，再按照结果
继续、恢复、阻塞或安全重试。

这只适用于 Dev Flow 可以识别和记录的 Action。它不表示 Dev Flow 能恢复任意 Host 文件写入、shell
命令或外部系统副作用。

## 当前记录分别说明什么

以下是相互独立的记录路径，每一项只说明表格中的范围：

| 记录 | 说明的范围 |
| --- | --- |
| [PR #8 的 Codex 状态图验收](https://github.com/Innocent-children/dev-flow/pull/8) | 真实 Codex 旅程覆盖重启、重构、重新测试、理解确认、交付和 Core `DONE` |
| [Support Matrix](SUPPORT-MATRIX.md) | 哪些稳定 registry package 与 Host 环境具有最终生命周期记录 |

不同 Journey 分别说明不同能力；不要把多份记录描述成一次运行证明全部能力。源码测试也不等于
最终公开制品支持。稳定、源码和未验证内容见 [Project Status](PROJECT-STATUS.md)。

## 试用稳定入口

```bash
npm install -g @imotong/dev-flow@latest
dev-flow
```

安装后使用 Codex 的 `$dev-flow-codex:dev-flow` 或 DeepSeek Harness 的 `/dev-flow` selector。Host
差异和完整命令见 [Codex 使用说明](../packages/codex/README.md)、
[DeepSeek 使用说明](../packages/deepseek/README.md)和[命令参考](COMMANDS.md)。
