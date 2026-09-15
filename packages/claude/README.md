# Dev Flow for Claude Code

[中文](../../docs/CLAUDE.md) | [English](../../docs/CLAUDE_en.md)

This source Adapter brings the current Dev Flow workflow to local Claude Code: persistent tasks, confirmed plans, file scope, verification limits, multi-repository workspace preparation, recovery and lifecycle operations.

It is not a published stable package. Build and install from this repository using Node.js >=24, Claude Code >=2.1.270 and the repository toolchain:

```sh
pnpm dev-flow:local -- install --host claude --yes
```

Start Claude Code and invoke `/dev-flow-claude:dev-flow <your task>`. For details, prerequisites, exact commands and verification limitations, use the linked Host guide. The plugin includes its runtime and helpers so it can run from Claude's plugin cache independently of the repository. Task data is stored outside the plugin cache.

Ordinary maintenance preserves Task data and unrelated Claude settings. Worktree deletion, branch deletion and factory reset require their own explicit decisions. Native Claude and platform verification must be recorded before claiming stable support.

