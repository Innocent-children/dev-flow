# Contract: Dev Flow State Machine 0.1

## Normal Flow

```text
INTAKE
  └─ ASSESS_TASK/succeeded ─→ ASSESS
ASSESS
  └─ PLAN_CHANGE/succeeded ─→ PLAN
PLAN
  └─ IMPLEMENT_CHANGE/succeeded ─→ IMPLEMENT
IMPLEMENT
  ├─ VERIFY_CHANGE/ready ─→ VERIFY
  └─ VERIFY_CHANGE/failed ─→ IMPLEMENT
VERIFY
  ├─ REVIEW_CHANGE/pass ─→ REVIEW
  ├─ REVIEW_CHANGE/rework_implementation ─→ IMPLEMENT
  └─ REVIEW_CHANGE/replan ─→ PLAN
REVIEW
  ├─ PREPARE_HANDOFF/ready ─→ HANDOFF
  ├─ PREPARE_HANDOFF/rework_implementation ─→ IMPLEMENT
  └─ PREPARE_HANDOFF/replan ─→ PLAN
HANDOFF
  ├─ PREPARE_HANDOFF/complete ─→ DONE
  ├─ PREPARE_HANDOFF/rework_implementation ─→ IMPLEMENT
  └─ PREPARE_HANDOFF/replan ─→ PLAN
BLOCKED
  └─ RESOLVE_BLOCKER/succeeded ─→ stored resume_phase
```

The action name shown on an edge is the action submitted while the task is in the source phase.
The implementation may assign the next action kind when entering a phase, but it must preserve this
semantic order.

## Canonical Phase-to-Action Mapping

| Phase | Current Action |
|---|---|
| INTAKE | ASSESS_TASK |
| ASSESS | PLAN_CHANGE |
| PLAN | IMPLEMENT_CHANGE |
| IMPLEMENT | VERIFY_CHANGE |
| VERIFY | REVIEW_CHANGE |
| REVIEW | PREPARE_HANDOFF |
| HANDOFF | PREPARE_HANDOFF |
| BLOCKED | RESOLVE_BLOCKER |
| DONE | none |
| CANCELLED | none |

`PREPARE_HANDOFF` may be used in REVIEW to assemble the review decision and in HANDOFF to commit
the terminal Delivery Summary. The payload schema is phase-specific and closed.

`DONE` and `CANCELLED` return `TASK_TERMINAL`. A Phase outside the closed enumeration returns
`INVALID_ARGUMENT`. If a valid nonterminal Phase ever lacks a blueprint, that is an internal
invariant failure and must not be reported as terminal.

## Handoff Allowed Effects

Allowed effects are phase-specific even when two phases share an ActionKind. In particular:

| Phase / Action | Allowed Effects |
|---|---|
| REVIEW / PREPARE_HANDOFF | `read_repository`, `prepare_delivery_summary` |
| HANDOFF / PREPARE_HANDOFF | `read_repository`, `prepare_delivery_summary` |

Both handoff actions require a current repository observation, so both explicitly authorize
`read_repository`. This does not authorize Git mutation, Git diff reads, or source-content return.

The canonical result vocabulary is exactly `succeeded`, `ready`, `failed`, `pass`,
`rework_implementation`, `replan`, and `complete`. These identifiers do not have aliases.

## Exceptional Transitions

An explicit ApplyAction whose optional `recovery_apply` member is present may enter `BLOCKED` only
when the Core classifies a still-current normal source action as `partially_completed` or
`conflicting`. Presence of that member is the only recovery-mutation discriminator; it is not a new
tool, OperationKind, phase, workflow, or caller-selected classification.

Ordinary ApplyAction drift returns `REPOSITORY_DRIFT` with no task, revision, event, evidence,
blocker, binding, or claim change. Reads may report a classification or guidance but cannot enter
`BLOCKED`.

