package recovery

import (
	"time"

	"github.com/Innocent-children/dev-flow/internal/domain"
)

// MutationDirective is an internal, non-persisted instruction for the
// Application coordinator. It never appears in RecoveryAssessment or protocol
// fixtures.
type MutationDirective string

const (
	DirectiveNoWrite               MutationDirective = "no_write"
	DirectiveNormalTransition      MutationDirective = "normal_transition"
	DirectiveCreateBlocker         MutationDirective = "create_blocker"
	DirectiveReturnExistingBlocker MutationDirective = "return_existing_blocker"
	DirectiveRevisionConflict      MutationDirective = "revision_conflict"
	DirectiveActionStale           MutationDirective = "action_stale"
)

func (d MutationDirective) IsValid() bool {
	switch d {
	case DirectiveNoWrite, DirectiveNormalTransition, DirectiveCreateBlocker,
		DirectiveReturnExistingBlocker, DirectiveRevisionConflict, DirectiveActionStale:
		return true
	default:
		return false
	}
}

// ClassificationFacts are already-validated, Core-derived facts. Reconcile
// constructs them; keeping Classify separate makes the ordered table pure and
// directly testable.
type ClassificationFacts struct {
	Operation                    OperationReference
	TaskRevision                 uint64
	CurrentTaskPhase             domain.Phase
	CurrentActionID              *domain.ID
	IssuanceBindingDigest        domain.Digest
	AuthoritativeBindingDigest   domain.Digest
	ObservedBindingDigest        domain.Digest
	RepositoryRelation           RepositoryRelation
	LastOperationRelation        LastOperationRelation
	OperationEvidence            OperationEvidenceState
	OperationPayloadDigest       domain.Digest
	CommittedProof               *CommittedOperationProof
	SourceCurrent                bool
	CurrentActionAcceptsObserved bool
	ProposedUnblockCondition     *domain.BlockerCondition
	ExistingUnblockCondition     *domain.BlockerCondition
	ObservedAt                   time.Time
}

type RecoveryDecision struct {
	Assessment RecoveryAssessment
	Directive  MutationDirective
}

func Classify(facts ClassificationFacts) (RecoveryDecision, error) {
	if err := facts.validate(); err != nil {
		return RecoveryDecision{}, err
	}

	classification := domain.RecoveryClassification("")
	directive := DirectiveNoWrite
	switch {
	case facts.LastOperationRelation == LastOperationExact:
		classification = domain.RecoveryCompletedAndRecorded
	case facts.LastOperationRelation == LastOperationContradictory:
		classification = domain.RecoveryConflicting
		directive = conflictDirective(facts)
	case !facts.SourceCurrent:
		classification = domain.RecoveryConflicting
		directive = conflictDirective(facts)
	case facts.OperationEvidence == OperationEvidenceContradictory ||
		!operationAllowsRelation(facts.Operation.ActionKind, facts.RepositoryRelation):
		classification = domain.RecoveryConflicting
		directive = conflictDirective(facts)
	case facts.Operation.ActionKind == domain.ActionImplementChange &&
		facts.OperationEvidence == OperationEvidenceNone &&
		facts.RepositoryRelation == RepositoryWorktreeOnlyChanged:
		classification = domain.RecoveryPartiallyCompleted
		directive = DirectiveCreateBlocker
	case facts.OperationEvidence == OperationEvidenceComplete:
		classification = domain.RecoveryCompletedButUnrecorded
		directive = DirectiveNormalTransition
	case facts.OperationEvidence == OperationEvidenceNone && facts.RepositoryRelation == RepositoryExact:
		classification = domain.RecoveryNotStarted
	default:
		return RecoveryDecision{}, domain.ErrInvalidArgument
	}

	assessment := RecoveryAssessment{
		Classification:             classification,
		Operation:                  facts.Operation,
		TaskRevision:               facts.TaskRevision,
		CurrentActionID:            cloneID(facts.CurrentActionID),
		IssuanceBindingDigest:      facts.IssuanceBindingDigest,
		AuthoritativeBindingDigest: facts.AuthoritativeBindingDigest,
		ObservedBindingDigest:      facts.ObservedBindingDigest,
		RepositoryRelation:         facts.RepositoryRelation,
		LastOperationRelation:      facts.LastOperationRelation,
		OperationEvidence:          facts.OperationEvidence,
		OperationPayloadDigest:     facts.OperationPayloadDigest,
		ActionRetrySafe:            classification == domain.RecoveryNotStarted,
		NextAdvice:                 adviceFor(classification, facts),
		ObservedAt:                 facts.ObservedAt,
	}
	if classification == domain.RecoveryCompletedAndRecorded {
		assessment.CommittedProof = cloneProof(facts.CommittedProof)
	}
	if facts.CurrentTaskPhase == domain.PhaseBlocked {
		assessment.UnblockCondition = cloneCondition(facts.ExistingUnblockCondition)
	} else if (classification == domain.RecoveryConflicting ||
		classification == domain.RecoveryPartiallyCompleted) && canCreateBlocker(facts) {
		assessment.UnblockCondition = cloneCondition(facts.ProposedUnblockCondition)
	}
	if err := assessment.Validate(); err != nil || !directive.IsValid() {
		return RecoveryDecision{}, domain.ErrInvalidArgument
	}
	return RecoveryDecision{Assessment: assessment, Directive: directive}, nil
}

