# 005 Recover Uncertain Actions and Drift

This directory intentionally contains only `spec.md`.

Feature 002 owns the baseline contract and implementation responsibility for the closed OperationProbe,
RecoveryAssessment, ordered five-class decision table, optional `recovery_apply` on ApplyAction,
ordinary-drift zero-write behavior, Core-derived BLOCKED entry, exact
`restore_issuance_binding`/ResolveBlockerPayload flow, latest-LastOperation proof, and bounded
two-handle concurrency. Feature 005 must not reopen those decisions merely to restate baseline work.

Planning is blocked until final real-host reports from both `003` and `004` identify actual
uncertain-response, truncation, cancellation, process-exit, and repository-drift behavior. Do not
create synthetic requirements merely to fill a crash matrix.

Before planning:

1. List observed failures from both host journeys.
2. Map each observation to an existing `002` recovery contract.
3. Remove scenarios already proven and not requiring product change.
4. Keep only concrete hardening gaps such as transport/crash failure injection, generic
   expected-evidence adoption, host parity, or an evidence-justified binding-adoption change.
5. Re-run `$speckit-clarify`; revise this specification downward when evidence supports less work.

Then generate the remaining Spec Kit artifacts. A proposed new MCP tool or workflow phase requires a
Constitution amendment before plan approval.
