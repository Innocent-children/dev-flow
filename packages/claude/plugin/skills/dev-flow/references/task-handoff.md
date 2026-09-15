# Requirement handoff

Implementation: packages/claude/lib/workspace.mjs — prepare and session.

Preserve the original relevant user/assistant messages in handoff.discussion along with the current request, confirmed requirements and later corrections. Keep unaccepted suggestions, assumptions and unresolved questions separate. Preserve message identity when available; do not invent inaccessible original messages. User and repository instructions remain authoritative.

The handoff is retained outside Task worktrees in the launch receipt and supplied to the destination session. The destination reads the full retained material, verifies provisioning, preserves carried content, and distinguishes Core creation from resume. Host session identity is a Claude UUID; Core task_id is a separate identity.


The receipt binds the request to its assessment digest and the retained handoff to its content digest. A changed request or discussion is rejected before launch or provisioning; inspect the original retained record rather than recreating the launch.
