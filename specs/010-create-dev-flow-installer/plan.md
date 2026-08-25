# Implementation Plan: Unified Adapter Lifecycle Manager

## Summary

新增独立 npm package `create-dev-flow`，以零第三方运行时依赖的 Node.js CLI 编排 Codex 与 DeepSeek
Adapter lifecycle。Manager 读取真实状态、生成 closed plan、获得所需确认、调用 Host driver、保存
operation journal并回读目标状态。Codex driver复用 `dev-flow-codex` lifecycle CLI；DeepSeek driver
只调用公开 DSH lifecycle。Factory reset 通过独立 manager ownership root、精确 target identity 和
两阶段确认保护共享数据。

## Technical Context

- Repository: Node.js ESM packages in a pnpm monorepo; repository development requires Node.js `>=24`.
- Manager runtime: macOS arm64; package runtime floor低于 Adapter package的 Node.js `>=24`，精确值由 package contract 固定。
- Codex authority: `packages/codex/bin/dev-flow-codex.mjs`, `lib/lifecycle.mjs`, `lib/paths.mjs`.
- DeepSeek authority: `packages/deepseek/package.json`, DSH `plugin add/remove`, `--dump-config`.
- Shared configuration: `$HOME/.dev-flow/config.json`.
- Default product state: `$HOME/Library/Application Support/dev-flow`.
- Manager state: `$HOME/Library/Application Support/create-dev-flow`.
- Persistence disposition: `not-applicable`; no Core, Task, MCP or Schema change.

## Constitution Check

### Before design

- Core remains the only Task and process authority; manager does not read or write Core records.
- Host registration remains owned by Codex lifecycle and DSH lifecycle.
- Manager adds no state machine authority: its journal records external lifecycle effects and recovery handoff only.
- Product Feature and release remain separate; package publication, version release, Tag and GitHub effects are excluded.
- All tests use isolated roots and fake subprocesses; no real Host lifecycle or repository-wide suite is authorized.

### After design

- One direct manager package and two bounded Host drivers are sufficient; no provider framework or plugin registry is introduced.
- Closed operation/Host/Profile enums and explicit plan actions keep the public surface finite.
- Cleanup authority requires observed identity, manager receipt or Codex receipt, plan membership and confirmation.
- Runtime behavior is defined in executable parser, constants and tests; Feature Markdown is not imported.
- Documentation paths and targeted verification are enumerated in tasks before implementation.

## Existing System Baseline

### Codex

`dev-flow-codex setup --json` performs package/Core/Codex preflight, creates or validates fixed user config,
registers marketplace and Plugin, reads the registration back and writes an ownership receipt. `remove --json`
requires a matching receipt, removes only owned Plugin/marketplace state and deletes the receipt. npm install and
uninstall remain separate package actions. A new read-only `status --json` projection is required so the manager
can observe receipt/registration state without duplicating Codex ownership rules or invoking a mutating setup.

### DeepSeek

`dev-flow-deepseek` has no bin. DSH installs a packed npm artifact into one explicit Profile. Existing reliable
upgrade recovery requires target artifact verification before remove, then remove→add→dump-config. DSH exposes
no stable complete Profile enumeration, so manager scope is `web`, an explicit Profile, or its own receipt set.

### Data

Both Adapters use the same default Task data root and optional explicit `DEV_FLOW_DATA_DIR`. Ordinary Host remove
and npm uninstall retain Task data. `$HOME/.codex`, `$HOME/.dsh`, npm cache and target repositories contain
adjacent/unowned state and never become cleanup roots.

## Selected Architecture

### A. Closed lifecycle CLI

`packages/create-dev-flow/bin/create-dev-flow.mjs` delegates parsing and interaction to `lib/cli.mjs`. The parser
accepts exactly the operations and options in `contracts/cli.md`. Interactive mode produces the same normalized
request as non-interactive mode. JSON output writes exactly one result object to stdout.

### B. Observe → plan → confirm → execute → verify

`lib/lifecycle.mjs` coordinates one linear pipeline. `lib/plan.mjs` is a pure function over normalized request and
observed state. It emits ordered actions, impacts, restart facts and required confirmation class. Execution never
adds an action that was absent from the confirmed plan. Re-observation after each persistent boundary decides the
next safe action or recovery handoff.

### C. Host drivers

`lib/hosts/codex.mjs` calls npm and `dev-flow-codex status/setup/remove --json` plus `--version` using argument
arrays. `packages/codex` adds read-only `status [--json]` backed by existing receipt and registration validators.
`lib/hosts/deepseek.mjs` calls DSH version, plugin remove/add and dump-config; artifacts live in a unique temp root
and are inspected before existing availability is reduced.

### D. Ownership, receipts and journal

`lib/ownership.mjs` resolves canonical non-symlink roots, validates Profile names, writes manager files atomically
with restrictive permissions and rejects paths outside closed roots. DeepSeek receipts record only Profiles the
manager installed or explicitly adopted. `lib/journal.mjs` stores operation identity, plan digest, observed target
identities, completed action IDs, current failure and next step. It is external lifecycle evidence, not a process
cursor or Host registration authority.

