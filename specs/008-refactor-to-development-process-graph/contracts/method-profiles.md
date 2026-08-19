# Contract: Method Profiles 1.0

## 1. Purpose

Method profiles answer “how should the developer perform the current node?” They do not answer
“what is the current node?” or “where does the task move next?”

Core owns:

- task/process/current node;
- semantic method-step IDs;
- node completion conditions;
- evidence obligations;
- legal transitions and guards;
- mutation/recovery/terminal state.

The Host Adapter owns:

- checking which method capability is actually available;
- rendering an exact installed command/skill name when known;
- describing expected repository artifacts;
- offering the Core-declared plain-equivalent work when tooling is absent;
- submitting honest bounded method evidence.

Spec Kit/OpenSpec never persist a second Dev Flow cursor.

## 2. Profile Selection

A standard new task selects exactly one:

```text
plain
spec-kit
openspec
```

Selection is part of immutable TaskIntent.

No public operation changes the profile after creation. A future profile-switch feature would need an
explicit state-transition and evidence contract.


## 3. Semantic Step Catalog

### REQUIREMENTS

```text
requirements.capture
requirements.clarify
requirements.validate
```

### DESIGN

```text
design.choose_approach
design.review_complexity
design.record_decisions
```

### TASKS

```text
tasks.decompose
tasks.map_acceptance
tasks.analyze_consistency
```

### IMPLEMENT

```text
implementation.execute_plan
implementation.record_surface
implementation.classify_deviations
```

### TEST

```text
test.run_budgeted_checks
test.record_evidence
test.classify_failure
```

### COMPREHENSION_REVIEW

```text
comprehension.explain
comprehension.identify_complexity
comprehension.obtain_user_verdict
```

### REFACTOR

```text
refactor.simplify
refactor.reconcile_artifacts
refactor.record_surface
```

### DELIVERY

```text
delivery.reconcile_acceptance
delivery.reconcile_method_artifacts
delivery.prepare_summary
```

Step IDs are stable Core contract. Host command spelling is not.

## 4. Rendered Operation Shape

The Host Adapter presents each current step as:

```json
{
  "step_id": "requirements.clarify",
  "purpose": "Resolve material requirement ambiguity.",
  "required": true,
  "profile": "spec-kit",
  "capability_id": "speckit-clarify",
  "rendered_instruction": "Use the installed Spec Kit clarify capability for the active feature.",
  "expected_artifacts": ["active feature spec clarification section"],
  "availability": "available"
}
```

Closed `availability`:

```text
available
unavailable
not_applicable
unknown
```

The rendered operation is presentation/admission guidance. It is not persisted as the current node.

## 5. Plain Profile

The plain profile uses no external method capability. Every semantic step is rendered as bounded
human/AI work.

| Node | Step | Plain Operation |
| --- | --- | --- |
| `REQUIREMENTS` | `requirements.capture` | Write a bounded goal, scope, exclusions, acceptance, constraints, and assumptions |
| `REQUIREMENTS` | `requirements.clarify` | Ask only material questions and record the developer's answers |
| `REQUIREMENTS` | `requirements.validate` | Check that acceptance is observable and no material question remains |
| `DESIGN` | `design.choose_approach` | Select the simplest viable approach for the current requirements |
| `DESIGN` | `design.review_complexity` | Identify unnecessary abstractions and justify each retained one |
| `DESIGN` | `design.record_decisions` | Record decisions, rejected alternatives, risks, and affected components |
| `TASKS` | `tasks.decompose` | Create bounded work items with dependencies and expected paths |
| `TASKS` | `tasks.map_acceptance` | Map every acceptance criterion to work/verification |
| `TASKS` | `tasks.analyze_consistency` | Check requirements/design/tasks for gaps or contradiction |
| `IMPLEMENT` | `implementation.execute_plan` | Implement only the current task plan |
| `IMPLEMENT` | `implementation.record_surface` | Record exact changed paths/no-change state |
| `IMPLEMENT` | `implementation.classify_deviations` | Route requirement/design/complexity deviations explicitly |
| `TEST` | `test.run_budgeted_checks` | Run the current bounded verification steps |
| `TEST` | `test.record_evidence` | Record actual sources, statuses, command count, and unverified items |
| `TEST` | `test.classify_failure` | Classify failure as implementation, design, or requirement |
| `COMPREHENSION_REVIEW` | `comprehension.explain` | Explain the final behavior and code path in developer-readable terms |
| `COMPREHENSION_REVIEW` | `comprehension.identify_complexity` | Identify unnecessary abstraction and maintenance risk |
| `COMPREHENSION_REVIEW` | `comprehension.obtain_user_verdict` | Ask the developer to confirm understanding or choose remediation |
| `REFACTOR` | `refactor.simplify` | Remove unnecessary complexity within current behavior boundaries |
| `REFACTOR` | `refactor.reconcile_artifacts` | Update affected requirements/design/task artifacts honestly |
| `REFACTOR` | `refactor.record_surface` | Record exact simplifications and changed paths |
| `DELIVERY` | `delivery.reconcile_acceptance` | Map latest acceptance to current evidence |
| `DELIVERY` | `delivery.reconcile_method_artifacts` | Ensure process artifacts describe delivered behavior |
| `DELIVERY` | `delivery.prepare_summary` | Prepare the bounded final delivery summary and risks |

