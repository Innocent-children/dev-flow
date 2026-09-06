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

`scripts/build-desktop-pet.mjs --output <absolute-directory>` prepares an ad-hoc-signed local desktop
pet package for functional development. It is a Node script invoked with `node`; it does not publish
or alter this release command. Developer ID signing, notarization, and integration of the native app
into the public release preparation remain outside that development checkpoint.

桌面宠物的本地功能包由 `node scripts/build-desktop-pet.mjs --output <absolute-directory>` 生成，使用
ad-hoc 签名。它不发布或改动本发布命令；Developer ID、公证和原生应用接入正式发布制备仍属于后续
正式分发工作。
