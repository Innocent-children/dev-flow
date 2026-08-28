# Repository Scripts

[中文](README.md) | [English](README_en.md)

`scripts/` 保存本仓库的开发验证、source-package 构建和 standalone release 工具。开发入口与
发布入口严格分离：普通验证不会安装真实 Host 产品，也不会创建 npm、Tag 或 GitHub Release。

## 日常开发

| 命令 | 用途 |
| --- | --- |
| `pnpm run validate` | 运行有界仓库验证 |
| `pnpm run validate:contracts` | 只运行公共 contract tests |
| `pnpm run versions:check` | 检查 Core、Codex、DeepSeek 版本权威与镜像 |
| `pnpm --dir packages/codex test` | 运行 Codex package-local tests |
| `pnpm --dir packages/deepseek test` | 运行 DeepSeek package-local tests |

`validate-repository.sh` 检查工具链、冻结依赖安装、版本权威、whitespace、Go formatting、
package contracts、Host Adapter tests、deterministic journeys 和 release tooling contracts。它不
调用真实发布入口。

## Source-local 构建

- `build-codex-local.sh`：构建 Codex source-local tarball 与 darwin-arm64 Core；
- `build-deepseek-runtime.sh`：构建 DeepSeek package tests 使用的 Core；
- `build-codex-release.sh`、`build-deepseek-release.sh`：为 standalone release 准备确定性制品。

最终制品和 evidence 必须写入仓库外、由操作者选择的目录。

## 发布入口

推荐在 GitHub Actions 手工运行 `publish-npm` 工作流。三个 npm 包分别把
`Innocent-children/dev-flow` 的 `publish-npm.yml` 配置为允许 `npm publish` 的 GitHub Actions
Trusted Publisher；运行时选择产品、channel、mode 和目标版本，normal 模式勾选
`confirm_comprehension`。工作流通过 OIDC 获取短期 npm 发布凭据，使用
`macos-15` ARM64、Node.js 24 和 pnpm 11，按产品串行执行，并调用下列现有入口。

```bash
pnpm run release:codex -- \
  [--channel stable|beta] \
  --mode quick|normal \
  --version "<CODEX_VERSION>" \
  --output "<ABSOLUTE_DIRECTORY>" \
  --confirm "codex-v<CODEX_VERSION>" \
  [--confirm-comprehension]
```

```bash
pnpm run release:deepseek -- \
  [--channel stable|beta] \
  --mode quick|normal \
  --version "<DEEPSEEK_VERSION>" \
  --output "<ABSOLUTE_DIRECTORY>" \
  --confirm "deepseek-v<DEEPSEEK_VERSION>" \
  [--confirm-comprehension]
```

`stable` 为默认 channel，只接受稳定 SemVer，并要求 `main` 与 `origin/main` 一致。`beta` 只接受
`MAJOR.MINOR.PATCH-beta.N`，允许任意干净的命名分支，version commit 推回当前分支；npm 固定使用
`beta` dist-tag，GitHub Release 固定为 prerelease，稳定版 `latest` 和公开版本文档保持不变。

两个一键发布命令仅在 stable version commit 中调用 `sync-public-release-docs.mjs`。同步器只从
`CORE_VERSION`、产品 package manifest 和 `release/public-versions.json` 获取版本事实，并更新
全部维护中的根 README、产品说明、Roadmap、Support Matrix 与 Host package README；Markdown
不参与版本决策。

发布前必须先检查当前公开 Tag 后的 changed paths，由维护者明确选择 `quick` 或 `normal`。
只有上述 exact-confirmation 入口可以修改产品版本、commit/push、Tag、npm、GitHub Release 与
assets。

两个 channel 共用同一个 Publisher。Publisher 使用仓库外的 `release-manifest.json` 和 `publication-record.json` 保留 source、
mode、版本、artifact digest、remote read-back 与恢复状态。中断后使用同一命令和同一 output
directory 继续。

Actions 会在成功或失败后上传 runner 临时发布目录。下载其中的 `publication-record.json` 可查看已完成
步骤；用同一组 workflow 输入重跑时，publisher 会先回读 npm、Tag 和 GitHub Release，不会盲目重复
不可逆操作。临时目录本身不会跨 workflow run 自动复用。

精确操作合同见 [Release Ownership](../release/README.md)。
