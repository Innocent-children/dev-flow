# Implementation Plan: Codex Setup 安装展示

**Branch**: `002-install-experience` | **Date**: 2026-08-24 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/002-install-experience/spec.md`

## Summary

在现有 `dev-flow-codex setup` 路径中增加一个窄化 install-experience 模块。setup 在 registration
mutation 前只在缺失时创建 `$HOME/.dev-flow/config.json`，既有配置通过与 Core 相同的 closed 规则
验证后原样保留。现有 `setupRegistration` 返回 registration receipt 的 created/updated/zero-change
事实，CLI 将配置与 receipt 事实聚合为同一个 setup success 或失败说明。

交互式 fresh setup/兼容升级使用 Dev Flow 自有 5～8 行品牌首屏；简中/英文按环境语言选择，其他
语言回退英文。非 TTY、`NO_COLOR`、窄终端使用纯文本；`setup --json` 保留现有字段并追加配置路径、
文件变化和下一步。`mcp`、remove、`--version`、Core、DeepSeek、Task/Git 和版本保持不变。

## Technical Context

**Language/Version**: Node.js `>=24`

**Primary Dependencies**: Node.js 标准库、现有 Codex CLI JSON lifecycle；不新增生产依赖

**Storage**: `$HOME/.dev-flow/config.json` 和现有
`$HOME/Library/Application Support/dev-flow/registrations/codex.json`

**Testing**: `node --test` package-local tests；最终 `pnpm run validate` 最多两次，Attempt 2 只验证
Attempt 1 的 reviewed allowlist 修复

**Target Platform**: 当前支持的 macOS arm64、Codex `>=0.147.0`；不扩展平台

**Project Type**: Codex Node.js Host Adapter/npm package；Go Core 不修改

**Performance Goals**: 只读取至多 16 KiB 配置和现有 receipt；不增加网络、动画延时或额外 Core 启动

**Constraints**: 新目录 `0700`、新文件 `0600`；既有配置字节级保留；MCP STDIO 零展示；setup JSON
向后兼容；无新命令、版本或发布

**Scale/Scope**: 一个 Host、一个 setup 命令、两个直接受管文件、四个展示代表模式

## Constitution Check

*GATE: Phase 0 前与 Phase 1 设计后均通过。*

| Gate | Phase 0 | Phase 1 | 设计依据 |
| --- | --- | --- | --- |
| Core 唯一流程权威 | PASS | PASS | setup presentation 不进入 Task、Action、Recovery 或 Core。 |
| Host 适配器边界 | PASS | PASS | 改动只在 Codex lifecycle；MCP 和 DeepSeek 保持不变。 |
| Core 只读 Git | PASS | PASS | setup 只写用户配置和 registration receipt，目标 Git 零写入。 |
| 最小直接架构 | PASS | PASS | 一个新模块接入三个现有 Codex 文件，无 shared package、receipt 类型或 UI framework。 |
| 可选索引 | PASS | PASS | 默认偏好 false，不安装或管理 codebase-memory。 |
| 验证有界 | PASS | PASS | Codex 定向 tests；最终门禁 Attempt 2 仅验证 Attempt 1 的精确修复。 |
| Feature/release 分离 | PASS | PASS | package 版本、Tag、npm 和 Release 不变。 |
| 规格先行 | PASS | PASS | spec、research、data model、contracts、quickstart 和 tasks 在代码前完成。 |

## Design

### 1. 配置准备

`resolveProductPaths` 增加 `configurationDirectory` 与 `configurationPath`。新
`lib/install-experience.mjs` 提供 `ensureUserConfiguration`：canonical HOME 内无 symlink 路径；
缺失时创建完整双 Host false/false 配置；存在时验证 16 KiB、UTF-8、single JSON、duplicate/unknown
field、boolean、普通文件和安全权限，成功不写入一个字节。配置失败发生在任何 registration mutation
前。

### 2. Receipt 文件事实

`setupRegistration` 已经读取 existing receipt 并区分 fresh、compatible upgrade、already-installed。
结果增加瞬时 `receipt_change`：fresh=`created`、upgrade=`updated`、repeat=null。receipt schema 本身
不增加字段，remove ownership 与原子写入保持不变。

### 3. Setup 结果与失败

`runCLI` 先保存配置 created/null 事实，再调用 registration。成功结果保留 operation/status/changed/
receipt_path，并追加 configuration_path、file_changes、next_step。`changed` 表示本次 setup 是否有任一
直接文件变化。配置已创建而 registration 失败时，现有非零退出保持，stderr 增加已创建配置和重新
执行 setup 的恢复步骤；不引入通用错误模型。

### 4. 展示

同一 success result 由纯函数渲染：rich、plain、JSON。locale 按 `LC_ALL → LC_MESSAGES → LANG`；
`zh_CN`、`zh_SG`、`zh_Hans` 常见形式为简中，其他为英文。rich 只在 TTY、宽度足够、`NO_COLOR`
未设置且 Unicode 可用时启用；plain/JSON 无 ANSI、动画、Unicode 边框。fresh/upgrade 展示完整首屏，
already-installed 展示紧凑零变化结果。展示失败降级 plain，不使 setup 失败。

### 5. 文件范围

摘要只列 `$HOME/.dev-flow/config.json` 和 registration receipt。npm package、Codex CLI cache、Plugin
cache、Task data、package resources 与相邻 HOME 文件不扫描、不推断、不展示。

## Project Structure

### Documentation

```text
specs/002-install-experience/
├── README.md
├── spec.md
├── checklists/{requirements,setup-ux}.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/{user-configuration,setup-result,setup-presentation}.md
└── tasks.md
```

### Source Code

```text
packages/codex/
├── bin/dev-flow-codex.mjs
├── lib/lifecycle.mjs
├── lib/paths.mjs
├── lib/install-experience.mjs        # new
├── package.json
└── tests/
    ├── install-experience.test.mjs   # new
    ├── launcher.test.mjs
    ├── lifecycle.test.mjs
    ├── paths.test.mjs
    ├── package-contract.test.mjs
    └── removal-retention.test.mjs

