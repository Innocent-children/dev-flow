# ZCode guide

[中文](ZCODE.md) | [English](ZCODE_en.md)

This guide covers the native Dev Flow plugin for Zhipu ZCode. The Adapter is available through source or local development packages, with no published stable npm installation entry yet. Targets are Windows x64 and macOS arm64; native macOS validation remains pending. See the [support matrix](SUPPORT-MATRIX_en.md) for actual records.

## Install and enable

Use Node.js `>=24`, Git and a ZCode installation providing native plugins, Skills, MCP and Hooks. Complete ZCode's own sign-in and permission setup.

Source installation also requires Go `>=1.26` and pnpm `>=11 <12`. Run from the repository root:

```sh
pnpm dev-flow:local -- install --host zcode --yes
node packages/dev-flow/bin/dev-flow.mjs status --host zcode
node packages/dev-flow/bin/dev-flow.mjs doctor --host zcode
```

The source entry builds local packages and uses the current manager; it does not upgrade an existing global `dev-flow`. If a maintainer supplies a local tarball, install it without compiling Go:

```sh
npm install --global "<path-to-dev-flow-zcode.tgz>"
dev-flow-zcode setup --json
dev-flow-zcode status --json
```

`setup` validates and prepares the local plugin source, returning `action_required` and `next_steps`. Complete these steps in ZCode:

1. Open **Settings → Plugins → Create → Add marketplace**.
2. Use the returned local marketplace path, then install and enable `dev-flow-zcode`.
3. Start a new session to activate plugin hooks; review plugin, MCP and permission prompts.
4. Enter `/` in the input, open **Skills** and select `dev-flow`. Use the actual name shown by ZCode.

The Adapter has no reliable interface for observing ZCode's plugin loading or cache state. After successful preparation, `status` therefore remains `action_required`, with `registration.host=unverified`. This does not establish sign-in or a verified model session. Unified `doctor` exits 1 for this state because Host readiness remains unverified; `partial` means local preparation or validation is incomplete and requires resolving diagnostics first. See the official [ZCode plugin guide](https://zcode.z.ai/en/docs/plugin) and [Hooks guide](https://zcode.z.ai/en/docs/hooks).

## Start and resume tasks

Open the repository you intend to change, select the Dev Flow Skill and send:

```text
Use Dev Flow to add failed-login rate limiting, changing only authentication files.
```

ZCode first assesses the request and offers direct work or Dev Flow. Dev Flow defaults to a new branch in the current directory, with current-branch and dedicated-worktree alternatives. Specify the target branch and whether existing uncommitted contents belong to the task. Dedicated worktrees also require a source, starting branch and destination. A task can include up to eight explicitly selected repositories; all must be prepared before Core Task creation.

Review and approve the complete requirements, design, work items, expected files and verification plan before implementation. When another workspace is needed, the Adapter returns prepared directories and a continuation prompt. Open those directories through ZCode's actual interface and grant the required access. A returned descriptor does not establish that a workspace or session was opened.

To resume, return to the original directory, select the same Skill and explicitly request continuation of the saved task. Read existing state and launch records first; an uncertain result does not permit duplicate task or worktree creation. Restore a missing or replaced directory instance, or explicitly abandon the task.

You may request cancellation while retaining files. Completion and cancellation release task claims and retain files and branches; dedicated-worktree and branch cleanup need separate authorization. Workspace relocation requires every repository to use a dedicated worktree; local modes resume in place. Obtain and retain Core's complete preparation result before moving, verifying the same Task and all source directories. Read existing records when the outcome is uncertain instead of repeating the move. Another relocation can start after Core verifies the completed one.

## File scope and permissions

The native PreToolUse Hook checks targets before ZCode **Write** and **Edit** operations. Unplanned writes and unavailable checks deny the operation. Follow Core's instructions for allowing one operation, revising the plan or restoring files. Allowing a path does not override ZCode permissions. Hook updates require a new session.

Shell and external-program writes may happen before Core observes them. Do not switch tools to bypass a rejection. Use OpenSpec, Spec Kit and code indexes only where actually available; a missing tool is not completed work.

## Maintenance and progress

Source-install users should continue from the repository root:

```sh
pnpm dev-flow:local -- repair --host zcode --yes
node packages/dev-flow/bin/dev-flow.mjs webui start
node packages/dev-flow/bin/dev-flow.mjs webui stop
```

Maintenance updates the local source. Follow `next_steps` to refresh or reinstall the plugin in ZCode and start a new session; source updates at the same version also require cache refresh. WebUI can filter ZCode Tasks and display saved progress. The desktop pet additionally requires the desktop app; installing an Adapter alone does not provide it. See the [desktop pet guide](DESKTOP-PETS_en.md).

## Removal and retained data

End relevant ZCode sessions, stop WebUI instances started through this Adapter, then request removal through the source manager:

```sh
node packages/dev-flow/bin/dev-flow.mjs uninstall --host zcode --yes
```

With only the Adapter package, first run `dev-flow-zcode remove --json`. Ordinary removal returns `action_required`; the unified manager also retains the Adapter package and removal record so the confirmation command remains available. It cannot confirm deletion of ZCode's cache. Uninstall the plugin and remove its marketplace in the ZCode UI, then close the relevant sessions.

After those UI actions have actually finished, run these commands while the global package is still present to confirm Host removal and uninstall the Adapter package:

```sh
dev-flow-zcode remove --confirm-host-removed --json
npm uninstall --global dev-flow-zcode
```

This returns `absent` and `registration.host=user_confirmed_removed`, recording user confirmation rather than automatic observation. After confirmation, you may alternatively repeat `uninstall --host zcode --yes` with the same manager entry above to remove the package. Ordinary maintenance and removal retain Task data and unrelated settings. The manager rejects `factory-reset` while a ZCode package or installation record remains because it cannot reliably enumerate Core processes in ZCode's cache. If you intend to clear data, finish UI removal, close sessions, confirm removal and uninstall the global package before using the manager's separate reset flow.

`DEV_FLOW_DATA_DIR` selects an existing canonical absolute data directory and must match across ZCode, MCP and the manager. Defaults are `~/.dev-flow/data` on macOS and `%LOCALAPPDATA%\dev-flow\data` on Windows.

See the [command reference](COMMANDS_en.md) for all entries and [project status](PROJECT-STATUS_en.md) for actual checks and remaining acceptance work.
