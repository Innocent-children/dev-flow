# Data Model: Development Process Graph

## 1. Model Boundaries

The Task snapshot remains the current-state authority. TaskEvents remain append-only audit records and
are not replayed during ordinary reads. Repository observation remains external structured input to
Core transitions. Spec Kit/OpenSpec documents remain repository artifacts and are not parsed as
workflow state.

Exactly one persisted task model is supported:

```text
snapshot_version 2 → ProcessTask / standard-development@1
```

Schema 1 and snapshot-version-1 task data are rejected before task decoding. There is no legacy task
model, compatibility process, dual decoder, or conversion path.

## 2. Closed Identifiers

### 2.1 Process identifiers

```text
ProcessID:
- standard-development

ProcessVersion:
- positive integer

ProcessDefinitionDigest:
- canonical lowercase SHA-256
```

Supported combination in Core Contract 0.2:

```text
standard-development@1
```

No other ID/version is accepted.

### 2.2 Standard node identifiers

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

`DONE` and `CANCELLED` are terminal. `BLOCKED` is exceptional and nonterminal.

### 2.3 Standard action kinds

```text
COMPLETE_REQUIREMENTS
COMPLETE_DESIGN
COMPLETE_TASKS
COMPLETE_IMPLEMENTATION
COMPLETE_TEST
COMPLETE_COMPREHENSION_REVIEW
COMPLETE_REFACTOR
COMPLETE_DELIVERY
RESOLVE_BLOCKER
```

The source node determines the exact action kind. There is no generic caller-owned “set state”
action.

### 2.4 Method profiles

```text
plain
spec-kit
openspec
```

The profile is selected when a task is created and is immutable.

### 2.5 V2 allowed effects

```text
read_repository
edit_process_artifacts
edit_product_files
run_verification_commands
request_user_decision
prepare_delivery_summary
resolve_blocker
```

These describe Host work allowed by the current action. They do not cause Core to execute arbitrary
filesystem, shell, Git, or network operations.

### 2.6 Artifact roles

```text
requirements
design
task_plan
implementation
test
comprehension
refactor
delivery
other_process
```

### 2.7 Method-step status

```text
completed
not_run
unavailable
plain_fallback
```

A method status is evidence about how node work was performed, not a workflow decision.

## 3. ProcessDefinition

```go
type ProcessReference struct {
    ID               ProcessID
    Version          uint32
    DefinitionDigest Digest
}

type ProcessDefinition struct {
    Reference  ProcessReference
    EntryNode  NodeID
    Nodes      []NodeDefinition
    Transitions []TransitionDefinition
}
```

### Invariants

- Process ID/version/digest is unique.
- Node IDs and transition IDs are unique within the process.
- Every transition source/destination exists.
- Entry node is nonterminal.
- Terminal nodes have no outgoing transition.
- Every nonterminal standard node has exactly one action blueprint.
- `BLOCKED` is not the destination of a normal transition.
- `CANCELLED` is not the destination of a normal transition.
- Definition order is stable and included in the digest.
- Definitions are compiled into Core; no runtime deserialization path exists.

## 4. NodeDefinition

```go
type NodeDefinition struct {
    NodeID                NodeID
    Purpose               string
    EntryAssumptions      []string
    CompletionConditions  []string
    AllowedEffects        []AllowedEffect
    RequiredEvidence      []EvidenceRequirement
    SemanticMethodSteps   []SemanticMethodStep
    OutgoingTransitions   []TransitionDefinition
    ActionKind            ActionKind
    PayloadContract       string
}
```

### Invariants

- Purpose is non-empty normalized text.
- Entry assumptions and completion conditions are non-empty bounded lists.
- Effects/evidence/steps/transition IDs are unique and declaration ordered.
- Every outgoing transition has `Source == NodeID`.
- `DONE` and `CANCELLED` have no action definition.
- The Task stores the exact issued action; repeated reads do not regenerate a different action
  identity or text.

