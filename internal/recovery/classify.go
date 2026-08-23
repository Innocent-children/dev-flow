package recovery

import (
	"time"

	"github.com/Innocent-children/dev-flow/internal/domain"
)

type ClassificationFacts struct {
	Operation                    domain.OperationReference
	TaskRevision                 uint64
	CurrentNode                  domain.NodeID
	CurrentActionID              *domain.ID
	IssuanceBindingDigest        domain.Digest
	AuthoritativeBindingDigest   domain.Digest
	ObservedBindingDigest        domain.Digest
	RepositoryRelation           RepositoryRelation
	Repositories                 []RepositoryFact
	LastOperationRelation        LastOperationRelation
	OperationEvidence            OperationEvidenceState
	OperationPayloadDigest       *domain.Digest
	CommittedProof               *CommittedOperationProof
	SourceCurrent                bool
	PayloadRetained              bool
	MayHavePartialRepositoryWork bool
	ExistingBlocker              *domain.ProcessBlocker
	ObservedAt                   time.Time
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
		classification, directive = domain.RecoveryConflicting, conflictDirective(facts)
	case !facts.SourceCurrent:
		classification, directive = domain.RecoveryConflicting, conflictDirective(facts)
	case facts.OperationEvidence == OperationEvidenceContradictory || facts.RepositoryRelation == RepositoryForbiddenChange:
		classification, directive = domain.RecoveryConflicting, DirectiveCreateBlocker
	case facts.OperationEvidence == OperationEvidencePartial:
		classification, directive = domain.RecoveryPartiallyCompleted, DirectiveCreateBlocker
	case facts.OperationEvidence == OperationEvidenceNone && facts.RepositoryRelation == RepositoryWorktreeOnlyChanged && facts.MayHavePartialRepositoryWork:
		classification, directive = domain.RecoveryPartiallyCompleted, DirectiveCreateBlocker
	case facts.OperationEvidence == OperationEvidenceComplete:
		classification, directive = domain.RecoveryCompletedButUnrecorded, DirectiveCommitRecoveredTransition
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
		Repositories:               append([]RepositoryFact(nil), facts.Repositories...),
		LastOperationRelation:      facts.LastOperationRelation,
		OperationEvidence:          facts.OperationEvidence,
		OperationPayloadDigest:     facts.OperationPayloadDigest,
		ActionRetrySafe:            classification == domain.RecoveryNotStarted && facts.PayloadRetained,
		NextAdvice:                 adviceFor(classification, facts),
		ObservedAt:                 facts.ObservedAt,
	}
	if classification == domain.RecoveryCompletedAndRecorded {
		assessment.CommittedProof = facts.CommittedProof
	}
	if facts.ExistingBlocker != nil {
		condition := facts.ExistingBlocker.Condition
		assessment.UnblockCondition = &condition
	} else if classification == domain.RecoveryPartiallyCompleted ||
		classification == domain.RecoveryConflicting && directive == DirectiveCreateBlocker {
		assessment.UnblockCondition = &domain.BlockerCondition{Kind: domain.BlockerConditionRestoreIssuanceBinding, ExpectedBindingDigest: facts.IssuanceBindingDigest}
	}
	return RecoveryDecision{Assessment: assessment, Directive: directive}, nil
}

func (facts ClassificationFacts) validate() error {
	if facts.Operation.Validate() != nil || facts.TaskRevision == 0 || !facts.CurrentNode.IsValid() ||
		(facts.CurrentActionID != nil && !facts.CurrentActionID.IsValid()) || !facts.IssuanceBindingDigest.IsValid() ||
		!facts.AuthoritativeBindingDigest.IsValid() || !facts.ObservedBindingDigest.IsValid() ||
		!facts.RepositoryRelation.IsValid() || !facts.LastOperationRelation.IsValid() ||
		!facts.OperationEvidence.IsValid() || !validUTC(facts.ObservedAt) {
		return domain.ErrInvalidArgument
	}
	if facts.PayloadRetained != (facts.OperationPayloadDigest != nil) {
		return domain.ErrInvalidArgument
	}
	if facts.OperationPayloadDigest != nil && !facts.OperationPayloadDigest.IsValid() {
		return domain.ErrInvalidArgument
	}
	if facts.LastOperationRelation == LastOperationExact {
		if facts.CommittedProof == nil || facts.CommittedProof.Validate() != nil {
			return domain.ErrInvalidArgument
		}
	} else if facts.CommittedProof != nil {
		return domain.ErrInvalidArgument
	}
	previous := domain.RepositoryKey("")
	for _, fact := range facts.Repositories {
		if !fact.RepositoryKey.IsValid() || !fact.Relation.IsValid() || !fact.Reason.IsValid() || previous != "" && fact.RepositoryKey <= previous {
			return domain.ErrInvalidArgument
		}
		previous = fact.RepositoryKey
	}
	return nil
}

func conflictDirective(facts ClassificationFacts) MutationDirective {
	if facts.SourceCurrent && facts.CurrentNode != domain.NodeBlocked {
		return DirectiveCreateBlocker
	}
	if facts.CurrentNode == domain.NodeBlocked && facts.ExistingBlocker != nil {
		return DirectiveReturnExistingBlocker
	}
	if facts.TaskRevision != facts.Operation.ExpectedRevision {
		return DirectiveRevisionConflict
	}
	return DirectiveActionStale
}

func adviceFor(classification domain.RecoveryClassification, facts ClassificationFacts) RecoveryAdvice {
	switch classification {
	case domain.RecoveryNotStarted:
		if facts.PayloadRetained {
			return AdviceRetryCurrentAction
		}
		return AdviceReadNextAction
	case domain.RecoveryCompletedButUnrecorded, domain.RecoveryPartiallyCompleted:
		return AdviceSubmitRecoveryApply
	case domain.RecoveryConflicting:
		if facts.SourceCurrent && facts.CurrentNode != domain.NodeBlocked {
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
	if facts.CurrentNode == domain.NodeBlocked {
		return AdviceResolveBlocker
	}
	if facts.CurrentNode.Terminal() || !facts.SourceCurrent {
		return AdviceReadNextAction
	}
	return AdviceStopForRepositoryDrift
}
