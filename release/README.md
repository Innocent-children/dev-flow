# Release Ownership

`release/` contains current product release schemas and operator guidance. Generated output stays
in an external operator-selected directory and is never committed.

## Current five-file output

```text
dev-flow-codex-<CODEX_VERSION>.tgz
dev-flow-core-<CORE_VERSION>-darwin-arm64
SHA256SUMS
release-manifest.json
publication-record.json
```

The schemas are closed, current-only formats without internal version fields. Historical release
testdata remains frozen and is accepted only by its historical evidence tests; current tooling
rejects an old publication directory before remote mutation.

## Operator entrypoint

维护者通常通过 GitHub Actions 的 `publish-npm` 工作流运行这些入口。在 Actions 页面选择
`Run workflow`，填写 `product`、`channel`、`mode`、`version`，normal 模式同时勾选
`confirm_comprehension`。三个 npm 包分别把 `Innocent-children/dev-flow` 的 `publish-npm.yml`
配置为允许 `npm publish` 的 GitHub Actions Trusted Publisher；工作流通过 OIDC 获取短期 npm 发布凭据，
并使用安装到当前仓库、加入 `main` ruleset bypass list 的专用 GitHub App 短期 token 提交版本、
创建 Tag 和维护 Release。仓库变量 `RELEASE_APP_CLIENT_ID` 保存 App Client ID，仓库 secret
`RELEASE_APP_PRIVATE_KEY` 保存完整 PEM 私钥。工作流固定运行在 `macos-15` ARM64 runner 上，并按
产品串行执行。

工作流仍调用下面的 standalone command，因此版本检查、quick eligibility、精确 confirmation、
npm/GitHub 回读和最终 registry-package Journey 没有变化。每次运行都会尝试上传 runner 临时目录中的
发布记录和制品；失败后先下载 artifact 查看 `publication-record.json`，再用同一组输入重跑。runner
临时目录不会跨运行自动恢复，已有不可变远端状态由 publisher 回读后复用。

```bash
pnpm run release:codex -- \
  [--channel stable|beta] \
  --mode quick|normal \
  --version "<CODEX_VERSION>" \
  --output "<ABSOLUTE_DIRECTORY>" \
  --confirm "codex-v<CODEX_VERSION>" \
  [--confirm-comprehension]
```

`stable` is the default channel. It accepts `MAJOR.MINOR.PATCH`, requires clean `main` equal to
`origin/main`, and synchronizes maintained public release-version descriptions from `CORE_VERSION`,
package manifests, and `release/public-versions.json`.

`beta` accepts only `MAJOR.MINOR.PATCH-beta.N`. It may run from any clean named branch, pushes its
version commit back to that branch, leaves stable public-version descriptions unchanged, publishes
with npm dist-tag `beta`, and creates a GitHub prerelease. The publisher still uses the same
validation, deterministic preparation, exact confirmation, read-back, Journey, and recovery gates.

Without confirmation, the publisher performs read-only npm/GitHub/Tag preflight. With exact
confirmation, it creates or reuses only matching immutable state, publishes npm at most once,
verifies registry bytes, uploads exact assets, and finalizes only after the selected Journey gate.

Pull-request CI syntax-checks these components and runs fake-remote contracts; it never invokes the real
release entrypoint or mutates Tag, npm, GitHub Release, assets, Codex registration, or task data. Only the
manually dispatched `publish-npm` workflow invokes a real release entrypoint.

DeepSeek uses the same operator argument shape with an independent product identity:

```bash
pnpm run release:deepseek -- \
  [--channel stable|beta] \
  --mode quick|normal \
  --version "<DEEPSEEK_VERSION>" \
  --output "<ABSOLUTE_DIRECTORY>" \
  --confirm "deepseek-v<DEEPSEEK_VERSION>" \
  [--confirm-comprehension]
```

Its package, Tag, output directory, npm identity, GitHub state and DSH registry lifecycle evidence
are independent from Codex. Stable releases apply the same public-document synchronization; beta
releases preserve stable public identities and use the isolated `beta`/prerelease channel. See
[`deepseek/README.md`](deepseek/README.md).

The Host-neutral CLI has its own normal-only release identity:

```bash
pnpm run release:dev-flow -- --mode normal --version "<DEV_FLOW_VERSION>" --output "<ABSOLUTE_DIRECTORY>" \
  --confirm "dev-flow-v<DEV_FLOW_VERSION>" --confirm-comprehension
```
