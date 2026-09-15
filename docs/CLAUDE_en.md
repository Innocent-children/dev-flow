# Claude Code guide

[中文](CLAUDE.md) | [English](CLAUDE_en.md)

The local Claude Code Adapter uses the same Go Core for persistent task state. It provides request assessment, full plan confirmation, file scope and verification controls, resume, multiple repositories and workspace lifecycle operations. This is source capability, not a published release. Static checks do not replace real Claude sessions or native platform acceptance.

## Installation and maintenance

Use Node.js >=24, Git and local Claude Code >=2.1.270. Development builds also require Go and pnpm as specified in the contribution guide. Runtime targets are macOS arm64 and Windows x64. Authenticate Claude before use; the Adapter stores no credentials.

```sh
pnpm dev-flow:local -- install --host claude --yes
node packages/dev-flow/bin/dev-flow.mjs status --host claude
node packages/dev-flow/bin/dev-flow.mjs doctor --host claude
```

The unified entry supports install, upgrade, repair, reinstall, uninstall and factory-reset. Until publication, use local artifacts for maintenance instead of requesting an unpublished stable Claude package from npm. Build an artifact directly with:

```sh
node scripts/build-claude-local.mjs --output <absolute-output-directory>
```

The plugin registers in user scope as dev-flow-claude from the dev-flow-claude-local marketplace. Reload plugins or start a new session and review Claude's permission prompts. CLAUDE_CONFIG_DIR selects the user configuration directory. DEV_FLOW_DATA_DIR selects an existing canonical absolute data directory and must match across MCP, Hooks and helpers. Defaults are ~/.dev-flow/data on macOS and dev-flow/data under local AppData on Windows.

## Starting and resuming

Send this in Claude:

```text
/dev-flow-claude:dev-flow Add failed-login rate limiting, changing only authentication files.
```

Review the read-only assessment and choose direct work or Dev Flow. The default is a new branch in the current directory; current-branch and dedicated-worktree modes are also available. Confirm the branch and ownership of existing changes. Dedicated worktrees also select a local or remote source, base branch and destination. Up to eight repositories form one fixed Task Scope. Core creation waits until every repository is provisioned.

Explicitly approve the full requirements, design, work items, file scope and verification plan. A revised plan invalidates its old confirmation. Core controls all nodes, verification budgets, blockers and recovery; completion of a Claude todo is not Core Task completion. plain, spec-kit and openspec follow the existing method rules. Report unavailable method tools honestly.

Resume in the original workspace and retained Claude session, explicitly continuing the same Task. After startup failure, inspect the retained launch and session records; an uncertain result does not permit another launch or workspace recreation. Follow Core recovery if the directory instance or branch changed. Handoffs preserve the relevant original discussion and corrections.

## Files and task lifecycle

The trusted PreToolUse Hook checks Write, Edit and NotebookEdit; Core decides whether the current plan permits their targets. An allow does not override Claude permissions. Core observes Bash and external-tool changes later; do not use them to bypass a denied write.

Cancel, abandon and recover through the current Core tools. For dedicated workspace relocation, Core prepares the operation, the Host moves every repository, and Core verifies the new bindings. Partial failures retain their state. DONE/CANCELLED releases claims without committing, publishing or deleting anything. Worktree and branch cleanup require separate authorization. Current-directory modes retain their directory and branch.

## Progress and diagnosis

```sh
dev-flow webui start
dev-flow pet start
dev-flow-claude status --json
```

WebUI can filter Claude Code tasks and open the original task. The desktop pet reuses Core task discovery and saved status.

Retain complete failure output, then consult the [command reference](COMMANDS_en.md) and [support matrix](SUPPORT-MATRIX_en.md). Record simulated Hook/CLI tests, final-package checks, actual Claude sessions and native macOS/Windows results separately. Missing checks remain acceptance gaps.

