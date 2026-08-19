# Contract: Development Process Graph 1.0

## 1. Authority and Scope

This contract is the normative closed definition of `standard-development@1` for Core Contract 0.2.
It defines:

- process identity;
- node IDs and action mapping;
- node obligations;
- semantic method steps;
- all normal transitions;
- guard identifiers;
- invalidation behavior;
- exceptional and terminal behavior;
- forbidden transitions.

No adapter, prompt, method tool, repository document, or caller may add an edge or select a
destination outside this contract.

## 2. Process Identity

```json
{
  "process_id": "standard-development",
  "process_version": 1,
  "entry_node": "REQUIREMENTS"
}
```

The external identity is:

```text
standard-development@1
```

New tasks always use this identity. No public input accepts `process_id`, `process_version`,
definition digest, or entry node.

## 3. Definition Digest

Core computes `definition_digest` as lowercase SHA-256 over canonical compact JSON with:

- object keys sorted lexicographically;
- arrays preserved in the declaration order defined below;
- UTF-8 bytes;
- no insignificant whitespace;
- HTML escaping disabled;
- no trailing newline.

Digest input contains only stable semantic identifiers:

```json
{
  "process_id": "standard-development",
  "process_version": 1,
  "entry_node": "REQUIREMENTS",
  "nodes": [
    {
      "node_id": "...",
      "action_kind": "...",
      "payload_contract": "...",
      "entry_condition_ids": ["..."],
      "completion_condition_ids": ["..."],
      "allowed_effects": ["..."],
      "required_evidence": [
        {"kind": "...", "required": true}
      ],
      "method_steps": [
        {"step_id": "...", "required": true}
      ],
      "outgoing_transition_ids": ["..."]
    }
  ],
  "transitions": [
    {
      "transition_id": "...",
      "source": "...",
      "destination": "...",
      "guard_id": "...",
      "reason_required": false
    }
  ]
}
```

Human-readable purpose, explanation, examples, localized text, and adapter command spelling are not
included. Changing a stable semantic identifier, a method-step `required` flag, or declaration
ordering requires a new process version. A wording clarification that preserves
identifiers/semantics may retain version 1.

Canonical encoding does not rely on Go struct-field order. Object keys are lexicographically sorted
by an explicitly tested canonical projection/encoder; arrays come only from the declaration-ordered
slices above. Definition construction must propagate encoding failure or panic during immutable
initialization and must never publish an empty or partial `ProcessReference`.

When validating a persisted action against this definition, Core compares all machine-authoritative
fields exactly: kind, task/revision/process/node/binding identity, payload contract, allowed effects,
evidence kind/required flags, method-step IDs/required flags, and transition
ID/source/destination/guard/reason rules. Human purpose, entry/completion descriptions, method-step
purpose, transition selection text, and guidance are validated for UTF-8, normalization, bounds, and
completeness, but wording differences alone do not produce `PROCESS_UNSUPPORTED`.

The Task stores the process reference/digest. An unsupported or mismatched definition returns
`PROCESS_UNSUPPORTED` with zero writes.

## 4. Canonical Declaration Order

### 4.1 Node order

```text
REQUIREMENTS
DESIGN
TASKS
IMPLEMENT
TEST
COMPREHENSION_REVIEW
REFACTOR
DELIVERY
DONE
BLOCKED
CANCELLED
```

### 4.2 Normal transition order

```text
requirements_ready
design_ready
design_requires_requirements
tasks_ready
tasks_require_design
tasks_require_requirements
implementation_ready_for_test
implementation_requires_design
implementation_requires_requirements
implementation_needs_refactor
tests_passed
tests_failed_implementation
tests_expose_design_issue
tests_expose_requirement_issue
comprehension_passed
implementation_defect
code_too_complex
design_too_complex
evidence_insufficient
requirement_unclear
refactor_ready_for_test
refactor_requires_design
refactor_requires_requirements
delivery_complete
delivery_needs_implementation
delivery_needs_test
delivery_needs_comprehension
delivery_needs_design
delivery_needs_requirements
```

`blocker_resolved` is exceptional and is not part of the normal transition list.

