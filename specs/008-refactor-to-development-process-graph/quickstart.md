# Quickstart: Development Process Graph Journeys

## 1. Purpose

This document describes the acceptance journeys for Feature 008. It is not evidence that the
implementation exists. During implementation, each journey must be executed with the evidence class
named below.

The examples use `host=codex`; shared contract tests repeat semantic fixtures with
`host=deepseek` without claiming a DeepSeek product.

## 2. Common Preconditions

- Feature 008 is selected and has passed clarify/checklist/analyze.
- A temporary existing Git repository is available.
- A fresh temporary Dev Flow data directory is used except the explicit old-data rejection journey.
- Core Contract 0.2 server handshake succeeds.
- No public npm/Tag/Release mutation occurs.
- The caller retains every apply request ID and exact payload until the mutation is known.

## 3. Journey A — See the Current Node and Legal Next Nodes

**Proves**: User Story 1, SC-001, SC-003

**Evidence class**: deterministic application/MCP contract test

### Step A1: Handshake

Call:

```text
dev_flow_server_info({})
```

Expected:

- schema version `2`;
- exact six-tool catalog;
- `standard-development@1` as the only supported process, with `new_task_supported=true`;
- method profiles `plain`, `spec-kit`, `openspec`.

### Step A2: Create an early-stage task

Call:

```json
{
  "host": "codex",
  "repository_path": "<temp-repository>",
  "new_task": {
    "request": "Simplify order submission while preserving behavior.",
    "initial_scope": [],
    "initial_out_of_scope": [],
    "known_acceptance_criteria": [],
    "verification_budget": {
      "level": "targeted",
      "max_automatic_commands": 4,
      "allow_full_suite": false,
      "allow_manual_handoff": true
    },
    "method_profile": "spec-kit"
  }
}
```

Expected:

```text
created=true
process=standard-development@1
snapshot_version=2
current_cursor=REQUIREMENTS
revision=1
```

The current action must show:

- node purpose and obligations;
- effects limited to requirements work;
- semantic steps `requirements.capture`, `requirements.clarify`, and
  `requirements.validate`;
- exactly one transition:
  `requirements_ready → DESIGN`;
- no caller-selected destination field.

### Step A3: Complete requirements

After developer clarification, submit `COMPLETE_REQUIREMENTS` using the exact action identity and:

```json
{
  "transition_id": "requirements_ready",
  "summary": "The requirement is bounded and testable.",
  "reason": "",
  "artifacts": [
    {
      "role": "requirements",
      "path": "specs/example/spec.md",
      "digest": "<observed-sha256>",
      "summary": "Current requirement specification."
    }
  ],
  "method_evidence": [
    {
      "step_id": "requirements.capture",
      "status": "completed",
      "capability": "speckit-specify",
      "summary": "The feature specification captures the request."
    },
    {
      "step_id": "requirements.clarify",
      "status": "completed",
      "capability": "speckit-clarify",
      "summary": "Material questions were resolved with the developer."
    },
    {
      "step_id": "requirements.validate",
      "status": "completed",
      "capability": "speckit-checklist",
      "summary": "Requirements quality was reviewed."
    }
  ],
  "node_result": {
    "problem_class": "none",
    "baseline": {
      "goal": "Simplify order submission while preserving observable behavior.",
      "scope": ["order submission request path"],
      "out_of_scope": ["payment provider replacement"],
      "acceptance_criteria": [
        "normal submission behavior is preserved",
        "duplicate submission remains rejected",
        "the developer can explain the final request path"
      ],
      "constraints": ["Do not add a generic pipeline framework"],
      "assumptions": []
    },
    "unresolved_questions": []
  }
}
```

Expected committed result:

```text
revision=2
requirements revision=1
current_cursor=DESIGN
```

The next action must show exactly:

```text
design_ready → TASKS
design_requires_requirements → REQUIREMENTS
```

### Step A4: Invalid edge proof

Using the current DESIGN action, attempt to submit `delivery_complete`.

Expected:

```text
TRANSITION_NOT_ALLOWED
revision remains 2
event count unchanged
claim unchanged
```

## 4. Journey B — Test, Comprehension, Refactor, Retest

**Proves**: User Story 2, SC-004–SC-007

