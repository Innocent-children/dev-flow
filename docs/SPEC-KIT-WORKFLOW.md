# Spec Kit 工作流规范

## 版本和初始化

项目使用 Spec Kit 官方最新稳定版，不在项目文档中固定补丁版本：

```bash
uv tool install specify-cli
specify self check
# 若 check 报告存在更新：
specify self upgrade

specify init --here --integration codex --script sh
```

Windows 使用 `--script ps`。

初始化后记录实际使用版本作为开发证据，但不把版本相等比较写入验收或 CI。升级只有在实际命令、生成目录或工作流行为变化时，才需要更新 `docs/TOOLCHAIN-BASELINES.md` 与当前功能的 `research.md`。

## 一个根项目

Monorepo 只在根目录放置一个 `.specify/`。`packages/codex` 和
`packages/deepseek` 不初始化自己的 Spec Kit 项目。

这样可以保持：

- 一份 Constitution；
- 一套 feature 编号；
- 一个 Core 与 Adapter 变更视图；
- 公共合同变更可同时约束两个产品。

## 选择活动功能

Spec Kit 可通过 `.specify/feature.json` 或环境变量选择活动功能。对预先准备的功能目录，
建议在启动 Codex 前设置：

```bash
export SPECIFY_INIT_DIR="$PWD"
export SPECIFY_FEATURE_DIRECTORY="specs/001-bootstrap-monorepo"
```

Git 分支和 Spec Kit feature selection 是两件事。每个 worktree/进程都要选择正确的
feature 目录。

## 新功能完整流程

### 1. Specify

```text
$speckit-specify
```

描述用户问题、行为、边界和可测结果。不要提前固定目录、驱动或 SDK 版本。

### 2. Clarify

```text
$speckit-clarify
```

解决会影响范围、验收、数据边界、错误行为和用户授权的问题。实现偏好留到 plan。

### 3. Plan

```text
$speckit-plan
```

计划应产生：

```text
plan.md
research.md
data-model.md
quickstart.md
contracts/
```

计划前后均需执行 Constitution Check。

### 4. Checklist

```text
$speckit-checklist
```

Checklist 检查需求质量：是否明确、完整、一致、可验证。它不是代码完成清单。

### 5. Tasks

```text
$speckit-tasks
```

任务必须：

- 使用具体文件路径；
- 按用户故事或基础阶段分组；
- 标记可并行项；
- 为每个故事提供独立验证；
- 不包含非目标和推测性工作；
- 将完整回归放在最终功能检查点。

### 6. Analyze

```text
$speckit-analyze
```

任何 CRITICAL Constitution 冲突都必须在 implement 前解决。

### 7. Staged Implement

一次只实施一个阶段或用户故事：

```text
$speckit-implement
只实施 Phase 1；完成定向检查后停止。
```

或：

```text
$speckit-implement
只实施 User Story 1；完成独立验收后停止。
```

### 8. Converge

```text
$speckit-converge
```

Converge 只补充由实现和验收暴露的真实缺口，不加入新能力，不做无关重构或覆盖率扩张。

## 已准备功能的使用方式

`001` 和 `002` 已包含完整计划与任务：

1. 审查 Constitution 和 feature spec；
2. 运行 `$speckit-clarify`；
3. 运行 `$speckit-checklist`；
4. 运行 `$speckit-analyze`；
5. 分阶段运行 `$speckit-implement`；
6. 每个阶段后运行 `$speckit-converge`。

不要重新运行 `specify`、`plan` 或 `tasks` 覆盖已准备产物，除非用户明确要求重建。

## 等待前置条件的功能

`003` 至 `006` 只有行为规格。达到各自 `README.md` 中的门禁后：

1. 激活 feature 目录；
2. 运行 clarify；
3. 运行 plan；
4. 审查 research/model/contracts；
5. 运行 checklist/tasks/analyze；
6. 分阶段实施。

## 分支与 worktree

推荐分支：

```text
feat/001-bootstrap-monorepo
feat/002-govern-resume-single-repository-task
feat/003-codex-explicit-dev-flow
feat/004-deepseek-explicit-dev-flow
```

`003` 与 `004` 可以使用不同 worktree，但必须基于冻结 Core 合同的同一提交。若某个宿主
需要 Core 变更，应先完成共享规格，不在宿主分支私自扩展。

## 变更控制

批准后的规格发生变化时：

1. 先更新 `spec.md`；
2. 重新 clarify/checklist；
3. 更新 plan/contracts/tasks；
4. 重新 analyze；
5. 重新判断已完成任务是否仍满足新规格。

不得先扩大代码范围，再让文档追认。
