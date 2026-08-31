# @imotong/dev-flow

`@imotong/dev-flow` is the Host-neutral lifecycle and Control Center CLI for Dev Flow.

```bash
npm install -g @imotong/dev-flow@latest
dev-flow
```

Lifecycle commands manage Codex and DeepSeek Adapters while preserving the shared Core boundary:

```bash
dev-flow status
dev-flow doctor
dev-flow install
dev-flow upgrade
dev-flow repair
dev-flow reinstall
dev-flow uninstall
dev-flow factory-reset
```

The public Control Center commands are independent of either Host:

```bash
dev-flow webui start
dev-flow webui open
dev-flow webui status
dev-flow webui stop
dev-flow webui reset
```

The launcher validates installed Adapter receipts and package identities, selects the newest available compatible
Core, and forwards only the closed WebUI command surface. It does not persist another Core or workflow state.
`dev-flow webui start` creates the product-owned default data directory with mode `0700` when it is absent. Explicit
`DEV_FLOW_DATA_DIR` values must already name canonical directories; all other WebUI commands remain zero-write.

The rich first-install result shows the Dev Flow mark, verified Host states, conversation selectors, WebUI commands,
and lifecycle commands. `zh*` locales use Simplified Chinese; every other locale uses English. Plain and JSON modes
remain automation-safe.
While install, upgrade, repair, or reinstall is running, rich and plain text output shows each Host action and each
completed package, registration, artifact, and readiness step. JSON mode remains a single result object with no
progress lines.
Codex uninstall first runs the installed Adapter's idempotent `remove`, which validates the runtime receipt and stops the matching WebUI before deregistration. If that stop fails, the global package is retained for a safe retry.
