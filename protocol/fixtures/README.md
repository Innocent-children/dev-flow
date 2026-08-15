# Protocol Fixtures

This directory owns the shared public-contract fixtures produced by the Dev Flow Core. The same
fixtures are consumed by future Codex and DeepSeek adapters; host-specific copies or alternate
workflow contracts do not belong here.

Feature 002 User Story 1 provides these shared examples:

- `server-info.json`: product and six-tool catalog metadata;
- `open-task.json`: creation of one governed task;
- `active-task-conflict.json`: a same-host incompatible-contract conflict;
- `host-ownership-conflict.json`: a cross-host ownership conflict;
- `task.json`: the authoritative persisted task projection;
- `next-action.json`: the persisted `ASSESS_TASK` projection.

The three successful task fixtures describe the same task, revision, repository binding, and action
identity. Error fixtures intentionally return only a stable error and recovery instruction; they do
not expose a task contract or repository path. `${VERSION}` is replaced by the implemented adapter's
repository-visible version, and paths below `/workspace/` are fictional public examples.

Feature 002 User Story 2 adds these shared mutation examples:

- `apply-success.json`: an accepted implementation apply, fresh worktree binding, next action, and
  committed operation;
- `rework.json`: `VERIFY_CHANGE/failed` returning to `IMPLEMENT` with a new action and retained
  transition reason;
- `verification-budget-failure.json`: a bounded `VERIFICATION_BUDGET_EXCEEDED` result;
- `revision-conflict.json`: a stale revision with `read_task` recovery;
- `stale-action.json`: stale action identity with `read_next_action` recovery;
- `repository-drift.json`: rejected repository drift with explicit drift-resolution guidance;
- `completed-outcome.json`: the terminal completed Outcome, evidence-ID references, and released
  claim indication;
- `cancelled-outcome.json`: complete unverified acceptance classification, retained evidence-ID
  references, and released claim indication.

Feature 002 User Story 4 adds the transient uncertain-action and blocker examples:

- `recovery-not-started.json`: exact current source with no retained payload and safe retry advice;
- `recovery-completed-and-recorded.json`: latest exact `LastOperation` proof and committed read-back;
- `recovery-completed-but-unrecorded.json`: complete payload/effect evidence awaiting recovery apply;
- `recovery-partially-completed.json`: worktree-only implementation evidence with a restore condition;
- `recovery-conflicting.json`: forbidden repository evidence classified as a current-source conflict;
- `recovery-apply-read-back.json`: ordinary `ApplyActionResult` read-back without an embedded assessment;
- `recovery-blocked.json`: retained issuance binding, Core-owned blocker, condition, and resolve action;
- `recovery-resolved.json`: explicit exact restoration, one resolution evidence item, and a fresh normal action.

`task.json` and `next-action.json` show their no-probe shape with a null `recovery_assessment`;
`next-action.json` also carries explicit nullable `action`, `blocker`, and `outcome` projections. The
five classification fixtures keep recovery assessment under the successful result, never in the
top-level error recovery instruction used by failure fixtures such as `repository-drift.json`.

The success fixtures keep revision, current-action revision, and binding digest aligned. Outcome
evidence remains canonical ID references to `Task.Evidence`; it never embeds a second copy. Mutation
error fixtures intentionally omit Task, Contract, repository path, status, source content, diff,
and raw command/output data.

Fixtures contain bounded public projections only: never database paths, source contents, Git diffs
or raw Git status, environment values, raw command output, or host-private state. The Application
does not read these files. They are contract evidence rather than runtime workflow authority, do
not replace the Domain model, and are checked against the implemented six-tool MCP adapter by the
shared contract suite.
