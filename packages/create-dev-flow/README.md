# create-dev-flow

`@imotong/create-dev-flow` is the unified lifecycle manager for the supported Dev Flow Codex and DeepSeek Adapters.

```bash
npx @imotong/create-dev-flow@latest
```

It supports `status`, `doctor`, `install`, `upgrade`, `repair`, `reinstall`, `uninstall`, and
`factory-reset`. Codex and DeepSeek Harness are prerequisites. Factory reset requires a plan-bound confirmation;
ordinary `--yes` never authorizes user-data cleanup.
Codex global-package installation is tracked independently from receipt and Plugin registration, so uninstall and
factory reset still remove an installed package after registration has already disappeared.
The interactive interface reads the current locale: `zh*` locales use Simplified Chinese, and every other locale uses
English. JSON output remains language-neutral.

The package is distributed through npm `latest`; exact stable versions and release evidence are listed in the
repository Support Matrix.
