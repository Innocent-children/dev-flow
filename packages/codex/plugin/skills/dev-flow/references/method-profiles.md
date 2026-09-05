# Codex Method Profile Rendering Reference

This is the closed Codex Host-rendering reference for current Core contract semantic method steps. Read
it only after Core returns a complete current Action. It explains how Codex may perform the work; it
is not a process definition or a second task cursor.

## Authority boundary

Core owns task and process identity, the current node and Action, node obligations, semantic step
IDs and order, legal transitions and guards, problem-class validation, destination, evidence
validity, recovery, blockers, and terminal outcome. The Adapter owns capability visibility checks,
rendered instructions, expected artifact descriptions, plain-equivalent work, and honest bounded
method evidence.

Code discovery may span only repositories already present in the immutable Core Repository Scope.
For a multi-repository Task, keep the repository key attached to every discovered symbol, artifact,
expected path, and changed surface. Discovery results never add repositories, change permissions,
or establish Core progress.

The Adapter must not derive or select a transition or destination outside the complete current
Action. A command result, artifact checkbox, proposal status, verification status, or archive status
does not advance or mutate Core. Only a valid Core apply using one returned transition can do that.
The Adapter keeps no independent current node, baseline, profile cursor, or completion state.

## Profiles and rendered operation

The immutable task profile is exactly one of `plain`, `spec-kit`, or `openspec`. `plain` uses no
external method capability. The other profiles map only capabilities actually visible in the
current Host; listing a capability here does not prove that it is installed.

Present each Core-returned step with this closed shape:

<!-- rendered-operation-example:start -->
```json
{
  "step_id": "requirements.clarify",
  "purpose": "Resolve material requirement ambiguity.",
  "required": true,
  "profile": "spec-kit",
  "capability_id": "speckit-clarify",
  "rendered_instruction": "Use the installed Spec Kit clarify capability for the active feature.",
  "expected_artifacts": ["active feature specification clarification"],
  "availability": "available"
}
```
<!-- rendered-operation-example:end -->

`availability` is closed and ordered as:

```text
available
unavailable
not_applicable
unknown
```

This shape is presentation and admission guidance only. It is never persisted as Core task state.

## Semantic step rendering catalog

Capability cells name preferred stable capability IDs. A slash-command spelling is not part of the
contract. “Direct” means the profile has no mandatory external capability for that step; render
`not_applicable` and perform the listed plain-equivalent work. Conditional capabilities are rendered
only when actually visible and appropriate to the current authorized artifacts.

