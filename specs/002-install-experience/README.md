# 002 — Codex Setup 安装展示

**Status**: Complete
**Created**: 2026-08-24

本 Feature 只优化 `dev-flow-codex setup`：缺失时创建安全默认配置，展示本次直接创建或更新的配置与
registration receipt，并输出简体中文/英文的 Dev Flow 品牌首屏或机器可读结果。

## Authority

- [Specification](spec.md)
- [Requirements checklist](checklists/requirements.md)
- [Setup UX checklist](checklists/setup-ux.md)
- [Implementation plan](plan.md)
- [Research](research.md)
- [Data model](data-model.md)
- [User configuration contract](contracts/user-configuration.md)
- [Setup result contract](contracts/setup-result.md)
- [Setup presentation contract](contracts/setup-presentation.md)
- [Validation quickstart](quickstart.md)
- [Implementation tasks](tasks.md)

## Fixed boundaries

- DeepSeek、Core、MCP、Task/SQLite、目标 Git 和产品版本保持不变；
- 既有配置字节级保留，只在缺失时创建完整默认配置；
- 文件摘要只包含 setup 直接负责的配置和 registration receipt；
- rich 展示只属于交互式 setup，`setup --json` 和 MCP 保持无装饰输出；
- Feature 不授权提交、推送或发布。

## Current checkpoint

T001～T018 与 converge 已完成。T019 Attempt 1 已启动并失败，修订后预算为 1/2 consumed。
失败发生在 `tests/contract/package_manifest_test.go`：reviewed Codex package allowlist 未包含
`lib/install-experience.mjs`。T021 已同步两处 allowlist，T022 定向合同测试通过；最终门禁未重跑，
Attempt 2 已通过，最终预算 2/2 consumed，`Repository validation passed.`。Feature 状态为
`Complete`。
