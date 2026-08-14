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

## Revision Semantics

- New task revision is 1.
- Each successful mutation increments revision by exactly 1.
- The new current action is bound to the new revision.
- Failed mutation does not increment revision.
- Reads never increment revision.
- Event revision equals committed task revision.

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