## 5. TransitionDefinition

```go
type TransitionDefinition struct {
    TransitionID  TransitionID
    Source        NodeID
    Destination   NodeID
    Guard         TransitionGuardID
    ReasonRequired bool
}
```

Guards are closed code identifiers, not caller expressions. The exact transition/guard set is in
`contracts/process-graph.md`.

### Invariants

- Caller submits only `TransitionID`.
- Destination and guard are resolved by Core.
- A transition is valid only for the current source node and current process definition.
- A `ReasonRequired` transition rejects empty, untrimmed, invalid UTF-8, or oversized reason.
- Unknown/stale/source-incompatible transition returns `TRANSITION_NOT_ALLOWED` with zero writes.
- Normal transitions cannot leave terminal nodes.
- Blocker resolution uses the stored resume node, not a normal transition definition.

## 6. TaskIntent

```go
type TaskIntent struct {
    Request                 string
    InitialScope            []string
    InitialOutOfScope       []string
    KnownAcceptanceCriteria []string
    VerificationBudget      VerificationBudget
    MethodProfile           MethodProfile
}
```

### Invariants

- Immutable after task creation.
- `Request` is non-empty and bounded by `MaxGoalBytes`.
- Known lists use existing scope/acceptance item limits and may be empty.
- Acceptance is allowed to be incomplete at task creation.
- Verification budget remains immutable and uses the existing closed levels.
- Method profile is one of the three standard values.

`TaskIntent` is authorization/history, not the terminal acceptance authority.

## 7. Baseline Entities

### 7.1 RequirementsBaseline

```go
type RequirementsBaseline struct {
    Revision           uint32
    Digest             Digest
    Goal               string
    Scope              []string
    OutOfScope         []string
    AcceptanceCriteria []string
    Constraints        []string
    Assumptions        []string
    ArtifactRefs       []ArtifactReference
    CreatedAt          time.Time
}
```

Invariants:

- Revision begins at 1 and increments exactly by 1.
- Goal and acceptance criteria are non-empty.
- Lists are normalized, ordered, duplicate-free, and bounded.
- Baseline digest is derived by Core from canonical semantic fields and artifact references.
- A ready baseline has no material unresolved-question field; unresolved questions remain in the
  source payload and prevent `requirements_ready`.
- The latest baseline is the only acceptance authority for Outcome.

### 7.2 DesignBaseline

```go
type DesignBaseline struct {
    Revision              uint32
    Digest                Digest
    RequirementsRevision  uint32
    Approach               string
    Components             []string
    Decisions              []string
    RejectedAlternatives   []string
    ComplexityJustification []string
    Risks                  []string
    ArtifactRefs           []ArtifactReference
    CreatedAt              time.Time
}
```

Invariants:

- Requirements revision equals the current requirements revision at commit.
- Approach and at least one decision are required.
- Every introduced abstraction named by the design must be represented in decisions or complexity
  justification.
- A new design revision invalidates the current task plan and all downstream readiness.

### 7.3 TaskPlanBaseline

```go
type TaskPlanBaseline struct {
    Revision       uint32
    Digest         Digest
    DesignRevision uint32
    WorkItems      []WorkItem
    ArtifactRefs   []ArtifactReference
    CreatedAt      time.Time
}

type WorkItem struct {
    WorkItemID        ID
    Summary           string
    ExpectedPaths     []string
    AcceptanceIndexes []uint32
    VerificationSteps []string
    Dependencies      []ID
}
```

Invariants:

- Design revision equals the current design revision.
- At least one work item exists.
- Work item IDs are unique and dependency references resolve within the same baseline.
- Dependency graph is acyclic.
- Every current acceptance criterion is referenced by at least one work item or an explicit
  delivery-only rationale.
- Expected paths are repository-relative and parent-safe.

### 7.4 BaselineReference

