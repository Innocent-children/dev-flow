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
  └─ VERIFY_CHANGE/ready ─→ VERIFY
VERIFY
  ├─ REVIEW_CHANGE/passed-or-accepted ─→ REVIEW
  └─ VERIFY_CHANGE/failed ─→ IMPLEMENT
REVIEW
  ├─ PREPARE_HANDOFF/approved ─→ HANDOFF
  ├─ REVIEW_CHANGE/rework-implementation ─→ IMPLEMENT
  └─ REVIEW_CHANGE/replan ─→ PLAN
HANDOFF
  ├─ PREPARE_HANDOFF/complete ─→ DONE
  ├─ PREPARE_HANDOFF/rework-implementation ─→ IMPLEMENT
  └─ PREPARE_HANDOFF/replan ─→ PLAN
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

## Exceptional Transitions

Any nonterminal normal phase may enter `BLOCKED` only when:

- repository drift prevents safe apply;
- uncertain action evidence is partial or conflicting;
- repository claim/storage reality is inconsistent;
- an accepted domain precondition cannot be satisfied.

A blocker records `resume_phase`. `RESOLVE_BLOCKER` may return only to that phase after a fresh
observation proves the unblock condition.

Any nonterminal phase may enter `CANCELLED` through `dev_flow_cancel_task`.

## Forbidden Transitions

- skipping any normal phase;
- leaving DONE or CANCELLED;
- changing INTAKE directly to IMPLEMENT;
- VERIFY directly to DONE;
- BLOCKED to a phase other than `resume_phase`;
- adapter-selected transitions;
- transition without exact revision, action ID, and repository binding;
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

## Repository Binding Semantics

Each action contains the current `binding_digest`. Apply must observe the repository again and
require equality before using the action result. When a successful action intentionally changes the
worktree, the submitted post-action observation becomes the task's next binding.

The Core validates observation shape and identity; the host cannot substitute another repository.