### E. Destructive reset

Factory reset requires a saved plan whose token is derived from the plan digest and observed target identities.
Interactive mode asks for that token; non-interactive mode requires `--confirm-reset`. `--yes` cannot satisfy it.
The default action moves confirmed targets to one unique `$HOME/.Trash/create-dev-flow-*` root. Permanent deletion
requires `--permanent` plus a second confirmation bound to the same plan. Explicit data roots require exact path
confirmation. Cross-volume rename failure leaves the source unchanged and returns one manual next step.

### F. Presentation and documentation

`lib/presentation.mjs` renders localized zh-CN/en rich output with system-language selection and plain fallback.
Other locales fall back to English at runtime. All maintained documentation locales describe the one lifecycle
entry; Host-native commands remain precise diagnostic/recovery references.

## Components and Exact Source Surfaces

| Component | Paths | Responsibility |
| --- | --- | --- |
| Manager manifest/entry | `packages/create-dev-flow/package.json`, `packages/create-dev-flow/bin/create-dev-flow.mjs` | npm identity and executable entry |
| Request/presentation | `packages/create-dev-flow/lib/cli.mjs`, `packages/create-dev-flow/lib/presentation.mjs` | Closed parser, interactive request, rich/plain/JSON output |
| Lifecycle pipeline | `packages/create-dev-flow/lib/lifecycle.mjs`, `packages/create-dev-flow/lib/plan.mjs` | Observe, plan, confirm, execute, verify |
| Host drivers | `packages/create-dev-flow/lib/hosts/codex.mjs`, `packages/create-dev-flow/lib/hosts/deepseek.mjs` | Exact npm/Codex/DSH subprocess contracts |
| Ownership/recovery | `packages/create-dev-flow/lib/ownership.mjs`, `packages/create-dev-flow/lib/journal.mjs` | Canonical paths, receipts, atomic journal, Trash/permanent cleanup |
| Codex readback | `packages/codex/bin/dev-flow-codex.mjs`, `packages/codex/lib/lifecycle.mjs` | New read-only status projection using existing authority |
| Package tests | `packages/create-dev-flow/tests/*.test.mjs`, affected `packages/codex/tests/*.test.mjs` | Isolated contract and lifecycle verification |
| Repository closure | `tests/contract/package_manifest_test.go`, `scripts/validate-repository.sh` | New package manifest and targeted validation inventory |
| Documentation | all paths listed in tasks | Synchronized public command and lifecycle behavior |

## Data and Compatibility

No Core or Task migration occurs. Manager JSON records are new product-owned files defined in `data-model.md` and
`contracts/ownership.md`. Unknown fields and invalid records safe-stop mutation. Existing manual DeepSeek installs
remain external until an explicit Profile readback passes and the user confirms adoption. Existing Codex receipt
continues to own registration; manager never rewrites it.

## Recovery Boundaries

- Preflight/artifact failure: zero persistent Host change.
- Package installed, Host setup failed: journal reports package installed and one setup recovery step.
- DeepSeek remove completed, add failed: journal retains exact Profile and verified target artifact identity; resume
  re-observes before add.
- Readback mismatch: stop with completed effects; do not guess success.
- Cleanup moved one target then failed: journal lists moved targets and remaining targets; resume never moves the same
  source twice.
- Manager journal conflict or ownership conflict: zero force repair; report exact bounded target category.

## Test Budget

The Feature authorizes deterministic isolated checks only:

1. `node --test packages/create-dev-flow/tests/*.test.mjs`
2. affected Codex launcher/lifecycle tests for `status --json`
3. `go test ./tests/contract -run 'Test(ProjectPackageManifests|PackageManifest)'`
4. package dry-pack inspection for `packages/create-dev-flow`

No repository-wide `pnpm run validate`, real Codex/DSH journey, registry lifecycle, release command or publication
is authorized. A later release contract chooses the manager version, release mode and final registry smoke.

## Complexity Review

Retained complexity is limited to two Host drivers because their lifecycle authorities differ, an operation journal
because npm and Host changes are not atomic, and a separate ownership module because factory reset is destructive.
The design uses no generic provider framework, dependency injection container, workflow DSL, background daemon,
Profile scanner, database or telemetry service. Pure plan functions and injected subprocess/filesystem adapters make
the required destructive scenarios testable without real user effects.

## Risks

- DSH output may change across supported releases; driver parsing must close accepted projections and fail before
  ownership mutation when incompatible.
- npm install and Host registration cannot commit atomically; the journal and re-observation provide bounded recovery.
- Explicit data may reside on another volume; recoverable Trash move can fail with `EXDEV` and must safe-stop.
- New package publication needs a separately authorized release contract before the documented command is usable.
- Nine root README locales and paired technical docs create synchronization risk; exact paths and command invariants
  are part of the task plan and tests.
