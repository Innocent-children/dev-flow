# Claude artifacts and write gates

Implementation: `packages/claude/plugin/hooks/pre-tool-use.mjs`; `cmd/taskbelay/artifacts.go`; `internal/application/file_scope.go`.

Before each submission use taskbelay-claude artifacts collect and prepare according to [shared artifact rules](artifact-contract.md). Use current host=claude, Task and Action. Preserve all observed files and their identities. Classify only the slot/summary; do not fabricate paths or digests.

PreToolUse matches Write, Edit and NotebookEdit. The Hook reads cwd and file_path/notebook_path, resolves the absolute target and hashes the complete original tool input. Missing or unparseable matching targets cause Core to deny the supported write. Core decides scope from the current Task Plan. A denial is returned as hookSpecificOutput.permissionDecision=deny; helper failure exits 2. An allow emits no permission override, so Claude's own permissions still apply.

Read actual blocker paths and offer only Core's current resolutions. The user supplies allow-once, expanded-plan or restoration decisions. One-time authorization is tied to the exact prepared input. Bash and external writes remain subject to later Core observation and must not be used to bypass the gate.

Carried staged/unstaged/untracked content belongs in the Task's plan and preservation checks; preservation alone does not verify its business behavior.

## Content after implementation

Follow the shared [content timing rules](artifact-contract.md#content-after-implementation).
Complete intended process-file writes, including any appropriate OpenSpec sync or archive, before
the final implementation submission and verification. These files participate in Core's content
checks. During TEST, COMPREHENSION_REVIEW and DELIVERY, reconcile files read-only; a later content
change invalidates dependent results. Follow Core's returned Action or legal remediation edge,
make the change in an allowed node, and re-establish verification before delivery.

## Verification

Use the shared [verification plan and accounting](verification.md). Choose checks from the current
diff, acceptance criteria and affected behavior; record actual commands and distinguish automated,
static, Host-observed and completed user checks. If capacity is insufficient, request a bounded Core
budget increase before extra commands. Every full suite needs a current reason; remaining capacity
alone is not a reason to broaden testing. Developer comprehension is a separate user decision and
does not replace a passed check.