**Evidence class**: deterministic Core journey; repeated once in final real Codex journey

Start from the DESIGN action produced in Journey A.

### Step B1: DESIGN → TASKS

Create the current design baseline and select `design_ready`.

Expected next cursor: `TASKS`.

### Step B2: TASKS → IMPLEMENT

Create a bounded task-plan baseline and select `tasks_ready`.

Expected next cursor: `IMPLEMENT`.

### Step B3: IMPLEMENT → TEST

Perform the planned change, report exact changed paths, and select
`implementation_ready_for_test`.

Expected:

- accepted post-edit repository binding;
- stale test/comprehension authorities absent;
- next cursor `TEST`.

### Step B4: First test fails

Run one targeted check that demonstrates an implementation defect. Submit
`tests_failed_implementation` with `problem_class=implementation_failure`, a reason, and failed
evidence.

Expected:

- next cursor `IMPLEMENT`;
- failure evidence retained;
- no passing TestRecord;
- comprehension/delivery remain unavailable.

### Step B5: Fix and retest

Complete implementation again, enter `TEST`, and submit `tests_passed`.

Expected:

- current TestRecord created against current repository/baselines;
- next cursor exactly `COMPREHENSION_REVIEW`;
- no direct delivery edge from TEST.

### Step B6: Developer cannot understand the code

Present the design/code explanation. The developer states that the code works but the factory and
adapter layers are unnecessary.

Submit:

```text
transition_id=code_too_complex
problem_class=code_complexity
reason=<developer-visible complexity reason>
unnecessary_abstractions=<non-empty>
user_confirmation=null
```

Expected:

- next cursor `REFACTOR`;
- current TestRecord may remain retained but is no longer sufficient for delivery;
- comprehension pass is absent.

### Step B7: Refactor

Remove the unnecessary layers and submit `refactor_ready_for_test`.

Expected:

- repository-changing refactor accepted;
- current TestRecord and comprehension authority invalidated;
- next cursor exactly `TEST`;
- no legal refactor edge to DELIVERY/DONE.

### Step B8: Retest

Submit a fresh `tests_passed` result using current repository and baseline identities.

Expected next cursor: `COMPREHENSION_REVIEW` with a new current TestRecord.

### Step B9: Explicit developer confirmation

Present the simplified path and obtain an explicit user answer. Submit
`comprehension_passed` with:

```json
{
    "explained_components": [
    "request entry",
    "duplicate guard",
    "repository write"
  ],
    "unresolved_questions": [],
    "unnecessary_abstractions": [],
    "maintenance_risks": [],
    "problem_class": "none",
  "user_confirmation": {
    "source": "user",
    "status": "passed",
    "summary": "The developer confirmed the simplified path is understandable."
  }
}
```

Expected:

- current ComprehensionAssessment created;
- next cursor `DELIVERY`.

A separate negative test submits the same payload with `user_confirmation=null`; it must fail with
zero writes.

### Step B10: Delivery

Submit `delivery_complete` using:

- the exact latest requirements acceptance in order;
- current TestRecord ID;
- current ComprehensionAssessment ID;
- current automated/user evidence IDs;
- no unverified item.

The automated list must equal every current passed automated TestRecord evidence in its original
order. The manual list must equal every current passed user TEST evidence in original order followed
by the comprehension user evidence. Empty, missing, stale, duplicate, failed, wrong-source,
static/host-observed, or cross-list IDs are rejected.

Expected:

```text
current_cursor=DONE
outcome.status=completed
claim released
action=null
```

## 5. Journey C — Requirements or Design Rework

**Proves**: explicit backward paths and baseline invalidation

**Evidence class**: deterministic workflow/application test

### Requirement gap discovered during test

At TEST, submit `tests_expose_requirement_issue` with:

- current failed/unverified evidence;
- a material requirement finding;
- required reason.

Expected:

```text
destination=REQUIREMENTS
current design/task plan/implementation/test/comprehension authorities cleared
prior baseline references retained
```

Complete REQUIREMENTS again.

Expected:

```text
requirements revision increments by one
destination=DESIGN
```

A subsequent design must bind to the new requirements revision. Attempts to use old design/task-plan
revision fail with zero writes.

### Design too complex during comprehension

