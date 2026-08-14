package domain

import "time"

type LastOperation struct {
	OperationID   ID            `json:"operation_id"`
	Kind          OperationKind `json:"kind"`
	ActionID      *ID           `json:"action_id"`
	FromRevision  uint64        `json:"from_revision"`
	ToRevision    uint64        `json:"to_revision"`
	PayloadDigest Digest        `json:"payload_digest"`
	CommittedAt   time.Time     `json:"committed_at"`
}

func (o LastOperation) Validate() error {
	if validateID(o.OperationID) != nil || !o.Kind.IsValid() ||
		o.ToRevision == 0 || o.ToRevision != o.FromRevision+1 || validateDigest(o.PayloadDigest) != nil ||
		validateUTC(o.CommittedAt) != nil {
		return ErrInvalidArgument
	}
	switch o.Kind {
	case OperationOpenTask:
		if o.FromRevision != 0 || o.ActionID != nil {
			return ErrInvalidArgument
		}
	case OperationApplyAction:
		if o.FromRevision == 0 || o.ActionID == nil || validateID(*o.ActionID) != nil {
			return ErrInvalidArgument
		}
	case OperationCancelTask:
		if o.FromRevision == 0 || o.ActionID != nil {
			return ErrInvalidArgument
		}
	default:
		return ErrInvalidArgument
	}
	return nil
}

// Task is the one authoritative domain snapshot. Validate is the sole entry
// point for aggregate-wide invariants.
type Task struct {
	TaskID        ID                `json:"task_id"`
	OriginHost    Host              `json:"origin_host"`
	Contract      Contract          `json:"-"`
	Repository    RepositoryBinding `json:"repository"`
	Phase         Phase             `json:"phase"`
	ResumePhase   *Phase            `json:"resume_phase"`
	CurrentAction *Action           `json:"current_action"`
	Blocker       *Blocker          `json:"blocker"`
	LastOperation *LastOperation    `json:"last_operation"`
	Evidence      []EvidenceSummary `json:"evidence"`
	Outcome       *Outcome          `json:"outcome"`
	Revision      uint64            `json:"revision"`
	CreatedAt     time.Time         `json:"created_at"`
	UpdatedAt     time.Time         `json:"updated_at"`
	CompletedAt   *time.Time        `json:"completed_at"`
}

func (t Task) Validate() error {
	if validateID(t.TaskID) != nil || !t.OriginHost.IsValid() || t.Contract.Validate() != nil ||
		t.Repository.Validate() != nil || !t.Phase.IsValid() || t.Revision == 0 ||
		validateUTC(t.CreatedAt) != nil || validateUTC(t.UpdatedAt) != nil ||
		t.UpdatedAt.Before(t.CreatedAt) || len(t.Evidence) > MaxRetainedEvidenceItems {
		return ErrInvalidArgument
	}

	evidenceByID := make(map[ID]EvidenceSummary, len(t.Evidence))
	automaticCommands := 0
	for _, evidence := range t.Evidence {
		if evidence.Validate() != nil {
			return ErrInvalidArgument
		}
		if _, duplicate := evidenceByID[evidence.EvidenceID]; duplicate {
			return ErrInvalidArgument
		}
		evidenceByID[evidence.EvidenceID] = evidence
		if evidence.Source == EvidenceSourceAutomated {
			automaticCommands += evidence.CommandCount
			if evidence.FullSuite && !t.Contract.VerificationBudget().AllowFullSuite {
				return ErrInvalidArgument
			}
		}
		if evidence.Source == EvidenceSourceUser && !t.Contract.VerificationBudget().AllowManualHandoff {
			return ErrInvalidArgument
		}
	}
	if automaticCommands > t.Contract.VerificationBudget().MaxAutomaticCommands {
		return ErrInvalidArgument
	}

	if t.LastOperation != nil {
		if t.LastOperation.Validate() != nil || t.LastOperation.ToRevision != t.Revision ||
			t.LastOperation.CommittedAt.After(t.UpdatedAt) {
			return ErrInvalidArgument
		}
	}

	switch {
	case t.Phase.Terminal():
		if t.CurrentAction != nil || t.Blocker != nil || t.ResumePhase != nil ||
			t.Outcome == nil || t.CompletedAt == nil {
			return ErrInvalidArgument
		}
		if validateUTC(*t.CompletedAt) != nil || t.CompletedAt.Before(t.UpdatedAt) ||
			t.Outcome.Validate() != nil || !t.CompletedAt.Equal(t.Outcome.CompletedAt) ||
			t.Outcome.FinalRepositoryBindingDigest != t.Repository.BindingDigest {
			return ErrInvalidArgument
		}
		if (t.Phase == PhaseDone && t.Outcome.Status != TerminalCompleted) ||
			(t.Phase == PhaseCancelled && t.Outcome.Status != TerminalCancelled) {
			return ErrInvalidArgument
		}
		if !outcomeCoversContract(*t.Outcome, t.Contract.AcceptanceCriteria()) {
			return ErrInvalidArgument
		}
		if validateOutcomeEvidenceReferences(*t.Outcome, evidenceByID) != nil {
			return ErrInvalidArgument
		}
	case t.Phase == PhaseBlocked:
		if t.CurrentAction == nil || t.Blocker == nil || t.ResumePhase == nil ||
			t.Outcome != nil || t.CompletedAt != nil || *t.ResumePhase != t.Blocker.ResumePhase {
			return ErrInvalidArgument
		}
		if t.Blocker.Validate() != nil {
			return ErrInvalidArgument
		}
	default:
		if !t.Phase.NormalNonTerminal() || t.CurrentAction == nil || t.Blocker != nil ||
			t.ResumePhase != nil || t.Outcome != nil || t.CompletedAt != nil {
			return ErrInvalidArgument
		}
	}

	if t.CurrentAction != nil {
		if t.CurrentAction.Validate() != nil || t.CurrentAction.TaskID != t.TaskID ||
			t.CurrentAction.Revision != t.Revision ||
			t.CurrentAction.PayloadContract != t.Phase ||
			t.CurrentAction.RepositoryBindingDigest != t.Repository.BindingDigest {
			return ErrInvalidArgument
		}
	}
	if validateTaskAggregate(t) != nil {
		return ErrInvalidArgument
	}
	return nil
}