```go
type BaselineReference struct {
    Kind      BaselineKind
    Revision  uint32
    Digest    Digest
    Summary   string
    CreatedAt time.Time
}
```

Only compact references to superseded baselines are retained in the Task. Full historical details
remain in TaskEvent payload digests and optional repository artifacts. Runtime reads do not replay
events.

## 8. ArtifactReference

```go
type ArtifactReference struct {
    Role    ArtifactRole
    Path    string
    Digest  Digest
    Summary string
}
```

### Invariants

- Optional for `plain`; used when a method creates repository artifacts.
- Path is repository-relative, normalized, and parent-safe.
- Digest is host-submitted evidence digest and is not a replacement for repository binding.
- Artifact content is not stored or parsed by Core.
- Duplicate role/path/digest entries within one payload are rejected.
- At most 16 references may be submitted by one action.

## 9. SemanticMethodStep and MethodEvidence

```go
type SemanticMethodStep struct {
    StepID      MethodStepID
    Purpose     string
    Required    bool
}

type MethodEvidence struct {
    StepID      MethodStepID
    Status      MethodStepStatus
    Capability  string
    Summary     string
}
```

### Invariants

- Step ID must be returned by the current node.
- Capability is adapter/Host evidence and may be empty for plain work.
- `unavailable` cannot satisfy a required semantic step.
- `plain_fallback` can satisfy a semantic step only when the payload also contains the required
  semantic node result.
- Command spelling is never used by Core to determine completion.
- At most 16 method-evidence items may be submitted by one action.

## 10. ImplementationRecord

```go
type ImplementationRecord struct {
    Revision               uint32
    TaskPlanRevision       uint32
    RepositoryBindingDigest Digest
    CompletedWorkItemIDs   []ID
    ChangedPaths           []string
    NoFileChanges          bool
    Deviations             []string
    Summary                string
    CreatedAt              time.Time
}
```

### Invariants

- Task-plan revision equals current plan.
- Exactly one of non-empty changed paths or `NoFileChanges=true` is used.
- Changed paths are normalized and parent-safe.
- Repository binding matches the accepted post-action observation.
- A repository-changing record invalidates current test/comprehension records.
- Deviations that change requirements/design must use a backward transition rather than being
  silently accepted.

## 11. TestRecord

```go
type TestRecord struct {
    RecordID                ID
    RequirementsRevision    uint32
    DesignRevision          uint32
    TaskPlanRevision        uint32
    RepositoryBindingDigest Digest
    EvidenceIDs             []ID
    UnverifiedItems         []string
    ManualHandoffItems      []string
    PassedAt                time.Time
}
```

### Invariants

- Created only by `tests_passed`.
- All referenced revisions and binding equal current authorities.
- Evidence IDs resolve to current retained evidence.
- No referenced evidence is failed.
- Failed items are empty.
- Automatic command/full-suite/manual handoff constraints obey the immutable verification budget.
- Any later repository-changing implementation/refactor or baseline change invalidates the current
  record but does not delete retained evidence.

## 12. ComprehensionAssessment

```go
type ComprehensionAssessment struct {
    RecordID                 ID
    RequirementsRevision     uint32
    DesignRevision           uint32
    TaskPlanRevision         uint32
    RepositoryBindingDigest  Digest
    ExplainedComponents      []string
    MaintenanceRisks         []string
    UserEvidenceID           ID
    ConfirmedAt              time.Time
}
```

### Invariants

- Created only by `comprehension_passed`.
- Current TestRecord exists and matches all revisions/binding.
- Explained components are non-empty.
- Unresolved questions and unnecessary-abstraction lists in the source payload are empty.
- `UserEvidenceID` resolves to source `user`, status `passed`, and the current action.
- Host-observed/static/automated evidence cannot replace user confirmation.
- Any later repository/baseline change invalidates the current assessment.

## 13. ProcessActionV2