A blocker records the original normal phase as `resume_phase`, retains the issuance
RepositoryBinding as Task.Repository, and records the fresh block-time binding digest only as an
observed fact (it may equal issuance for a non-binding conflict). Feature 002 supports exactly one
condition, `restore_issuance_binding`; it does not
adopt a new worktree binding. `RESOLVE_BLOCKER` may return only to the stored phase after a fresh
structured observation proves that condition.

Any nonterminal phase may enter `CANCELLED` through `dev_flow_cancel_task`.

## Forbidden Transitions

- skipping any normal phase;
- leaving DONE or CANCELLED;
- changing INTAKE directly to IMPLEMENT;
- VERIFY directly to DONE;
- BLOCKED to a phase other than `resume_phase`;
- adapter-selected transitions;
- transition without exact task ID, revision, action ID, action kind, and repository-binding digest;
- transition that changes the immutable contract.
- ordinary drift creating `BLOCKED`;
- caller-supplied recovery classification, blocker, resume/next phase, or authoritative binding;
- parsing `RequiredResolution` text as a condition;
- runtime TaskEvent lookup or replay to decide recovery.

## Phase Obligations

### INTAKE / ASSESS_TASK

Required result:

- repository observation confirmed;
- task goal and acceptance summarized;
- known constraints and risks;
- intended changed surface at a high level;
- verification budget acknowledged.

No source modification is authorized by this action.

### ASSESS / PLAN_CHANGE

Required result:

- bounded implementation plan;
- files/modules expected to change;
- explicit non-goals;
- verification plan within budget;
- unresolved questions either resolved or represented as blocker.

No source modification is authorized by this action.

### PLAN / IMPLEMENT_CHANGE

Required result:

- implementation summary;
- changed paths;
- deviations from plan;
- no unauthorized scope;
- current repository observation.

Source edits are allowed. Git history mutation is not granted by Dev Flow.

### IMPLEMENT / VERIFY_CHANGE

Required result:

- exact logical checks performed;
- evidence source classification;
- command count;
- full-suite indicator;
- manual-handoff items;
- failed or unverified items;
- current repository observation.

### VERIFY / REVIEW_CHANGE

Required result:

- comparison against scope, exclusions, acceptance, and plan;
- findings;
- verdict: `pass`, `rework_implementation`, or `replan`;
- residual risks;
- current repository observation.

### REVIEW / PREPARE_HANDOFF

Required result:

- final acceptance mapping;
- automated/manual/unverified evidence;
- risks;
- retained user actions;
- repository observation;
- decision: `ready`, `rework_implementation`, or `replan`.

### HANDOFF / PREPARE_HANDOFF

Required result:

- closed Delivery Summary;
- every acceptance criterion classified;
- final evidence lists;
- final risks and unverified items;
- current repository observation;
- decision: `complete`, `rework_implementation`, or `replan`.

`complete` creates DONE and releases the repository claim.

## Closed Action Payloads

Application accepts `workflow.ActionPayload`, a sealed Go interface implemented only by the
phase-specific concrete types below. Callers may construct those concrete values, but cannot add a
payload type. Normal ApplyAction and blocker resolution reject a nil or typed-nil payload, the wrong
payload type for the source phase, a result alias, or an invalid field as `INVALID_ARGUMENT`. Only
an explicit recovery apply may use JSON `null` as the probe's canonical no-evidence payload; it is
never a valid normal action result. Workflow normalizes valid UTF-8 text only by trimming leading
and trailing whitespace, preserves list order, rejects post-trim duplicates, and encodes the
normalized concrete payload as compact JSON with HTML escaping disabled. The complete normalized
payload must not exceed `MaxActionPayloadBytes`. Payloads do not accept arbitrary JSON or
`map[string]any`; the future MCP decoder rejects unknown and duplicate object-member names at every
nesting level before typed dispatch.

### `INTAKE / ASSESS_TASK`

