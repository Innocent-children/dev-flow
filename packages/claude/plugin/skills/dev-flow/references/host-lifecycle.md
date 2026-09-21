# Claude lifecycle and recovery

Implementation: packages/claude/lib/lifecycle.mjs; packages/claude/lib/workspace.mjs.

## Installation and diagnosis commands

Use `dev-flow-claude status --json` to inspect the package/Core versions, receipt, user-scope
marketplace/plugin registration and cached package contents. `ready` means these installation checks
passed; it does not establish model sign-in or Task completion. A `partial` result requires diagnosis
before starting a Task. Preserve the original result or error and repair through the installation's
source or local-package route.

After the required authorization, `dev-flow-claude setup --json` registers the owned local
marketplace/plugin, replaces mismatched cached contents and verifies the result. Reload Claude
plugins or start a new session and review Host permissions. `dev-flow-claude remove --json` removes
only the owned registration and receipt; Task data and Git workspaces remain. These commands take
argv, read no JSON from stdin, and output JSON with or without `--json`.

The unified manager supports ordinary maintenance through `--host claude`; shared data reset uses
the separately confirmed `factory-reset --host all` flow. Respect `CLAUDE_CONFIG_DIR` and keep
`DEV_FLOW_DATA_DIR` consistent across Claude, MCP, hooks and management commands. Do not start a
second Core server or switch Host identity to work around an unavailable integration.

## Startup and recovery

Read host-launch status with the saved launch_id before acting on incomplete/uncertain operations. Preserve receipt/session identity and original output. A launch receipt has no Core process cursor. If invocation definitely did not start, establish that fact before recovery; absence of an observed session alone is not proof. Do not start another consumer when outcome is unknown.

When retained call logs prove no Claude session started and the prior caller has stopped, host-launch retry-launch accepts launch_id, previous_caller_stopped=true, session_not_started=true and the concrete reason. It returns the original session UUID launch descriptor. Never use it for a missing response, unknown outcome or observed live session. Completed cleanup is idempotent; an incomplete cleanup remains for inspection.

## Relocation

For workspace relocation first obtain dev_flow_prepare_task_relocation and the actual relocation_id from Core. Then obtain user authorization and provide host-launch relocate with launch_id, relocation_id, destinations (all repository_key/repository_path pairs), authorized=true. Only all-dedicated provisioned workspaces can move. It records each move; uncertain/partial moves remain for inspection. Pass the returned relocation_id and relocation_destinations unchanged to Core's relocation blocker resolution; each returned destination uses Core's key/repository_path fields. Until Core verifies them, its original binding remains authoritative.

## Terminal operations and cleanup

Cancel/abandon through current Core tools, following the shared lifecycle and recovery reference. Never infer DONE from Claude stopping. After a verified terminal Task, host-launch cleanup-worktree takes launch_id, repository_key, terminal=true, authorized=true from actual facts and explicit authorization. Only clean receipt-owned dedicated worktrees are removed without force. cleanup-branch requires a separate authorization after worktree removal and uses non-force Git deletion. Local directories and branches remain. Never delete active, dirty, unpushed or uncertain resources automatically.

## Terminal presentation

After Core returns `DONE` or `CANCELLED`, report its actual outcome, completed work, changed paths,
verification results and remaining limitations. Keep automated checks, static checks, Host
observations and user-performed checks distinct. State the retained workspace path and branch so
the user can review the files. Terminal state releases the Task's claims; it does not commit, push,
publish, relocate or delete anything. Present Git or cleanup operations only when separately
authorized, following the checks and separate worktree/branch decisions above.
