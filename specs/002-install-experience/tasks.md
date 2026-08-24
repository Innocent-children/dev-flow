# Tasks: Codex Setup 安装展示

**Input**: `specs/002-install-experience/` 中的 spec、plan、research、data-model、contracts、quickstart

**Tests**: 只包含规格明确要求的 Codex config/setup/renderer/package regression 与最多两次最终门禁。

**Organization**: 先完成配置 helper foundation，再按 US1 setup 文件事实、US2 展示递增实现；每个
checkpoint 是硬停点。

## Phase 1: Setup — 定向测试入口

**Purpose**: 建立新模块的独立测试文件和固定配置/展示 fixture，不接入 lifecycle。

- [X] T001 在新文件 `packages/codex/tests/install-experience.test.mjs` 建立临时 HOME 配置 fixture，并写入默认 false/false 配置、0700/0600、既有字节保留、invalid/unsafe/symlink/非普通文件的失败断言（FR-001～FR-004；SC-001、SC-002；`contracts/user-configuration.md`）。

**Checkpoint**: 只新增失败的定向测试入口；生产行为未改变。

---

## Phase 2: Foundational — 配置准备与 package closure

**Purpose**: 完成 setup 接入前可独立验证的配置路径、验证和缺失创建能力。

- [X] T002 在新文件 `packages/codex/lib/install-experience.mjs` 和现有 `packages/codex/lib/paths.mjs` 实现 canonical HOME 配置路径、closed 16 KiB 验证、缺失创建、created/null fact 和既有文件字节保留（FR-001～FR-004；SC-001、SC-002；`plan.md`「配置准备」）。
- [X] T003 在 `packages/codex/package.json`、`packages/codex/tests/package-contract.test.mjs`、`scripts/build-codex-local.sh`、`scripts/validate-repository.sh` 将 `lib/install-experience.mjs` 加入闭合 source/packed/reviewed/staging/dry-pack 文件清单，保持 package version 不变（FR-012、FR-014；SC-006；`plan.md`「Project Structure」）。
- [X] T004 运行 `node --test packages/codex/tests/install-experience.test.mjs packages/codex/tests/paths.test.mjs packages/codex/tests/package-contract.test.mjs`，只判定配置 helper 与 package closure（FR-001～FR-004、FR-012、FR-014；SC-001、SC-002、SC-006）。

**Checkpoint**: Foundation ready；停止并确认 Core、DeepSeek、MCP、Task/Git 零改动。

---

## Phase 3: User Story 1 — Setup 后立即可用 (Priority: P1) 🎯 MVP

**Goal**: setup 在 registration 前确保配置，并准确报告配置/receipt created、updated 或零变化。

**Independent Test**: 临时 HOME 的 fresh、existing、repeat、compatible upgrade、invalid config 和配置创建后 registration failure 均产生规定文件事实与恢复说明。

- [X] T005 [US1] 在 `packages/codex/tests/lifecycle.test.mjs` 写入 fresh receipt created、compatible upgrade updated、already-installed null 和既有 ownership/rollback 语义不变的断言（FR-005～FR-007、FR-012；SC-003、SC-006；`contracts/setup-result.md`）。
- [X] T006 [US1] 在 `packages/codex/tests/launcher.test.mjs` 写入配置先于 registration、配置失败零 registration、配置 created 后 registration failure、fresh/existing/repeat/upgrade success result 和 `setup --json` 新字段断言（FR-001～FR-007、FR-011；SC-001～SC-004；`data-model.md`「Lifecycle」）。
- [X] T007 [US1] 在 `packages/codex/lib/lifecycle.mjs` 的三个 setup success return 增加瞬时 receipt created/updated/null fact，不改变 receipt closed schema、registration mutation 或 remove ownership（FR-005～FR-007、FR-012；SC-003、SC-006；`research.md` Decision 3）。
- [X] T008 [US1] 在 `packages/codex/bin/dev-flow-codex.mjs` 接入配置准备，聚合现有 success 字段、configuration_path、file_changes、next_step，并在配置已创建而 registration 失败时输出非 ready 恢复说明（FR-001～FR-007、FR-011；SC-001～SC-004；`contracts/setup-result.md`）。
- [X] T009 [US1] 在 `packages/codex/tests/removal-retention.test.mjs` 锁定 setup 后 `remove`、npm uninstall fixture 与兼容重装均保留配置字节，且摘要不包含 Task data/cache/package resources（FR-003、FR-006、FR-012；SC-002、SC-003、SC-006；`contracts/user-configuration.md`）。
- [X] T010 [US1] 运行 `node --test packages/codex/tests/install-experience.test.mjs packages/codex/tests/launcher.test.mjs packages/codex/tests/lifecycle.test.mjs packages/codex/tests/removal-retention.test.mjs packages/codex/tests/paths.test.mjs packages/codex/tests/package-contract.test.mjs`，只验收 User Story 1（FR-001～FR-007、FR-011、FR-012；SC-001～SC-004、SC-006）。

