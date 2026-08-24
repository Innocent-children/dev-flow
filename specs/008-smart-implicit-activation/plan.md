# Implementation Plan: Codex 智能隐式启用

## Summary

把 Codex Plugin 当前锁死的 explicit-only policy 改为允许 Host 依据 Skill `description` 隐式选择，
同时保留精确 selector 作为强制入口。隐式与显式选择进入同一 admission gate；Task 创建仍要求一个
实质、有界的开发请求或明确恢复意图。实现只同步现有 metadata、Skill、MCP admission、setup
validator、contract tests 和维护文档，不增加分类器、配置项或持久状态。

## Current Baseline

- `packages/codex/plugin/skills/dev-flow/agents/openai.yaml` 固定
  `allow_implicit_invocation: false`；
- `packages/codex/plugin/skills/dev-flow/SKILL.md` 把精确 selector 定义为唯一入口，并拒绝任何隐式选择；
- `packages/codex/bin/dev-flow-codex.mjs` 向 MCP Host 注入同一 explicit-only admission instructions；
- `packages/codex/lib/lifecycle.mjs` 的 `assertPackageResources` 校验 metadata 必须等于 explicit-only 常量；
- `packages/codex/tests/skill-contract.test.mjs`、`packages/codex/tests/lifecycle.test.mjs`、
  `packages/codex/tests/launcher.test.mjs` 与 `packages/codex/tests/package-contract.test.mjs` 分别锁定
  Skill、setup、MCP instructions 和 packed metadata 合同；
- Codex 中英文 Host 文档和部分根 README 把完整 selector 记录为唯一调用方式。

## Technical Approach

### 1. Host metadata

把 `agents/openai.yaml` 的固定 policy 改为 `allow_implicit_invocation: true`。Policy 只允许 Host 考虑
隐式选择，不负责识别请求、授权副作用或持久化激活来源。同步 `packages/codex/package.json` 与
`packages/codex/plugin/.codex-plugin/plugin.json` 的公开描述和 Plugin interface，使目录展示不再声称
explicit-only；default prompt 继续使用精确 selector 作为确定性示例。

### 2. Skill description and admission

重写 frontmatter `description`，前置列出允许隐式选择的任务型开发用途及排除类型。Admission gate
接受两个来源：Host 已隐式选择当前 Skill，或当前请求包含精确 selector。两者都必须继续通过：

1. 实质有界请求或明确恢复意图；
2. 当前 Git worktree 与显式 Repository Scope；
3. 当前 Codex writable authority；
4. `dev_flow_server_info` compatibility handshake；
5. Core Task discovery 和 Action loop。

Skill 不实现关键词解析器，也不保存 `implicit|explicit` 状态。负向请求边界由 metadata 描述和
admission 文本共同表达；如果 Host 已错误选择一个非任务请求，admission 仍不得创建 Task。

### 3. MCP admission and setup validation

把 launcher 的 MCP admission instructions 同步为同一双入口合同。`assertPackageResources` 保持
闭合字符串校验，但改为验证 implicit-enabled metadata，并检查 Skill/MCP 文本包含正向用途、负向
Task 创建边界和精确 selector。Setup 继续只校验 package 自有资源，不调用模型或创建 Task。

### 4. Tests

扩展既有静态 package contract，而不是新增概率性模型测试框架：

- metadata 精确启用 implicit invocation；
- description 覆盖 implementation、bug fix、refactoring、targeted testing、delivery；
- description/admission 覆盖 explanation、status-only、design discussion、ordinary question、ambiguous；
- 精确 selector 保留，裸 `$dev-flow` 与错误 namespace 仍不是 selector；
- implicit 和 explicit 都汇合到同一 startup handshake；
- lifecycle fixture 接受新 policy，拒绝旧 policy 和矛盾资源。
- launcher 环境注入精确使用新双入口 MCP instructions；
- packed package contract 精确包含 implicit-enabled metadata。

### 5. Documentation

