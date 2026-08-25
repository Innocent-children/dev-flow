# create-dev-flow

`@imotong/create-dev-flow` is the unified lifecycle manager for the supported Dev Flow Codex and DeepSeek Adapters.

```bash
npx @imotong/create-dev-flow@latest
```

It supports `status`, `doctor`, `install`, `upgrade`, `repair`, `reinstall`, `uninstall`, and
`factory-reset`. Codex and DeepSeek Harness are prerequisites. Factory reset requires a plan-bound confirmation;
ordinary `--yes` never authorizes user-data cleanup.

The package is currently implemented in the repository but is not available from npm until a separately authorized
release completes.