**Checkpoint — STOP REQUIRED**: User Story 1 MVP 完成后停止；不得自动进入品牌 renderer。

---

## Phase 4: User Story 2 — 醒目清晰的安装首屏 (Priority: P2)

**Goal**: 同一 setup success facts 以简中/英文 rich、plain 或 JSON 表达，其他命令输出不变。

**Independent Test**: 四个代表结果核心字段一致，rich 为 5～8 逻辑行，plain/JSON ANSI 为 0，unsupported locale 回退英文，MCP stdout 零展示。

- [X] T011 [US2] 在 `packages/codex/tests/install-experience.test.mjs` 增加简中 rich、英文窄屏/`NO_COLOR`、unsupported locale fallback、plain/JSON 无 ANSI、5～8 行、唯一 next step 和第三方品牌文本排除断言（FR-008～FR-013；SC-004、SC-005；`contracts/setup-presentation.md`）。
- [X] T012 [US2] 在 `packages/codex/tests/launcher.test.mjs` 锁定 fresh/upgrade 完整首屏、already-installed 紧凑零变化、`setup --json` 无装饰、renderer failure 降级 plain、`mcp`/remove/`--version` 现有输出不变（FR-008～FR-013；SC-004～SC-006；`contracts/setup-presentation.md`）。
- [X] T013 [US2] 在 `packages/codex/lib/install-experience.mjs` 实现 locale 选择与纯 rich/plain/JSON renderer，在 `packages/codex/bin/dev-flow-codex.mjs` 仅为 setup success 选择模式并在展示能力错误时降级 plain（FR-008～FR-013；SC-004、SC-005；`research.md` Decision 5/6）。
- [X] T014 [US2] 运行 `node --test packages/codex/tests/install-experience.test.mjs packages/codex/tests/launcher.test.mjs packages/codex/tests/lifecycle.test.mjs packages/codex/tests/paths.test.mjs packages/codex/tests/package-contract.test.mjs`，只验收 User Story 2 和命令兼容（FR-008～FR-014；SC-004～SC-006）。

**Checkpoint — STOP REQUIRED**: 两个 User Story 定向验收完成后停止；先执行 converge，再进入文档与最终门禁。

---

## Phase 5: Documentation 与最终有界验证

