# Dev Flow Spec Kit 文档基线

这是一套用于开发 Dev Flow Monorepo 的仓库级 Spec Kit 文档。

目标产品由一个宿主无关的 Go 流程内核和两个独立发布产品组成：

```text
Dev Flow Core
├── dev-flow-codex
└── dev-flow-deepseek
```

## 文档范围

本包包含：

- 项目 Constitution；
- 产品定义、架构边界、发布原则和发展路线；
- `001-bootstrap-monorepo` 的完整 Spec Kit 文档；
- `002-govern-and-resume-single-repository-task` 的完整 Spec Kit 文档；
- `003` 至 `006` 的完整功能规格；
- 后续功能的计划准入规则；
- 可直接交给 Codex 执行的 Spec Kit 工作流说明。

`003` 至 `006` 暂不包含 `plan.md`、`tasks.md` 等实施产物。这是有意的：
它们必须在前置功能真实完成、公共合同稳定后，再由当时的技术现实生成，避免提前设计
尚未被验证的实现。

## 工具链兼容策略

仓库只声明最低版本或兼容主版本范围，不把某个补丁版本写成验收条件：

- Spec Kit：初始化和更新时使用官方最新稳定版；
- Go：`>= 1.26`；
- Node.js：`>= 24`，并且仍处于官方支持周期；
- pnpm：`>= 11 < 12`。

`go.sum`、`pnpm-lock.yaml` 和发布清单可以记录实际解析版本，用于复现与审计；仓库验证不得因为兼容的补丁或次版本升级而失效。主版本升级仍应作为独立变更审查。

## 初始化仓库

```bash
mkdir dev-flow
cd dev-flow
git init

uv tool install specify-cli
specify self check
# 若 check 报告存在更新：
specify self upgrade

specify init --here \
  --integration codex \
  --script sh
```

Windows 开发机使用：

```powershell
specify init --here --integration codex --script ps
```

Codex integration 会生成 `.agents/skills/speckit-*/SKILL.md`。这些文件由 Spec Kit
管理，不包含在本基线中，也不得手工修改。

完成初始化后，把本包内容合并到仓库根目录。若 `.specify/memory/constitution.md`
已经由初始化生成，以本包版本覆盖它；不要覆盖 `.specify/scripts/`、
`.specify/templates/` 或 `.agents/skills/`。

## 激活功能目录

Spec Kit 通过其管理的 `.specify/feature.json` 或
`SPECIFY_FEATURE_DIRECTORY` 选择当前功能，不是仅靠 Git 分支名。对于本包已经写好的
规格，优先在启动 Codex 前设置环境变量，不要猜测或手写 `feature.json` 的内部格式：

```bash
export SPECIFY_FEATURE_DIRECTORY="specs/001-bootstrap-monorepo"
```

切换到 `002` 时必须显式更新该值。以后通过 `$speckit-specify` 创建的新功能，由 Spec
Kit 自行更新 `.specify/feature.json`。

## 标准开发顺序

本项目对每个生产功能使用完整路径：

```text
constitution
→ specify
→ clarify
→ plan
→ checklist
→ tasks
→ analyze
→ implement
→ converge
```

本包已经提供 Constitution、规格、计划和任务时，不要重新运行 `specify` 覆盖现有文档。
先执行人工审查，然后运行：

```text
$speckit-clarify
$speckit-checklist
$speckit-analyze
```

只有三者没有未解决的阻塞项后，才进入分阶段实施。

## 分阶段实施规则

禁止一次执行整个 `tasks.md`。每次只实施一个可独立验证的阶段：

```text
$speckit-implement
只实施 tasks.md 的 Phase 1；完成后停止，报告变更和验证结果。
```

下一轮再实施 Phase 2 或一个用户故事。每个阶段结束后：

1. 执行该阶段明确列出的定向检查；
2. 不自动扩大测试范围；
3. 更新任务复选框；
4. 停止并报告；
5. 必要时运行 `$speckit-converge`，只追加真实遗漏任务。

## 文档索引

- [项目 Constitution](.specify/memory/constitution.md)：不可绕过的项目原则
- [产品定义](docs/PRODUCT.md)：产品职责与首版边界
- [架构边界](docs/ARCHITECTURE.md)：Monorepo 与依赖方向
- [发展路线](docs/ROADMAP.md)：从项目骨架到 1.0 的演进门禁
- [Spec Kit 工作流](docs/SPEC-KIT-WORKFLOW.md)：规格与分阶段实施规范
- [双产品发布策略](docs/RELEASE-STRATEGY.md)：独立安装和同步发布原则
- [功能依赖关系](docs/FEATURE-DEPENDENCIES.md)：规格依赖和并行条件
- [工具链兼容策略](docs/TOOLCHAIN-BASELINES.md)：最低版本、兼容范围和重验规则
- [001：Monorepo 工程基础](specs/001-bootstrap-monorepo/spec.md)
- [002：单仓库流程治理与任务恢复](specs/002-govern-and-resume-single-repository-task/spec.md)
- [003：Codex 显式 Dev Flow](specs/003-codex-explicit-dev-flow/spec.md)
- [004：DeepSeek 显式 Dev Flow](specs/004-deepseek-explicit-dev-flow/spec.md)
- [005：不确定动作与仓库漂移恢复](specs/005-recover-uncertain-actions-and-drift/spec.md)
- [006：两个可安装产品的发布](specs/006-publish-two-installable-products/spec.md)