```go
type AssessTaskPayload struct {
    Result                         domain.ActionResult `json:"result"`
    Summary                        string              `json:"summary"`
    Constraints                    []string            `json:"constraints"`
    Risks                          []string            `json:"risks"`
    IntendedChangedSurface         []string            `json:"intended_changed_surface"`
    VerificationBudgetAcknowledged bool                `json:"verification_budget_acknowledged"`
}
```

`Result` is exactly `succeeded`; `Summary` is required; and
`VerificationBudgetAcknowledged` is true. The three lists may be empty. This payload has no reason
and authorizes no repository modification.

### `ASSESS / PLAN_CHANGE`

```go
type PlanChangePayload struct {
    Result               domain.ActionResult `json:"result"`
    Summary              string              `json:"summary"`
    Steps                []string            `json:"steps"`
    ExpectedChangedPaths []string            `json:"expected_changed_paths"`
    NonGoals             []string            `json:"non_goals"`
    VerificationSteps    []string            `json:"verification_steps"`
    UnresolvedQuestions  []string            `json:"unresolved_questions"`
}
```

`Result` is exactly `succeeded`; `Summary` is required; and `Steps` and `VerificationSteps` each
contain at least one item. `UnresolvedQuestions` is empty. The remaining lists may be empty. This
payload has no reason and authorizes no repository modification.

### `PLAN / IMPLEMENT_CHANGE`

```go
type ImplementChangePayload struct {
    Result         domain.ActionResult `json:"result"`
    Summary        string              `json:"summary"`
    ChangedPaths   []string            `json:"changed_paths"`
    NoFileChanges  bool                `json:"no_file_changes"`
    Deviations     []string            `json:"deviations"`
    ScopeConfirmed bool                `json:"scope_confirmed"`
}
```

`Result` is exactly `succeeded`; `Summary` is required; and `ScopeConfirmed` is true. Exactly one
of these representations is accepted: a non-empty `ChangedPaths` with `NoFileChanges=false`, or an
empty `ChangedPaths` with `NoFileChanges=true`. Changed paths are repository-relative, not absolute,
and contain no parent-escape component. Existence and file contents are not inspected. `Deviations`
may be empty.

### Verification evidence input

```go
type EvidenceInput struct {
    Source       domain.EvidenceSource `json:"source"`
    Name         string                `json:"name"`
    Status       domain.EvidenceStatus `json:"status"`
    Summary      string                `json:"summary"`
    CommandCount int                   `json:"command_count"`
    FullSuite    bool                  `json:"full_suite"`
}
```

The caller cannot provide an evidence ID, digest, recording time, task/action identity, raw command,
raw output, source content, or output path. Source and status use the closed Domain enums; name and
summary are required and bounded; and names are unique within the action after normalization.
Non-automated evidence has zero commands and `FullSuite=false`; automated command counts remain
within Core Limits 0.1. The Core later generates evidence IDs, normalized digests, and one mutation
recording time while preserving input order.

### `IMPLEMENT / VERIFY_CHANGE`

```go
type VerifyChangePayload struct {
    Result             domain.ActionResult `json:"result"`
    Summary            string              `json:"summary"`
    Checks             []EvidenceInput     `json:"checks"`
    FailedItems        []string            `json:"failed_items"`
    UnverifiedItems    []string            `json:"unverified_items"`
    ManualHandoffItems []string            `json:"manual_handoff_items"`
    Reason             string              `json:"reason"`
}
```

`Result` is exactly `ready` or `failed`, and `Summary` is required. `ready` has no failed items or
reason. `failed` has a required reason and at least one failed item or one check with `failed`
status. Checks may be empty, but every accepted verification adds the host-observed
`verification_summary`. That summary, an optional `transition_reason`, and checks together do not
exceed `MaxEvidencePerAction`. Manual-handoff items require the task budget's permission.

### `VERIFY / REVIEW_CHANGE`

