package recovery

import (
	"time"

	"github.com/Innocent-children/dev-flow/internal/domain"
)

type RepositoryRelation string

const (
	RepositoryExact               RepositoryRelation = "exact"
	RepositoryWorktreeOnlyChanged RepositoryRelation = "worktree_only_changed"
	RepositoryForbiddenChange     RepositoryRelation = "forbidden_change"
)

func (r RepositoryRelation) IsValid() bool {
	return r == RepositoryExact || r == RepositoryWorktreeOnlyChanged || r == RepositoryForbiddenChange
}

type LastOperationRelation string

const (
	LastOperationExact         LastOperationRelation = "exact"
	LastOperationUnrelated     LastOperationRelation = "unrelated"
	LastOperationContradictory LastOperationRelation = "contradictory"
)

func (r LastOperationRelation) IsValid() bool {
	return r == LastOperationExact || r == LastOperationUnrelated || r == LastOperationContradictory
}

type OperationEvidenceState string

const (
	OperationEvidenceNone          OperationEvidenceState = "none"
	OperationEvidenceComplete      OperationEvidenceState = "complete"
	OperationEvidenceContradictory OperationEvidenceState = "contradictory"
)

func (s OperationEvidenceState) IsValid() bool {
	return s == OperationEvidenceNone || s == OperationEvidenceComplete || s == OperationEvidenceContradictory
}

type RecoveryAdvice string

const (
	AdviceRetryCurrentAction     RecoveryAdvice = "retry_current_action"
	AdviceSubmitRecoveryApply    RecoveryAdvice = "submit_recovery_apply"
	AdviceReadNextAction         RecoveryAdvice = "read_next_action"
	AdviceResolveBlocker         RecoveryAdvice = "resolve_blocker"
	AdviceStopForRepositoryDrift RecoveryAdvice = "stop_for_repository_drift"
)

func (a RecoveryAdvice) IsValid() bool {
	switch a {
	case AdviceRetryCurrentAction, AdviceSubmitRecoveryApply, AdviceReadNextAction,
		AdviceResolveBlocker, AdviceStopForRepositoryDrift:
		return true
	default:
		return false
	}
}

type OperationReference struct {
	OperationID      domain.ID         `json:"operation_id"`
	SourcePhase      domain.Phase      `json:"source_phase"`
	ExpectedRevision uint64            `json:"expected_revision"`
	ActionID         domain.ID         `json:"action_id"`
	ActionKind       domain.ActionKind `json:"action_kind"`
}

func (o OperationReference) Validate() error {
	if !o.OperationID.IsValid() || (!o.SourcePhase.NormalNonTerminal() && o.SourcePhase != domain.PhaseBlocked) ||
		o.ExpectedRevision == 0 || !o.ActionID.IsValid() || !o.ActionKind.IsValid() {
		return domain.ErrInvalidArgument
	}
	return nil
}

type CommittedOperationProof struct {
	OperationID   domain.ID            `json:"operation_id"`
	Kind          domain.OperationKind `json:"kind"`
	ActionID      domain.ID            `json:"action_id"`
	FromRevision  uint64               `json:"from_revision"`
	ToRevision    uint64               `json:"to_revision"`
	PayloadDigest domain.Digest        `json:"payload_digest"`
	CommittedAt   time.Time            `json:"committed_at"`
}

func (p CommittedOperationProof) Validate() error {
	if !p.OperationID.IsValid() || p.Kind != domain.OperationApplyAction || !p.ActionID.IsValid() ||
		p.FromRevision == 0 || p.ToRevision != p.FromRevision+1 || !p.PayloadDigest.IsValid() ||
		!validUTC(p.CommittedAt) {
		return domain.ErrInvalidArgument
	}
	return nil
}

type RecoveryAssessment struct {
	Classification             domain.RecoveryClassification `json:"classification"`
	Operation                  OperationReference            `json:"operation"`
	TaskRevision               uint64                        `json:"task_revision"`
	CurrentActionID            *domain.ID                    `json:"current_action_id"`
	IssuanceBindingDigest      domain.Digest                 `json:"issuance_binding_digest"`
	AuthoritativeBindingDigest domain.Digest                 `json:"authoritative_binding_digest"`
	ObservedBindingDigest      domain.Digest                 `json:"observed_binding_digest"`
	RepositoryRelation         RepositoryRelation            `json:"repository_relation"`
	LastOperationRelation      LastOperationRelation         `json:"last_operation_relation"`
	OperationEvidence          OperationEvidenceState        `json:"operation_evidence"`
	OperationPayloadDigest     domain.Digest                 `json:"operation_payload_digest"`
	CommittedProof             *CommittedOperationProof      `json:"committed_proof"`
	ActionRetrySafe            bool                          `json:"action_retry_safe"`
	NextAdvice                 RecoveryAdvice                `json:"next_advice"`
	UnblockCondition           *domain.BlockerCondition      `json:"unblock_condition"`
	ObservedAt                 time.Time                     `json:"observed_at"`
}

