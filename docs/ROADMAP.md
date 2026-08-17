# Dev Flow 发展路线

路线图按能力门禁推进，不按日历承诺。当前批准路线优先交付可用的 Codex 产品；DeepSeek
Harness 产品保留但延期。

## Stage 0：Monorepo 工程基础

**规格**：`001-bootstrap-monorepo`

已交付根级 Spec Kit、Constitution、Go module、pnpm workspace、Core/Codex/DeepSeek 责任
边界、单一版本源与有界 CI。

## Stage 1：共享流程内核 MVP

**规格**：`002-govern-and-resume-single-repository-task`

用户闭环：

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

已交付单仓库、单状态机、六个 MCP 工具、SQLite、revision、repository claim、验证预算、
只读 Git 指纹、基础五类恢复和本地 STDIO，并冻结 Core Contract 0.1。

## Stage 2：Codex 产品 MVP

**规格**：`003-codex-explicit-dev-flow`

用户闭环：

```text
安装本地产品
→ $dev-flow 启动真实任务
→ 完成阶段
→ 关闭 Codex
→ 新会话恢复
→ Core DONE
→ 删除产品且保留任务数据
```

退出条件：

- 一个私有本地包携带一个 Runtime、Plugin、Skill 和 MCP；
- 普通请求不进入 Dev Flow；
- Core 保持唯一流程权威；
- 重启后恢复同一任务；
- setup/remove 边界与 retained data 通过；
- 最终真实 Codex acceptance 通过；
- 003 合并到 `main`。

## Stage 3：恢复加固

**规格**：`005-recover-uncertain-actions-and-drift`

005 不再等待 DeepSeek。它在已合并 Codex 产品与 Core Contract 0.1 上证明：

- mutation 提交后结果丢失；
- pre-commit 失败；
- 响应截断与写入失败；
- completed-and-recorded / completed-but-unrecorded；
- partial / conflicting；
- branch、HEAD、tracked/untracked、路径和 repository identity 漂移；
- 两个 Core handle 并发恢复。

退出条件：

- 五种既有恢复分类都有确定性测试；
- 不确定 mutation 必须 read-before-retry；
- 提交后结果丢失只产生一次 revision/event；
- 冲突读取零写入；
- 两个 handle 最多一个提交；
- 不新增 MCP 工具、状态、恢复类、Schema 或生产故障开关；
- `packages/deepseek/` 不变。

## Stage 4：Codex 首个公开 0.x Release

**规格**：`006-publish-codex-installable-product`

用户闭环：

```text
npm install -g dev-flow-codex
→ 显式 setup
→ $dev-flow 创建任务
→ Codex 重启与恢复
→ Core DONE
→ 显式 remove
→ npm uninstall
→ retained task 仍可读取
```

首版边界：

- 产品：仅 `dev-flow-codex`；
- 平台：仅 macOS arm64；
- 制品：一个 npm 包，内含一个 Go Runtime；
- 发布：显式 operator 流程，不由 PR CI 发布；
- 完整性：一个版本、一个 source commit/tree、一个 Tag、一个 Draft/Release；
- 远端 npm/GitHub 制品全部下载回读；
- 最终 journey 必须使用 registry package；
- 失败保留真实 publication record，不伪造回滚。

退出条件：

- 两次干净构建的 Runtime 与标准化包内容一致；
- public package allowlist、模式、版本、Core identity 通过；
- npm/GitHub read-back 通过；
- 最终 registry-package Codex journey 通过；
- removal/uninstall 保留任务数据；
- Release 只声明实际验证的平台与 Host；
- DeepSeek 不被发布或宣称支持。

## 延期路线：DeepSeek 产品

**规格**：`004-deepseek-explicit-dev-flow`  
**状态**：DEFERRED

恢复条件：

- 使用当时官方稳定 Harness，而不是沿用旧 RC 假设；
- 宿主能满足修订后的显式调用与完整结果合同；
- 从当前 `main` 重新评估 package/profile/MCP 行为；
- 保持 Core 与已发布 Codex 兼容；
- 完成独立真实 Harness journey；
- 通过新的 DeepSeek 发布 Feature 公开产品。

004 的延期不降低未来 DeepSeek 质量门禁，也不阻塞当前 Codex 0.x 路线。

## MVP 后候选能力

只有真实使用达到准入条件时才建立新规格：

- 合同修订与 verification budget delta；
- 只读 doctor；
- 用户授权的跨宿主 handoff；
- Linux、Windows 或其他架构；
- 只读任务检查；
- 签名、notarization 或供应链透明度；
- 多平台 Runtime 包拆分。

## 1.0.0 门禁

`1.0.0` 仍要求：

- Codex 与 DeepSeek 两个产品都可公开安装；
- 两个宿主都有真实创建、重启、恢复、完成与删除证据；
- 公共 MCP、Result Envelope、Recovery 与 SQLite 升级政策稳定；
- 不确定 mutation 恢复经过真实使用验证；
- Adapter 不复制状态机或任务存储；
- Core 不操作用户 Git；
- 安装、升级和删除不会丢失任务；
- 每个支持平台都有最终制品证据；
- 真实使用证明流程治理与恢复具有稳定价值。

Codex-only `0.x` Release 是通往 1.0 的阶段性交付，不等于放弃第二个产品。
