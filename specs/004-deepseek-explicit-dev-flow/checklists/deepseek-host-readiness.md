# DeepSeek Host Requirements Quality Checklist

**Feature**: [spec.md](../spec.md)  
**Reviewed**: 2026-08-15 after parallel-boundary remediation
**Meaning**: `[x]` records requirements-quality approval only; it does not claim implementation,
stable Harness availability, packaged artifacts, or native evidence.

## Merged dependency and ownership

- [x] Feature 004 may start only the enumerated Host-local deterministic preparation before the
  Feature 003 merge; all shared/native/final work remains post-barrier.
- [x] The pre-merge writable path allowlist and forbidden shared paths/behaviors are exact and
  consistent across README, spec, plan, tasks, and quickstart.
- [x] The 003 merge barrier requires clean bounded commits, completed Feature 003 on `main`, a
  history-preserving merge of latest `main`, baseline recording, and follow-up analysis.
- [x] The dependency is expressed as delivered capabilities and identities rather than mutable
  Feature 003 task numbers.
- [x] Feature 004 consumes the shared detached-build version seam and preserves Codex-aware shared
  contracts/root validation without duplication or weakening.
- [x] Shared-file ownership, the history-preserving merge order, and the no-rebase rule are explicit
  before Feature 004 crosses the 003 merge barrier.

## Product, runtime, and authority

- [x] One private package, one explicit `dev-flow` Skill, one native STDIO integration, one
  transport-transparent launcher, and one packaged Core form the complete product.
- [x] Core Contract 0.1 remains the sole task, action, claim, recovery, budget, and outcome authority.
- [x] The launcher uses a closed environment, no shell/listener/network, raw STDIO, bounded
  diagnostics, cancellation propagation, and deterministic child reaping.
- [x] No proxy, task projection, state/action catalog, transition table, error reinterpretation,
  recovery classifier, or completion predicate is authorized.

## Host compatibility and complete results

- [x] Release-candidate observations are labelled provisional and never establish stable support.
- [x] The latest official stable compatible Harness is selected before final evidence.
- [x] The full six-case direct-result gate is established on the exact stable version/build used
  by the final journey; RC or different-artifact evidence never substitutes.
- [x] Inline success, domain error, near-spill, spilled, pruned/compacted, and near-Core-limit cases
  require marker detection, official retrieval, byte/digest equality, and complete parsing.
- [x] A failed gate stops for reviewed amendment and does not automatically authorize a proxy.

## Explicit workflow and recovery

- [x] The sole Skill is user-invocable, not model-invocable, and requires exact `/dev-flow`.
- [x] Ordinary, empty/conversational, non-Git, and multi-repository requests stop before task
  creation.
- [x] Server-info and the exact six raw tools are validated before discovery or mutation.
- [x] Complete fresh Core identity/schema/effects/evidence/recovery/outcome remain authoritative.
- [x] Previewed, pruned, truncated, malformed, lost, cancelled, or uncertain mutation results cannot
  authorize a retry; original values and Core-defined readback are required.
- [x] Verification budgets and evidence-strength labels are measurable.

## Evidence budget and final integrity

- [x] US1, US2, and US3 checkpoints use deterministic/fake/integration evidence and start no real
  Harness host.
- [x] Native execution is limited to an optional provisional direct-result spike, a mandatory stable
  direct-result gate, and one final stable end-to-end journey.
- [x] Deterministic tests, root validation, scope audit, and source freeze precede one final product
  artifact.
- [x] The final journey uses the same exact stable Harness that passed stable Gate B and the exact
  frozen-source artifact.
- [x] Removal/data/reinstall checks are mandatory in the final journey.
- [x] Passing final evidence requires real co-installed Codex non-interference; Codex absence blocks
  pass.
- [x] Structural and semantic evidence validation are separate and read-only.
- [x] Final ordering prevents tests, fixes, or evidence edits from invalidating the final artifact.

## Approval

- [x] No unresolved CRITICAL/HIGH planning conflict remains from the independent audit.
