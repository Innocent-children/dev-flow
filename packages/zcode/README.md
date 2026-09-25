# TaskBelay for ZCode

TaskBelay preserves a development task's requirements, file scope, verification plan and progress across ZCode sessions. The Go Core remains the authority for its saved state.

This Adapter requires Node.js `>=24`, Git and ZCode with native plugins, local stdio MCP and process hooks. It targets Windows x64 and macOS arm64. Check the [verified platform coverage](https://github.com/Innocent-children/taskbelay/blob/main/docs/SUPPORT-MATRIX_en.md); macOS device verification is pending. Distribution currently uses source builds or local development packages.

## Install and activate

For a local Adapter package supplied by a maintainer:

```sh
npm install --global "<path-to-taskbelay-zcode.tgz>"
taskbelay-zcode setup --json
taskbelay-zcode status --json
```

Setup returns `action_required` and the local marketplace path. Open a ZCode workspace, then Settings → Plugins → Create → Add marketplace. Add that file, install and enable `taskbelay-zcode` from `taskbelay-zcode-local`, and start a new session. Check the Skill, plugin MCP server and Write/Edit Hook in ZCode. The CLI verifies the local package; it cannot verify the client has installed or loaded it. `partial` requires fixing local setup first.

For installation from source, see the [ZCode guide](https://github.com/Innocent-children/taskbelay/blob/main/docs/ZCODE_en.md). This package provides the Adapter, not the general manager or desktop application.

## Start and resume

In the repository you want to change, type `/` in ZCode and select the TaskBelay Skill under Skills, then describe your task. Review the assessment and approve the complete work/file/verification plan before implementation. A new branch in the current directory is the default; current-branch and dedicated-worktree modes are also supported.

To resume, reopen the original workspace and ask the Skill to continue the saved Task. Prepared workspaces and handoffs use retained receipts; the Adapter's `host-launch open|resume` returns UI instructions and does not pretend to launch a ZCode process.

## Maintain and remove

After updating local package files, refresh the marketplace in ZCode. If the package version is unchanged, uninstall and reinstall the plugin so its cached files are replaced. Start a new session for the current Hook configuration.

Ordinary removal retains Task data, workspaces and unrelated settings:

```sh
taskbelay-zcode remove --json
```

Follow the returned instructions to uninstall the plugin, remove its marketplace in ZCode, and close affected sessions. After explicitly confirming those steps:

```sh
taskbelay-zcode remove --confirm-host-removed --json
npm uninstall --global taskbelay-zcode
```

The confirmation command clears only the owned pending-removal record; it reports human confirmation, not an automatic ZCode UI check. Shared data reset and Git cleanup are separate operations. Use the same `TASKBELAY_DATA_DIR` for management and ZCode when overriding the default data directory.

[中文指南](https://github.com/Innocent-children/taskbelay/blob/main/docs/ZCODE.md) · [English guide](https://github.com/Innocent-children/taskbelay/blob/main/docs/ZCODE_en.md)
