# 008 — Codex 智能隐式启用

**Status**: Complete
**Created**: 2026-08-24

本 Feature 优化 Dev Flow Codex Plugin 的进入体验：明确的开发执行请求可以由 Codex 根据 Skill
描述隐式选择 Dev Flow，现有精确 selector 继续作为强制入口；非执行型和含糊请求保持普通对话，
不得自动创建 Dev Flow Task。

## Authority

- [Specification](spec.md)
- [Requirements checklist](checklists/requirements.md)
- [Implementation plan](plan.md)
- [Research](research.md)
- [Data model](data-model.md)
- [Activation contract](contracts/activation.md)
- [Validation quickstart](quickstart.md)
- [Implementation tasks](tasks.md)

需求、设计、合同、任务和直接一致性分析已完成，可以实施唯一批准切片。

## Fixed boundaries

- 只改变 Codex Plugin 的 Skill 选择、准入说明、安装校验、对应测试和维护文档；
- Core 流程图、Task/SQLite、MCP Schema、DeepSeek、产品版本和发布流程保持不变；
- 精确 `$dev-flow-codex:dev-flow` selector 保持可用；不新增 `$dev-flow` 别名或第二份 Skill；
- Feature 不授权提交、推送、版本修改或发布。

## Current checkpoint

T001～T004、理解审查和最终验收映射已完成。T004 Attempt 5 通过，累计使用 5/8 个自动验证命令，
71/71 tests passed；开发者已明确确认理解并能够维护。Feature 状态为 `Complete`。

未运行完整仓库验证、真实 Host Journey、registry lifecycle、DeepSeek、平台/模型矩阵或发布验证；
未提交、推送、修改版本或发布。
