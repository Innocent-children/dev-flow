# Claude lifecycle and recovery

Implementation: packages/claude/lib/lifecycle.mjs; packages/claude/lib/workspace.mjs.

## Installation

Use dev-flow-claude status --json to inspect registration. setup --json installs the owned user-scope local marketplace/plugin. remove --json removes those entries and the registration receipt; Task data and Git workspaces remain. The unified dev-flow CLI manages install, upgrade, repair, reinstall, uninstall and factory-reset through --host claude. Explicit reset/data deletion is separate from ordinary maintenance. Respect CLAUDE_CONFIG_DIR and DEV_FLOW_DATA_DIR.

## Startup and recovery

Read host-launch status with the saved launch_id before acting on incomplete/uncertain operations. Preserve receipt/session identity and original output. A launch receipt has no Core process cursor. If invocation definitely did not start, establish that fact before recovery; absence of an observed session alone is not proof. Do not start another consumer when outcome is unknown.

When retained call logs prove no Claude session started and the prior caller has stopped, host-launch retry-launch accepts launch_id, previous_caller_stopped=true, session_not_started=true and the concrete reason. It returns the original session UUID launch descriptor. Never use it for a missing response, unknown outcome or observed live session. Completed cleanup is idempotent; an incomplete cleanup remains for inspection.

## Relocation

For workspace relocation first obtain dev_flow_prepare_task_relocation and the actual relocation_id from Core. Then obtain user authorization and provide host-launch relocate with launch_id, relocation_id, destinations (all repository_key/repository_path pairs), authorized=true. Only all-dedicated provisioned workspaces can move. It records each move; uncertain/partial moves remain for inspection. Pass the returned relocation_id and relocation_destinations unchanged to Core's relocation blocker resolution; each returned destination uses Core's key/repository_path fields. Until Core verifies them, its original binding remains authoritative.

## Terminal operations and cleanup

Cancel/abandon through current Core tools, following the shared lifecycle and recovery reference. Never infer DONE from Claude stopping. After a verified terminal Task, host-launch cleanup-worktree takes launch_id, repository_key, terminal=true, authorized=true from actual facts and explicit authorization. Only clean receipt-owned dedicated worktrees are removed without force. cleanup-branch requires a separate authorization after worktree removal and uses non-force Git deletion. Local directories and branches remain. Never delete active, dirty, unpushed or uncertain resources automatically.