func (a RecoveryAssessment) Validate() error {
	if !a.Classification.IsValid() || a.Operation.Validate() != nil || a.TaskRevision == 0 ||
		(a.CurrentActionID != nil && !a.CurrentActionID.IsValid()) || !a.IssuanceBindingDigest.IsValid() ||
		!a.AuthoritativeBindingDigest.IsValid() || !a.ObservedBindingDigest.IsValid() ||
		!a.RepositoryRelation.IsValid() || !a.LastOperationRelation.IsValid() ||
		!a.OperationEvidence.IsValid() || !a.OperationPayloadDigest.IsValid() ||
		!a.NextAdvice.IsValid() || !validUTC(a.ObservedAt) {
		return domain.ErrInvalidArgument
	}
	if a.UnblockCondition != nil && a.UnblockCondition.Validate() != nil {
		return domain.ErrInvalidArgument
	}
	if a.UnblockCondition != nil &&
		a.UnblockCondition.ExpectedBindingDigest != a.AuthoritativeBindingDigest {
		return domain.ErrInvalidArgument
	}
	if (a.RepositoryRelation == RepositoryExact) !=
		(a.AuthoritativeBindingDigest == a.ObservedBindingDigest) {
		return domain.ErrInvalidArgument
	}
	if (a.LastOperationRelation == LastOperationExact) !=
		(a.Classification == domain.RecoveryCompletedAndRecorded) ||
		(a.LastOperationRelation == LastOperationContradictory &&
			a.Classification != domain.RecoveryConflicting) {
		return domain.ErrInvalidArgument
	}
	if a.Classification == domain.RecoveryCompletedAndRecorded {
		if a.LastOperationRelation != LastOperationExact || a.CommittedProof == nil ||
			!proofMatchesAssessment(*a.CommittedProof, a) || a.ActionRetrySafe {
			return domain.ErrInvalidArgument
		}
	} else if a.CommittedProof != nil {
		return domain.ErrInvalidArgument
	}
	if a.Classification == domain.RecoveryNotStarted {
		if !a.ActionRetrySafe || a.NextAdvice != AdviceRetryCurrentAction ||
			a.LastOperationRelation != LastOperationUnrelated || a.OperationEvidence != OperationEvidenceNone ||
			a.RepositoryRelation != RepositoryExact || !assessmentProjectsCurrentSource(a) {
			return domain.ErrInvalidArgument
		}
	} else if a.ActionRetrySafe {
		return domain.ErrInvalidArgument
	}
	if a.Classification == domain.RecoveryCompletedButUnrecorded &&
		(a.OperationEvidence != OperationEvidenceComplete || a.NextAdvice != AdviceSubmitRecoveryApply ||
			a.LastOperationRelation != LastOperationUnrelated || !assessmentProjectsCurrentSource(a) ||
			!operationAllowsRelation(a.Operation.ActionKind, a.RepositoryRelation)) {
		return domain.ErrInvalidArgument
	}
	if a.Classification == domain.RecoveryPartiallyCompleted &&
		(a.Operation.ActionKind != domain.ActionImplementChange ||
			a.RepositoryRelation != RepositoryWorktreeOnlyChanged ||
			a.OperationEvidence != OperationEvidenceNone || a.NextAdvice != AdviceSubmitRecoveryApply ||
			a.LastOperationRelation != LastOperationUnrelated || !assessmentProjectsCurrentSource(a) ||
			a.UnblockCondition == nil) {
		return domain.ErrInvalidArgument
	}
	if a.Classification == domain.RecoveryConflicting && a.NextAdvice == AdviceRetryCurrentAction {
		return domain.ErrInvalidArgument
	}
	return nil
}

func assessmentProjectsCurrentSource(assessment RecoveryAssessment) bool {
	return assessment.TaskRevision == assessment.Operation.ExpectedRevision &&
		assessment.CurrentActionID != nil && *assessment.CurrentActionID == assessment.Operation.ActionID &&
		assessment.AuthoritativeBindingDigest == assessment.IssuanceBindingDigest
}

func proofMatchesAssessment(proof CommittedOperationProof, assessment RecoveryAssessment) bool {
	return proof.Validate() == nil && proof.OperationID == assessment.Operation.OperationID &&
		proof.ActionID == assessment.Operation.ActionID &&
		proof.FromRevision == assessment.Operation.ExpectedRevision &&
		proof.ToRevision == assessment.Operation.ExpectedRevision+1 &&
		proof.ToRevision == assessment.TaskRevision &&
		proof.PayloadDigest == assessment.OperationPayloadDigest
}

func validUTC(value time.Time) bool {
	if value.IsZero() {
		return false
	}
	_, offset := value.Zone()
	return offset == 0
}

func cloneID(value *domain.ID) *domain.ID {
	if value == nil {
		return nil
	}
	copy := *value
	return &copy
}

func cloneProof(value *CommittedOperationProof) *CommittedOperationProof {
	if value == nil {
		return nil
	}
	copy := *value
	return &copy
}

func cloneCondition(value *domain.BlockerCondition) *domain.BlockerCondition {
	if value == nil {
		return nil
	}
	copy := *value
	return &copy
}