```go
type ProcessActionV2 struct {
    ActionID                ID
    Kind                    ActionKind
    TaskID                  ID
    Revision                uint64
    Process                 ProcessReference
    NodeID                  NodeID
    RepositoryBindingDigest Digest
    AllowedEffects          []AllowedEffect
    RequiredEvidence        []EvidenceRequirement
    PayloadContract         string
    NodeContract            NodeContractProjection
    AllowedTransitions      []TransitionProjection
    MethodProfile           MethodProfile
    SemanticMethodSteps     []SemanticMethodStep
    Guidance                string
    IssuedAt                time.Time
}
```

### Invariants

- Action revision equals Task revision.
- Process and node equal the current Task cursor.
- Node contract, edges, and method steps equal the built-in definition identified by the Task's
  process digest.
- Repository binding equals the Task binding at issuance.
- Action identity and complete contract persist across reads/restarts.
- An action must use the exact current-node payload contract; no historical payload branch exists.

## 14. ProcessTask (Snapshot Version 2)

```go
type ProcessTask struct {
    TaskID                 ID
    OriginHost             Host
    Intent                 TaskIntent
    Process                ProcessReference
    CurrentNode            NodeID
    ResumeNode             *NodeID
    CurrentAction          *ProcessActionV2
    Blocker                *Blocker
    LastOperation          *LastOperation
    Repository             RepositoryBinding

    Requirements           *RequirementsBaseline
    Design                 *DesignBaseline
    TaskPlan               *TaskPlanBaseline
    Implementation         *ImplementationRecord
    Test                   *TestRecord
    Comprehension          *ComprehensionAssessment
    BaselineHistory        []BaselineReference

    Evidence               []EvidenceSummary
    Outcome                *ProcessOutcome
    Revision               uint64
    CreatedAt              time.Time
    UpdatedAt              time.Time
    CompletedAt            *time.Time
}
```

### Aggregate invariants

- New task starts with no baselines in `REQUIREMENTS`.
- Nonterminal normal task has one current action, no outcome/completed time.
- `BLOCKED` has blocker, resume node, and `RESOLVE_BLOCKER`.
- Terminal task has no action/blocker/resume node and has one valid outcome/completed time.
- Baseline dependency chain is current and monotonic.
- Current test/comprehension authorities satisfy invalidation rules.
- Current action is an exact definition-derived blueprint.
- LastOperation reaches current revision.
- Evidence and history are bounded and duplicate-free.
- Repository claim exists for nonterminal task and is released at terminal.
- Encoded task remains within `MaxPersistedTaskSnapshotBytes`.
- Process definition mismatch returns `PROCESS_UNSUPPORTED`; it is never silently upgraded.

## 15. ProcessOutcome

```go
type ProcessOutcome struct {
    Status                    TerminalStatus
    Summary                   string
    RequirementsRevision      uint32
    Acceptance                []OutcomeCriterion
    TestRecordID              ID
    ComprehensionRecordID     ID
    AutomatedEvidenceIDs      []ID
    ManualEvidenceIDs         []ID
    FinalRepositoryDigest     Digest
    Risks                     []string
    CompletedAt               time.Time
}
```

### Invariants

- `DONE` uses status `completed`; `CANCELLED` uses status `cancelled`.
- Completed acceptance count/order/text equals the latest requirements baseline.
- Every criterion is `satisfied`; no current unverified item remains.
- Test and comprehension IDs resolve to current records.
- Evidence source types match their lists.
- Final repository digest equals Task repository binding.
- Cancellation retains the latest available authorities but does not claim criteria satisfied.

## 16. TaskEvent Schema 2 Projection

Schema 2 stores graph-native event fields directly:

```text
source_node
destination_node
transition_id
transition_reason
```

For a normal apply:

- `transition_id` is required and exact;
- `transition_reason` is null/empty for reason-free forward edges and normalized text for required
  backward/remediation edges;