## 5. Node-to-Action Mapping

| Node | Action Kind | Payload Contract |
| --- | --- | --- |
| `REQUIREMENTS` | `COMPLETE_REQUIREMENTS` | `requirements-result@1` |
| `DESIGN` | `COMPLETE_DESIGN` | `design-result@1` |
| `TASKS` | `COMPLETE_TASKS` | `tasks-result@1` |
| `IMPLEMENT` | `COMPLETE_IMPLEMENTATION` | `implementation-result@1` |
| `TEST` | `COMPLETE_TEST` | `test-result@1` |
| `COMPREHENSION_REVIEW` | `COMPLETE_COMPREHENSION_REVIEW` | `comprehension-result@1` |
| `REFACTOR` | `COMPLETE_REFACTOR` | `refactor-result@1` |
| `DELIVERY` | `COMPLETE_DELIVERY` | `delivery-result@1` |
| `BLOCKED` | `RESOLVE_BLOCKER` | `blocker-resolution@1` |
| `DONE` | none | none |
| `CANCELLED` | none | none |

## 6. Shared Node-Contract Projection

Every standard nonterminal action returns:

```json
{
  "task_id": "task-id",
  "revision": 8,
  "action_id": "action-id",
  "process_id": "standard-development",
  "process_version": 1,
  "process_definition_digest": "<sha256>",
  "current_node": "TEST",
  "node_purpose": "Verify current behavior within the task verification budget.",
  "entry_conditions": ["..."],
  "completion_conditions": ["..."],
  "allowed_effects": ["read_repository", "run_verification_commands"],
  "required_evidence": ["repository_observation", "test_summary"],
  "method_profile": "spec-kit",
  "method_steps": [
    {
      "step_id": "test.run_budgeted_checks",
      "purpose": "Run only the checks authorized by the current verification plan.",
      "required": true
    }
  ],
  "payload_contract": "test-result@1",
  "guidance": "Complete the TEST contract and select one available transition.",
  "repository_binding_digest": "<sha256>",
  "available_transitions": [
    {
      "transition_id": "tests_passed",
      "destination": "COMPREHENSION_REVIEW",
      "guard_id": "current_tests_pass",
      "when": "All required current checks pass.",
      "reason_required": false
    }
  ]
}
```

These fields are part of the closed Process Action contract. Human-readable text is guidance;
stable IDs and closed fields are authoritative.

## 7. Node Contracts

### 7.1 REQUIREMENTS

**Purpose**

Transform the immutable initial intent into the current requirements authority.

**Entry-condition IDs**

```text
intent_available
repository_claimed
requirements_context_available
```

**Entry assumptions**

- A valid immutable TaskIntent exists.
- The canonical repository is claimed by this task.
- For first entry, known initial bounds are available; for re-entry, the current baseline and
  transition reason are available as starting context.

**Completion-condition IDs**

```text
requirements_goal_defined
requirements_scope_bounded
requirements_exclusions_explicit
requirements_acceptance_nonempty
requirements_material_questions_resolved
requirements_user_decisions_recorded
```

**Allowed effects**

```text
read_repository
edit_process_artifacts
request_user_decision
```

**Required evidence**

```text
repository_observation
requirements_baseline
```

**Semantic method-step IDs**

```text
requirements.capture
requirements.clarify
requirements.validate
```

**Outgoing transitions**

```text
requirements_ready
```

### 7.2 DESIGN

**Purpose**

Select and explain the simplest viable design for the current requirements baseline.

**Entry-condition IDs**

```text
requirements_current
repository_context_available
```

**Completion-condition IDs**

```text
design_approach_defined
design_components_bounded
design_decisions_explicit
design_alternatives_considered
design_complexity_justified
design_risks_recorded
```

**Allowed effects**

```text
read_repository
edit_process_artifacts
request_user_decision
```

**Required evidence**

```text
repository_observation
design_baseline
```

**Semantic method-step IDs**

```text
design.choose_approach
design.review_complexity
design.record_decisions
```

**Outgoing transitions**

```text
design_ready
design_requires_requirements
```

### 7.3 TASKS

