# Release Ownership

`release/` contains the current prepare/publish implementation and operator guidance. Generated output stays
in an external operator-selected directory and is never committed.

## Current four-file output

```text
dev-flow-codex-<CODEX_VERSION>.tgz
dev-flow-core-<CORE_VERSION>-darwin-arm64
SHA256SUMS
release-manifest.json
```

The manifest binds the product, version, source commit, Core identity, and artifact digests.

## Operator entrypoint

维护者通常通过 GitHub Actions 的 `publish-npm` 工作流运行这些入口。在 Actions 页面选择
`Run workflow`，填写 `product`、`channel` 和 `version`。工作流使用固定的发布检查，不要求操作者选择
验证模式或勾选理解确认。三个 npm 包分别把 `Innocent-children/dev-flow` 的 `publish-npm.yml`
配置为允许 `npm publish` 的 GitHub Actions Trusted Publisher；工作流通过 OIDC 获取短期 npm 发布凭据，
并使用安装到当前仓库、加入 `main` ruleset bypass list 的专用 GitHub App 短期 token 提交版本、
创建 Tag 和维护 Release。仓库变量 `RELEASE_APP_CLIENT_ID` 保存 App Client ID，仓库 secret
`RELEASE_APP_PRIVATE_KEY` 保存完整 PEM 私钥。工作流固定运行在 `macos-15` ARM64 runner 上，并按
产品串行执行；发布工具链固定为 Go `1.26.5`、Node.js `24.18.0` 和 pnpm `11.24.0`，npm 发布只使用 Trusted Publishing OIDC，不生成依赖
`NODE_AUTH_TOKEN` 的旧式 registry 认证配置。

工作流仍调用下面的 standalone command，完成版本检查、制品检查、npm tarball 回读和 GitHub
Release 资产处理，不运行 Host 或 Task Journey。每次运行都会上传 runner 临时目录中的制品；同一组
输入重跑时，Publisher 回读并复用匹配的 Tag、npm 和 GitHub Release 状态。

```bash
pnpm run release:codex -- \
  [--channel stable|beta] \
  --version "<CODEX_VERSION>" \
  --output "<ABSOLUTE_DIRECTORY>" \
  --confirm "codex-v<CODEX_VERSION>"
```

`stable` is the default channel. It accepts `MAJOR.MINOR.PATCH`, requires clean `main` equal to
`origin/main`, and synchronizes maintained public release-version descriptions from `CORE_VERSION`,
package manifests, and `release/public-versions.json`.

`beta` accepts only `MAJOR.MINOR.PATCH-beta.N`. It may run from any clean named branch, pushes its
version commit back to that branch, leaves stable public-version descriptions unchanged, publishes
with npm dist-tag `beta`, and creates a GitHub prerelease.

The publisher creates or reuses only matching Tag and GitHub Release state, publishes npm at most
once, verifies registry tarball bytes, uploads prepared assets, and finalizes without running Host or
Task journeys.

Pull-request CI syntax-checks these components and runs fake-remote contracts; it never invokes the real
release entrypoint or mutates Tag, npm, GitHub Release, assets, Codex registration, or task data. Only the
manually dispatched `publish-npm` workflow invokes a real release entrypoint.

DeepSeek uses the same operator argument shape with an independent product identity:

```bash
pnpm run release:deepseek -- \
  [--channel stable|beta] \
  --version "<DEEPSEEK_VERSION>" \
  --output "<ABSOLUTE_DIRECTORY>" \
  --confirm "deepseek-v<DEEPSEEK_VERSION>"
```

Its package, Tag, output directory, npm identity, GitHub state and DSH registry lifecycle evidence
are independent from Codex. Stable releases apply the same public-document synchronization; beta
releases preserve stable public identities and use the isolated `beta`/prerelease channel. See
[`deepseek/README.md`](deepseek/README.md).

The Host-neutral CLI has its own normal-only release identity:

```bash
pnpm run release:dev-flow -- --version "<DEV_FLOW_VERSION>" --output "<ABSOLUTE_DIRECTORY>" \
  --confirm "dev-flow-v<DEV_FLOW_VERSION>"
```