```go
type ReviewChangePayload struct {
    Result        domain.ActionResult `json:"result"`
    Summary       string              `json:"summary"`
    Findings      []string            `json:"findings"`
    ResidualRisks []string            `json:"residual_risks"`
    Reason        string              `json:"reason"`
}
```

`Result` is exactly `pass`, `rework_implementation`, or `replan`, and `Summary` is required. `pass`
has no reason; rework and replanning require one. Findings and residual risks may be empty.

### Delivery data

```go
type DeliveryData struct {
    Acceptance           []domain.OutcomeCriterion `json:"acceptance"`
    AutomatedEvidenceIDs []domain.ID               `json:"automated_evidence_ids"`
    ManualEvidenceIDs    []domain.ID               `json:"manual_evidence_ids"`
    UnverifiedItems      []string                  `json:"unverified_items"`
    Risks                []string                  `json:"risks"`
}
```

Acceptance has the same count, order, and exact criterion text as the immutable task contract.
Evidence IDs are canonical and unique within and across both lists. Automated IDs resolve to
`automated` entries in `Task.Evidence`; manual IDs resolve to `user` entries, and are empty when
manual handoff is disallowed. Delivery data contains no copied evidence summaries and uses
`UnverifiedItems` for retained user actions.

### `REVIEW / PREPARE_HANDOFF`

```go
type ReviewHandoffPayload struct {
    Result   domain.ActionResult `json:"result"`
    Summary  string              `json:"summary"`
    Delivery *DeliveryData       `json:"delivery"`
    Reason   string              `json:"reason"`
}
```

`Result` is exactly `ready`, `rework_implementation`, or `replan`, and `Summary` is required.
`ready` requires valid delivery data and no reason. Rework and replanning require a reason and no
delivery data. A ready review records only the bounded handoff-preparation evidence, payload digest,
event, and next action; it does not persist a separate delivery draft.

### `HANDOFF / PREPARE_HANDOFF`

```go
type CompleteHandoffPayload struct {
    Result   domain.ActionResult `json:"result"`
    Summary  string              `json:"summary"`
    Delivery *DeliveryData       `json:"delivery"`
    Reason   string              `json:"reason"`
}
```

`Result` is exactly `complete`, `rework_implementation`, or `replan`, and `Summary` is required.
`complete` requires valid delivery data and no reason; rework and replanning require a reason and no
delivery data. `complete` constructs the final Outcome from this submission.

### `BLOCKED / RESOLVE_BLOCKER`

```go
type BlockerResolutionEvidence struct {
    Condition             domain.BlockerCondition `json:"condition"`
    ObservedBindingDigest domain.Digest           `json:"observed_binding_digest"`
}

type ResolveBlockerPayload struct {
    Result             domain.ActionResult        `json:"result"`
    BlockerID          domain.ID                  `json:"blocker_id"`
    Summary            string                     `json:"summary"`
    ResolutionEvidence BlockerResolutionEvidence  `json:"resolution_evidence"`
}
```

`Result` is exactly `succeeded`. `BlockerID` and `ResolutionEvidence.Condition` must exactly equal
the current Blocker ID and stored condition; identifiers, enum values, and digests are canonical
and are never trimmed or aliased. `Summary` is required, trimmed only at its ends, valid UTF-8, and
bounded by `MaxEvidenceSummaryBytes`. `ObservedBindingDigest` is the caller's last observation, not
an authoritative replacement binding. Core freshly observes the retained canonical root and
requires the caller digest, fresh digest, condition's expected digest, and Task.Repository digest to
agree after structured digest verification. The entire canonical payload remains within
`MaxActionPayloadBytes` and is included in the normal apply-operation payload digest.

