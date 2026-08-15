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

An explicit apply-action transaction may enter `BLOCKED` only when it accepts:

- uncertain action evidence classified as `partially_completed` or `conflicting`.

Ordinary fresh-observation drift returns `REPOSITORY_DRIFT` with no task change; reads may report a
classification or guidance but cannot enter `BLOCKED`.

A blocker records `resume_phase`. `RESOLVE_BLOCKER` may return only to that phase after a fresh
observation proves the concrete unblock condition. A new repository binding is accepted only when
that condition explicitly permits it.

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
payload type. A nil or typed-nil payload, the wrong payload type for the source phase, a result
alias, or an invalid field returns `INVALID_ARGUMENT`. Workflow normalizes valid UTF-8 text only by
trimming leading and trailing whitespace, preserves list order, rejects post-trim duplicates, and
encodes the normalized concrete payload as compact JSON with HTML escaping disabled. The complete
normalized payload must not exceed `MaxActionPayloadBytes`. Payloads do not accept arbitrary JSON
or `map[string]any`; strict unknown-field rejection remains the future MCP decoder's boundary.

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

`BLOCKED / RESOLVE_BLOCKER` has no accepted payload in User Story 2. Application returns
`TASK_BLOCKED`; blocker creation and resolution remain T061.

### Verification budget evaluation

Workflow evaluates existing `Task.Evidence` and all incoming summary/reason/check evidence exactly
once. It enforces retained evidence count, total automated command count, full-suite permission,
user-evidence permission, and manual-handoff-item permission. Malformed evidence returns
`INVALID_ARGUMENT`; a policy overrun returns `VERIFICATION_BUDGET_EXCEEDED`. It adds no inferred
semantics for verification levels.

## Revision Semantics

- New task revision is 1.
- Each successful mutation increments revision by exactly 1.
- The new current action is bound to the new revision.
- Failed mutation does not increment revision.
- Reads never increment revision.
- Event revision equals committed task revision.
- Every mutation uses one closed OperationKind: `open_task`, `apply_action`, or `cancel_task`.
- The Task's LastOperation and appended TaskEvent are exact projections of the same request, optional
  action, expected/committed revision, payload digest, and committed timestamp.

## Read Semantics

`get_task` and `get_next_action` are pure with respect to persistent task state. They may obtain a
fresh repository observation and return recovery classification, drift/conflict guidance, or proof
of a committed mutation. They never write an event, increment revision, change phase/action,
persist the observation, or create a blocker. `BLOCKED` can be produced only by an explicit
apply-action transaction.

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
- `RESOLVE_BLOCKER` accepts a new binding only according to the stored blocker's concrete condition.

The Core validates observation shape and identity; the host cannot substitute another repository.
It binds and reviews current observed reality but does not claim to identify which external process
performed a modification.

The worktree fingerprint parses bounded porcelain-v2 `-z` records, normalizes their order, and
includes the status/path/Git identity fields plus a current content digest or deleted/missing
sentinel. Only modified and untracked ordinary paths reported by status may be hashed with
`git hash-object --no-filters -- <path>`; `-w`, diff reads, and raw status/source retention are
forbidden. More than 1,024 affected paths, a disappearing or inconsistent path, timeout, or output
overflow fails observation. Dirty submodules fail closed without recursion or mutation.
