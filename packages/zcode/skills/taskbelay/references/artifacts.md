# ZCode artifacts and write gates

Implementation: `packages/zcode/hooks/pre-tool-use.mjs`, `cmd/taskbelay/artifacts.go` and `internal/application/file_scope.go`.

Before each submission use `taskbelay-zcode artifacts collect` and `prepare` according to the [shared artifact contract](artifact-contract.md). Supply current `host=zcode`, Task and Action. Preserve all observed files and their identities. Classify only the slot and summary; never invent paths or digests.

The native PreToolUse Hook matches Write and Edit. It reads `cwd` and `tool_input.file_path`, resolves the absolute target and hashes the complete original operation. Missing or unparseable matching targets are submitted as incomplete so Core can refuse the write. Core decides scope from the current Task and plan. A denial returns `hookSpecificOutput.permissionDecision=deny`; input or helper failure exits 2 to block the operation. An allowed path emits no permission override, so ZCode's own permissions still apply.

Use actual blocker paths and only Core's current resolutions. The user supplies allow-once, expanded-plan or restoration decisions. One-time authorization is tied to the exact prepared input. Shell and external writes remain subject to later Core observation and must not bypass the gate. Project-level Hook configuration is not executed by ZCode; verify this installed plugin's Hook in a new session.

Carried staged, unstaged and untracked content belongs in the Task's plan and preservation checks. Preserving it does not verify its business behavior.

## Content after implementation

Follow the shared [content timing rules](artifact-contract.md#content-after-implementation). Complete intended method-artifact writes before final verification. Delivery reconciles saved results read-only; a late content change invalidates dependent checks and must follow Core's returned action.

## Verification

Use the shared [verification plan and accounting](verification.md). Budget checks by their actual commands and sources; increase an insufficient budget through Core before running more checks. A full suite needs a current reason rather than unused capacity.