scripts/build-codex-local.sh            # source artifact staging mirror only
scripts/validate-repository.sh          # Codex source dry-pack mirror only

README*.md
docs/{PRODUCT,ARCHITECTURE,COMMANDS,ROADMAP}{,_en}.md
packages/codex/README.md
docs/CODEX_en.md
```

**Structure Decision**: 复用现有 Codex package lifecycle 和 receipt，不新增 package、Core command、
presentation state 或跨 Host 抽象。

## Documentation Scope

同一实现 checkpoint 更新 9 个根 README、Product/Architecture/Commands/Roadmap 中英双语文档和
Codex 中英 Host 文档。DeepSeek package README、Support Matrix、公开版本和 release evidence 不变。

## Test Budget

1. 新模块：fresh/existing/invalid/unsafe/symlink/非普通文件与四个 renderer 代表模式；
2. lifecycle/launcher：fresh、repeat、compatible upgrade、配置后 registration failure、JSON；
3. paths/package/removal/MCP output 直接回归；
4. 文档完成后 `pnpm run validate` 最多两次；Attempt 1 failed，Attempt 2 由用户批准且只验证精确修复。

不运行 DeepSeek 新测试、真实 Host/registry/codebase-memory、平台/终端/语言组合矩阵、压力/性能/fuzz
或 release command。Attempt 2 失败则 Feature `Blocked`，不得自动追加第三次运行。

**Execution record**: T019 Attempt 1 已执行并失败，修订后预算为 1/2 consumed。直接失败为
`tests/contract/package_manifest_test.go` 的 `codexPackageFiles`/fixture allowlist 未包含
`lib/install-experience.mjs`。T021 已修复，T022 定向合同测试通过；Attempt 2 已执行并通过，最终
预算 2/2 consumed。

## Complexity Tracking

无 Constitution 违例。
