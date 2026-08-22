# DeepSeek Release

DeepSeek uses an independent one-command release flow with the same operator interface as Codex:

```bash
pnpm run release:deepseek -- \
  --mode quick|normal \
  --version "<DEEPSEEK_VERSION>" \
  --output "<ABSOLUTE_DIRECTORY>" \
  --confirm "deepseek-v<DEEPSEEK_VERSION>" \
  [--confirm-comprehension]
```

The command updates only `packages/deepseek/package.json`, commits
`release(deepseek): v<DEEPSEEK_VERSION>`, and uses Tag `deepseek-v<DEEPSEEK_VERSION>`. The packaged
Core version comes from `CORE_VERSION` and is recorded independently.

Preparation creates exactly:

```text
dev-flow-deepseek-<DEEPSEEK_VERSION>.tgz
dev-flow-core-<CORE_VERSION>-darwin-arm64
SHA256SUMS
release-manifest.json
publication-record.json
```

Confirmed publication creates or reuses matching Tag/npm/GitHub state, verifies registry bytes,
runs the selected exact DSH `0.1.0-rc.8` registry lifecycle gate, uploads immutable assets, and
finalizes the GitHub Release only after every prior step passes. Rerunning the exact command with the
same output directory resumes from recorded and reread remote state.
