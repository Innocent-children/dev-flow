# DeepSeek Release

日常发布从 GitHub Actions 手工运行 `publish-npm`：选择 `product=deepseek`、channel、mode 和目标版本；
normal 模式必须勾选 `confirm_comprehension`。工作流需要仓库 secret `NPM_TOKEN`，并在
`macos-15` ARM64 runner 上调用下面同一个命令。失败时下载 workflow artifact 查看发布记录，再用
相同输入重跑；publisher 会回读并复用已创建的不可变远端状态。

DeepSeek uses an independent one-command release flow with the same operator interface as Codex:

```bash
pnpm run release:deepseek -- \
  [--channel stable|beta] \
  --mode quick|normal \
  --version "<DEEPSEEK_VERSION>" \
  --output "<ABSOLUTE_DIRECTORY>" \
  --confirm "deepseek-v<DEEPSEEK_VERSION>" \
  [--confirm-comprehension]
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
SHA256SUMS
release-manifest.json
publication-record.json
```

Confirmed publication creates or reuses matching Tag/npm/GitHub state, verifies registry bytes,
runs the selected DSH `>=0.1.0-rc.6` registry lifecycle gate, uploads immutable assets, and
finalizes the GitHub Release only after every prior step passes. The lifecycle gate installs the exact
registry package, verifies package/Core identity and the host handshake, then verifies removal,
uninstall, and an unchanged repository. Complete graph, recovery, and terminal-state behavior remains
covered by deterministic Core and integration tests. Rerunning the exact command with the same output
directory resumes from recorded and reread remote state.