**Purpose**

Decompose the current design into bounded, ordered, independently checkable work items.

**Entry-condition IDs**

```text
requirements_current
design_current
```

**Completion-condition IDs**

```text
task_items_nonempty
task_dependencies_valid
task_acceptance_covered
task_paths_bounded
task_verification_defined
```

**Allowed effects**

```text
read_repository
edit_process_artifacts
```

**Required evidence**

```text
repository_observation
task_plan_baseline
```

**Semantic method-step IDs**

```text
tasks.decompose
tasks.map_acceptance
tasks.analyze_consistency
```

**Outgoing transitions**

```text
tasks_ready
tasks_require_design
tasks_require_requirements
```

### 7.4 IMPLEMENT

**Purpose**

Execute the current task plan and report the exact changed surface and deviations.

**Entry-condition IDs**

```text
requirements_current
design_current
task_plan_current
```

**Completion-condition IDs**

```text
implementation_scope_reported
implementation_paths_reported
implementation_deviations_classified
implementation_repository_observed
```

**Allowed effects**

```text
read_repository
edit_product_files
edit_process_artifacts
```

**Required evidence**

```text
repository_observation
implementation_summary
```

**Semantic method-step IDs**

```text
implementation.execute_plan
implementation.record_surface
implementation.classify_deviations
```

**Outgoing transitions**

```text
implementation_ready_for_test
implementation_requires_design
implementation_requires_requirements
implementation_needs_refactor
```

### 7.5 TEST

**Purpose**

Verify the current repository behavior within the immutable verification budget.

**Entry-condition IDs**

```text
implementation_current
repository_binding_current
verification_budget_available
```

**Completion-condition IDs**

```text
test_checks_classified
test_failures_classified
test_unverified_items_recorded
test_budget_obeyed
```

**Allowed effects**

```text
read_repository
run_verification_commands
edit_process_artifacts
```

**Required evidence**

```text
repository_observation
test_summary
```

**Semantic method-step IDs**

```text
test.run_budgeted_checks
test.record_evidence
test.classify_failure
```

**Outgoing transitions**

```text
tests_passed
tests_failed_implementation
tests_expose_design_issue
tests_expose_requirement_issue
```

### 7.6 COMPREHENSION_REVIEW

**Purpose**

Verify that the developer can explain and maintain the current design and implementation.

**Entry-condition IDs**

```text
test_current_and_passed
repository_binding_current
requirements_design_plan_current
```

**Completion-condition IDs**

```text
comprehension_explanation_complete
comprehension_complexity_classified
comprehension_questions_resolved_or_routed
comprehension_user_verdict_recorded
```

**Allowed effects**

```text
read_repository
edit_process_artifacts
request_user_decision
```

**Required evidence**

```text
repository_observation
comprehension_assessment
```

**Semantic method-step IDs**

```text
comprehension.explain
comprehension.identify_complexity
comprehension.obtain_user_verdict
```

**Outgoing transitions**

```text
comprehension_passed
implementation_defect
code_too_complex
design_too_complex
evidence_insufficient
requirement_unclear
```

### 7.7 REFACTOR

**Purpose**

Simplify the current design/code without silently changing the approved behavior.

**Entry-condition IDs**

```text
simplification_reason_available
current_authorities_available
```

**Completion-condition IDs**

```text
refactor_simplifications_reported
refactor_changed_surface_reported
refactor_behavior_intent_explicit
refactor_repository_observed
```

**Allowed effects**

```text
read_repository
edit_product_files
edit_process_artifacts
```

**Required evidence**

```text
repository_observation
refactor_summary
```

**Semantic method-step IDs**

```text
refactor.simplify
refactor.reconcile_artifacts
refactor.record_surface
```

**Outgoing transitions**

```text
refactor_ready_for_test
refactor_requires_design
refactor_requires_requirements
```

### 7.8 DELIVERY

**Purpose**

Reconcile the latest requirements, repository, test, comprehension, evidence, risks, and handoff.

**Entry-condition IDs**

```text
requirements_current
design_current
task_plan_current
test_current_and_passed
comprehension_current_and_passed
repository_binding_current
```

