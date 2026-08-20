package recovery

import (
	"encoding/json"
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

type RepositoryEffectKind string

const (
	EffectExactBinding            RepositoryEffectKind = "exact_binding"
	EffectProcessArtifactOnly     RepositoryEffectKind = "process_artifact_only"
	EffectProductFileChange       RepositoryEffectKind = "product_file_change"
	EffectExactBlockerRestoration RepositoryEffectKind = "exact_blocker_restoration"
)

type RepositoryEffect struct {
	Kind          RepositoryEffectKind
	ChangedPaths  []string
	NoFileChanges bool
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
		p.FromRevision == 0 || p.ToRevision != p.FromRevision+1 || !p.PayloadDigest.IsValid() || !validUTC(p.CommittedAt) {
		return domain.ErrInvalidArgument
	}
	return nil
}

type RecoveryAssessment struct {
	Classification             domain.RecoveryClassification `json:"classification"`
	Operation                  domain.OperationReference     `json:"operation"`
	TaskRevision               uint64                        `json:"task_revision"`
	CurrentActionID            *domain.ID                    `json:"current_action_id"`
	IssuanceBindingDigest      domain.Digest                 `json:"issuance_binding_digest"`
	AuthoritativeBindingDigest domain.Digest                 `json:"authoritative_binding_digest"`
	ObservedBindingDigest      domain.Digest                 `json:"observed_binding_digest"`
	RepositoryRelation         RepositoryRelation            `json:"repository_relation"`
	LastOperationRelation      LastOperationRelation         `json:"last_operation_relation"`
	OperationEvidence          OperationEvidenceState        `json:"operation_evidence"`
	OperationPayloadDigest     *domain.Digest                `json:"operation_payload_digest"`
	CommittedProof             *CommittedOperationProof      `json:"committed_proof"`
	ActionRetrySafe            bool                          `json:"action_retry_safe"`
	NextAdvice                 RecoveryAdvice                `json:"next_advice"`
	UnblockCondition           *domain.BlockerCondition      `json:"unblock_condition"`
	ObservedAt                 time.Time                     `json:"observed_at"`
}

type MutationDirective string

const (
	DirectiveNoWrite                   MutationDirective = "no_write"
	DirectiveCommitRecoveredTransition MutationDirective = "commit_recovered_transition"
	DirectiveCreateBlocker             MutationDirective = "create_blocker"
	DirectiveReturnExistingBlocker     MutationDirective = "return_existing_blocker"
	DirectiveRevisionConflict          MutationDirective = "revision_conflict"
	DirectiveActionStale               MutationDirective = "action_stale"
)

type ReconcileInput struct {
	Host      domain.Host
	Task      domain.ProcessTask
	Operation domain.OperationReference
	Payload   json.RawMessage
	Observed  domain.RepositoryBinding
}

type RecoveryDecision struct {
	Assessment       RecoveryAssessment
	Directive        MutationDirective
	CanonicalPayload json.RawMessage
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