<!-- semantic-step-table:start -->
| Step ID | Developer-readable purpose | Plain-equivalent work | Spec Kit capability guidance | OpenSpec capability guidance | Expected artifacts or result |
| --- | --- | --- | --- | --- | --- |
| `requirements.capture` | Capture a bounded goal, scope, exclusions, acceptance criteria, constraints, and assumptions. | Write or revise those bounded requirements. | `speckit-specify` only when no prepared feature exists; otherwise review and revise the current specification. | Use visible `openspec-explore` when intent is unclear, then visible `openspec-propose` when a proposal is needed. | Current requirements specification or proposal/delta specification. |
| `requirements.clarify` | Resolve material requirement questions with the developer. | Ask only material questions and record the answers. | `speckit-clarify`. | Direct proposal/specification revision; visible `openspec-explore` may support exploration. | Recorded material clarifications. |
| `requirements.validate` | Verify that requirements are observable, bounded, and free of material ambiguity. | Review acceptance and confirm that no material question remains. | `speckit-checklist` or direct checklist review. | `openspec-validate` plus human review. | Requirements-quality review or structurally valid current change. |
| `design.choose_approach` | Select the simplest viable approach for the current requirements. | Choose a direct bounded design. | `speckit-plan`. | Revise the proposal/design through visible `openspec-propose`. | Current design artifact. |
| `design.review_complexity` | Identify unnecessary abstractions and justify retained complexity. | Review the design and justify every retained abstraction. | `speckit-plan` plus direct design review. | Direct review; visible `openspec-explore` may support comparison. | Complexity rationale and rejected alternatives. |
| `design.record_decisions` | Record components, decisions, rejected alternatives, and risks. | Record the current decisions and affected components. | `speckit-plan` artifact updates. | Update the proposal/design through visible `openspec-propose`. | Current decisions, risks, and design references. |
| `tasks.decompose` | Decompose the current design into bounded, ordered work items. | Create bounded items with dependencies and expected paths. | `speckit-tasks`. | Revise proposal task artifacts through visible `openspec-propose`. | Current bounded task plan. |
| `tasks.map_acceptance` | Map every current acceptance criterion to work and verification. | Record acceptance-to-work and verification traceability. | `speckit-tasks`. | Review delta specifications and tasks through visible `openspec-propose`. | Acceptance traceability. |
| `tasks.analyze_consistency` | Check requirements, design, and tasks for gaps or contradictions. | Perform a direct cross-artifact consistency review. | `speckit-analyze`. | `openspec-validate` plus direct consistency review. | No unresolved blocking consistency gap, or exact findings. |
| `tasks.plan_verification` | Set initial verification effort after scope, impact, work, and existing tests are understood. | Record intended checks and rationales, expected automatic commands, full-suite expectation, and test-code expectation. | Direct Task Plan work after `speckit-tasks`; no separate capability. | Revise proposal task artifacts through visible `openspec-propose`. | Current `verification_plan` inside the Task Plan baseline. |
| `implementation.execute_plan` | Execute only the work authorized by the current task plan. | Implement the current authorized slice. | `speckit-implement`. | `openspec-apply`. | Implemented current work slice. |
| `implementation.record_surface` | Reconcile completed work and deviations with Core-observed repository effects. | Describe completed work and deviations while Core computes the file surface. | Direct implementation result; no mandatory capability. | Direct apply result; no mandatory capability. | Completed work and deviation summary; Core-observed surface. |
| `implementation.classify_deviations` | Classify deviations as requirement, design, or complexity concerns. | Record the exact concern and route it through Core facts. | Direct classification; amend active artifacts before continuing when semantics change. | Direct classification and current change-artifact update. | Exact deviations and findings. |
| `test.run_budgeted_checks` | Choose the closest necessary checks and adjust insufficient capacity before extra commands run. | Recheck scope before every command; use a justified TEST self-transition before exceeding budget and reassess every full suite. | Direct plan-defined checks; no mandatory Spec Kit capability. | Use `openspec-verify` only when visible and justified; otherwise run plan-defined checks. | Actual bounded result or a recorded pre-run budget increase. |
| `test.record_evidence` | Record actual evidence or the exact pre-run budget adjustment. | Record actual sources and statuses; full suites include the current reason, while an adjustment records its basis, checks, increment, and reason. | Direct evidence recording; no mandatory capability. | Direct evidence recording; no mandatory capability. | Current evidence summary or budget-adjustment record. |
| `test.classify_failure` | Classify failures as implementation, design, or requirement problems. | Classify current failures from observed facts. | Direct classification; no mandatory capability. | Direct classification; no mandatory capability. | Exact failure class and findings. |
| `comprehension.explain` | Explain current behavior, design, and code paths in developer-readable terms. | Present a bounded explanation to the developer. | Direct review; no Spec Kit command owns the verdict. | Direct review; no OpenSpec command owns the verdict. | Developer-readable explanation. |
| `comprehension.identify_complexity` | Identify unnecessary abstractions and maintenance risks. | List concrete complexity and maintenance concerns. | Direct review; no mandatory capability. | Direct review; no mandatory capability. | Exact abstraction and risk findings. |
| `comprehension.obtain_user_verdict` | Obtain the developer's explicit understanding or remediation verdict. | Ask the developer and wait for an explicit answer. | Direct user interaction; no Spec Kit capability can answer. | Direct user interaction; no OpenSpec capability can answer. | Explicit current user verdict. |
| `refactor.simplify` | Remove unnecessary complexity within the approved behavior boundary. | Perform the bounded simplification. | `speckit-implement` only after affected artifacts and tasks are current. | Update change artifacts as needed, then use visible `openspec-apply`. | Bounded simplification. |
| `refactor.reconcile_artifacts` | Reconcile affected process artifacts with the simplification. | Amend only artifacts affected by the simplification. | Use visible `speckit-clarify`, `speckit-plan`, `speckit-tasks`, or `speckit-analyze` only as needed. | Revise proposal/design/spec/task artifacts through visible `openspec-propose` as needed. | Current affected artifacts. |
| `refactor.record_surface` | Record exact simplifications while Core observes the resulting file surface. | Record simplifications and behavior intent. | Direct refactor result; no mandatory capability. | Direct apply result; no mandatory capability. | Refactor summary and Core-observed surface. |
| `delivery.reconcile_acceptance` | Map the latest acceptance criteria to current test and comprehension evidence. | Reconcile every current criterion with current evidence. | `speckit-analyze` or direct final consistency review. | Use visible `openspec-verify` and/or `openspec-validate` as appropriate. | Current acceptance/evidence mapping. |
| `delivery.reconcile_method_artifacts` | Reconcile method artifacts with delivered behavior. | Ensure current process artifacts describe the delivered behavior. | Direct status reconciliation; `speckit-converge` may be used only when available and appropriate. | Use visible `openspec-sync` and/or `openspec-archive` only when appropriate. | Current reconciled or archived change artifacts. |
| `delivery.prepare_summary` | Prepare a bounded delivery summary and remaining risks. | Write the final bounded summary and risks. | Direct summary; no mandatory capability. | Direct summary; no mandatory capability. | Delivery summary and remaining risks. |
<!-- semantic-step-table:end -->