**Completion-condition IDs**

```text
delivery_acceptance_complete
delivery_evidence_current
delivery_unverified_empty
delivery_risks_recorded
delivery_method_artifacts_reconciled
```

**Allowed effects**

```text
read_repository
edit_process_artifacts
prepare_delivery_summary
```

**Required evidence**

```text
repository_observation
delivery_summary
```

**Semantic method-step IDs**

```text
delivery.reconcile_acceptance
delivery.reconcile_method_artifacts
delivery.prepare_summary
```

**Outgoing transitions**

```text
delivery_complete
delivery_needs_implementation
delivery_needs_test
delivery_needs_comprehension
delivery_needs_design
delivery_needs_requirements
```

### 7.9 DONE

Terminal completed node. It has no action and no outgoing transition. Reads return the retained
Outcome.

### 7.10 BLOCKED

Exceptional safety/recovery node. It has one `RESOLVE_BLOCKER` action. It stores the exact source
standard node as resume cursor. A successful resolution returns only to that cursor
and issues a new action identity.

`BLOCKED` is not selectable by a normal transition. Entry remains limited to Core recovery/safety
logic defined by the recovery contract.

### 7.11 CANCELLED

Terminal cancellation node. It has no action and no outgoing transition. It is entered only through
`dev_flow_cancel_task` with explicit user authority and a current revision.

## 8. Normal Transition Table

| # | Transition ID | Source | Destination | Guard ID | Reason |
| ---: | --- | --- | --- | --- | --- |
| 1 | `requirements_ready` | `REQUIREMENTS` | `DESIGN` | `requirements_baseline_complete` | Not required |
| 2 | `design_ready` | `DESIGN` | `TASKS` | `design_baseline_complete` | Not required |
| 3 | `design_requires_requirements` | `DESIGN` | `REQUIREMENTS` | `material_requirement_gap` | Required |
| 4 | `tasks_ready` | `TASKS` | `IMPLEMENT` | `task_plan_baseline_complete` | Not required |
| 5 | `tasks_require_design` | `TASKS` | `DESIGN` | `design_not_decomposable` | Required |
| 6 | `tasks_require_requirements` | `TASKS` | `REQUIREMENTS` | `material_requirement_gap` | Required |
| 7 | `implementation_ready_for_test` | `IMPLEMENT` | `TEST` | `implementation_report_complete` | Not required |
| 8 | `implementation_requires_design` | `IMPLEMENT` | `DESIGN` | `implementation_exposes_design_gap` | Required |
| 9 | `implementation_requires_requirements` | `IMPLEMENT` | `REQUIREMENTS` | `material_requirement_gap` | Required |
| 10 | `implementation_needs_refactor` | `IMPLEMENT` | `REFACTOR` | `implementation_complexity_identified` | Required |
| 11 | `tests_passed` | `TEST` | `COMPREHENSION_REVIEW` | `current_tests_pass` | Not required |
| 12 | `tests_failed_implementation` | `TEST` | `IMPLEMENT` | `implementation_failure_identified` | Required |
| 13 | `tests_expose_design_issue` | `TEST` | `DESIGN` | `test_design_failure_identified` | Required |
| 14 | `tests_expose_requirement_issue` | `TEST` | `REQUIREMENTS` | `test_requirement_gap_identified` | Required |
| 15 | `comprehension_passed` | `COMPREHENSION_REVIEW` | `DELIVERY` | `current_user_comprehension_confirmed` | Not required |
| 16 | `implementation_defect` | `COMPREHENSION_REVIEW` | `IMPLEMENT` | `implementation_defect_identified` | Required |
| 17 | `code_too_complex` | `COMPREHENSION_REVIEW` | `REFACTOR` | `code_complexity_identified` | Required |
| 18 | `design_too_complex` | `COMPREHENSION_REVIEW` | `DESIGN` | `design_complexity_identified` | Required |
| 19 | `evidence_insufficient` | `COMPREHENSION_REVIEW` | `TEST` | `verification_gap_identified` | Required |
| 20 | `requirement_unclear` | `COMPREHENSION_REVIEW` | `REQUIREMENTS` | `comprehension_requirement_gap_identified` | Required |
| 21 | `refactor_ready_for_test` | `REFACTOR` | `TEST` | `refactor_report_complete` | Not required |
| 22 | `refactor_requires_design` | `REFACTOR` | `DESIGN` | `refactor_design_change_required` | Required |
| 23 | `refactor_requires_requirements` | `REFACTOR` | `REQUIREMENTS` | `refactor_requirement_change_required` | Required |
| 24 | `delivery_complete` | `DELIVERY` | `DONE` | `delivery_current_and_complete` | Not required |
| 25 | `delivery_needs_implementation` | `DELIVERY` | `IMPLEMENT` | `delivery_implementation_gap_identified` | Required |
| 26 | `delivery_needs_test` | `DELIVERY` | `TEST` | `delivery_test_gap_identified` | Required |
| 27 | `delivery_needs_comprehension` | `DELIVERY` | `COMPREHENSION_REVIEW` | `delivery_comprehension_gap_identified` | Required |
| 28 | `delivery_needs_design` | `DELIVERY` | `DESIGN` | `delivery_design_gap_identified` | Required |
| 29 | `delivery_needs_requirements` | `DELIVERY` | `REQUIREMENTS` | `delivery_requirement_gap_identified` | Required |

