# dev-flow Release

日常发布从 GitHub Actions 手工运行 `publish-npm`，选择 `product=dev-flow`、`channel=stable`、
`mode=normal`、目标版本并勾选 `confirm_comprehension`。npm 包 `@imotong/dev-flow` 把
`Innocent-children/dev-flow` 的 `publish-npm.yml` 配置为允许 `npm publish` 的 GitHub Actions
Trusted Publisher；工作流通过 OIDC 认证，不使用长期 npm 发布 token。
`packages/dev-flow/package.json` 必须已是目标版本；失败时下载 workflow artifact 查看
`publication-record.json`，再用相同输入重跑。

```bash
pnpm run release:dev-flow -- --mode normal --version 0.1.1 --output /absolute/output \
  --confirm dev-flow-v0.1.1 --confirm-comprehension
```

The command requires clean synchronized `main`, creates or reuses the exact Tag, npm version and GitHub draft,
verifies registry tarball bytes, installs the registry package in an isolated prefix, runs a zero-mutation CLI smoke,
uploads the tarball and checksums, and then finalizes the Release. Rerun with the same output directory to recover.
