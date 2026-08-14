# Dev Flow 架构与边界

## 目标结构

```text
dev-flow/
├── cmd/dev-flow/                  # 单一 Go 二进制入口
├── internal/
│   ├── domain/                    # 任务、合同、阶段、动作、错误
│   ├── workflow/                  # 转换与阶段义务
│   ├── recovery/                  # 持久状态与外部现实核对
│   ├── repository/                # Git 只读观察
│   ├── store/                     # SQLite 与迁移
│   ├── application/               # 用例协调与事务边界
│   └── mcp/                       # STDIO MCP Adapter
├── packages/
│   ├── codex/                     # Codex 产品
│   └── deepseek/                  # DeepSeek 产品
├── protocol/                      # 共享 fixture、Schema 与错误说明
├── tests/                         # Core、合同与宿主 journey
├── release/                       # 构建、打包与发布工具
├── .specify/                      # 根级 Spec Kit 项目
└── specs/                         # 统一 feature 序列
```

## 运行时关系

```text
Codex Skill ───────────────────┐
                               ▼
                         Go STDIO MCP
                               ▼
                       Application Service
                        ┌──────┴──────┐
                        ▼             ▼
                 Workflow Core   Recovery Core
                        │             │
                        └──────┬──────┘
                               ▼
                         Domain Model
                        ┌──────┴──────┐
                        ▼             ▼
                    SQLite Store  Git Observer
                               ▲
                               │
DeepSeek Skill → optional TS Proxy
```

## 依赖方向

允许的依赖方向：

```text
host adapters → MCP adapter → application → domain/workflow/recovery
application → store/repository ports
store/repository implementations → standard library and approved dependencies
```

禁止的依赖：

- `domain` 依赖 MCP、CLI、SQLite、Git 或宿主包；
- `workflow` 直接执行 Git、SQL 或进程；
- `store` 决定流程转换；
- `repository` 修改 Git；
- `mcp` 直接拼装状态转换；
- `packages/codex` 与 `packages/deepseek` 互相依赖；
- Adapter 绕过 Application Service 写数据库。

## Domain

Domain 定义稳定业务概念：

- `Task`；
- `TaskContract`；
- `RepositoryBinding`；
- `Phase`；
- `Action`；
- `VerificationBudget`；
- `EvidenceSummary`；
- `LastOperation`；
- `RecoveryClassification`；
- `Outcome`；
- 领域错误码。

Domain 对外部技术无感知，所有结构都必须可序列化、可验证、字段有界。

## Workflow

Workflow 负责：

- 当前阶段允许什么动作；
- 动作结果满足什么义务；
- 合法和非法转换；
- 返工路径；
- `DONE`、`BLOCKED`、`CANCELLED` 规则；
- 下一动作的确定性计算。

首版使用显式 Go 代码和表驱动测试，不引入状态机框架或配置 DSL。

## Recovery

Recovery 接收：

- 持久任务；
- `last_operation`；
- 当前仓库观察；
- 可验证的宿主结果摘要。

输出五类分类之一以及安全恢复指令。Recovery 自身不写数据库；Application Service 在
事务中应用其决定。

## Repository Observer

首版只执行只读 Git 命令，获取：

```text
canonical_root
git_common_dir
branch
head
status_fingerprint
observed_at
```

Observer 不解释流程，只返回事实或有界错误。

## Store

SQLite 是当前任务状态权威。首版表：

```text
schema_migrations
tasks
task_events
repository_claims
```

一次 mutation 在一个事务中完成：

```text
检查 expected revision
→ 检查 repository claim
→ 写入新任务快照
→ 追加事件
→ 更新 claim
→ commit
```

不采用完整 Event Sourcing；`tasks` 是当前权威，`task_events` 用于审计和恢复诊断。

## Application Service

Application Service 是唯一用例协调层，负责：

- 开启/恢复任务；
- 加载任务和仓库观察；
- 调用 Workflow 或 Recovery；
- 执行事务性 mutation；
- 返回领域结果。

CLI 与 MCP 都调用同一 Application Service。

## MCP Adapter

MCP Adapter：

- 注册固定工具；
- 使用闭合输入 Schema；
- 限制字段大小和列表数量；
- 将领域结果映射到统一结果信封；
- 只通过 stderr 输出不含任务数据的诊断；
- 支持本地 STDIO。

MCP Adapter 不拥有任务选择和状态转换规则。

## Codex Adapter

Codex 产品包含：

- npm 分发入口；
- Codex plugin manifest；
- `.mcp.json`；
- 一个 `dev-flow` Skill；
- 包内平台 Runtime；
- 显式 setup/remove；
- 宿主合同和真实 journey。

Codex 直接调用 Go MCP，不增加 Node Proxy。

## DeepSeek Adapter

DeepSeek 产品包含：

- DSH bundle/patch；
- 一个 `dev-flow` Skill；
- 包内平台 Runtime；
- 必要时的轻量 TypeScript Projection Proxy；
- 宿主合同和真实 journey。

Proxy 只允许转发工具、限制白名单、投影结果并处理关闭/取消。

## 数据目录

两个产品默认使用统一的用户级 Dev Flow 数据根，以避免同一仓库被两个不相知的任务同时
控制。推荐平台路径：

```text
macOS:   ~/Library/Application Support/dev-flow/
Linux:   ${XDG_DATA_HOME:-~/.local/share}/dev-flow/
Windows: %LOCALAPPDATA%\dev-flow\
```

首版任务记录 `origin_host`。另一宿主发现活动任务时返回冲突，不自动接管。

## 安全边界

Dev Flow 不是操作系统沙箱。安全边界来自：

- 小而闭合的 MCP 工具面；
- 无通用 Shell MCP；
- Core 只读观察 Git；
- expected revision；
- repository claim；
- 不确定 mutation 的 read-after-write；
- 字段、结果和诊断大小限制；
- 明确的宿主与用户授权边界。

## 暂不抽象

首版不设计：

- 通用 `HostAdapter` 框架；
- workflow plugin registry；
- 多数据库后端；
- 远程 Store；
- 事件总线；
- 多租户；
- 通用策略语言；
- UI read model 平台。

只有实际出现第二个实现或重复需求后，才从现有代码中提取抽象。
