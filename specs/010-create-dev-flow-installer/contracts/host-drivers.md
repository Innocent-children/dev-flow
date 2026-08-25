# Contract: Host Drivers

## Shared Rules

- Spawn executable plus argument array with `shell=false`.
- Use bounded output buffers and timeouts appropriate to package/profile lifecycle.
- Pass a closed environment; never expose npm credentials or child raw output in JSON result.
- Verify target artifact before reducing an existing installation's availability.
- Re-observe after every persistent command.
- An unrecognized output shape is a failure, not success or absence.

## Codex Driver

### Observe

```text
dev-flow-codex status --json
dev-flow-codex --version
```

`status --json` is read-only and projects package, Core, receipt and Codex registration state through existing Codex
lifecycle validators. It never creates config, receipt, marketplace or Plugin state.

### Mutate

```text
npm install --global dev-flow-codex@<target>
dev-flow-codex setup --json
dev-flow-codex remove --json
npm uninstall --global dev-flow-codex
```

Install/upgrade runs npm then setup then status. Uninstall runs status, remove, npm uninstall and final absence
readback. A missing/broken launcher with owned registration returns repair as the next step; manager does not edit
Codex config directly.

## DeepSeek Driver

### Observe

```text
dsh --version
dsh --profile <profile> --dump-config
```

Only an explicit/default/receipt Profile is observed. Dump-config parsing accepts the closed Dev Flow contribution
identity defined by tests.

### Artifact

```text
npm pack dev-flow-deepseek@<target> --json
```

The command runs inside one manager-created temporary directory. The JSON report must identify one safe tarball
basename with the requested package name and version before Profile mutation; package dry-pack and release contracts
own the complete packaged file/Core inventory validation.

### Mutate

```text
dsh plugin --profile <profile> remove dev-flow-deepseek
dsh plugin --profile <profile> add <canonical-temporary-tarball>
dsh --profile <profile> --dump-config
```

Fresh install uses add then readback. Upgrade/repair/reinstall with an existing or stale contribution uses verified
artifact, remove, absence readback, add and final readback. Uninstall uses remove and absence readback. Manager writes
or removes its Profile receipt only after matching DSH readback.

## Host Prerequisite Failure

Missing/incompatible Codex or DSH stops before Adapter mutation. The result gives one Host installation/update
command but the manager does not execute it.
