# Toolchain Baselines

**Validated on**: 2026-08-14

这些版本是仓库开发基线，不是 Dev Flow 产品协议。功能实施前应重新确认版本仍受支持；
任何基线变更都要在当前 feature 的 `research.md` 和 `plan.md` 中记录。

## Spec Kit

- Baseline: `v0.16.3`
- Release: <https://github.com/github/spec-kit/releases/tag/v0.16.3>
- Documentation: <https://github.github.com/spec-kit/>
- Monorepo guidance: <https://github.github.com/spec-kit/guides/monorepo.html>

仓库策略：

- 一个根级 Spec Kit 项目；
- Codex integration 由 Spec Kit 写入 `.agents/skills/`；
- 不在两个产品目录创建嵌套 `.specify/`。

## Go

- Language line: `1.26.x`
- Exact initial CI baseline: `1.26.6`
- Release history: <https://go.dev/doc/devel/release>

使用批准版本线中的最新安全补丁。大版本/小版本线升级需要独立计划审查。

## Node.js

- Development line: `24.x LTS`
- Release schedule: <https://nodejs.org/en/about/previous-releases>

Node.js 只用于 Monorepo 包工具与 DeepSeek 宿主集成，不是共享流程 Runtime。

## pnpm

- Baseline: `11.17.0`
- Registry: <https://www.npmjs.com/package/pnpm>

根 `packageManager` 字段和 `pnpm-lock.yaml` 固定包管理行为。

## Model Context Protocol Go SDK

- Stable baseline: `github.com/modelcontextprotocol/go-sdk v1.7.0`
- Releases: <https://github.com/modelcontextprotocol/go-sdk/releases>

Dev Flow 首版只使用本地 STDIO Tools。不要因为 SDK 提供 HTTP、OAuth、Sampling 或其他
能力就扩大产品范围。具体协议版本由 SDK 和宿主协商，Dev Flow 自己的工具合同独立版本化。

## SQLite Driver

- Baseline: `modernc.org/sqlite v1.54.0`
- Package: <https://pkg.go.dev/modernc.org/sqlite@v1.54.0>

该驱动通过 `database/sql` 提供无需 CGo 的 SQLite。依赖图由 `go.mod` 和 `go.sum`
锁定；升级时必须关注其配套 `modernc.org/libc` 约束。

## Revalidation Rules

工具链更新不能与无关产品功能混合。评审材料至少记录：

1. 原版本和新版本；
2. 更新原因；
3. 与 Dev Flow 有关的 API/行为变化；
4. 需要更新的源码、合同和测试；
5. 是否要重跑真实宿主证据；
6. 确认未顺带引入产品能力。