同一实现 checkpoint 同步全部 9 个根 README、`docs/PRODUCT*`、`docs/ARCHITECTURE*`、
`docs/COMMANDS*`、`docs/ROADMAP*`、`packages/codex/README.md` 与 `docs/CODEX_en.md`。命令、selector、
package identity 和版本事实保持不变。

## Exact Source Scope

```text
packages/codex/plugin/skills/dev-flow/agents/openai.yaml
packages/codex/plugin/skills/dev-flow/SKILL.md
packages/codex/package.json
packages/codex/plugin/.codex-plugin/plugin.json
packages/codex/bin/dev-flow-codex.mjs
packages/codex/lib/lifecycle.mjs
packages/codex/tests/skill-contract.test.mjs
packages/codex/tests/lifecycle.test.mjs
packages/codex/tests/launcher.test.mjs
packages/codex/tests/package-contract.test.mjs
README.md
README_en.md
README_zh-TW.md
README_ja.md
README_ko.md
README_es.md
README_fr.md
README_de.md
README_pt-BR.md
docs/PRODUCT.md
docs/PRODUCT_en.md
docs/ARCHITECTURE.md
docs/ARCHITECTURE_en.md
docs/COMMANDS.md
docs/COMMANDS_en.md
docs/ROADMAP.md
docs/ROADMAP_en.md
packages/codex/README.md
docs/CODEX_en.md
```

Feature 过程文件位于 `specs/008-smart-implicit-activation/`。不修改 package version、Core、DeepSeek、
MCP Schema、release 或 `.agents/skills/`。

## Constitution Check

- **Core single authority**: 激活来源不进入 Core，不增加 Task 状态或流程游标；通过。
- **Hosts and methods are adapters**: Codex 只选择并执行既有 Skill；通过。
- **Authorized mutations**: 隐式选择不授权 Git/release 副作用；通过。
- **Incremental bounded scope**: 复用 metadata、description、admission 和现有 validator/tests；通过。
- **Optional indexes**: codebase-memory preference 和 fallback 不变；通过。
- **Acceptance-bound verification**: 只运行 Codex package 定向测试，最多 8 个命令；通过。
- **Feature/release separation**: 不改版本、不发布；通过。
- **Specification first**: Feature 008 在实现前完成；通过。

## Data and Compatibility

持久化处置为 `not-applicable`。不修改 Task、SQLite、receipt、用户配置或 Git 仓库数据。既有显式
prompt 保持可用；新的 implicit metadata 是向后兼容的额外 Host 选择入口。旧 Host 若不支持隐式选择，
用户仍可使用精确 selector。

## Risks and Mitigations

- **误触发**: description 明确负向类型，admission 在非任务请求上禁止创建 Task；不承诺模型分类
  绝对确定。
- **合同漂移**: setup validator 与 contract tests 同时校验 metadata、Skill 和 MCP instructions。
- **显式入口退化**: 保留精确 selector 的正向测试和裸名称/错误 namespace 负向测试。
- **授权扩大**: Skill 明确隐式选择不改变 repository、Git 和 release authority。

## Verification Budget

自动验证最多 8 个定向命令，优先组合执行：

1. `node --test packages/codex/tests/skill-contract.test.mjs packages/codex/tests/lifecycle.test.mjs packages/codex/tests/launcher.test.mjs packages/codex/tests/package-contract.test.mjs`
2. 若直接失败，只运行定位该失败所需的更窄测试；每次均计入预算。
3. 文档与 package closure 仅在对应任务要求时运行现有直接合同。

不运行 `pnpm run validate`、完整仓库测试、真实 Host/registry Journey、DeepSeek 测试、平台/模型矩阵、
压力、性能、fuzz 或 release command。

## Complexity Review

保留复杂度只有一项：metadata、Skill、MCP instructions 和 setup validator 的合同镜像，用于保证安装
制品自洽。没有新增模块、分类器、配置 schema、激活 registry、状态机或持久化字段。