- [X] T015 更新 `README.md`、`README_en.md`、`README_zh-TW.md`、`README_ja.md`、`README_ko.md`、`README_es.md`、`README_fr.md`、`README_de.md`、`README_pt-BR.md`，同步 Codex setup 自动配置、配置/receipt 文件摘要、语言/降级和保留 Task/DeepSeek 行为，不修改版本/支持声明（FR-001～FR-014；SC-001～SC-006；`plan.md`「Documentation Scope」）。
- [X] T016 [P] 更新 `docs/PRODUCT.md`、`docs/PRODUCT_en.md`、`docs/ROADMAP.md`、`docs/ROADMAP_en.md`，记录 Codex setup 开箱体验和持续的 Core/DeepSeek/release 边界（FR-012～FR-014；SC-004、SC-006；`spec.md`「Non-Goals」）。
- [X] T017 [P] 更新 `docs/ARCHITECTURE.md`、`docs/ARCHITECTURE_en.md`、`docs/COMMANDS.md`、`docs/COMMANDS_en.md`，记录 Host-owned配置准备、receipt file fact、setup/JSON/rich/plain 合同和 MCP STDIO 不变（FR-001～FR-014；SC-001～SC-006；三个 contracts）。
- [X] T018 [P] 更新 `packages/codex/README.md`、`docs/CODEX_en.md`，提供可复制 setup 输出说明、文件范围、locale/降级、重复零变化与失败恢复；不修改 DeepSeek 文档（FR-001～FR-014；SC-001～SC-006；`contracts/setup-presentation.md`）。
- [X] T019 在 T001～T018 与 converge 完成后最多调用两次 `pnpm run validate`；Attempt 2 只验证 Attempt 1 的 reviewed allowlist 精确修复。每次启动即消费预算；Attempt 2 失败时将 Feature 标记 `Blocked` 并停止，不得自动追加第三次运行；不得运行真实 Host/registry/codebase-memory、额外矩阵或 release command（FR-012～FR-014；SC-001～SC-006；`quickstart.md`「最终门禁」）。
  - attempt 1: failed；1/2 consumed
  - command: `pnpm run validate`
  - result: failed；`tests/contract/package_manifest_test.go:94`
  - failure: Codex package manifest `files` does not equal the reviewed Go contract allowlist because `lib/install-experience.mjs` is absent from `codexPackageFiles` and its manifest fixture
  - action: stopped；no fix and no retry
  - attempt 2: passed；2/2 consumed；exit code 0；`Repository validation passed.`
- [X] T020 在 `specs/002-install-experience/README.md`、`specs/002-install-experience/spec.md`、`specs/002-install-experience/tasks.md` 记录 T019 结果；仅当全部任务和门禁通过时将 Feature 标记 `Complete`（SC-001～SC-006；`docs/SPEC-KIT-WORKFLOW.md`「状态词汇」）。

**Checkpoint — FINAL STOP REQUIRED**: 完成 T020 后停止；不提交、不推送、不改版本、不发布。

---

## Dependencies & Execution Order

```text
T001 tests -> T002 helper -> T003 package closure -> T004 foundation check
  -> T005～T010 US1 -> T011～T014 US2 -> converge
  -> T015～T018 docs -> T019 one final validation -> T020 complete
```

- US1 依赖配置 foundation；不依赖品牌 renderer。
- US2 依赖 US1 的 setup success facts，只增加展示。
- T016～T018 文档族可并行；T019 等待全部文档与 converge。

## Implementation Strategy

### MVP

T001～T010：setup 自动配置和真实文件摘要；完成 T010 后硬停。

### Incremental Delivery

1. 配置 helper foundation；
2. US1 setup 可用性与文件事实；
3. US2 品牌化双语展示；
4. converge；
5. 文档与唯一最终门禁。

## Scope and Budget Guardrails

- 只修改 `packages/codex/`、指定 Codex/根文档和 Feature 002；DeepSeek/Core/MCP/Task/Git 不变。
- 不新增 presentation identity/receipt、shared package、配置 CLI、Core/MCP 命令、UI framework 或生产依赖。
- 不扫描/报告 npm、Codex cache、Task data 或相邻 HOME 文件。
- 不运行真实 Host/registry/codebase-memory、平台/终端/语言矩阵、压力/性能/fuzz 或 release。
- `pnpm run validate` 最多两次；Attempt 2 已获用户明确批准，禁止自动追加第三次。

---

## Phase 6: Convergence

- [X] T021 在 `tests/contract/package_manifest_test.go` 的 `codexPackageFiles` 与 Codex manifest fixture 两处加入 `lib/install-experience.mjs`，完成 plan package closure 与 T003 的 reviewed Go contract 镜像（partial）。
- [X] T022 运行 `go test ./tests/contract -run TestProjectPackageManifests`，只验证 T019 直接失败的 package manifest contract；不得重跑 `pnpm run validate`（partial）。
  - result: passed；`ok github.com/Innocent-children/dev-flow/tests/contract`
  - final gate: Attempt 2 passed after targeted fix；T019 complete；2/2 consumed

**Checkpoint**: T022 通过后曾停止；用户随后批准 T019 Attempt 2，并已同步预算文档。