## 9. Guard Semantics

Guards are evaluated by Core from typed payload, current Task authorities, current repository
observation, and retained evidence.

Every normal node result contains a required `problem_class` selected from that node's closed enum.
The exact transition mapping is:

| Source | Problem class | Required transition |
| --- | --- | --- |
| `REQUIREMENTS` | `none` | `requirements_ready` |
| `DESIGN` | `none` | `design_ready` |
| `DESIGN` | `requirement_gap` | `design_requires_requirements` |
| `TASKS` | `none` | `tasks_ready` |
| `TASKS` | `design_gap` | `tasks_require_design` |
| `TASKS` | `requirement_gap` | `tasks_require_requirements` |
| `IMPLEMENT` | `none` | `implementation_ready_for_test` |
| `IMPLEMENT` | `design_gap` | `implementation_requires_design` |
| `IMPLEMENT` | `requirement_gap` | `implementation_requires_requirements` |
| `IMPLEMENT` | `code_complexity` | `implementation_needs_refactor` |
| `TEST` | `none` | `tests_passed` |
| `TEST` | `implementation_failure` | `tests_failed_implementation` |
| `TEST` | `design_failure` | `tests_expose_design_issue` |
| `TEST` | `requirement_gap` | `tests_expose_requirement_issue` |
| `COMPREHENSION_REVIEW` | `none` | `comprehension_passed` |
| `COMPREHENSION_REVIEW` | `implementation_defect` | `implementation_defect` |
| `COMPREHENSION_REVIEW` | `code_complexity` | `code_too_complex` |
| `COMPREHENSION_REVIEW` | `design_complexity` | `design_too_complex` |
| `COMPREHENSION_REVIEW` | `verification_gap` | `evidence_insufficient` |
| `COMPREHENSION_REVIEW` | `requirement_gap` | `requirement_unclear` |
| `REFACTOR` | `none` | `refactor_ready_for_test` |
| `REFACTOR` | `design_change` | `refactor_requires_design` |
| `REFACTOR` | `requirement_change` | `refactor_requires_requirements` |
| `DELIVERY` | `none` | `delivery_complete` |
| `DELIVERY` | `implementation_gap` | `delivery_needs_implementation` |
| `DELIVERY` | `test_gap` | `delivery_needs_test` |
| `DELIVERY` | `comprehension_gap` | `delivery_needs_comprehension` |
| `DELIVERY` | `design_gap` | `delivery_needs_design` |
| `DELIVERY` | `requirement_gap` | `delivery_needs_requirements` |

Forward transitions require `problem_class=none` and no classification finding. Remediation
transitions require their exact non-`none` class, at least one normalized bounded finding that is
structurally relevant to that class, and the required normalized reason. A payload may satisfy at
most one transition; changing only `transition_id` is insufficient. Every mismatch returns
`TRANSITION_NOT_ALLOWED` with zero writes.

