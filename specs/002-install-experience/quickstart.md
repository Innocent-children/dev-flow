# Quickstart: 验证 Codex Setup 安装展示

## 前置条件

- 仓库根目录；Node.js `>=24`、pnpm `>=11 <12`；
- 使用临时 HOME、Codex fixture 和数据目录；
- 不使用真实用户 HOME、真实 Codex、registry package 或 codebase-memory。

## 配置与路径

```bash
node --test \
  packages/codex/tests/install-experience.test.mjs \
  packages/codex/tests/paths.test.mjs
```

覆盖 fresh、existing、invalid/unsafe、symlink/非普通文件、0700/0600 和字节保留。

## Setup lifecycle 与输出

```bash
node --test \
  packages/codex/tests/install-experience.test.mjs \
  packages/codex/tests/launcher.test.mjs \
  packages/codex/tests/lifecycle.test.mjs \
  packages/codex/tests/removal-retention.test.mjs \
  packages/codex/tests/package-contract.test.mjs
```

覆盖 fresh、repeat、compatible upgrade、配置后 registration failure、receipt created/updated、
`setup --json` 和 remove/MCP regression。

展示只保留四个代表模式：简中 rich、英文窄屏无色、不支持 locale 回退英文、JSON。不得扩展组合
矩阵。

## 最终门禁

全部定向检查和文档完成后最多两次；Attempt 2 只验证 Attempt 1 直接暴露的 reviewed allowlist 修复：

```bash
pnpm run validate
```

每次启动即消费预算；Attempt 2 失败后 Feature `Blocked` 并停止，不自动追加第三次运行。

执行记录：T019 Attempt 1 已失败，修订后预算 1/2 consumed。失败点为
`tests/contract/package_manifest_test.go` 的 reviewed Codex package allowlist 未同步
`lib/install-experience.mjs`。T021 已修复，T022 定向合同测试通过；Attempt 2 已执行并通过，最终
预算 2/2 consumed。

## 明确不执行

DeepSeek 新测试、真实 Host/registry/codebase-memory、平台/终端/语言矩阵、压力/性能/fuzz、版本或
release command。
