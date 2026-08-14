# Dev Flow 产品定义

> **文档状态**：本文保留 Feature 002–006 的后续产品目标，不表示这些能力已由 Feature
> 001 交付。Feature 001 仅建立 Monorepo、私有产品包和 help/version 工程骨架；下文的
> 状态机、SQLite、MCP、Codex/DeepSeek 产品行为、可分发 Runtime、安装、升级、卸载和
> 发布均未实现。后续实现必须以届时的活动 Feature 规格为准。

## 一句话定义

Dev Flow 是面向 AI 编程宿主的本地开发流程控制器：它通过明确的任务合同、统一状态机、
验证预算和恢复语义规范开发过程，并在会话或进程中断后安全继续任务。

## 用户

首要用户是使用 Codex 或 DeepSeek Harness 完成真实代码任务的个人开发者。用户希望：

- AI 在开始实现前明确目标、范围和验收标准；
- AI 按可解释的阶段推进，而不是随意扩展工作；
- 测试和审查规模与任务风险匹配；
- 会话关闭、宿主重启或调用响应丢失后能够继续；
- 冲突或仓库漂移时安全停止，而不是猜测或重放副作用。

## 产品职责

Dev Flow 负责：

1. 创建和恢复任务；
2. 持久化任务合同与当前阶段；
3. 选择唯一权威的下一动作；
4. 记录阶段结果、用户决定和验证证据；
5. 控制一个仓库的活动任务归属；
6. 识别仓库漂移和不确定完成；
7. 生成最终交付结果。

Dev Flow 不负责直接编写代码。Codex 或 DeepSeek 使用自身文件、Shell、搜索和 Git 工具
完成当前动作。

## 产品组成

```text
                         Dev Flow Core
                  Go workflow + recovery + store
                              │
                       local STDIO MCP
                    ┌─────────┴─────────┐
                    │                   │
             dev-flow-codex      dev-flow-deepseek
               $dev-flow             /dev-flow
```

两个产品共享：

- 任务模型；
- 状态机；
- MCP 工具与错误码；
- SQLite 存储；
- 仓库观察规则；
- 恢复分类；
- 终态结果。

两个产品分别拥有：

- 安装与宿主注册；
- Skill 文案；
- 显式调用语法；
- 宿主结果投影；
- 宿主级真实验收。

## 首版任务合同

每个任务至少包含：

```text
goal
repository_root
scope
out_of_scope
acceptance_criteria
verification_budget
origin_host
```

合同在首版中不可静默修改。需求发生实质变化时，当前任务停止，由用户决定取消或创建新
任务。

## 首版流程

```text
INTAKE
→ ASSESS
→ PLAN
→ IMPLEMENT
→ VERIFY
→ REVIEW
→ HANDOFF
→ DONE
```

异常状态：

```text
BLOCKED
CANCELLED
```

所有任务使用同一条流程。小任务通过简短计划和较低验证预算保持轻量；高风险任务通过更
严格的阶段义务增加控制，不增加第二套状态机。

## 首版功能

- 显式 `$dev-flow` 与 `/dev-flow`；
- 单个现有 Git 仓库；
- 一个仓库最多一个活动任务；
- 本地 STDIO MCP；
- SQLite 持久化；
- 进程与宿主重启恢复；
- revision 乐观锁；
- Git 分支、`HEAD` 和工作树指纹观察；
- 阶段级下一动作；
- 验证预算；
- 任务取消；
- 最终交付报告。

## 首版非目标

- 多仓库任务；
- 自动创建或切换分支/worktree；
- commit、push、PR、Tag、Release；
- 隐式触发；
- Web UI；
- HTTP/SSE/远程 MCP；
- 多 Agent 或并行执行器；
- 通用 Shell MCP；
- 自定义工作流 DSL；
- 运行时集成 Spec Kit；
- 自动跨宿主接管；
- 遥测、账号体系或远程服务；
- 未经真实验收的平台支持声明。

## 成功定义

首版成功不是功能数量，而是以下闭环在两个产品上都成立：

```text
显式启动任务
→ 查看当前动作
→ 完成并记录阶段
→ 关闭宿主或进程
→ 重新打开
→ 找回同一任务
→ 核对仓库现实
→ 继续执行
→ 在验证预算内完成
→ 获得可信交付结果
```

## 产品判断原则

### 为什么使用 Go Core

核心是本地状态控制器，需要强类型、单二进制分发、跨平台构建、STDIO、事务存储和清晰
并发语义。Go 可以减少运行时安装负担，并保持实现直接。

### 为什么使用 SQLite

任务需要事务、唯一仓库 claim、revision 检查、重启恢复和可查询状态。SQLite 提供一
个明确的数据权威，不需要同时维护多组状态文件、索引和锁协议。

### 为什么允许 DeepSeek Proxy

若 DeepSeek Harness 需要稳定的文本结果投影，可使用极薄的 TypeScript Proxy。Proxy
只处理宿主兼容，不拥有工作流规则。

### 为什么只有一个 Core

两个宿主面对的是同一个产品问题。共享 Core 可以保证状态、恢复和完成语义一致，避免
宿主适配层逐渐形成不同产品。