The caller provides only result, blocker ID, summary, the exact echoed condition, and its observed
binding digest. Core alone loads the blocker, source `resume_phase`, retained issuance binding,
fresh observation, and next action identity. A stale revision returns `REVISION_CONFLICT`; a stale
action, blocker ID, or condition returns `ACTION_STALE`; a stale observation or unsatisfied
condition returns `REPOSITORY_DRIFT`; malformed, unknown, duplicate, nil/typed-nil, wrong-phase, or
wrong-payload input returns `INVALID_ARGUMENT`. Every failure is zero-write.

Success uses the existing ApplyAction and `OperationApplyAction`, increments revision exactly once,
appends one matching TaskEvent, retains the repository claim, clears Blocker and ResumePhase,
returns only to the stored normal phase, and issues a brand-new normal Action ID. It replaces
Task.Repository only with the freshly observed structurally identical issuance binding (therefore
only `observed_at` may differ), invalidates the old `RESOLVE_BLOCKER` action, preserves all prior
evidence, and appends exactly one Core-generated EvidenceSummary named `blocker_resolution` with
source `host_observed`, status `observed`, the normalized payload summary, zero commands, and digest
derived from the canonical payload. Core never parses `RequiredResolution` and never mutates Git.

For an operation/evidence-only conflict, the block-time repository may already satisfy
`restore_issuance_binding`. That never auto-resolves the task: the closed `RESOLVE_BLOCKER` action,
exact IDs/condition, and a new fresh observation are still required before Core issues a replacement
normal action.

### Verification budget evaluation

Workflow evaluates existing `Task.Evidence` and all incoming summary/reason/check evidence exactly
once. It enforces retained evidence count, total automated command count, full-suite permission,
user-evidence permission, and manual-handoff-item permission. Malformed evidence returns
`INVALID_ARGUMENT`; a policy overrun returns `VERIFICATION_BUDGET_EXCEEDED`. It adds no inferred
semantics for verification levels.

## Operation Probe and Explicit Recovery Apply

Reads accept this optional transient input:

```go
type OperationProbe struct {
    OperationID              domain.ID              `json:"operation_id"`
    SourcePhase              domain.Phase           `json:"source_phase"`
    ExpectedRevision         uint64                 `json:"expected_revision"`
    ActionID                 domain.ID              `json:"action_id"`
    ActionKind               domain.ActionKind      `json:"action_kind"`
    RepositoryBindingDigest  domain.Digest          `json:"repository_binding_digest"`
    Payload                  workflow.ActionPayload `json:"payload"` // nullable in a probe
}
```

Host and task ID come from the enclosing read request. `OperationID` is the exact request ID of the
uncertain ApplyAction, chosen and retained by its caller before dispatch rather than learned only
from the response; it is not the read request ID. The probe does not accept an operation kind (it is
closed to `apply_action`), caller digest, classification, blocker, resume/next phase, replacement
binding, canonical path, raw status, source, diff, command, output, or environment data.

The existing ApplyAction request gains only this optional discriminator:

```go
type RecoveryApplyInput struct {
    OperationID domain.ID    `json:"operation_id"`
    SourcePhase domain.Phase `json:"source_phase"`
}
```

JSON member `recovery_apply` is absent for normal semantics. When present, all enclosing
ApplyAction identity fields plus payload and both recovery fields form the same `OperationProbe`.
`recovery_apply.operation_id` is the original uncertain ApplyAction request ID; the enclosing
recovery call's request ID remains response correlation and is not the probed operation. The caller
may reuse the same ID value; no equality/inequality rule selects recovery mode, which is determined
only by presence of `recovery_apply`. The caller never submits the assessment. A non-null payload is
validated and canonicalized by the one phase-specific payload validator; null canonicalizes as the
literal JSON `null`. Core calculates the operation payload digest over host, task ID, expected
revision, action ID/kind, issuance binding
digest, source phase, and those canonical payload bytes. `recovery_apply` itself is excluded so an
exact previously committed normal request has the same digest. This digest is never accepted from
the caller. If reconciliation commits a normal transition or blocker, LastOperation.OperationID
and TaskEvent.RequestID use the probed `operation_id`, preserving idempotent proof across a lost
recovery response; the recovery call's correlation ID is not persisted as workflow truth.