At COMPREHENSION_REVIEW, submit `design_too_complex`.

Expected:

```text
destination=DESIGN
task plan/test/comprehension current authorities invalidated
requirements baseline retained
```

## 6. Journey D — Method Profiles and Missing Capability

**Proves**: User Story 3, SC-008–SC-009

**Evidence class**: Codex adapter static/fixture tests

Create three isolated new tasks with equivalent intent and profiles:

```text
plain
spec-kit
openspec
```

For each REQUIREMENTS action, assert:

- same process/node/action/payload/transition semantics;
- same definition digest;
- different method rendering;
- no profile-specific Core transition.

### Missing Spec Kit capability

Fixture says `speckit-clarify` is unavailable.

Expected presentation:

```text
Selected profile: spec-kit
Missing capability: speckit-clarify
Plain-equivalent work: ask and record only material requirement questions
Core state: unchanged at REQUIREMENTS
```

After direct clarification, method evidence uses:

```json
{
  "step_id": "requirements.clarify",
  "status": "plain_fallback",
  "capability": "",
  "summary": "Resolved the material questions directly with the developer."
}
```

Core validates the requirements baseline; the fallback label does not weaken semantic conditions.

### OpenSpec capability variation

Fixture provides core OpenSpec capabilities but not expanded `verify`.

At TEST:

- adapter reports `openspec-verify` unavailable;
- renders plan-defined plain checks;
- does not run or claim an absent command;
- task remains TEST until actual checks are submitted.

## 7. Journey E — Restart and Resume

**Proves**: persistence/current-action stability

**Evidence class**: subprocess Core journey

1. Create a standard task.
2. Advance to `COMPREHENSION_REVIEW`.
3. Record task/revision/process/node/action/baselines/repository/test evidence.
4. Close the SQLite Store and terminate the first process.
5. Start a new Core/Store/Application process against the same data directory.
6. Resume with `open_task.new_task=null`.

Expected exact equality:

```text
task ID
revision
process ID/version/digest
current cursor
action ID/kind/payload contract
allowed transitions and order
method profile/semantic steps
repository binding
current baseline revisions/digests
TestRecord identity
retained evidence
```

Resume/read performs zero new event/revision writes. Continue to DONE and reopen the retained terminal
task after removing Codex registration.

## 8. Journey F — Fresh Schema 2 and Explicit Old-Data Rejection

**Proves**: User Story 4, SC-011–SC-013

**Evidence class**: deterministic Store/Journey tests

### Fresh bootstrap

1. Create an empty usable temporary data directory.
2. Open the Feature 008 Core.
3. Verify the complete Schema 2 tables/indexes and the exact version-2 bootstrap digest.
4. Verify no Schema 1 history row, `ALTER TABLE` compatibility step, legacy process, or v1 codec is
   involved.
5. Create a `standard-development@1` task, advance it at least one node, close the Store, restart, and
   verify exact task/action/process/baseline equality.

Expected:

```text
schema history = [2]
snapshot_version = 2
process = standard-development@1
current task reopens exactly
```

### Schema 1 zero-write rejection

Prepare a copied representative Schema 1 database containing active and terminal task rows, events,
and a repository claim. Record its database digest and/or logical table/row manifest.

1. Attempt to open it with the Feature 008 Core.
2. Expect `SCHEMA_UNSUPPORTED` before any task snapshot is decoded.
3. Record the after digest/manifest.
4. Verify no table, column, schema row, task, event, claim, or file content changed.
5. Verify Core/setup/update/remove/uninstall did not delete or rename the data.
6. Explicitly choose a fresh data directory (or in the manual scenario archive/rename/delete the old
   directory outside Core).
7. Open again and create a new standard task.

Expected:

```text
old data: unchanged and unsupported
new directory: direct Schema 2 bootstrap
legacy task projection: absent
```

No old binary, legacy continuation, task conversion, or migration journey is required.

## 9. Journey G — Uncertain Mutation Recovery

**Proves**: SC-014

**Evidence class**: deterministic recovery/concurrency journey

Use a repository-changing `REFACTOR → TEST` mutation.

For each uncertain result shape:

```text
missing
cancelled
malformed
truncated
transport-failed
```

