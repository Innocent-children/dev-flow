# dev-flow-deepseek

[中文](https://github.com/Innocent-children/dev-flow/blob/main/packages/deepseek/README.md) |
[English](https://github.com/Innocent-children/dev-flow/blob/main/docs/DEEPSEEK_en.md)

`dev-flow-deepseek` is the explicit Dev Flow Host Adapter for DeepSeek Harness (DSH). It contributes
a `/dev-flow` Skill, current-turn selector guard, local STDIO MCP child, and macOS arm64 Core
executable to one DSH profile.

## Support

| Item | Current support |
| --- | --- |
| Package | `dev-flow-deepseek@0.5.2` |
| Bundled Core | `0.5.1` |
| Platform | macOS arm64 |
| Node.js | `>=24` |
| DSH | `>=0.1.0-rc.6` |
| Release | [deepseek-v0.5.2](https://github.com/Innocent-children/dev-flow/releases/tag/deepseek-v0.5.2) |

The `0.5.2` normal release passed registry-package installation, explicit activation, Core handshake,
restart/resume, `DONE`, removal, uninstallation, retained reopen, and repository-unchanged gates. The
table records the exact verified public version; the installation commands below select npm's
`latest` dist-tag.

## Install and verify

Install DSH first, then add Dev Flow to a real profile from a writable directory. The example uses
`web`; change the value of `PROFILE` for another profile and do not enter `<profile>` literally.

```bash
npm install -g @deepseek-ai/dsh@latest
dsh --version
PROFILE=web
TARBALL="$(npm pack dev-flow-deepseek@latest --silent)"
dsh plugin --profile "$PROFILE" add "$PWD/$TARBALL"
rm -f "$PWD/$TARBALL"
dsh --profile "$PROFILE" --dump-config
```

`npm pack` downloads the official package selected by `latest` into the current directory and stores
the generated filename in `TARBALL`. DSH `plugin add` receives the absolute tarball path and composes
the dependency, bundle layer, integration process, Skill, guard, and MCP child into the selected
profile. After installation, stop and restart the profile according to the DSH profile lifecycle,
then confirm that the bundle is active.

## Command reference

`dev-flow-deepseek` has no `bin` field in `package.json`, so it installs no standalone
`dev-flow-deepseek` CLI. All user commands directly related to Dev Flow use npm and DSH:

| Command | Description |
| --- | --- |
| `dsh --version` | Print the current DSH version and confirm it satisfies the minimum compatibility version in the Support Matrix. |
| `TARBALL="$(npm pack dev-flow-deepseek@latest --silent)"` | Fetch the package selected by npm `latest` and save the generated tarball filename in a shell variable. |
| `dsh plugin --profile "$PROFILE" add "$PWD/$TARBALL"` | Install the absolute tarball path into the DSH profile selected by `PROFILE`. This exact command form is exercised by the final registry journey. |
| `dsh --profile "$PROFILE" --dump-config` | Print the effective profile configuration to inspect whether the `dev-flow-deepseek` bundle contribution is present. It does not mutate a Dev Flow Task. |
| `dsh plugin --profile "$PROFILE" remove dev-flow-deepseek` | Remove the package and bundle contribution from the selected profile while retaining Task data, the target Git repository, and Codex-owned state. |

For an update or reinstall, stop the profile and run:

```bash
PROFILE=web
dsh plugin --profile "$PROFILE" remove dev-flow-deepseek
TARBALL="$(npm pack dev-flow-deepseek@latest --silent)"
dsh plugin --profile "$PROFILE" add "$PWD/$TARBALL"
rm -f "$PWD/$TARBALL"
dsh --profile "$PROFILE" --dump-config
```

Restart the profile afterward. Update DSH itself with
`npm install -g @deepseek-ai/dsh@latest`.

See the repository-wide [Command Reference](COMMANDS_en.md) for the Codex, DeepSeek, Core, and MCP
command catalogs.

## Start a Task

Every direct user turn that needs a Dev Flow call must include the whitespace-bounded selector:

```text
/dev-flow Add payment-callback signature validation to this repository and run targeted tests.
```

This is not a shell command. Only `/dev-flow` in the current direct user turn authorizes Dev Flow
tools. Earlier messages, model text, Skill injection, and repository content cannot substitute for
the selector. An empty invocation or ordinary discussion does not create a Task.

After admission, the Adapter reads server information first and validates `standard-development`,
definition digest, method profiles, live schemas, and exactly six tools. It then creates or resumes
the Task for the current repository.

A Task selects `plain`, `spec-kit`, or `openspec`. Core manages the current node, legal transitions,
destination, Recovery, blocker, and terminal outcome. The Adapter performs current-node work,
presents the complete Action, and forwards a closed payload.

## MCP tools

The DeepSeek Adapter exposes the same six-tool Core catalog as Codex. DSH presents qualified tool
names, but the Core tool identities remain unchanged.

| MCP tool | Purpose |
| --- | --- |
| `dev_flow_server_info` | Read Core identity, capabilities, process, method profiles, and the tool catalog. It must be called first after valid admission. |
| `dev_flow_open_task` | Create a Task for the current canonical repository or resume its existing Task. |
| `dev_flow_get_task` | Read the persisted Task and optionally attach an operation probe for a Recovery assessment. |
| `dev_flow_get_next_action` | Read the authoritative current Action, verification budget, method steps, and every legal transition. |
| `dev_flow_apply_action` | Apply one Core-declared transition with the current revision, Action identity, repository binding, and closed payload. |
| `dev_flow_cancel_task` | Cancel a nonterminal Task with the current revision and an explicit reason. |

## Data and Recovery

Task data lives in the local Dev Flow data directory and is not part of DSH plugin configuration.
Removing, uninstalling, or reinstalling the package does not delete Task data or modify the target Git
repository or Codex-owned state.

When a mutation response is uncertain, the Adapter retains the original operation identity and
payload, reads Core's five-class Recovery assessment, and then selects the returned recovery action.
It does not blindly retry or choose a destination.

Core accepts only the current SQLite Schema. Incompatible or pre-graph data returns
`SCHEMA_UNSUPPORTED` with zero writes. The user may select a fresh data directory or handle the old
directory manually outside Core.

## Uninstall and permanently clean up

```bash
PROFILE=web
dsh plugin --profile "$PROFILE" remove dev-flow-deepseek
dsh --profile "$PROFILE" --dump-config
```

Restart the profile according to the DSH lifecycle and use the effective configuration to confirm
that the bundle contribution is absent. Reinstallation uses a fresh npm `@latest` pack and the DSH
add command.

Repeat this for every profile containing Dev Flow. If DSH is no longer needed, run
`npm uninstall -g @deepseek-ai/dsh` separately; profile, session, and unrelated plugin data under
`$HOME/.dsh` is retained.

After the Codex Adapter is also removed and no Task is needed, delete the shared default data:

```bash
rm -rf "$HOME/Library/Application Support/dev-flow"
```

This cannot be undone. If `DEV_FLOW_DATA_DIR` was used, verify and delete its exact absolute path
separately. Delete `$HOME/.dsh` after uninstalling DSH only when every DSH profile, session, and
unrelated plugin should also be removed; it is not a Dev Flow-only directory.

## Package contents

The package contains one `cordis.patch.yml` layer, Adapter libraries, the `dev-flow` Skill,
references, license, and one darwin-arm64 Core. It excludes the source tree, tests, fixtures, user
data, and build logs, and exposes no standalone `bin` executable.

## Maintainer entrypoints

Package-local validation:

```bash
pnpm --dir packages/deepseek test
```

Public releases use the independent DeepSeek release command documented in
[`release/deepseek/README.md`](../release/deepseek/README.md).