func (facts ClassificationFacts) validate() error {
	if facts.Operation.Validate() != nil || facts.TaskRevision == 0 || !facts.CurrentTaskPhase.IsValid() ||
		(facts.CurrentActionID != nil && !facts.CurrentActionID.IsValid()) ||
		!facts.IssuanceBindingDigest.IsValid() || !facts.AuthoritativeBindingDigest.IsValid() ||
		!facts.ObservedBindingDigest.IsValid() || !facts.RepositoryRelation.IsValid() ||
		!facts.LastOperationRelation.IsValid() || !facts.OperationEvidence.IsValid() ||
		!facts.OperationPayloadDigest.IsValid() || !validUTC(facts.ObservedAt) {
		return domain.ErrInvalidArgument
	}
	if facts.CurrentTaskPhase.Terminal() {
		if facts.CurrentActionID != nil {
			return domain.ErrInvalidArgument
		}
	} else if facts.CurrentActionID == nil {
		return domain.ErrInvalidArgument
	}
	if (facts.RepositoryRelation == RepositoryExact) !=
		(facts.AuthoritativeBindingDigest == facts.ObservedBindingDigest) {
		return domain.ErrInvalidArgument
	}
	if facts.SourceCurrent && (facts.TaskRevision != facts.Operation.ExpectedRevision ||
		facts.CurrentTaskPhase != facts.Operation.SourcePhase || facts.CurrentActionID == nil ||
		*facts.CurrentActionID != facts.Operation.ActionID ||
		facts.AuthoritativeBindingDigest != facts.IssuanceBindingDigest) {
		return domain.ErrInvalidArgument
	}
	if facts.LastOperationRelation == LastOperationExact {
		if facts.CommittedProof == nil || !proofMatchesFacts(*facts.CommittedProof, facts) {
			return domain.ErrInvalidArgument
		}
	} else if facts.CommittedProof != nil {
		return domain.ErrInvalidArgument
	}
	if facts.ProposedUnblockCondition == nil || facts.ProposedUnblockCondition.Validate() != nil ||
		facts.ProposedUnblockCondition.ExpectedBindingDigest != facts.IssuanceBindingDigest {
		return domain.ErrInvalidArgument
	}
	if facts.CurrentTaskPhase == domain.PhaseBlocked {
		if facts.ExistingUnblockCondition == nil || facts.ExistingUnblockCondition.Validate() != nil ||
			facts.ExistingUnblockCondition.ExpectedBindingDigest != facts.AuthoritativeBindingDigest {
			return domain.ErrInvalidArgument
		}
	} else if facts.ExistingUnblockCondition != nil {
		return domain.ErrInvalidArgument
	}
	return nil
}

func proofMatchesFacts(proof CommittedOperationProof, facts ClassificationFacts) bool {
	return proof.Validate() == nil && proof.OperationID == facts.Operation.OperationID &&
		proof.ActionID == facts.Operation.ActionID && proof.FromRevision == facts.Operation.ExpectedRevision &&
		proof.ToRevision == facts.Operation.ExpectedRevision+1 && proof.ToRevision == facts.TaskRevision &&
		proof.PayloadDigest == facts.OperationPayloadDigest
}

func canCreateBlocker(facts ClassificationFacts) bool {
	return facts.SourceCurrent && facts.Operation.SourcePhase.NormalNonTerminal() &&
		facts.CurrentTaskPhase == facts.Operation.SourcePhase
}

func conflictDirective(facts ClassificationFacts) MutationDirective {
	if canCreateBlocker(facts) {
		return DirectiveCreateBlocker
	}
	if facts.CurrentTaskPhase == domain.PhaseBlocked {
		return DirectiveReturnExistingBlocker
	}
	if facts.TaskRevision != facts.Operation.ExpectedRevision {
		return DirectiveRevisionConflict
	}
	return DirectiveActionStale
}

func operationAllowsRelation(action domain.ActionKind, relation RepositoryRelation) bool {
	if action == domain.ActionImplementChange {
		return relation == RepositoryExact || relation == RepositoryWorktreeOnlyChanged
	}
	return relation == RepositoryExact
}

func adviceFor(classification domain.RecoveryClassification, facts ClassificationFacts) RecoveryAdvice {
	switch classification {
	case domain.RecoveryNotStarted:
		return AdviceRetryCurrentAction
	case domain.RecoveryCompletedButUnrecorded:
		return AdviceSubmitRecoveryApply
	case domain.RecoveryPartiallyCompleted:
		return AdviceSubmitRecoveryApply
	case domain.RecoveryConflicting:
		if canCreateBlocker(facts) {
			return AdviceSubmitRecoveryApply
		}
		return currentTaskAdvice(facts)
	case domain.RecoveryCompletedAndRecorded:
		return currentTaskAdvice(facts)
	default:
		return ""
	}
}

func currentTaskAdvice(facts ClassificationFacts) RecoveryAdvice {
	if facts.CurrentTaskPhase == domain.PhaseBlocked {
		return AdviceResolveBlocker
	}
	if facts.CurrentTaskPhase.Terminal() || facts.CurrentActionAcceptsObserved {
		return AdviceReadNextAction
	}
	return AdviceStopForRepositoryDrift
}
