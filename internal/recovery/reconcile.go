package recovery

import (
	"github.com/Innocent-children/dev-flow/internal/domain"
	"github.com/Innocent-children/dev-flow/internal/workflow"
)

// CompareRepositoryBindings compares already-verified structured bindings.
// ObservedAt is freshness metadata and never participates in the relation.
func CompareRepositoryBindings(
	authoritative domain.RepositoryBinding,
	fresh domain.RepositoryBinding,
) (RepositoryRelation, error) {
	if authoritative.Validate() != nil || fresh.Validate() != nil {
		return "", domain.ErrInvalidArgument
	}
	identityExact := authoritative.CanonicalRoot == fresh.CanonicalRoot &&
		authoritative.GitCommonDirDigest == fresh.GitCommonDirDigest &&
		authoritative.RepositoryIdentity == fresh.RepositoryIdentity &&
		sameOptionalText(authoritative.Branch, fresh.Branch) &&
		authoritative.Detached == fresh.Detached &&
		sameOptionalText(authoritative.Head, fresh.Head) &&
		authoritative.Unborn == fresh.Unborn
	worktreeExact := authoritative.WorktreeFingerprint == fresh.WorktreeFingerprint
	bindingExact := authoritative.BindingDigest == fresh.BindingDigest
	switch {
	case identityExact && worktreeExact && bindingExact:
		return RepositoryExact, nil
	case identityExact && !worktreeExact && !bindingExact:
		return RepositoryWorktreeOnlyChanged, nil
	default:
		return RepositoryForbiddenChange, nil
	}
}

// BindingAcceptedForAction is the sole action-specific binding acceptance
// rule used by normal apply, recovery, and blocker resolution.
func BindingAcceptedForAction(
	action domain.ActionKind,
	relation RepositoryRelation,
) (bool, error) {
	if !action.IsValid() || !relation.IsValid() {
		return false, domain.ErrInvalidArgument
	}
	return operationAllowsRelation(action, relation), nil
}

func DeriveRestoreIssuanceCondition(
	issuance domain.RepositoryBinding,
) (domain.BlockerCondition, error) {
	if issuance.Validate() != nil {
		return domain.BlockerCondition{}, domain.ErrInvalidArgument
	}
	condition := domain.BlockerCondition{
		Kind:                  domain.BlockerConditionRestoreIssuanceBinding,
		ExpectedBindingDigest: issuance.BindingDigest,
	}
	if condition.Validate() != nil {
		return domain.BlockerCondition{}, domain.ErrInvalidArgument
	}
	return condition, nil
}

func RestoreIssuanceBindingSatisfied(
	condition domain.BlockerCondition,
	issuance domain.RepositoryBinding,
	fresh domain.RepositoryBinding,
) (bool, error) {
	if condition.Validate() != nil || issuance.Validate() != nil || fresh.Validate() != nil {
		return false, domain.ErrInvalidArgument
	}
	if condition.Kind != domain.BlockerConditionRestoreIssuanceBinding ||
		condition.ExpectedBindingDigest != issuance.BindingDigest {
		return false, nil
	}
	relation, err := CompareRepositoryBindings(issuance, fresh)
	if err != nil {
		return false, err
	}
	return relation == RepositoryExact, nil
}

// ReconcileInput contains only Core-derived operation/payload facts and
// already-verified repository bindings. Reconcile performs no I/O.
type ReconcileInput struct {
	Task                   domain.Task
	Operation              OperationReference
	IssuanceBindingDigest  domain.Digest
	OperationPayloadDigest domain.Digest
	Payload                *workflow.ValidatedPayload
	FreshBinding           domain.RepositoryBinding
}