### Derived facts

Classification runs only after the task/host is loaded, Domain/Workflow invariants pass, persisted
and fresh binding digests are self-consistent, the probe identity/source-phase mapping is valid, a
non-null payload is valid, and a fresh observation succeeds. Failure of any prerequisite returns
the existing bounded error and no assessment or write. Specifically, a persisted binding that
fails the Repository verifier returns `STORAGE_UNAVAILABLE`; a fresh observer result that fails the
same verifier returns `INTERNAL_ERROR`. No syntactically valid digest string bypasses this check.

- **exact committed proof**: payload digest is Core-derived and LastOperation has
  `kind=apply_action`, the exact probe operation/action IDs, `from_revision=expected_revision`,
  `to_revision=expected_revision+1=Task.Revision`, the exact payload digest, and a valid committed
  time. No TaskEvent read participates.
- **LastOperation relation**: `exact` is the full proof above. `unrelated` means neither operation ID
  nor non-null action ID matches the probe. If either identity matches but any remaining
  kind/action/from/to/current-revision/Core-derived-digest/commit-time requirement differs, the
  relation is `contradictory`; partial matches cannot fall through as an unattempted operation.
- **source current**: `Task.Revision`, `Task.Phase`, CurrentAction ID/kind/revision/issuance digest,
  and Task.Repository binding digest exactly match the probe source. A mismatch is superseded,
  even if an older TaskEvent might exist.
- **repository relation**: `exact` means every digest-bearing structured field equals the
  authoritative Task.Repository; `worktree_only_changed` means canonical root, common-directory
  digest, repository identity, branch/detached, and HEAD/unborn are exact while worktree and final
  binding digests both change; every other valid difference is `forbidden_change`. `observed_at`
  never participates.
- **operation evidence**: null payload is `none`. A valid non-null payload is `complete` only when
  all closed result/evidence fields are present and its observable repository effect agrees:
  non-`IMPLEMENT_CHANGE` requires `exact`; `IMPLEMENT_CHANGE` with changed paths requires
  `worktree_only_changed`; `IMPLEMENT_CHANGE` with `no_file_changes=true` requires `exact`; and
  `RESOLVE_BLOCKER` requires the exact stored condition and binding. A valid payload that claims the
  opposite repository effect is `contradictory`. Feature 002 performs no path-by-path authorship
  inference or generic expected-evidence adoption.

### Canonical recovery decision table

Rows are evaluated top to bottom; the first matching row is final. This is the sole five-class
decision table. Reads always have the listed zero-write effect. “Recovery apply” means the existing
ApplyAction with `recovery_apply` present.