Plain work may still create ordinary Markdown artifacts. Artifact paths are optional.

## 6. Spec Kit Profile

### 6.1 Capability identifiers

The Codex adapter recognizes semantic capabilities, not slash-command punctuation:

```text
speckit-specify
speckit-clarify
speckit-plan
speckit-checklist
speckit-tasks
speckit-analyze
speckit-implement
```

A repository may also provide extra capabilities such as `speckit-converge`; extras are optional and
must not become Core completion requirements unless a future Product Feature adds a semantic step.

### 6.2 Mapping

| Node / Step | Preferred Capability | Expected Artifacts / Result |
| --- | --- | --- |
| REQUIREMENTS / capture | `speckit-specify` when no prepared feature exists; otherwise review current spec | `spec.md` with problem, stories, requirements |
| REQUIREMENTS / clarify | `speckit-clarify` | recorded material clarifications |
| REQUIREMENTS / validate | `speckit-checklist` or direct checklist review | requirements-quality checklist |
| DESIGN / choose approach | `speckit-plan` | `plan.md`, research/data-model/contracts as required |
| DESIGN / review complexity | `speckit-plan` plus direct design review | explicit complexity/rejected alternatives |
| DESIGN / record decisions | `speckit-plan` artifact updates | plan/research decisions |
| TASKS / decompose | `speckit-tasks` | exact `tasks.md` |
| TASKS / map acceptance | `speckit-tasks` | requirement/task traceability |
| TASKS / analyze consistency | `speckit-analyze` | no blocking cross-artifact finding |
| IMPLEMENT / execute plan | `speckit-implement` for the authorized slice | selected tasks implemented |
| IMPLEMENT / record surface | direct result from implementation | changed paths/deviations |
| IMPLEMENT / classify deviations | amend active artifacts before continuing when semantics change | explicit route decision |
| TEST / all steps | no mandatory Spec Kit command | run only plan/task verification budget |
| COMPREHENSION_REVIEW / all steps | no Spec Kit command owns the verdict | developer-readable review and explicit user answer |
| REFACTOR / simplify | `speckit-implement` only after affected artifacts/tasks are current | bounded refactor |
| REFACTOR / reconcile artifacts | direct amendment; use clarify/plan/tasks/analyze only as needed | artifacts match revised authority |
| DELIVERY / reconcile acceptance | `speckit-analyze` or direct final consistency review | no unresolved acceptance gap |
| DELIVERY / reconcile method artifacts | direct status reconciliation; optional repository-specific converge | active Feature artifacts current |
| DELIVERY / prepare summary | plain delivery summary | final Core payload |

### 6.3 Rules

- Do not rerun `specify`, `plan`, or `tasks` merely because the step name appears; inspect whether the
  active artifact already exists and amend intentionally.
- Capability output is draft evidence until the developer reviews it.
- Checklist markers are reviewer-owned and are not implementation progress.
- `speckit-implement` may execute repository work but cannot select a Dev Flow transition.
- `speckit-analyze` findings inform the node payload; Core decides the legal transition from the
  selected transition ID and typed evidence.
- The Host must preserve exact active Feature selection and must not infer it only from branch name.

## 7. OpenSpec Profile

### 7.1 Capability identifiers

Recognized semantic capabilities:

```text
openspec-explore
openspec-propose
openspec-apply
openspec-verify
openspec-sync
openspec-archive
openspec-validate
```

The exact chat command may differ by Host/integration/profile. The adapter renders only a capability
it can identify as installed. Core never stores slash syntax.

### 7.2 Mapping

| Node / Step | Preferred Capability | Expected Artifacts / Result |
| --- | --- | --- |
| REQUIREMENTS / capture | `openspec-explore` when intent is unclear, then `openspec-propose` | proposal and delta specs |
| REQUIREMENTS / clarify | direct proposal/spec revision; explore when useful | resolved scenarios/requirements |
| REQUIREMENTS / validate | `openspec-validate` and human review | structurally valid current change |
| DESIGN / choose approach | proposal/design artifact revision | bounded `design.md` or equivalent |
| DESIGN / review complexity | direct design review/explore | rejected alternatives and simplification |
| DESIGN / record decisions | update design/proposal | current decisions and risks |
| TASKS / decompose | proposal task artifact revision | bounded `tasks.md` |
| TASKS / map acceptance | review delta specs/tasks | scenario/task traceability |
| TASKS / analyze consistency | `openspec-validate` plus direct consistency review | no blocking gap |
| IMPLEMENT / execute plan | `openspec-apply` | current change tasks implemented |
| IMPLEMENT / record/classify | direct apply result and artifact update | exact changed surface/deviations |
| TEST / run checks | `openspec-verify` when installed; otherwise plain plan-defined checks | current implementation verification |
| TEST / record/classify | direct test evidence | exact outcome/problem class |
| COMPREHENSION_REVIEW / all steps | no OpenSpec command owns the verdict | developer review and explicit user answer |
| REFACTOR / simplify | update change artifacts as needed, then `openspec-apply` | bounded simplification |
| REFACTOR / reconcile artifacts | proposal/design/spec/task updates | artifacts match current authority |
| DELIVERY / reconcile acceptance | `openspec-verify`/`openspec-validate` as available | implementation/artifact consistency |
| DELIVERY / reconcile artifacts | `openspec-sync` and/or `openspec-archive` when appropriate | completed change incorporated/archived |
| DELIVERY / prepare summary | plain delivery summary | final Core payload |

