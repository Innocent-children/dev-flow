# dev-flow Release

日常发布从 GitHub Actions 手工运行 `publish-npm`，选择 `product=dev-flow`、`channel=stable` 和目标
版本；工作流使用固定发布检查。npm 包 `@imotong/dev-flow` 把
`Innocent-children/dev-flow` 的 `publish-npm.yml` 配置为允许 `npm publish` 的 GitHub Actions
Trusted Publisher；工作流通过 OIDC 认证，不使用长期 npm 发布 token。
`packages/dev-flow/package.json` 必须已是目标版本；失败后可用相同输入重跑，Publisher 会回读远端状态。

```bash
pnpm run release:dev-flow -- --version "<VERSION>" --output /absolute/output \
  --confirm "dev-flow-v<VERSION>"
```

The command requires clean synchronized `main`, creates or reuses the exact Tag, npm version and GitHub draft,
verifies registry tarball bytes, installs the registry package in an isolated prefix, runs a zero-mutation CLI smoke,
uploads the tarball and checksums, and then finalizes the Release. Rerun with the same output directory to recover.
Registry tarball read-back retries only propagation responses such as `ETARGET` and `E404` for up to
ten minutes; authentication failures and byte mismatches stop immediately.

## Desktop pet development artifact

`node scripts/build-desktop-pet.mjs --output <absolute-directory>` builds a local desktop pet package, signs the app ad hoc, and adds
`DevFlowPet.app` to that package's file list. The regular source package list and this release preparation omit the native app.
This build command neither publishes nor changes the release command. Developer ID signing, notarization, and minimum-system operation
are outside the verified local artifact scope. Installation and existing-app updates are documented in the
[desktop pet guide](../../docs/DESKTOP-PETS_en.md#local-build-and-installation).

`node scripts/build-desktop-pet.mjs --output <absolute-directory>` 构建本地桌面宠物包，使用 ad-hoc 签名，并将
`DevFlowPet.app` 加入该包的文件清单。常规源码包清单与本正式制备流程不包含原生应用。该构建命令不发布、
也不改变发布命令；Developer ID、公证和最低系统实际运行不在已验证的本地制品范围内。
安装及已有应用更新见[桌面宠物指南](../../docs/DESKTOP-PETS.md#本地构建与安装)。