### 9.1 Forward guards

- `requirements_baseline_complete`: valid next RequirementsBaseline; non-empty acceptance; material
  unresolved questions empty; required method steps represented.
- `design_baseline_complete`: valid next DesignBaseline tied to current requirements.
- `task_plan_baseline_complete`: valid next TaskPlanBaseline tied to current design; dependencies
  valid; acceptance covered.
- `implementation_report_complete`: exact current plan revision; changed/no-change representation
  valid; repository relation permitted.
- `current_tests_pass`: current revisions/binding; no failed item; budget valid; required current
  checks passed.
- `current_user_comprehension_confirmed`: current passing TestRecord; no unresolved question or
  unnecessary abstraction; explicit current user evidence.
- `refactor_report_complete`: simplifications/surface reported; repository relation permitted;
  behavior preservation claimed; result proceeds to test.
- `delivery_current_and_complete`: latest requirements acceptance fully satisfied; current test and
  comprehension; no unverified item; evidence and binding current.

### 9.2 Backward/remediation guards

Each guard requires:

- a non-empty normalized reason;
- the exact source-node `problem_class` mapped to the selected transition;
- non-empty normalized payload findings structurally consistent with that class;
- exact current action/process/node/baseline identity;
- allowed repository relation for the source action.

Problem-class evidence:

- requirement-gap guards require at least one bounded requirement/acceptance ambiguity or conflict;
- design-gap guards require at least one bounded design decision/complexity defect;
- implementation-gap guards require at least one bounded implementation defect;
- test-gap guards require failed/stale/unverified current verification evidence;
- comprehension-gap guards require missing/stale user confirmation or bounded understanding issue;
- complexity guards require at least one unnecessary abstraction, explanation failure, or
  maintainability risk.

Core does not use model confidence or free-form labels alone as proof.

## 10. Authority Invalidation

The destination and source mutation determine current-authority invalidation.

| Event | Clear Current Design | Clear Current Task Plan | Clear Current Implementation | Clear Current Test | Clear Current Comprehension |
| --- | ---: | ---: | ---: | ---: | ---: |
| Enter `REQUIREMENTS` | Yes | Yes | Yes | Yes | Yes |
| Commit new requirements | Yes | Yes | Yes | Yes | Yes |
| Enter `DESIGN` for rework | No | Yes | Yes | Yes | Yes |
| Commit new design | No | Yes | Yes | Yes | Yes |
| Commit new task plan | No | No | Yes | Yes | Yes |
| Enter `IMPLEMENT` for rework | No | No | No | Yes | Yes |
| Repository-changing implementation | No | No | No | Yes | Yes |
| Enter `TEST` | No | No | No | Yes | Yes |
| Commit `tests_passed` | No | No | No | Replace | Yes |
| Enter `COMPREHENSION_REVIEW` | No | No | No | No | Yes |
| Commit `comprehension_passed` | No | No | No | No | Replace |
| Enter `REFACTOR` | No | No | No | Yes | Yes |
| Repository-changing refactor | No | No | No | Yes | Yes |
| Enter `DELIVERY` | No | No | No | No | No |

“Clear” removes only current authority pointers/readiness. Retained baselines/evidence/history remain.

## 11. Repository-Effect Rules

- `REQUIREMENTS`, `DESIGN`, `TASKS`, `TEST`, `COMPREHENSION_REVIEW`, and `DELIVERY` require exact
  repository binding except for process-artifact-only changes explicitly modeled by the selected
  action contract.
- `IMPLEMENT` and `REFACTOR` may accept a worktree-only repository change under the existing
  repository identity/branch/HEAD constraints.
- Process-artifact edits and product-file edits are separately declared effects, but both remain Host
  operations and are represented in the accepted repository observation.
- Core never performs checkout, reset, clean, stash, commit, merge, rebase, push, tag, publish, or
  generic shell execution.

Exact effect reconciliation is defined in the MCP/persistence/recovery contracts and implementation
plan.

## 12. Exceptional Behavior

### Recovery BLOCKED