### 7.3 Rules

- `propose`, `apply`, `verify`, `sync`, or `archive` status never changes Dev Flow state by itself.
- The adapter must not assume expanded capabilities such as `verify` exist.
- When `archive` is performed in DELIVERY, its artifact reference may support method reconciliation
  but Core still validates current acceptance/test/comprehension independently.
- A manually edited OpenSpec artifact is acceptable evidence when its semantic contents are reflected
  in the node result.
- OpenSpec initialization/installation is outside Core and outside an active node unless the user
  explicitly authorized setup.

## 8. Availability and Fallback

For each returned semantic step:

1. The adapter checks only its actual available capability surface.
2. If available, it renders the exact capability and expected artifact.
3. If unavailable/unknown, it says so.
4. It renders the plain-equivalent operation from this contract.
5. It does not execute a different tool implicitly.
6. It records one `MethodEvidence` item:
   - `completed` when the named capability actually completed the semantic step;
   - `plain_fallback` when equivalent plain work completed;
   - `unavailable` when no equivalent work completed;
   - `not_run` when optional/not needed.
7. Core validates the semantic result regardless of method status.

Required semantic steps cannot be satisfied by `unavailable` or `not_run`.

Tool absence does not cause a Core mutation, blocker, cancellation, or profile change.

## 9. Artifact Evidence

Method artifacts are submitted only as bounded references:

```text
role
repository-relative path
digest
summary
```

Rules:

- Core does not read full artifact content or trust checkboxes as state.
- Artifact digest does not replace repository binding.
- A Host must not reference a file it did not observe.
- A missing/changed artifact may cause method evidence to be incomplete, but only the current Core
  node contract determines whether the transition is valid.
- Historical Spec Kit/OpenSpec artifacts may remain after baseline revision; only current baseline
  references satisfy current gates.

## 10. Comprehension Interaction

All profiles render the same mandatory interaction:

1. present a bounded explanation of requirements, design, and code path;
2. list unnecessary abstractions and maintenance risks found;
3. ask the developer whether they can explain and maintain the result;
4. accept an explicit answer:
   - understood → candidate `comprehension_passed`;
   - code too complex → `code_too_complex`;
   - design too complex → `design_too_complex`;
   - implementation defect → `implementation_defect`;
   - tests insufficient → `evidence_insufficient`;
   - requirements unclear → `requirement_unclear`;
5. submit only the matching transition returned by Core.

No profile command can answer on behalf of the developer.
This user verdict is comprehension authority, not TEST manual handoff, and remains required and
permitted when the task verification budget sets `allow_manual_handoff=false`.

## 11. Adapter Boundary

The Codex Skill may contain:

- capability-to-instruction mapping;
- exact selector/admission logic;
- payload forwarding guidance;
- uncertainty recovery procedure;
- user-presentation rules.

It must not contain:

- a copied process transition table used for decisions;
- independent current node;
- completion inference;
- baseline storage;
- recovery classification table;
- destination derivation;
- automatic profile switching.

The Skill must read the complete Core action before rendering method operations.

## 12. Persistence Boundary

- Method profiles exist only on current Schema 2 `standard-development@1` tasks.
- A Schema 1/pre-graph database is rejected before any profile or task projection is returned.
- Standard task: profile mapping uses this contract.
- A Host that does not understand Core Contract 0.2 fails handshake.
- DeepSeek shared fixtures validate semantic projection only; no product integration/support is
  created.
- Future method-tool command changes can update adapter rendering without changing process version
  when semantic capability and evidence meaning remain identical.

## 13. Examples

### Spec Kit unavailable

Core returns `requirements.clarify`, profile `spec-kit`. No `speckit-clarify` capability is available.

Adapter presents:

```text
Spec Kit clarify capability is unavailable.
Plain-equivalent step: ask and record only material requirement questions.
The task remains in REQUIREMENTS until those questions are resolved.
```

After plain work, payload method evidence:

```json
{
  "step_id": "requirements.clarify",
  "status": "plain_fallback",
  "capability": "",
  "summary": "Resolved the two material questions directly with the developer."
}
```

### OpenSpec apply completed

```json
{
  "step_id": "implementation.execute_plan",
  "status": "completed",
  "capability": "openspec-apply",
  "summary": "Applied the current OpenSpec change tasks."
}
```

Core still validates changed paths, current task-plan revision, repository relation, and selected
transition. The method evidence alone is insufficient.
