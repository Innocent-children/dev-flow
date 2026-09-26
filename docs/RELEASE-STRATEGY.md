# Product Release Strategy

TaskBelay versions Core, Codex, DeepSeek, Claude, ZCode and the lifecycle CLI independently. Current
release commands publish any of the four Host Adapters or the CLI. See [VERSIONING.md](VERSIONING.md) for
their authorities. A product release changes only that product's version; a host artifact records the
actual bundled Core version separately.

## Product Tags

Product Tag prefixes are `core-vX.Y.Z`, `codex-vX.Y.Z`, `deepseek-vX.Y.Z`, `claude-vX.Y.Z`,
`zcode-vX.Y.Z` and `taskbelay-vX.Y.Z`. Historical unprefixed Tags remain frozen. Host releases
validate the selected source and artifacts directly; a first release does not require a previous Tag.

## Host Adapter artifacts

```text
taskbelay-<HOST>-<VERSION>.tgz
taskbelay-core-<CORE_VERSION>-darwin-arm64
taskbelay-core-<CORE_VERSION>-windows-amd64.exe
SHA256SUMS
release-manifest.json
```

`<HOST>` is `codex`, `deepseek`, `claude` or `zcode`. The manifest records product, package/Core versions, source commit/tree, and artifact digests. The
npm package contains the exact `darwin-arm64` and `win32-x64` runtime directories, and publication
verifies and uploads both standalone Core executables.

## One-command release

维护者默认通过 GitHub Actions 手工触发 `publish-npm` 工作流，填写 product、channel 和 version。
四个 Host Adapter 使用 ARM64 `macos-15` runner，CLI 桌面包使用带 Xcode 27 的 ARM64 `xcode-27` 预览镜像。
工作流使用固定发布检查，再调用对应的一键发布命令。五个 npm
包须分别配置为信任 `Innocent-children/taskbelay` 的 `publish-npm.yml`，workflow
通过 OIDC 获取短期 npm 发布凭据；GitHub mutation 使用已安装到当前仓库并加入 `main` ruleset
bypass list 的专用 GitHub App 短期 token，所有产品共用一个串行发布队列。App Client ID 存在仓库
变量 `RELEASE_APP_CLIENT_ID`，完整 PEM 私钥存在仓库 secret `RELEASE_APP_PRIVATE_KEY`。

工作流上传 runner 临时发布目录中的构建产物；同输入重跑时由 Publisher 回读并复用匹配的远端状态。
每个产品发布前须核对 npm 包所有权与 Trusted Publisher 配置；工作流不负责修改 npm 账号设置。详见 [Release Ownership](../release/README.md)。

```bash
pnpm run release:codex -- \
  --version "<CODEX_VERSION>" \
  --output "<ABSOLUTE_DIRECTORY>" \
  --confirm "codex-v<CODEX_VERSION>"
```

The four Host commands are `release:codex`, `release:deepseek`, `release:claude` and `release:zcode`.
They use the same options and their own `<host>-v<VERSION>` confirmation and Tag. The version commit
updates the selected package and its plugin or marketplace mirrors, using `release(<host>): v<VERSION>`.
Stable releases also update that Host's `release/public-versions.json` entry and bundled Core version.
A first stable release can retain the current package version while adding the missing public identity.
Core and other Host version files remain unchanged, and release commands do not rewrite Markdown.
Adding a release entrypoint does not publish the package or expand verified platform support.
Product-specific instructions and the CLI entrypoint are linked from [Release Ownership](../release/README.md).

The release command runs one fixed set of package and publication checks before creating the version
commit.

Preparation builds the same frozen source in two independent clean checkouts and requires identical
tarball bytes. Publication requires exact confirmation and checks existing Tag, npm and GitHub
Release state before publishing or retrying. Resume checks the saved source commit/tree, product, package/Core versions,
channel and artifact bytes, then publishes the already verified artifacts. It does not rebuild them
or create another source checkout.

Product changes and pull-request validation never execute publication. Publication requires the
product, channel, target version and exact maintainer confirmation. Stable releases require synchronized
`main`; all four Host beta releases may use a clean named branch. The CLI supports stable only.
