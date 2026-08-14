package domain

import "time"

type LastOperation struct {
	OperationID   ID        `json:"operation_id"`
	ActionID      ID        `json:"action_id"`
	FromRevision  uint64    `json:"from_revision"`
	ToRevision    uint64    `json:"to_revision"`
	PayloadDigest Digest    `json:"payload_digest"`
	CommittedAt   time.Time `json:"committed_at"`
}

func (o LastOperation) Validate() error {
	if validateID(o.OperationID) != nil || validateID(o.ActionID) != nil || o.FromRevision == 0 ||
		o.ToRevision != o.FromRevision+1 || validateDigest(o.PayloadDigest) != nil ||
		validateUTC(o.CommittedAt) != nil {
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

	evidenceIDs := make(map[ID]struct{}, len(t.Evidence))
	automaticCommands := 0
	for _, evidence := range t.Evidence {
		if evidence.Validate() != nil {
			return ErrInvalidArgument
		}
		if _, duplicate := evidenceIDs[evidence.EvidenceID]; duplicate {
			return ErrInvalidArgument
		}
		evidenceIDs[evidence.EvidenceID] = struct{}{}
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
