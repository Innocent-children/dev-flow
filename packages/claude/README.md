# Dev Flow for Claude Code

Dev Flow keeps a development task's requirements, file scope, verification plan and progress available across Claude Code sessions.

This Adapter requires Node.js `>=24`, Git and Claude Code `>=2.1.270`. Check [availability and verified platforms](https://github.com/Innocent-children/dev-flow/blob/main/docs/SUPPORT-MATRIX_en.md) before installation. The Claude integration is currently distributed through source or local development packages.

## Install and verify

For a local Adapter package supplied by a maintainer:

```sh
npm install --global "<path-to-dev-flow-claude.tgz>"
dev-flow-claude setup --json
dev-flow-claude status --json
```

Installation status should be `ready`. Reload Claude plugins or start a new session, review the permission prompts and complete Claude sign-in. This package provides the Adapter; the general `dev-flow` manager and desktop application are separate.

For installation from the repository, follow the [source installation guide](https://github.com/Innocent-children/dev-flow/blob/main/docs/CLAUDE_en.md#install-from-this-repository).

## Start and resume

In the code repository you want to change, send:

```text
/dev-flow-claude:dev-flow Add failed-login rate limiting, changing only authentication files.
```

Review the assessment, choose the workspace and approve the complete plan before implementation. To resume, reopen the original directory and conversation and explicitly ask the same skill to continue the saved task.

## Maintain or remove

Use the maintenance route associated with your installation; source builds and public packages have different availability. The [Host guide](https://github.com/Innocent-children/dev-flow/blob/main/docs/CLAUDE_en.md) covers diagnostics and maintenance.

To remove only this Adapter, end its Claude sessions and stop any WebUI you started, then run:

```sh
dev-flow-claude remove --json
npm uninstall --global dev-flow-claude
```

Ordinary removal retains task data and unrelated Claude configuration. Worktree deletion, branch deletion and data reset are separate operations.

[中文指南](https://github.com/Innocent-children/dev-flow/blob/main/docs/CLAUDE.md) · [English guide](https://github.com/Innocent-children/dev-flow/blob/main/docs/CLAUDE_en.md)