Retain original process/source/action/revision/binding/request/payload. Call `get_task` with the exact
operation probe, then `get_next_action` only when needed.

Exercise:

```text
not_started
completed_and_recorded
completed_but_unrecorded
partially_completed
conflicting
```

Expected:

- no blind retry;
- Core-derived classification/advice;
- at most one revision/event;
- partial/conflicting may enter one recovery BLOCKED transaction;
- two handles attempting the same commit produce at most one success;
- adapter never decides the classification.

## 10. Journey H — Phase 5D Contract and Runtime Hardening

**Proves**: SC-017–SC-025 without entering Phase 6–8

**Evidence class**: deterministic domain/workflow/application/store/MCP/contract journey tests

### Recovery fail-closed

Call `get_task` and `get_next_action` with `operation_probe` omitted and explicitly null; both are
ordinary reads. Call ordinary `apply_action` with `recovery_apply` omitted and explicitly null; both
follow the normal transition path.

Then submit a syntactically valid non-null probe and recovery apply. Both return:

```text
RECOVERY_UNAVAILABLE
retry_safe=false
action=none
```

The repository observer invocation count and Task/Event/Evidence/Claim/Schema manifests remain
unchanged. Malformed, unknown-member, and duplicate-member Recovery input returns
`INVALID_ARGUMENT`. This journey does not exercise the five Phase 7 classifications.

### Problem-class binding

Table-drive all 29 transitions using the closed per-node enums. Prove at minimum that an
`implementation_failure` TEST result cannot select `tests_expose_design_issue`, a
`code_complexity` comprehension result cannot select `design_too_complex`, and a delivery
`test_gap` cannot select `delivery_needs_requirements`. Every mismatch is
`TRANSITION_NOT_ALLOWED` and zero-write.

### Manual-handoff separation and exact delivery evidence

Create a task with `allow_manual_handoff=false`. Prove `source=user` TEST evidence is rejected, then
pass TEST using automated evidence, obtain explicit user comprehension confirmation, and reach DONE
with the exact current evidence sets. Empty, incomplete, stale, duplicate, failed, wrong-source, or
cross-list evidence remains rejected.

### Load/cancel/store hardening

Use strict snapshot fixtures to exercise every node-authority row and cross-record reference. Use
database copies to exercise active/terminal claim cardinality, orphan and identity mismatches; every
Store-open failure is `STORAGE_UNAVAILABLE` with an unchanged manifest. Finally prove terminal
cancellation returns `TASK_TERMINAL`, invalid reasons return `INVALID_ARGUMENT`, and valid active or
blocked cancellation commits once.

## 11. Final Real Codex Journey

**Proves**: SC-015

**Evidence class**: one successful native real Codex Journey against one local source-built package
artifact. Failed attempts 1 and 2 remain retained evidence. Attempt 3 is not authorized; no further
native execution may begin without a new explicit user decision.

The final journey must:

1. install the local artifact in an isolated prefix;
2. run explicit setup;
3. invoke the exact Dev Flow selector;
4. create a `spec-kit` or `plain` standard task;
5. show at least one node with multiple legal destinations;
6. perform implementation/test/comprehension complexity/refactor/retest;
7. close and restart Codex;
8. resume the exact same task/action;
9. obtain explicit developer comprehension confirmation;
10. reach Core `DONE`;
11. remove registration;
12. uninstall the local package;
13. reopen retained task data directly with packaged Core;
14. record no unexpected repository path.

This journey does not publish npm, create a Tag, or create a GitHub Release.

## 12. Final Acceptance Matrix

| Capability | Deterministic | Native |
| --- | ---: | ---: |
| Complete graph/forbidden edges | Required | Sampled in final journey |
| Baseline revision/invalidation | Required | Sampled |
| Method-profile parity/fallback | Required | One profile sampled |
| Comprehension user evidence | Required | Required |
| Refactor → test loop | Required | Required |
| Restart/resume | Required | Required |
| Fresh Schema 2 / Schema 1 zero-write rejection | Required | Fresh data used in final journey |
| Five-class uncertain recovery | Required | No extra native fault matrix |
| Phase 5D Recovery fail-closed / problem classes / authority / claim / delivery hardening | Required before Phase 6 | No native run |
| Public release | Forbidden | Forbidden |
