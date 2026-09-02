# DeepSeek Release

日常发布从 GitHub Actions 手工运行 `publish-npm`：选择 `product=deepseek`、channel 和目标版本；
工作流使用固定发布检查。npm 包 `dev-flow-deepseek` 把
`Innocent-children/dev-flow` 的 `publish-npm.yml` 配置为允许 `npm publish` 的 GitHub Actions
Trusted Publisher；工作流通过 OIDC 认证，并在 `macos-15` ARM64 runner 上调用下面同一个命令。
失败时下载 workflow artifact 查看发布记录，再用
相同输入重跑；publisher 会回读并复用已创建的不可变远端状态。

DeepSeek uses an independent one-command release flow with the same operator interface as Codex:

```bash
pnpm run release:deepseek -- \
  [--channel stable|beta] \
  --version "<DEEPSEEK_VERSION>" \
  --output "<ABSOLUTE_DIRECTORY>" \
  --confirm "deepseek-v<DEEPSEEK_VERSION>"
```

The default `stable` channel accepts `MAJOR.MINOR.PATCH`, requires clean synchronized `main`, and
synchronizes maintained public release-version descriptions. The `beta` channel accepts only
`MAJOR.MINOR.PATCH-beta.N`, permits any clean named branch, pushes the version commit to that branch,
keeps stable public identities unchanged, publishes npm with dist-tag `beta`, and marks the GitHub
Release as a prerelease. Both channels commit `release(deepseek): v<DEEPSEEK_VERSION>` and use Tag
`deepseek-v<DEEPSEEK_VERSION>`. The packaged Core version comes from `CORE_VERSION` and is recorded
independently.

Preparation creates exactly:

```text
dev-flow-deepseek-<DEEPSEEK_VERSION>.tgz
dev-flow-core-<CORE_VERSION>-darwin-arm64
dev-flow-core-<CORE_VERSION>-windows-amd64.exe
SHA256SUMS
release-manifest.json
```

The repository does not store either DeepSeek Core executable. `packages/deepseek/package.json`
declares their final package paths, while release preparation checks out the frozen source twice and
uses `scripts/build-deepseek-local.mjs` to build both runtime pairs in temporary staging directories.
The resulting tarballs must be byte-identical before either one becomes the prepared npm artifact.

Confirmed publication creates or reuses matching Tag/npm/GitHub state, verifies registry tarball
bytes, uploads both standalone Core assets, and finalizes the GitHub Release. DSH lifecycle and Task behavior
remain covered by product tests and do not run inside publication.
The npm tarball read-back retries only propagation responses such as `ETARGET` and `E404` for up to
ten minutes; authentication failures and byte mismatches stop immediately.