The recognized Spec Kit capability IDs are `speckit-specify`, `speckit-clarify`, `speckit-plan`,
`speckit-checklist`, `speckit-tasks`, `speckit-analyze`, and `speckit-implement`.
`speckit-converge` is an optional repository capability and is never a Core required step.

The recognized OpenSpec capability IDs are `openspec-explore`, `openspec-propose`, `openspec-apply`,
`openspec-verify`, `openspec-sync`, `openspec-archive`, and `openspec-validate`. Some integrations do
not expose verify, sync, or archive. Render only a capability actually visible to the Host. The
presence of an ID in this reference does not prove installation, and OpenSpec installation or
initialization is never automatic Core behavior.

## Availability and fallback

For each step returned by Core:

1. Check only the Host's actual capability surface.
2. When the preferred capability is visible and appropriate, render its exact ID and expected result.
3. When visibility is absent or cannot be confirmed, report `unavailable` or `unknown` honestly.
4. Always show the catalog's plain-equivalent work.
5. Do not automatically install a tool, silently run another tool, or treat invocation as completion.
6. Record completion only after the semantic work actually completes.

For `plain`, render external capability availability as `not_applicable`. When the ordinary work
actually completes, submit an empty `capability`; Core records `status="plain_fallback"`. The same
rule applies when a selected external capability is unavailable but the equivalent work actually
completes. A non-empty `capability` names the actual external capability that completed the step.

When equivalent work remains incomplete, report `unavailable` or `not_run` honestly to the user.
An incomplete required semantic step prevents submission for that Action.

## Method results

A normal submission supplies `method_results` as a closed object keyed by every current Action
`method_steps[].step_id`. Each value contains only `capability` and `summary`. Core creates the
internal `MethodEvidence` items in Action order and fills their `step_id` and `status`.

- Completed external work supplies the actual non-empty capability ID; Core records `completed`.
- Completed plain-equivalent work supplies an empty `capability`; Core records `plain_fallback`.
- Incomplete required steps prevent submission; availability and execution status are not input fields.
- Unknown, duplicate, previous-node, or omitted step keys are invalid. Core determines item order.
- Capability output cannot substitute for the typed `node_result` or any current Core evidence gate.

## Artifact references

Put current-node artifacts in `artifacts.current` when the live schema exposes that slot, and related
method artifacts in `artifacts.other_process`. Each entry contains only contract `path`, `digest`,
and `summary`; Core assigns `role` from the slot and current node. A single-repository Task uses an
ordinary repository-relative path; a multi-repository Task uses
`<repository-key>::<repository-relative-path>`. Refer
only to a file actually observed by the Host. Never submit full contents, command output, prompts,
token data, runtime configuration, or private locations. An artifact digest does not replace the
repository binding. File existence, checkboxes, validation, sync, or archive status never advances
Core by itself.

For Spec Kit, determine the exact active Feature from explicit repository context. Never infer it
only from the branch name. Existing specification, design, and task artifacts should be reviewed and
amended intentionally; step names do not require rerunning specify, plan, or tasks. Checklist marks
are reviewer evidence, not implementation progress. Analyze findings become typed node facts, and
implement work produces repository changes, but neither selects a Core transition.

For OpenSpec, propose, apply, verify, sync, and archive results remain method evidence only. Archive
cannot replace DELIVERY acceptance, current test, comprehension, or evidence gates.

## Comprehension verdict

All profiles present a bounded requirements/design/code-path explanation, list unnecessary
abstractions and maintenance risks, ask whether the developer can explain and maintain the result,
and wait for an explicit user verdict. No AI statement or Spec Kit/OpenSpec capability may provide
that confirmation. The Adapter then considers only the matching transition that Core returned; Core
still validates the typed result and derives the destination.
