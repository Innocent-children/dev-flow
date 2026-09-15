# Claude artifacts and write gates

Implementation: packages/claude/plugin/hooks/pre-tool-use.mjs; cmd/dev-flow/artifacts.go; internal/application/file_scope.go.

Before each submission use dev-flow-claude artifacts collect and prepare according to [shared artifact rules](artifact-contract.md). Use current host=claude, Task and Action. Preserve all observed files and their identities. Classify only the slot/summary; do not fabricate paths or digests.

PreToolUse matches Write, Edit and NotebookEdit. The Hook reads cwd and file_path/notebook_path, resolves the absolute target and hashes the complete original tool input. Missing or unparseable matching targets cause Core to deny the supported write. Core decides scope from the current Task Plan. A denial is returned as hookSpecificOutput.permissionDecision=deny; helper failure exits 2. An allow emits no permission override, so Claude's own permissions still apply.

Read actual blocker paths and offer only Core's current resolutions. The user supplies allow-once, expanded-plan or restoration decisions. One-time authorization is tied to the exact prepared input. Bash and external writes remain subject to later Core observation and must not be used to bypass the gate.

Carried staged/unstaged/untracked content belongs in the Task's plan and preservation checks; preservation alone does not verify its business behavior.

