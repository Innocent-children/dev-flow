# taskbelay Release

日常发布从 GitHub Actions 手工运行 `publish-npm`，选择 `product=taskbelay`、`channel=stable` 和目标
版本；工作流使用固定发布检查。npm 包 `taskbelay` 把
`Innocent-children/taskbelay` 的 `publish-npm.yml` 配置为允许 `npm publish` 的 GitHub Actions
Trusted Publisher；工作流通过 OIDC 认证，不使用长期 npm 发布 token。
固定检查通过后，入口对齐 `packages/taskbelay/package.json` 到目标版本，再构建并校验完整桌面包；失败后可用相同输入重跑，Publisher 会回读远端状态。

```bash
pnpm run release:taskbelay -- --version "<VERSION>" --output /absolute/output \
  --confirm "taskbelay-v<VERSION>"
```

The command requires clean synchronized `main`, creates or reuses the exact Tag, npm version and GitHub draft,
verifies registry tarball bytes against the prepared package,
uploads the tarball and checksums, and then finalizes the Release. Rerun with the same output directory to recover.
Registry tarball read-back retries only propagation responses such as `ETARGET` and `E404` for up to
ten minutes; authentication failures and byte mismatches stop immediately.

Before any remote command, the shared publisher checks exactly three regular non-symbolic-link
files: `taskbelay-<VERSION>.tgz`, `release-manifest.json`, and `SHA256SUMS`. Product, version and
source must match the selection, and the tarball bytes must match the saved manifest digest and its
sole checksum entry. This product's current checksum format does not include the manifest. Missing,
extra, duplicated, linked, or out-of-directory entries stop publication. Initial and resumed calls
use the same check; later npm and GitHub read-back retain its expectations instead of deriving new
ones from local files that may have changed.

共享 publisher 在任何远端命令前核对这三个普通、非链接文件。产品、版本、源码身份须与选择一致，
tarball 必须同时匹配保存的 manifest 摘要和 SHA256SUMS 中唯一的条目；当前产品格式不将 manifest
列入 SHA256SUMS。文件缺失、多余、重复、链接或路径越界都会停止发布。首次与恢复发布使用同一
检查，之后的 npm/GitHub 回读沿用预检保存的期望摘要，不改用本地文件后来变化后的摘要。

## Desktop package preparation / 桌面包制备

```bash
node release/taskbelay/prepare.mjs --output "/absolute/pet-release"
```

Preparation requires macOS arm64, the repository Node/npm toolchain and Xcode >=27 with macOS SDK >=27. It compiles and ad-hoc signs the macOS app, installs locked Windows build dependencies in an external temporary directory without lifecycle scripts, and downloads the exact Windows x64 Electron distribution. It reuses platform assembly to include both applications and nine default actions with 57 PNG frames in one npm tarball. It checks app versions, native architectures, runtime files, artwork and every extracted file before writing `SHA256SUMS` and `release-manifest.json`. The formal package has no local Adapter archives and relies on independently configured Adapters for Core. Missing or altered files fail preparation before publication. The standalone prepare command publishes nothing.

制备要求 macOS arm64、仓库规定的 Node/npm 工具链与 Xcode >=27（包含 macOS SDK >=27）。它编译并以 ad-hoc 方式签名 macOS 应用，在仓库外临时目录中安装锁定的 Windows 构建依赖（禁用生命周期脚本），并下载精确版本的 Windows x64 Electron。两个平台复用既有应用装配，将应用和九类动作、57 个 PNG 帧装入同一 npm tarball。写入 `SHA256SUMS` 和 `release-manifest.json` 前，核对应用版本、架构、运行时文件、素材及全部解包文件。正式包不携带本地 Adapter 归档，Core 由独立配置的 Adapter 提供。文件缺失或内容不一致会在发布前阻止制备。单独执行制备命令不发布。

The release entry runs package, preparation and publisher contract checks before the version commit, then awaits this preparation before calling the publisher. The `publish-npm` job selects the arm64 `xcode-27` preview image for this product and checks the selected Xcode, Swift and SDK before release credentials are created. Other products retain their existing runner. Native command failures include stdout and stderr. Windows assembly on macOS is a content check, not a native Windows execution test. Developer ID signing, notarization, minimum-macOS execution and Windows distribution signing remain unverified. See the [desktop pet guide](../../docs/DESKTOP-PETS_en.md).

Swift release builds omit debug information and its temporary paths so repeated preparation from the same source and toolchain can reproduce the tarball bytes. The npm app carries no debugger symbols.

发布入口在版本提交前运行 package、制备和 publisher 合同检查，然后等待完整制备成功后调用 publisher。`publish-npm` 为此产品选择 arm64 `xcode-27` 预览镜像，在创建发布凭据前检查所选 Xcode、Swift 和 SDK。其他产品沿用原 runner。原生命令失败时输出标准输出和标准错误。macOS 上装配 Windows 应用属于内容检查，不代表已执行 Windows 原生测试。Developer ID、公证、最低 macOS 实际运行与 Windows 正式分发签名仍未验证，详见[桌面宠物指南](../../docs/DESKTOP-PETS.md)。

Swift 发布构建关闭调试信息及其中的临时路径，使同一源码与工具链的重复制备能够生成字节一致的 tarball。npm 应用不携带调试符号。

Local development commands `node scripts/build-desktop-pet.mjs --output <absolute-directory>` and `node scripts/build-desktop-pet-windows.mjs --output <absolute-directory>` retain their platform-specific packages using the same application assembly. 本地开发命令保留各自平台的开发包入口，并复用相同的应用装配。
