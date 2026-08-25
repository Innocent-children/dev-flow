# Quickstart: Unified Adapter Lifecycle Manager

These journeys describe the final package behavior. Feature implementation does not claim the unpublished command is
already available.

## Inspect Current State

```bash
npx create-dev-flow@latest status --host all
```

Expected: read-only Codex and known DeepSeek target states, current data policy and no persistent change.

## Interactive Lifecycle

```bash
npx create-dev-flow@latest
```

Choose an operation, Host, optional DeepSeek Profile/version and confirm the displayed plan. Default DeepSeek Profile
is `web`. Successful output contains actual target state, restart requirements and no additional command sequence.

## Install Codex

```bash
npx create-dev-flow@latest install --host codex --yes
```

Expected: install latest stable Adapter, run Codex setup, verify package/Core/registration and preserve existing Task
data. Missing or incompatible Codex exits before mutation with one next step.

## Install DeepSeek

```bash
npx create-dev-flow@latest install --host deepseek --profile web --yes
```

Expected: verify DSH, fetch/validate the Adapter in a manager temp root, install into `web`, clean the temp root and
report the Profile restart requirement. The terminal never exposes a user-managed tarball or PROFILE variable.

## Upgrade All Known Targets

```bash
npx create-dev-flow@latest upgrade --host all --all-known-profiles --yes
```

Expected: upgrade Codex plus manager-owned DeepSeek Profiles to npm latest. A second run verifies with zero mutation.

## Repair or Reinstall While Preserving Data

```bash
npx create-dev-flow@latest repair --host codex --yes
npx create-dev-flow@latest reinstall --host deepseek --profile web --yes
```

Repair performs the minimal action needed for ready state. Reinstall forces remove/install of the selected Adapter.
Both preserve user configuration and Task data.

## Uninstall and Retain Tasks

```bash
npx create-dev-flow@latest uninstall --host all --all-known-profiles --yes
```

Expected: remove owned Adapter package/registration/Profile contributions. User preferences, Task data, Host
executables, other plugins, sessions and repositories remain.

## Factory Reset

First request a plan:

```bash
npx create-dev-flow@latest factory-reset --host all --all-known-profiles --json
```

The result returns a reset token and exact impact categories. Then execute the current plan:

```bash
npx create-dev-flow@latest factory-reset --host all --all-known-profiles \
  --confirm-reset '<token>' --yes
```

Expected: remove all included Adapters, move confirmed configuration/data/manager resources to one reported Trash
root and leave Codex/DSH adjacent state untouched. `--yes` alone cannot authorize this operation.

## Clean Reinstall

```bash
npx create-dev-flow@latest factory-reset --host all --all-known-profiles \
  --reinstall --confirm-reset '<token>' --yes
```

Expected: after reset readback, create fresh active configuration/data and install the selected Adapters. Old data
remains only in the reported Trash root unless a separately confirmed permanent reset was requested.

## Recovery

Re-run the exact operation after a partial failure. Manager validates the saved plan against real current state and
continues only the safe remaining action. Ownership conflict, changed cleanup target or expired confirmation stops
with one bounded next step and no force overwrite.
