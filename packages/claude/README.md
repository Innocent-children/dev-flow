# TaskBelay for Claude Code

TaskBelay keeps a development task's requirements, file scope, verification plan and progress available across Claude Code sessions.

This Adapter requires Node.js `>=24`, Git and Claude Code `>=2.1.270`. Check the [support matrix](https://github.com/Innocent-children/taskbelay/blob/main/docs/SUPPORT-MATRIX_en.md) for platform verification and remaining limits.

## Install and verify

Install the published Adapter:

```sh
npm install --global taskbelay-claude@latest
taskbelay-claude setup --json
taskbelay-claude status --json
```

For a maintainer-provided local tarball, replace `taskbelay-claude@latest` with its path.

Installation status should be `ready`. Reload Claude plugins or start a new session, review the permission prompts and complete Claude sign-in. This package provides the Adapter; the general `taskbelay` manager and desktop application are separate.

For installation from the repository, follow the [source installation guide](https://github.com/Innocent-children/taskbelay/blob/main/docs/CLAUDE_en.md#install-from-this-repository).

## Start and resume

In the code repository you want to change, send:

```text
/taskbelay-claude:taskbelay Add failed-login rate limiting, changing only authentication files.
```

Review the assessment, choose the workspace and approve the complete plan before implementation. To resume, reopen the original directory and conversation and explicitly ask the same skill to continue the saved task.

## Maintain or remove

The [Host guide](https://github.com/Innocent-children/taskbelay/blob/main/docs/CLAUDE_en.md) covers diagnostics and maintenance, including the separate build steps for source installations.

To remove only this Adapter, end its Claude sessions and stop any WebUI you started, then run:

```sh
taskbelay-claude remove --json
npm uninstall --global taskbelay-claude
```

Ordinary removal retains task data and unrelated Claude configuration. Worktree deletion, branch deletion and data reset are separate operations.

[中文指南](https://github.com/Innocent-children/taskbelay/blob/main/docs/CLAUDE.md) · [English guide](https://github.com/Innocent-children/taskbelay/blob/main/docs/CLAUDE_en.md)
