# 治理与规格资产清单

本文件索引仓库中的治理文档和 Spec Kit 功能包，不是当前 checkout 的完整源码、npm
allowlist 或 Release manifest。

## 项目治理

- `.specify/memory/constitution.md`
- `AGENTS.md`
- `docs/PRODUCT.md`
- `docs/ARCHITECTURE.md`
- `docs/ROADMAP.md`
- `docs/SPEC-KIT-WORKFLOW.md`
- `docs/RELEASE-STRATEGY.md`
- `docs/FEATURE-DEPENDENCIES.md`
- `docs/TOOLCHAIN-BASELINES.md`

## 完整 Spec Kit 功能包

### `001-bootstrap-monorepo`

- `spec.md`
- `plan.md`
- `research.md`
- `data-model.md`
- `quickstart.md`
- `contracts/`
- `checklists/requirements.md`
- `tasks.md`

### `002-govern-and-resume-single-repository-task`

- `spec.md`
- `plan.md`
- `research.md`
- `data-model.md`
- `quickstart.md`
- `contracts/`
- `checklists/requirements.md`
- `tasks.md`

### `003-codex-explicit-dev-flow`

完整规划与实施跟踪包；产品实现位于独立 003 分支，合并后成为 005 的入口基线。

### `004-deepseek-explicit-dev-flow`

完整规划包，当前状态为 **DEFERRED**。保留用于未来重新核验和实施，不再阻塞 005/006。

### `005-recover-uncertain-actions-and-drift`

- `README.md`
- `spec.md`
- `plan.md`
- `research.md`
- `data-model.md`
- `quickstart.md`
- `contracts/recovery-hardening.md`
- `contracts/test-failure-model.md`
- `checklists/requirements.md`
- `tasks.md`

### `006-publish-codex-installable-product`

- `README.md`
- `spec.md`
- `plan.md`
- `research.md`
- `data-model.md`
- `quickstart.md`
- `contracts/codex-public-package.md`
- `contracts/release-process.md`
- `contracts/release-manifest.schema.json`
- `contracts/publication-record.schema.json`
- `checklists/requirements.md`
- `tasks.md`

旧的 `006-publish-two-installable-products` 已被 Codex-only 首发规格取代。DeepSeek 发布将在
Feature 004 完成后使用新的独立 Feature。

## 主要实现边界

- 根治理与元数据：`README.md`、`AGENTS.md`、`LICENSE`、`VERSION`；
- Core：`cmd/dev-flow/`、`internal/`、`protocol/fixtures/`；
- Host 产品：`packages/codex/`、`packages/deepseek/`；
- 合同与 journey：`tests/contract/`、`tests/journeys/`；
- 发布实现保留区：`release/`、`scripts/`；
- Spec Kit：一个根 `.specify/`、`.agents/skills/speckit-*`、`specs/`。
