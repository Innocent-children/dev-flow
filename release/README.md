# Release Ownership

`release/` contains the current prepare/publish implementation and operator guidance. Generated output stays
in an external operator-selected directory and is never committed.


TaskBelay uses new npm package names. Existing public-version numbers and historical Tags do not prove publication under these names. Before publishing each package, confirm its npm ownership and configure its Trusted Publisher for the actual GitHub repository. Keep publication in the standalone release flow; a source rename does not publish a package.

## Host Adapter output

```text
taskbelay-<HOST>-<VERSION>.tgz
taskbelay-core-<CORE_VERSION>-darwin-arm64
taskbelay-core-<CORE_VERSION>-windows-amd64.exe
SHA256SUMS
release-manifest.json
```

`<HOST>` is `codex`, `deepseek`, `claude` or `zcode`. The manifest binds the product, version, source commit, Core identity, and artifact digests. The
package and standalone assets include only the exact `darwin-arm64` and `win32-x64` runtime pairs;
the Publisher verifies and uploads both standalone Core assets.

## Operator entrypoint

维护者通常通过 GitHub Actions 的 `publish-npm` 工作流运行这些入口。在 Actions 页面选择
`Run workflow`，填写 `product`、`channel` 和 `version`。工作流使用固定的发布检查，不要求操作者选择
验证模式或勾选理解确认。可选产品为 `codex`、`deepseek`、`claude`、`zcode` 和 `taskbelay`。每个 npm 包须分别把 `Innocent-children/taskbelay` 的 `publish-npm.yml`
配置为允许 `npm publish` 的 GitHub Actions Trusted Publisher；工作流通过 OIDC 获取短期 npm 发布凭据，
并使用安装到当前仓库、加入 `main` ruleset bypass list 的专用 GitHub App 短期 token 提交版本、
创建 Tag 和维护 Release。仓库变量 `RELEASE_APP_CLIENT_ID` 保存 App Client ID，仓库 secret
`RELEASE_APP_PRIVATE_KEY` 保存完整 PEM 私钥。四个 Host Adapter 使用 `macos-15` ARM64 runner，
TaskBelay 桌面包使用带 Xcode 27 的 ARM64 `xcode-27` 预览镜像。所有产品共用发布队列串行执行；
排队任务获得执行机会后从最新 `main` checkout，避免前一个发布任务推送版本提交后，
后续任务仍基于触发时的旧提交发布。发布工具链固定为 Go `1.26.5`、Node.js `24.18.0` 和 pnpm `11.24.0`，npm 发布只使用 Trusted Publishing OIDC，不生成依赖
`NODE_AUTH_TOKEN` 的 registry 认证配置。

新增的 Claude/ZCode 发布入口不代表 `taskbelay-claude`、`taskbelay-zcode` 已在 npm 完成首次发布或已配置 Trusted Publisher。首次启用前，包维护者须确认包名所有权、npm 侧的首次发布条件和认证方式，并分别配置上述 Trusted Publisher。仓库不自动创建 npm 包所有权或修改 npm 设置；在这些条件完成前，不能仅凭 Actions 中出现产品选项就认定可以发布。首次发布仍须明确选择产品、channel、精确版本，并通过独立发布入口完成固定检查与产物核对。

工作流仍调用下面的 standalone command，完成版本检查、构建产物检查、npm tarball 回读和 GitHub
Release 资产处理，不运行 Host 或 Task 完整流程测试。每次运行都会上传 runner 临时目录中的构建产物；同一组
输入重跑时，Publisher 回读并复用匹配的 Tag、npm 和 GitHub Release 状态。

```bash
pnpm run release:codex -- \
  [--channel stable|beta] \
  --version "<CODEX_VERSION>" \
  --output "<ABSOLUTE_DIRECTORY>" \
  --confirm "codex-v<CODEX_VERSION>"
```

The four Host release commands use the same arguments and product-specific confirmation. Use
`release:deepseek`, `release:claude` or `release:zcode` with `deepseek-v<VERSION>`,
`claude-v<VERSION>` or `zcode-v<VERSION>` respectively. Product details: [Codex](codex/README.md),
[DeepSeek](deepseek/README.md), [Claude Code](claude/README.md), [ZCode](zcode/README.md).

The release command can create its output directory, but the parent must already exist. If `--output`
is omitted, it uses `~/taskbelay-releases/<host>-v<VERSION>`.

