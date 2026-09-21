# Product Release Strategy

Dev Flow versions Core, Codex, DeepSeek, Claude, ZCode and the lifecycle CLI independently. Current
public release commands publish Codex, DeepSeek or the CLI. See [VERSIONING.md](VERSIONING.md) for
their authorities. A product release changes only that product's version; a host artifact records the
actual bundled Core version separately.

## Tags and Codex baseline

Product Tag prefixes are `core-vX.Y.Z`, `codex-vX.Y.Z`, `deepseek-vX.Y.Z` and `dev-flow-vX.Y.Z`. Historical `v0.1.0` through
`v0.5.0` remain frozen. The first new Codex release compares against `v0.5.0`; later Codex releases
compare against the latest lower `codex-v*`.

## Codex artifacts

```text
dev-flow-codex-<CODEX_VERSION>.tgz
dev-flow-core-<CORE_VERSION>-darwin-arm64
dev-flow-core-<CORE_VERSION>-windows-amd64.exe
SHA256SUMS
release-manifest.json
```

The manifest records product, package/Core versions, source commit/tree, and artifact digests. The
npm package contains the exact `darwin-arm64` and `win32-x64` runtime directories, and publication
verifies and uploads both standalone Core executables.

## One-command release

维护者默认通过 GitHub Actions 手工触发 `publish-npm` 工作流，填写 product、channel 和 version。
Codex/DeepSeek 使用 ARM64 `macos-15` runner，CLI 桌面包使用带 Xcode 27 的 ARM64 `xcode-27` 预览镜像。
工作流使用固定发布检查，再调用对应的一键发布命令。三个 npm
包分别信任 `Innocent-children/dev-flow` 的 `publish-npm.yml`，workflow
通过 OIDC 获取短期 npm 发布凭据；GitHub mutation 使用已安装到当前仓库并加入 `main` ruleset
bypass list 的专用 GitHub App 短期 token，所有产品共用一个串行发布队列。App Client ID 存在仓库
变量 `RELEASE_APP_CLIENT_ID`，完整 PEM 私钥存在仓库 secret `RELEASE_APP_PRIVATE_KEY`。

工作流上传 runner 临时发布目录中的构建产物；同输入重跑时由 Publisher 回读并复用匹配的远端状态。

```bash
pnpm run release:codex -- \
  --version "<CODEX_VERSION>" \
  --output "<ABSOLUTE_DIRECTORY>" \
  --confirm "codex-v<CODEX_VERSION>"
```

The Codex version commit updates its package and plugin mirror and uses
`release(codex): v<CODEX_VERSION>`. Stable releases also update `release/public-versions.json` with
the selected Codex version and bundled Core version. Core and DeepSeek version files remain unchanged;
release commands do not rewrite Markdown. DeepSeek and CLI entrypoints are documented in
[Release Ownership](../release/README.md).

The release command runs one fixed set of package and publication checks before creating the version
commit.

Preparation keeps the two-clean-worktree deterministic build. Publication keeps exact confirmation,
publish-once npm behavior, immutable Tag/assets, remote read-back, atomic local state, and
read-before-retry. Resume uses the original product, Codex/Core versions, Tag, source, mode, previous
release, and digests, including a frozen source checkout when current source has advanced.

Product changes and pull-request validation never execute publication. Publication requires the
product, channel, target version and exact maintainer confirmation. Stable releases require synchronized
`main`; Codex and DeepSeek beta releases may use a clean named branch. The CLI supports stable only.
