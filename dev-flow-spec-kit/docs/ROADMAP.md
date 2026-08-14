# Dev Flow 发展路线

路线图按能力门禁推进，不按日历承诺。每一阶段必须先证明用户闭环，再进入下一阶段。

## Stage 0：Monorepo 工程基础

### 对应规格

`001-bootstrap-monorepo`

### 目标

- 根级 Spec Kit；
- Constitution 与 AGENTS；
- 一个 Go module；
- 一个 pnpm workspace；
- Core、Codex、DeepSeek 责任目录；
- 单一版本源；
- 最小可运行 Go 命令；
- 两个可本地 pack 的产品骨架；
- 有界 CI。

### 退出条件

- 仓库布局合同通过；
- `go test ./...` 可执行；
- `pnpm install --frozen-lockfile` 可执行；
- 两个 package 可本地 `pack`；
- CI 只验证工程基础，不伪造产品行为；
- Spec Kit 能激活 `002`。

---

## Stage 1：共享流程内核 MVP

### 对应规格

`002-govern-and-resume-single-repository-task`

### 用户闭环

```text
创建任务
→ 获取下一动作
→ 提交阶段结果
→ 退出进程
→ 重启
→ 恢复任务
→ 继续流程
→ 完成交付
```

### 能力

- 单仓库；
- 单状态机；
- 六个 MCP 工具；
- SQLite 当前状态；
- revision；
- repository claim；
- origin host；
- 验证预算；
- Git 只读指纹；
- 基础恢复；
- 本地 STDIO。

### 退出条件

- 临时 Git 仓库中的 Core journey 通过；
- 合法和非法转换均有定向测试；
- 过期 revision 和 claim 冲突被拒绝；
- 进程重启后任务一致；
- MCP contract fixture 稳定；
- 无宿主代码参与 Core 验收。

完成后冻结 `Core Contract 0.1`。

---

## Stage 2A：Codex 产品 MVP

### 对应规格

`003-codex-explicit-dev-flow`

### 用户闭环

```text
安装产品
→ $dev-flow 启动真实任务
→ 完成至少两个阶段
→ 关闭 Codex
→ 新会话恢复
→ 完成任务
→ 删除产品且保留任务数据
```

### 范围

- 显式触发；
- 一个 Skill；
- 直接连接 Go MCP；
- 包内 Runtime；
- 显式 setup/remove；
- 一个最终包真实 journey。

### 退出条件

- 不依赖目标仓库额外规则；
- Skill 不定义状态机；
- Codex 遵守验证预算；
- 重启后恢复同一任务；
- 安装与删除边界清楚。

---

## Stage 2B：DeepSeek 产品 MVP

### 对应规格

`004-deepseek-explicit-dev-flow`

### 用户闭环

```text
安装产品
→ /dev-flow 启动真实任务
→ 完成至少两个阶段
→ 重启 DeepSeek Harness
→ 恢复
→ 完成任务
→ 删除产品且保留任务数据
```

### 范围

- 显式触发；
- 一个 Skill；
- DSH bundle；
- 仅在宿主需要时使用轻量 Projection Proxy；
- 包内 Runtime；
- 一个最终包真实 journey。

### 退出条件

- Proxy 不含业务规则；
- 工具面与共享 fixture 一致；
- DeepSeek 能消费完整权威结果；
- 重启后恢复同一任务；
- 删除插件不删除任务数据。

`Stage 2A` 与 `Stage 2B` 可并行，但不能分别扩展 Core Contract。

---

## Stage 3：恢复加固

### 对应规格

`005-recover-uncertain-actions-and-drift`

### 目标

根据两个真实宿主暴露的恢复边界覆盖：

- mutation 提交后响应丢失；
- 进程崩溃；
- revision 冲突；
- branch/HEAD/工作树漂移；
- 同仓库被另一宿主占用；
- completed-but-unrecorded；
- partial；
- conflicting。

### 退出条件

- 五种恢复分类均有端到端测试；
- 不确定 mutation 不会自动重放；
- 冲突时不修改任务或仓库；
- 两个宿主遵循同一恢复指令；
- 没有为恢复场景增加第二套流程。

---

## Stage 4：双产品首发

### 对应规格

`006-publish-two-installable-products`

### 目标

从一个源码身份发布两个可独立安装的产品。

### 退出条件

- 两个产品自包含；
- 任一产品可独立安装和运行；
- 版本、Tag、Runtime 和 package identity 一致；
- 最终资产经过上传后 read-back；
- 两个最终包真实宿主 journey 完成；
- `v0.1.0` 只声明已验证平台。

---

## v0.2.x 候选：只按真实使用进入

### 合同修订

准入条件：至少三个真实任务需要在不中止任务的情况下修改范围、验收或验证预算。

可能能力：

- 用户批准的 contract delta；
- 证据失效规则；
- 重新计划；
- 验证预算调整。

先评估能否通过现有工具表达，再决定是否增加 MCP 工具。

### Doctor 与可诊断性

准入条件：至少三次安装、启动或数据问题无法通过现有错误定位。

Doctor 必须只读，可检查：

- Runtime/package identity；
- 数据库可读性；
- Skill/MCP path；
- repository claim；
- 宿主注册状态。

### 跨宿主显式 Handoff

准入条件：至少三个真实任务需要从 Codex 切换至 DeepSeek 或反向。

可能能力：

- 用户明确授权的 owner transfer；
- 当前任务与仓库 read-back；
- 动作重新投影；
- handoff 记录。

始终禁止自动接管。

### Linux 与 Windows 正式支持

每个平台单独建立规格并完成最终包 journey。交叉编译和 CI 通过不能单独构成用户支持
证据。

### 只读任务检查

准入条件：用户持续需要在宿主外查看活动任务、阻塞原因和最终结果。

优先提供有界 CLI 读取命令，不直接建设 Web UI。

---

## 1.0.0 门禁

`1.0.0` 只有在以下条件全部满足后进入：

- 两个产品可公开安装；
- 两个宿主都有真实创建、重启、恢复和完成证据；
- 公共 MCP 工具与结果合同稳定；
- SQLite Schema 有明确升级政策；
- 不确定 mutation 恢复经过真实验证；
- Adapter 未复制状态机或任务存储；
- Core 未操作用户 Git；
- 安装、升级和删除不会丢失任务；
- 每个支持平台都有最终包证据；
- 真实使用证明流程治理和恢复带来稳定价值。