| Priority | Persisted revision/action and LastOperation | Probe payload / allowed effect | Fresh repository fact | Classification | Read result | Recovery-apply result |
|---:|---|---|---|---|---|---|
| 1 | Exact committed proof, regardless of whether a next or terminal action now exists | Core-derived digest exactly matches | Report relation to the now-authoritative Task.Repository | `completed_and_recorded` | Return committed proof; `action_retry_safe=false` | Return the ordinary current Task result only; no revision, event, evidence, claim, or binding write |
| 2 | Latest LastOperation relation is `contradictory`, regardless of source currency | Any valid probe payload | Any valid observation | `conflicting` | Return the contradictory relation; never call a partial match proof | If source is current and normal, commit the one Core-derived blocker; if source is already `BLOCKED`, return its existing blocker; otherwise return `REVISION_CONFLICT` or `ACTION_STALE`; no other write |
| 3 | Latest LastOperation is `unrelated` and source is not current | Any | Any valid observation | `conflicting` | Return assessment; never claim an older event committed | Return `REVISION_CONFLICT` when revision differs, otherwise `ACTION_STALE`; zero write and no blocker |
| 4 | LastOperation is `unrelated`; source is current | `operation_evidence=contradictory`, or null (`none`) while the action disallows the observed relation | Any non-worktree `forbidden_change`; `worktree_only_changed` for a non-`IMPLEMENT_CHANGE` action (including resolve); or claimed file-change/no-change opposite to observation | `conflicting` | Return assessment; normal source advice is `submit_recovery_apply` | From a normal source, commit the one Core-derived blocker; if already `BLOCKED`, return the existing blocker without another write |
| 5 | LastOperation is `unrelated`; current normal `IMPLEMENT_CHANGE` source | Null (`none`): repository effect exists but required result/evidence is absent | `worktree_only_changed` | `partially_completed` | Return assessment with proposed restore condition | Commit the one Core-derived blocker |
| 6 | LastOperation is `unrelated`; source is current | Complete payload and all closed required evidence; allowed effect agrees | Required exact/worktree-only/resolve-condition relation | `completed_but_unrecorded` | Return assessment with `action_retry_safe=false` and advice `submit_recovery_apply` | Record through the normal transition/evidence/budget path in one revision/event; never re-execute host effects |
| 7 | LastOperation is `unrelated`; source is current | Null (`none`) | `exact` | `not_started` | Return `action_retry_safe=true` and advice `retry_current_action` | Return the ordinary unchanged Task result only; zero write |

For rows 2, 4, and 5, blocker creation is legal only while the source is a normal nonterminal phase. Core
generates the blocker/action IDs, cause classification, message, human resolution, stored condition,
and resume phase; it retains the issuance binding and adds no incomplete evidence. A task already in
`BLOCKED` keeps its existing blocker without a second revision. For row 6, the ordinary transition
table, verification budget, evidence construction, terminal claim release, and CAS rules remain the
only mutation path.

`action_retry_safe` belongs to `RecoveryAssessment` and is true only in row 7. It means the caller
may re-execute and resubmit that exact still-current action after this fresh assessment; it is not
the error envelope's `recovery.retry_safe`. Advice is closed to `retry_current_action`,
`submit_recovery_apply`, `read_next_action`, `resolve_blocker`, or
`stop_for_repository_drift` and is derived as follows: row 7 uses `retry_current_action`; row 6 uses
`submit_recovery_apply`; rows 2, 4, and 5 use `submit_recovery_apply` for a current normal source and
`resolve_blocker` for a current blocked Task; row 3 uses `resolve_blocker` if the current Task is
blocked, otherwise `stop_for_repository_drift` when the fresh binding is not accepted for the
current nonterminal action and `read_next_action`; row 1 uses `resolve_blocker` when the committed
Task is blocked, `read_next_action` for a terminal Task, and otherwise the same current-action
binding check. All rows except row 7 set `action_retry_safe=false`.

`unblock_condition` is non-null only when the current Task is already blocked (the exact stored
condition) or rows 2, 4, or 5 can legally block a current normal source (the exact Core-proposed
condition). It is null for a superseded/non-blockable conflict. If state changes after assessment,
the ordinary CAS fails with `REVISION_CONFLICT` and the complete recovery-apply transaction writes
nothing.

## Revision Semantics

- New task revision is 1.
- Each committed mutation increments revision by exactly 1; recovery read-back and `not_started`
  no-write results do not.
- The new current action is bound to the new revision.
- Failed mutation does not increment revision.
- Reads never increment revision.
- Event revision equals committed task revision.
- Every mutation uses one closed OperationKind: `open_task`, `apply_action`, or `cancel_task`.
- The Task's LastOperation and appended TaskEvent are exact projections of the same request, optional
  action, expected/committed revision, payload digest, and committed timestamp.
- Entering `BLOCKED`, recording `completed_but_unrecorded`, and resolving a blocker all use
  `apply_action`; no fourth OperationKind exists.

## Read Semantics