A still-current uncertain mutation classified `partially_completed` or `conflicting` may enter
`BLOCKED` in one transaction. The Blocker stores:

- process reference;
- original source cursor;
- original action/operation identity;
- machine condition;
- issuance and observed repository relations.

Resolution returns only to the stored source cursor. It does not choose a normal edge and does not
adopt caller state.

### Cancellation

Any nonterminal task may be cancelled through the existing cancellation tool. Cancellation:

- requires current revision and explicit reason;
- validates a non-empty, trimmed, bounded valid-UTF-8 reason at the Application boundary;
- returns `TASK_TERMINAL` with zero writes for `DONE` or `CANCELLED`;
- writes one terminal mutation;
- releases repository claim;
- retains all task data;
- does not claim current acceptance satisfied.

## 13. Forbidden Behavior

The following always fail:

- caller-supplied process, process version, definition digest, entry node, destination, next node,
  guard result, or resume node;
- an undeclared transition ID;
- a transition declared for another source node;
- leaving `DONE` or `CANCELLED`;
- `TEST` directly to `DELIVERY` or `DONE`;
- `REFACTOR` directly to comprehension, delivery, or done;
- comprehension pass without explicit current user evidence;
- delivery with stale test/comprehension/baseline/repository evidence;
- any `legacy-linear@1` task, historical-task continuation, or alternate process;
- adapter-selected transition;
- method-tool artifact/checkbox state changing Core without apply;
- normal caller-selected `BLOCKED`;
- blind mutation retry after an uncertain result;
- event replay as ordinary current-state authority.

Every failure is zero-write unless the failure itself is an explicitly defined successful recovery
transition into `BLOCKED`.

## 14. Legal Example

Current node:

```json
{
  "node_id": "COMPREHENSION_REVIEW",
  "available_transitions": [
    {"transition_id": "comprehension_passed", "destination": "DELIVERY"},
    {"transition_id": "implementation_defect", "destination": "IMPLEMENT"},
    {"transition_id": "code_too_complex", "destination": "REFACTOR"},
    {"transition_id": "design_too_complex", "destination": "DESIGN"},
    {"transition_id": "evidence_insufficient", "destination": "TEST"},
    {"transition_id": "requirement_unclear", "destination": "REQUIREMENTS"}
  ]
}
```

Developer says the code works but is too complex. The caller submits:

```json
{
  "transition_id": "code_too_complex",
  "summary": "The behavior is correct, but the abstraction chain is not maintainable.",
  "reason": "The developer cannot trace the request path without crossing four unnecessary wrappers.",
  "artifacts": [],
  "method_evidence": [
    {
      "step_id": "comprehension.explain",
      "status": "plain_fallback",
      "capability": "",
      "summary": "Explained the current behavior and code path."
    },
    {
      "step_id": "comprehension.identify_complexity",
      "status": "plain_fallback",
      "capability": "",
      "summary": "Identified the unnecessary abstraction and maintenance risk."
    },
    {
      "step_id": "comprehension.obtain_user_verdict",
      "status": "plain_fallback",
      "capability": "",
      "summary": "Recorded the developer's remediation verdict."
    }
  ],
  "node_result": {
    "problem_class": "code_complexity",
    "explained_components": ["request entry", "service boundary"],
    "unresolved_questions": ["Why two adapter layers are required"],
    "unnecessary_abstractions": ["second adapter layer", "generic factory"],
    "maintenance_risks": ["simple changes require edits across four files"],
    "user_confirmation": null,
    "findings": ["The request path contains unnecessary abstraction."]
  }
}
```

Core derives destination `REFACTOR`; the caller does not submit it.

## 15. Illegal Example

```json
{
  "transition_id": "delivery_complete",
  "destination": "DONE",
  "summary": "Skip the remaining review.",
  "reason": "",
  "node_result": {}
}
```

From `COMPREHENSION_REVIEW`, `delivery_complete` is not declared, and `destination` is forbidden.
Core returns `TRANSITION_NOT_ALLOWED` or `INVALID_ARGUMENT` according to decode/dispatch order and
performs zero writes.