func validateOutcomeEvidenceReferences(
	outcome Outcome,
	evidenceByID map[ID]EvidenceSummary,
) error {
	for _, evidenceID := range outcome.AutomatedEvidenceIDs {
		evidence, exists := evidenceByID[evidenceID]
		if !exists || evidence.Source != EvidenceSourceAutomated {
			return ErrInvalidArgument
		}
	}
	for _, evidenceID := range outcome.ManualEvidenceIDs {
		evidence, exists := evidenceByID[evidenceID]
		if !exists || evidence.Source != EvidenceSourceUser {
			return ErrInvalidArgument
		}
	}
	return nil
}

func outcomeCoversContract(outcome Outcome, criteria []string) bool {
	if len(outcome.Acceptance) != len(criteria) {
		return false
	}
	for i, criterion := range criteria {
		if outcome.Acceptance[i].Criterion != criterion {
			return false
		}
	}
	return true
}

func (t Task) Clone() Task {
	t.Repository = t.Repository.Clone()
	if t.CurrentAction != nil {
		action := t.CurrentAction.Clone()
		t.CurrentAction = &action
	}
	if t.Blocker != nil {
		blocker := *t.Blocker
		t.Blocker = &blocker
	}
	if t.LastOperation != nil {
		operation := *t.LastOperation
		operation.ActionID = cloneIDPointer(operation.ActionID)
		t.LastOperation = &operation
	}
	t.Evidence = append([]EvidenceSummary(nil), t.Evidence...)
	if t.Outcome != nil {
		outcome := t.Outcome.Clone()
		t.Outcome = &outcome
	}
	t.ResumePhase = clonePhasePointer(t.ResumePhase)
	t.CompletedAt = cloneTimePointer(t.CompletedAt)
	return t
}

type taskAggregateProjection struct {
	TaskID        ID                          `json:"task_id"`
	OriginHost    Host                        `json:"origin_host"`
	Contract      contractAggregateProjection `json:"contract"`
	Repository    RepositoryBinding           `json:"repository"`
	Phase         Phase                       `json:"phase"`
	ResumePhase   *Phase                      `json:"resume_phase"`
	CurrentAction *Action                     `json:"current_action"`
	Blocker       *Blocker                    `json:"blocker"`
	LastOperation *LastOperation              `json:"last_operation"`
	Evidence      []EvidenceSummary           `json:"evidence"`
	Outcome       *Outcome                    `json:"outcome"`
	Revision      uint64                      `json:"revision"`
	CreatedAt     time.Time                   `json:"created_at"`
	UpdatedAt     time.Time                   `json:"updated_at"`
	CompletedAt   *time.Time                  `json:"completed_at"`
}

func validateTaskAggregate(t Task) error {
	size, err := taskAggregateSize(t)
	if err != nil || size > MaxTaskAggregateBytes {
		return ErrInvalidArgument
	}
	return nil
}

func taskAggregateSize(t Task) (int, error) {
	return compactJSONSize(taskAggregateProjection{
		TaskID:        t.TaskID,
		OriginHost:    t.OriginHost,
		Contract:      contractProjection(t.Contract),
		Repository:    t.Repository,
		Phase:         t.Phase,
		ResumePhase:   t.ResumePhase,
		CurrentAction: t.CurrentAction,
		Blocker:       t.Blocker,
		LastOperation: t.LastOperation,
		Evidence:      t.Evidence,
		Outcome:       t.Outcome,
		Revision:      t.Revision,
		CreatedAt:     t.CreatedAt,
		UpdatedAt:     t.UpdatedAt,
		CompletedAt:   t.CompletedAt,
	})
}