`get_task` returns `GetTaskResult{Task, RecoveryAssessment}` rather than a bare Task.
`get_next_action` returns `NextActionResult{TaskID, Phase, Revision, Action, Blocker, Outcome,
RecoveryAssessment}`. `RecoveryAssessment` is nullable. With no OperationProbe, both reads preserve
the current no-observation behavior and return a null assessment; the pure persisted-binding
integrity check is not a repository observation. With a probe, both freshly observe
the canonical root and return the same typed assessment; this includes `BLOCKED`, `DONE`, and
`CANCELLED` so the latest lost terminal or blocking apply can be proved. `BLOCKED` results also carry
the persisted Blocker and its machine condition even without a probe.

Reads are pure with respect to persistent task and repository state. They never write an event,
increment revision, change phase/action, replace LastOperation, persist an observation, or create a
blocker. Observer failure returns the existing bounded mapped error and a zero result; Core never
fabricates an “unavailable” classification. For the same Task, probe, and structured repository
state, every assessment field is stable except the fresh `observed_at`; because time is excluded
from digests, repeated observations retain all identities, digests, classification, proof, retry
safety, advice, and condition.

## Repository Binding Semantics

Every apply carries the current action's original `task_id`, `revision`, `action_id`, `action_kind`,
and `repository_binding_digest`. The Core observes the repository again before committing.

- `ASSESS_TASK`, `PLAN_CHANGE`, `VERIFY_CHANGE`, `REVIEW_CHANGE`, and `PREPARE_HANDOFF` may not
  actively change the binding; their fresh binding must exactly equal the issuance binding.
- `IMPLEMENT_CHANGE` may change only the worktree fingerprint. Canonical repository identity, Git
  common-directory identity, branch/detached state, and HEAD/unborn state must remain exact. A
  successful apply stores the fresh observation as the next revision's binding.
- Branch, HEAD, repository identity, common-directory identity, an unauthorized phase's worktree
  change, or a non-worktree implementation change returns `REPOSITORY_DRIFT` without mutation.
- `RESOLVE_BLOCKER` accepts only a fresh observation structurally identical to the retained issuance
  binding under `restore_issuance_binding`; it may refresh `observed_at` but adopts no changed state.

`internal/recovery` is the sole future authority for structured binding relation and acceptance in
normal apply, explicit recovery apply, reads, and blocker resolution. Application delegates to it
and removes its private comparison helpers. The Repository package remains the sole digest-algorithm
owner and exposes one pure verifier invoked by Application before it passes persisted or fresh facts
to Recovery. It recomputes `repository_identity` from canonical root plus
`git_common_dir_digest`, then recomputes `binding_digest` from all structured fields except
`observed_at`. A well-formed SHA-256 string alone is not valid evidence. The private raw
common-directory path is never persisted, so its digest is independently grounded only by the fresh
observer and compared structurally; no second digest algorithm is added to Application or Recovery.
Verifier invocation is integrity validation and does not let Application decide binding acceptance.

The Core validates observation shape and identity; the host cannot substitute another repository.
It binds and reviews current observed reality but does not claim to identify which external process
performed a modification. `IMPLEMENT_CHANGE` is the sole ordinary action allowed to adopt a
worktree-only binding. Feature 002's `restore_issuance_binding` condition adopts no new binding
state: on resolution, only freshness metadata may change. Repository identity, common-directory
identity, branch/detached, and HEAD/unborn are never rebound.

The worktree fingerprint parses bounded porcelain-v2 `-z` records, normalizes their order, and
includes the status/path/Git identity fields plus a current content digest or deleted/missing
sentinel. Only modified and untracked ordinary paths reported by status may be hashed with
`git hash-object --no-filters -- <path>`; `-w`, diff reads, and raw status/source retention are
forbidden. More than 1,024 affected paths, a disappearing or inconsistent path, timeout, or output
overflow fails observation. Dirty submodules fail closed without recursion or mutation.
