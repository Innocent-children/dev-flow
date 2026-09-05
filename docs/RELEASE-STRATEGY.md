# Product Release Strategy

Dev Flow releases Core, Codex, and DeepSeek independently. See [VERSIONING.md](VERSIONING.md) for
their authorities. A product release changes only that product's version; a host artifact records the
actual bundled Core version separately.

## Tags and Codex baseline

New Tags use `core-vX.Y.Z`, `codex-vX.Y.Z`, or `deepseek-vX.Y.Z`. Historical `v0.1.0` through
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

维护者默认通过 GitHub Actions 手工触发 `publish-npm` 工作流。工作流在 ARM64 `macos-15` runner
上收集 product、channel 和 version，使用固定发布检查，再调用本节已有的一键发布命令。三个 npm
包分别信任 `Innocent-children/dev-flow` 的 `publish-npm.yml`，workflow
通过 OIDC 获取短期 npm 发布凭据；GitHub mutation 使用已安装到当前仓库并加入 `main` ruleset
bypass list 的专用 GitHub App 短期 token，同一产品的发布不会并发执行。App Client ID 存在仓库
变量 `RELEASE_APP_CLIENT_ID`，完整 PEM 私钥存在仓库 secret `RELEASE_APP_PRIVATE_KEY`。

工作流上传 runner 临时发布目录中的构建产物；同输入重跑时由 Publisher 回读并复用匹配的远端状态。

```bash
pnpm run release:codex -- \
  --version "<CODEX_VERSION>" \
  --output "<ABSOLUTE_DIRECTORY>" \
  --confirm "codex-v<CODEX_VERSION>"
```

The version commit changes only the Codex package and plugin mirror and uses
`release(codex): v<CODEX_VERSION>`. Core and DeepSeek remain unchanged.

The release command runs one fixed set of package and publication checks before creating the version
commit.

Preparation keeps the two-clean-worktree deterministic build. Publication keeps exact confirmation,
publish-once npm behavior, immutable Tag/assets, remote read-back, atomic local state, and
read-before-retry. Resume uses the original product, Codex/Core versions, Tag, source, mode, previous
release, and digests, including a frozen source checkout when current source has advanced.

Product changes and pull-request validation never execute publication. A release occurs only after
merge, mode selection, target version, and exact maintainer confirmation.
