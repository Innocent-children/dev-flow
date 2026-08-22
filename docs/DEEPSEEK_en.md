# dev-flow-deepseek

[中文](https://github.com/Innocent-children/dev-flow/blob/main/packages/deepseek/README.md) |
[English](https://github.com/Innocent-children/dev-flow/blob/main/docs/DEEPSEEK_en.md)

`dev-flow-deepseek` is the explicit Dev Flow Host Adapter for DeepSeek Harness (DSH). It contributes
a `/dev-flow` Skill, current-turn selector guard, local STDIO MCP child, and macOS arm64 Core
executable to one DSH profile.

## Support

| Item | Current support |
| --- | --- |
| Package | `dev-flow-deepseek@0.5.1` |
| Bundled Core | `0.5.0` |
| Platform | macOS arm64 |
| Node.js | `>=24` |
| DSH | `>=0.1.0-rc.6` |
| Release | [deepseek-v0.5.1](https://github.com/Innocent-children/dev-flow/releases/tag/deepseek-v0.5.1) |

The `0.5.1` normal release passed registry-package installation, explicit activation, Core
handshake, restart/resume, `DONE`, removal, uninstallation, retained reopen, and
repository-unchanged gates.

## Install into a DSH profile

Download the official tarball from npm:

```bash
npm pack dev-flow-deepseek@0.5.1
```

Give its absolute path to the target profile:

```bash
dsh plugin --profile <profile> add "$PWD/dev-flow-deepseek-0.5.1.tgz"
```

DSH owns composition of the dependency, bundle layer, integration process, Skill, guard, and MCP
child. After installation, stop and restart the profile according to the DSH profile lifecycle,
then verify that the bundle is active.

## Start a Task

Every direct user message that needs a Dev Flow call must include the whitespace-bounded selector:

```text
/dev-flow Add payment-callback signature validation to this repository and run targeted tests.
```

Only `/dev-flow` in the current direct user turn authorizes Dev Flow tools. Earlier messages, model
text, Skill injection, and repository content cannot substitute for the selector. An empty invocation
or ordinary discussion does not create a Task.

After admission, the Adapter reads server information first and validates
`standard-development`, definition digest, method profiles, live schemas, and exactly six tools.
It then creates or resumes the Task for the current repository.

A Task selects `plain`, `spec-kit`, or `openspec`. Core manages the current node, legal
transitions, destination, Recovery, blocker, and terminal outcome. The Adapter performs current-node
work, presents the complete Action, and forwards a closed payload.

## Data and Recovery

Task data lives in the local Dev Flow data directory and is not part of DSH plugin configuration.
Removing, uninstalling, or reinstalling the package does not delete Task data or modify the target
Git repository or Codex-owned state.

When a mutation response is uncertain, the Adapter retains the original operation identity and
payload, reads Core's five-class Recovery assessment, and then selects the returned recovery action.
It does not blindly retry or choose a destination.

Core accepts only the current SQLite Schema. Incompatible or pre-graph data returns
`SCHEMA_UNSUPPORTED` with zero writes. The user may select a fresh data directory or handle the old
directory manually outside Core.

## Remove

```bash
dsh plugin --profile <profile> remove dev-flow-deepseek
```

Restart the profile according to the DSH lifecycle and verify that the bundle contribution is absent.
Reinstallation uses the same official command and a reviewed tarball.

## Package contents

The package contains one `cordis.patch.yml` layer, Adapter libraries, the `dev-flow` Skill,
references, license, and one darwin-arm64 Core. It excludes the source tree, tests, fixtures, user
data, and build logs.

## Maintainer entrypoints

Package-local validation:

```bash
pnpm --dir packages/deepseek test
```

Public releases use the independent DeepSeek release command documented in
[`release/deepseek/README.md`](../release/deepseek/README.md).