// Reconcile derives all relations and invokes the sole ordered classifier.
// Application coordinates observation and persistence but does not repeat any
// relation or five-class rule.
func Reconcile(input ReconcileInput) (RecoveryDecision, error) {
	if workflow.ValidateTask(input.Task) != nil || input.Operation.Validate() != nil ||
		!input.IssuanceBindingDigest.IsValid() || !input.OperationPayloadDigest.IsValid() ||
		input.FreshBinding.Validate() != nil {
		return RecoveryDecision{}, domain.ErrInvalidArgument
	}
	expectedAction, ok := workflow.ActionForPhase(input.Operation.SourcePhase)
	if !ok || expectedAction != input.Operation.ActionKind {
		return RecoveryDecision{}, domain.ErrInvalidArgument
	}
	if input.Payload != nil && (!input.Payload.RepositoryEffect.IsValid() ||
		len(input.Payload.CanonicalBytes) == 0) {
		return RecoveryDecision{}, domain.ErrInvalidArgument
	}

	repositoryRelation, err := CompareRepositoryBindings(input.Task.Repository, input.FreshBinding)
	if err != nil {
		return RecoveryDecision{}, err
	}
	lastRelation, proof := reconcileLastOperation(input)
	sourceCurrent := sourceIsCurrent(input.Task, input.Operation, input.IssuanceBindingDigest)
	evidence := reconcileOperationEvidence(input.Payload, repositoryRelation, input.Task, input.FreshBinding)

	currentActionID := currentActionID(input.Task)
	currentActionAccepts := true
	if input.Task.CurrentAction != nil {
		currentActionAccepts, err = BindingAcceptedForAction(input.Task.CurrentAction.Kind, repositoryRelation)
		if err != nil {
			return RecoveryDecision{}, err
		}
	}
	proposedCondition := domain.BlockerCondition{
		Kind:                  domain.BlockerConditionRestoreIssuanceBinding,
		ExpectedBindingDigest: input.IssuanceBindingDigest,
	}

	var existingCondition *domain.BlockerCondition
	if input.Task.Blocker != nil {
		condition := input.Task.Blocker.Condition
		existingCondition = &condition
	}
	return Classify(ClassificationFacts{
		Operation:                    input.Operation,
		TaskRevision:                 input.Task.Revision,
		CurrentTaskPhase:             input.Task.Phase,
		CurrentActionID:              currentActionID,
		IssuanceBindingDigest:        input.IssuanceBindingDigest,
		AuthoritativeBindingDigest:   input.Task.Repository.BindingDigest,
		ObservedBindingDigest:        input.FreshBinding.BindingDigest,
		RepositoryRelation:           repositoryRelation,
		LastOperationRelation:        lastRelation,
		OperationEvidence:            evidence,
		OperationPayloadDigest:       input.OperationPayloadDigest,
		CommittedProof:               proof,
		SourceCurrent:                sourceCurrent,
		CurrentActionAcceptsObserved: currentActionAccepts,
		ProposedUnblockCondition:     &proposedCondition,
		ExistingUnblockCondition:     existingCondition,
		ObservedAt:                   input.FreshBinding.ObservedAt,
	})
}

func reconcileLastOperation(input ReconcileInput) (LastOperationRelation, *CommittedOperationProof) {
	operation := input.Task.LastOperation
	if operation == nil {
		return LastOperationUnrelated, nil
	}
	actionMatches := operation.ActionID != nil && *operation.ActionID == input.Operation.ActionID
	identityMatches := operation.OperationID == input.Operation.OperationID || actionMatches
	exact := operation.Kind == domain.OperationApplyAction &&
		operation.OperationID == input.Operation.OperationID && actionMatches &&
		operation.FromRevision == input.Operation.ExpectedRevision &&
		operation.ToRevision == input.Operation.ExpectedRevision+1 &&
		operation.ToRevision == input.Task.Revision &&
		operation.PayloadDigest == input.OperationPayloadDigest && validUTC(operation.CommittedAt)
	if exact {
		return LastOperationExact, &CommittedOperationProof{
			OperationID:   operation.OperationID,
			Kind:          operation.Kind,
			ActionID:      *operation.ActionID,
			FromRevision:  operation.FromRevision,
			ToRevision:    operation.ToRevision,
			PayloadDigest: operation.PayloadDigest,
			CommittedAt:   operation.CommittedAt,
		}
	}
	if identityMatches {
		return LastOperationContradictory, nil
	}
	return LastOperationUnrelated, nil
}

func sourceIsCurrent(task domain.Task, operation OperationReference, issuance domain.Digest) bool {
	return task.Revision == operation.ExpectedRevision && task.Phase == operation.SourcePhase &&
		task.CurrentAction != nil && task.CurrentAction.ActionID == operation.ActionID &&
		task.CurrentAction.Kind == operation.ActionKind && task.CurrentAction.Revision == task.Revision &&
		task.CurrentAction.RepositoryBindingDigest == issuance && task.Repository.BindingDigest == issuance
}

func reconcileOperationEvidence(
	payload *workflow.ValidatedPayload,
	relation RepositoryRelation,
	task domain.Task,
	fresh domain.RepositoryBinding,
) OperationEvidenceState {
	if payload == nil {
		return OperationEvidenceNone
	}
	matches := false
	switch payload.RepositoryEffect {
	case workflow.RepositoryEffectExactBinding:
		matches = relation == RepositoryExact
	case workflow.RepositoryEffectExactBlockerRestoration:
		if task.Phase != domain.PhaseBlocked || task.Blocker == nil || payload.BlockerResolution == nil {
			return OperationEvidenceContradictory
		}
		resolution := payload.BlockerResolution
		satisfied, err := RestoreIssuanceBindingSatisfied(resolution.Condition, task.Repository, fresh)
		matches = err == nil && satisfied && resolution.BlockerID == task.Blocker.BlockerID &&
			resolution.Condition == task.Blocker.Condition &&
			resolution.ObservedBindingDigest == fresh.BindingDigest
	case workflow.RepositoryEffectWorktreeOnlyChange:
		matches = relation == RepositoryWorktreeOnlyChanged
	}
	if matches {
		return OperationEvidenceComplete
	}
	return OperationEvidenceContradictory
}

func currentActionID(task domain.Task) *domain.ID {
	if task.CurrentAction == nil {
		return nil
	}
	id := task.CurrentAction.ActionID
	return &id
}

func sameOptionalText(left, right *string) bool {
	if left == nil || right == nil {
		return left == nil && right == nil
	}
	return *left == *right
}