`stable` is the default channel. It accepts `MAJOR.MINOR.PATCH`, requires clean `main` equal to
`origin/main`, and updates the selected package version and its entry in `release/public-versions.json`,
including the bundled version read from `CORE_VERSION`. The selected plugin and marketplace version
mirrors are updated with the package version. A first stable release may keep the current source
package version while adding its public-version entry. No Host release requires a previous Tag.
Release commands do not rewrite Markdown; creating release tooling does not change public-version
metadata or expand the [support matrix](../docs/SUPPORT-MATRIX_en.md).

`beta` accepts only `MAJOR.MINOR.PATCH-beta.N`. It may run from any clean named branch, pushes its
version commit back to that branch, leaves stable public-version metadata unchanged, publishes
with npm dist-tag `beta`, and creates a GitHub prerelease.

The publisher creates or reuses only matching Tag and GitHub Release state, publishes npm at most
once, verifies registry tarball bytes, uploads prepared assets, and finalizes without running Host or
Task 完整流程测试.

The standalone command commits and pushes any version-file changes before preparing artifacts.
For each initial or resumed publication, the shared publisher validates the prepared directory through
`release/artifacts.mjs` before its Tag, npm and GitHub Release operations. It requires the exact product-specific
file set, matching release identity, unique artifact names, regular non-symbolic-link files, and
agreement between saved manifest digests, `SHA256SUMS`, and actual bytes. All four Host checksums
cover the tarball, both Core binaries, and the manifest; the lifecycle CLI's current prepare format
checksums only its tarball. Missing, extra, duplicated, linked, out-of-directory, or altered artifacts
stop publication. Registry and GitHub read-back use the expectations saved by this validation rather
than accepting a fresh digest from a changed local file. Preparation and publication require one
operator to retain ownership of the output directory.

For a new draft, the publisher writes a product-specific title and a compact Release summary. The
summary names the exact npm package, links the immutable source commit and source-pinned
installation/support documents, and points readers to `SHA256SUMS`. All four Host summaries also
name their bundled Core version; the Host-neutral lifecycle CLI has no bundled Core and omits that
sentence. A retry that finds an existing matching Release preserves that remote Release instead of
rewriting its title or notes. Its prerelease status must match the selected channel; a mismatch stops
publication before npm or Release changes.

Registry byte verification retries the actual `npm pack <package>@<version>` read-back for up to ten
minutes when npm returns `ETARGET` or `E404`. Metadata visibility alone is not treated as tarball
availability. Authentication failures, malformed output, and byte mismatches still stop immediately.

Pull-request CI syntax-checks these components and runs fake-remote contracts; it never invokes the real
release entrypoint or mutates Tag, npm, GitHub Release, assets, Codex registration, or task data. Only the
manually dispatched `publish-npm` workflow invokes a real release entrypoint.

Host source packages store no precompiled Core. Preparation builds both runtime pairs from
`CORE_VERSION` in two temporary frozen-source staging directories, verifies package contents and
version mirrors, and compares the independently built tarballs before publication. Preparation can
also run without publishing. Its output must be an existing empty absolute directory outside the
repository:

```bash
node scripts/build-host-release.mjs --product <codex|deepseek|claude|zcode> --output "<ABSOLUTE_DIRECTORY>"
```

The Codex and DeepSeek shell prepare commands delegate to this shared Host builder. Host setup,
authenticated model sessions, Task behavior and ZCode UI activation remain product checks, separate
from release checks.

The Host-neutral CLI has its own stable-only release identity:

```bash
pnpm run release:taskbelay -- --version "<TASKBELAY_VERSION>" --output "<ABSOLUTE_DIRECTORY>" \
  --confirm "taskbelay-v<TASKBELAY_VERSION>"
```

For `@imotong/taskbelay`, preparation includes both desktop applications and their default artwork. The macOS release job compiles Swift and assembles the locked Windows x64 Electron distribution; it verifies the final extracted npm package before publication. No Core or local Adapter archives are bundled in this product. See [TaskBelay CLI release](taskbelay/README.md) for toolchain and signing limits.

`@imotong/taskbelay` 制备包含两个平台的桌面应用与默认素材。macOS 发布 job 编译 Swift 并装配锁定的 Windows x64 Electron，在发布前验证最终 npm 解包结果。此产品不内置 Core 或本地 Adapter 归档。工具链与签名限制见 [TaskBelay CLI 发布说明](taskbelay/README.md)。
