# 功能依赖关系

## 当前批准路线

```text
001-bootstrap-monorepo
          │
          ▼
002-govern-and-resume-single-repository-task
          │
          ▼
003-codex-explicit-dev-flow
          │
          ▼
005-recover-uncertain-actions-and-drift
          │
          ▼
006-publish-codex-installable-product
```

DeepSeek 路线被显式延期，不再阻塞上述 Codex 路线：

```text
002 / current main
          │
          ▼
004-deepseek-explicit-dev-flow   [DEFERRED]
          │
          ▼
future DeepSeek publication feature
```

## 路线规则

### 003 → 005

Feature 005 必须从已合并 003 的 `main` 开始，使用：

- Core Contract 0.1；
- 003 已交付的 Codex Skill 与 read-before-retry 行为；
- 003 的真实创建、重启、恢复与完成证据；
- 确定性的 Core/Store/MCP/repository 测试。

005 不修改公共 MCP、状态机、稳定错误、恢复分类或 SQLite Schema，因此无需等待 004。
若实施过程中发现必须修改公共语义，005 必须停止并先修订规格；此时 Constitution 的双宿主
合同一致性门禁重新生效。

### 005 → 006

Feature 006 必须从已合并 003 和 005 的 `main` 开始。006 只发布
`dev-flow-codex`，不修改或发布 `dev-flow-deepseek`。

首个公开支持范围只有完成最终制品 journey 的 macOS arm64 与实际 Codex 版本/兼容范围。
发布过程不得把模拟、交叉编译或本地源码包提升为公开支持证据。

### 004 延期

004 的完整规划资产保留，但当前不实施。它恢复时必须重新核验当时的官方 Harness 稳定制品
与宿主能力，不能直接依赖 2026-08 的 RC 假设。

004 完成后，通过 standalone release command 选择合格模式并公开第二个产品；不得新建发布
Feature，也不得把 DeepSeek 发布重新塞回已完成的 006。

## 规格成熟度

| Spec | 当前产物 | 实施/完成门禁 |
|---|---|---|
| `001` | 完整 Spec Kit + implementation | 已完成 |
| `002` | 完整 Spec Kit + Core implementation | 已完成并冻结 Core Contract 0.1 |
| `003` | 完整 Spec Kit + Codex implementation branch | 合并到 `main` 后进入 005 |
| `004` | 完整规划包 | **延期**；恢复时重新核验 Harness |
| `005` | 完整 Spec Kit | 003 已合并；禁止公共合同变化 |
| `006` | 完整 Spec Kit | 003/005 已合并；npm/GitHub 权限与包名预检通过 |

## 并行与公共合同规则

- 005 的不同测试故事可在共享测试辅助稳定后并行；
- 006 只能在 005 合并后开始，避免发布后再改变恢复核心；
- 004 可以在未来独立恢复，但不得从旧分支覆盖已发布 Codex 合同；
- 任一 Feature 修改公共任务语义、MCP Schema、错误码、Result Envelope、状态转换或 SQLite
  模型时，必须重新满足双宿主 fixture 一致性，而不能用“004 已延期”绕过。