- `source_node` equals the action source node;
- `destination_node` is derived by Core from the process definition.

For cancellation, recovery blocking, and blocker resolution, event type and source/destination rules
are operation-specific; Core does not fabricate a normal transition ID.

## 17. SQLite Row Metadata and Storage Boundary

Every Schema 2 task row contains:

```text
process_id                TEXT NOT NULL
process_version           INTEGER NOT NULL
process_definition_digest TEXT NOT NULL
snapshot_version          INTEGER NOT NULL CHECK (= 2)
current_node              TEXT NOT NULL
```

The only accepted values are:

```text
process_id       = standard-development
process_version  = 1
snapshot_version = 2
```

A fresh data directory creates the complete Schema 2 tables directly. A Schema 1/pre-graph database
is rejected as `SCHEMA_UNSUPPORTED` with zero writes before task decoding. Core does not provide a v1
codec, migration, legacy process, or data conversion path. User-controlled archive/rename/delete or a
fresh data directory is required before new graph tasks can be created.

## 18. Invalidation Matrix

| Transition Category | Authorities Invalidated at Commit |
| --- | --- |
| Any destination `REQUIREMENTS` | Design, task plan, implementation currentness, test, comprehension, delivery readiness |
| Any destination `DESIGN` | Task plan, implementation currentness, test, comprehension, delivery readiness |
| Any destination `TASKS` after new design | Implementation currentness, test, comprehension, delivery readiness |
| Destination `IMPLEMENT` for rework | Test, comprehension, delivery readiness |
| Repository-changing `IMPLEMENT → TEST` | Test, comprehension, delivery readiness before new test |
| Any destination `TEST` | Comprehension and delivery readiness; existing test is non-current |
| Destination `REFACTOR` | Test, comprehension, delivery readiness |
| Repository-changing `REFACTOR → TEST` | Test, comprehension, delivery readiness before new test |
| `tests_passed` | Creates TestRecord; comprehension remains absent/non-current |
| `comprehension_passed` | Creates ComprehensionAssessment |
| Destination `DELIVERY` | Requires current test/comprehension but does not create outcome |
| `delivery_complete` | Creates Outcome and releases claim |

Invalidation clears only the current authority pointer. Retained EvidenceSummary and
BaselineReference records remain for audit and recovery.

## 19. Lifecycle

### New standard task

```text
open_task
→ persist TaskIntent + standard process reference
→ current node REQUIREMENTS
→ issue COMPLETE_REQUIREMENTS action
```

### Forward development

```text
requirements baseline
→ design baseline
→ task-plan baseline
→ implementation record
→ test record
→ user-confirmed comprehension
→ delivery outcome
```

### Backward revision

```text
source node selects exact backward transition + reason
→ invalidate dependent current authorities
→ destination action issued
→ destination node creates a new baseline/record when completed
```

### Blocked recovery

```text
uncertain mutation classified partial/conflicting
→ BLOCKED with stored resume node
→ exact machine condition restored
→ new action issued at stored node
```

### Cancellation

Any nonterminal node can be cancelled through the existing cancellation operation using current
revision and explicit user authority.

### Restart

The Store verifies exact Schema 2 metadata, decodes the single strict snapshot shape, validates the process definition, and
returns the persisted action identity. Reads do not increment revision or regenerate an action.

## 20. Core Limits 0.2

Reuse existing limits unless listed below. Add:

| Limit | Value |
| --- | ---: |
| Maximum retained baseline references | 32 |
| Maximum artifact references per action | 16 |
| Maximum method evidence items per action | 16 |
| Maximum work items in one task-plan baseline | 64 |
| Maximum dependency IDs per work item | 64 |
| Maximum explained components | 64 |
| Maximum standard transitions in one process | 64 |
| Maximum normal/exceptional nodes in one process | 16 |

The existing maximum task snapshot and result-envelope byte limits remain unchanged. Validation
must account for the complete v2 aggregate before mutation.
