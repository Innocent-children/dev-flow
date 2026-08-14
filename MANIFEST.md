# 初始治理与规格基线清单

本文件记录 Monorepo 启动时纳入版本控制的治理文档和规格基线，不是当前 checkout 的完整
实现文件清单、npm 打包清单或发布 manifest。Feature 001 的权威布局合同位于
`specs/001-bootstrap-monorepo/contracts/repository-layout.md`；Spec Kit 生成资产的精确文件
集合也不由本清单固定。

## Feature 001 主要交付索引

- 根治理与元数据：`README.md`、`AGENTS.md`、`LICENSE`、`VERSION`、`.gitignore`；
- 单一 Go 边界：`go.mod`、`cmd/dev-flow/`、`internal/version/`；
- 单一 pnpm Workspace：`package.json`、`pnpm-workspace.yaml`、`pnpm-lock.yaml`；
- 两个私有产品骨架：`packages/codex/`、`packages/deepseek/`；
- 保留所有权区域：`protocol/fixtures/`、`release/`、`scripts/`；
- 有界合同与 fixture：`tests/contract/`；
- 本地与 PR 共用验证：`scripts/validate-repository.sh`、`.github/workflows/ci.yml`；
- 唯一 Spec Kit 根：`.specify/`、`.agents/skills/speckit-*/`、`specs/`。

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

## 可直接实施的完整功能包

### 001-bootstrap-monorepo

- `spec.md`
- `plan.md`
- `research.md`
- `data-model.md`
- `quickstart.md`
- `contracts/repository-layout.md`
- `checklists/requirements.md`
- `tasks.md`

### 002-govern-and-resume-single-repository-task

- `spec.md`
- `plan.md`
- `research.md`
- `data-model.md`
- `quickstart.md`
- `contracts/mcp-tools.md`
- `contracts/result-envelope.schema.json`
- `contracts/state-machine.md`
- `checklists/requirements.md`
- `tasks.md`

## 路线功能规格

- `003-codex-explicit-dev-flow/spec.md`
- `004-deepseek-explicit-dev-flow/spec.md`
- `005-recover-uncertain-actions-and-drift/spec.md`
- `006-publish-two-installable-products/spec.md`

每个路线功能目录都有 `README.md`，说明为什么计划和任务必须延后生成。
