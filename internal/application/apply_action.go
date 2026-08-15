package application

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"math"
	"reflect"
	"time"

	"github.com/Innocent-children/dev-flow/internal/domain"
	"github.com/Innocent-children/dev-flow/internal/recovery"
	"github.com/Innocent-children/dev-flow/internal/store"
	"github.com/Innocent-children/dev-flow/internal/workflow"
)

const (
	recoveryBlockerMessage    = "Recovery evidence conflicts with the authoritative task state."
	recoveryBlockerResolution = "Restore the repository binding issued for the blocked action, then submit its resolution."
)

type applyActionDigestPayload struct {
	Host                    domain.Host       `json:"host"`
	TaskID                  domain.ID         `json:"task_id"`
	ExpectedRevision        uint64            `json:"expected_revision"`
	ActionID                domain.ID         `json:"action_id"`
	ActionKind              domain.ActionKind `json:"action_kind"`
	RepositoryBindingDigest domain.Digest     `json:"repository_binding_digest"`
	SourcePhase             domain.Phase      `json:"source_phase"`
	Payload                 json.RawMessage   `json:"payload"`
}

// ApplyAction is the sole action mutation entry point. Presence of
// RecoveryApply selects reconciliation; ordinary actions retain exact CAS and
// repository-drift semantics.
func (s *Service) ApplyAction(ctx context.Context, request ApplyActionRequest) (ApplyActionResult, error) {
	if err := validateApplyActionRequest(s, ctx, request); err != nil {
		return ApplyActionResult{}, err
	}
	task, err := s.loadOwnedTask(ctx, request.Host, request.TaskID)
	if err != nil {
		return ApplyActionResult{}, err
	}
	if request.RecoveryApply != nil {
		return s.applyRecovery(ctx, task, request)
	}
	return s.applyNormal(ctx, task, request)
}

func (s *Service) applyNormal(
	ctx context.Context,
	task domain.Task,
	request ApplyActionRequest,
) (ApplyActionResult, error) {
	if task.Phase.Terminal() {
		return ApplyActionResult{}, domain.ErrTaskTerminal
	}
	if task.CurrentAction == nil {
		return ApplyActionResult{}, domain.ErrInternal
	}
	if task.Phase == domain.PhaseBlocked {
		validated, err := workflow.ValidatePayload(task.Phase, task.CurrentAction.Kind, request.Payload)
		if err != nil {
			return ApplyActionResult{}, domain.ErrInvalidArgument
		}
		return s.resolveBlocker(ctx, task, request, validated)
	}
	if task.Revision != request.ExpectedRevision {
		return ApplyActionResult{}, domain.ErrRevisionConflict
	}
	if !requestMatchesCurrentAction(task, request) {
		return ApplyActionResult{}, domain.ErrActionStale
	}
	validated, err := workflow.ValidatePayload(task.Phase, task.CurrentAction.Kind, request.Payload)
	if err != nil {
		return ApplyActionResult{}, domain.ErrInvalidArgument
	}
	incomingEvidence, err := validateNormalTransition(task, validated)
	if err != nil {
		return ApplyActionResult{}, err
	}
	fresh, err := s.observeVerifiedBinding(ctx, task.Repository.CanonicalRoot)
	if err != nil {
		return ApplyActionResult{}, err
	}
	relation, err := recovery.CompareRepositoryBindings(task.Repository, fresh)
	if err != nil {
		return ApplyActionResult{}, domain.ErrInternal
	}
	accepted, err := recovery.BindingAcceptedForAction(task.CurrentAction.Kind, relation)
	if err != nil {
		return ApplyActionResult{}, domain.ErrInternal
	}
	if !accepted {
		return ApplyActionResult{}, domain.ErrRepositoryDrift
	}
	payloadDigest, err := digestApplyActionPayload(request, task.Phase, validated.CanonicalBytes)
	if err != nil {
		return ApplyActionResult{}, domain.ErrInternal
	}
	return s.commitValidatedTransition(
		ctx, task, request, validated, incomingEvidence, fresh, request.RequestID, payloadDigest,
	)
}

func (s *Service) applyRecovery(
	ctx context.Context,
	task domain.Task,
	request ApplyActionRequest,
) (ApplyActionResult, error) {
	recoveryInput := request.RecoveryApply
	operation := recovery.OperationReference{
		OperationID:      recoveryInput.OperationID,
		SourcePhase:      recoveryInput.SourcePhase,
		ExpectedRevision: request.ExpectedRevision,
		ActionID:         request.ActionID,
		ActionKind:       request.ActionKind,
	}
	if operation.Validate() != nil {
		return ApplyActionResult{}, domain.ErrInvalidArgument
	}
	expectedAction, ok := workflow.ActionForPhase(operation.SourcePhase)
	if !ok || expectedAction != operation.ActionKind {
		return ApplyActionResult{}, domain.ErrInvalidArgument
	}

	canonicalPayload := []byte("null")
	var validatedPayload *workflow.ValidatedPayload
	if request.Payload != nil {
		validated, err := workflow.ValidatePayload(operation.SourcePhase, operation.ActionKind, request.Payload)
		if err != nil {
			return ApplyActionResult{}, domain.ErrInvalidArgument
		}
		canonicalPayload = validated.CanonicalBytes
		validatedPayload = &validated
	}
	payloadDigest, err := digestApplyActionPayload(request, operation.SourcePhase, canonicalPayload)
	if err != nil {
		return ApplyActionResult{}, domain.ErrInternal
	}
	fresh, err := s.observeVerifiedBinding(ctx, task.Repository.CanonicalRoot)
	if err != nil {
		return ApplyActionResult{}, err
	}
	decision, err := recovery.Reconcile(recovery.ReconcileInput{
		Task:                   task,
		Operation:              operation,
		IssuanceBindingDigest:  request.RepositoryBindingDigest,
		OperationPayloadDigest: payloadDigest,
		Payload:                validatedPayload,
		FreshBinding:           fresh,
	})
	if err != nil {
		return ApplyActionResult{}, domain.ErrInternal
	}

	switch decision.Directive {
	case recovery.DirectiveNoWrite, recovery.DirectiveReturnExistingBlocker:
		return ApplyActionResult{Task: task.Clone()}, nil
	case recovery.DirectiveRevisionConflict:
		return ApplyActionResult{}, domain.ErrRevisionConflict
	case recovery.DirectiveActionStale:
		return ApplyActionResult{}, domain.ErrActionStale
	case recovery.DirectiveCreateBlocker:
		return s.commitRecoveryBlocker(ctx, task, request, fresh, payloadDigest, decision.Assessment)
	case recovery.DirectiveNormalTransition:
		if validatedPayload == nil {
			return ApplyActionResult{}, domain.ErrInternal
		}
		if operation.SourcePhase == domain.PhaseBlocked {
			return s.commitResolvedBlocker(
				ctx, task, request, *validatedPayload, fresh, recoveryInput.OperationID, payloadDigest,
			)
		}
		incomingEvidence, err := validateNormalTransition(task, *validatedPayload)
		if err != nil {
			return ApplyActionResult{}, err
		}
		return s.commitValidatedTransition(
			ctx, task, request, *validatedPayload, incomingEvidence, fresh,
			recoveryInput.OperationID, payloadDigest,
		)
	default:
		return ApplyActionResult{}, domain.ErrInternal
	}
}

func (s *Service) resolveBlocker(
	ctx context.Context,
	task domain.Task,
	request ApplyActionRequest,
	validated workflow.ValidatedPayload,
) (ApplyActionResult, error) {
	if validated.BlockerResolution == nil || task.Blocker == nil || task.ResumePhase == nil {
		return ApplyActionResult{}, domain.ErrInternal
	}
	if task.Revision != request.ExpectedRevision {
		return ApplyActionResult{}, domain.ErrRevisionConflict
	}
	if !requestMatchesCurrentAction(task, request) {
		return ApplyActionResult{}, domain.ErrActionStale
	}
	resolution := validated.BlockerResolution
	if resolution.BlockerID != task.Blocker.BlockerID || resolution.Condition != task.Blocker.Condition {
		return ApplyActionResult{}, domain.ErrActionStale
	}
	payloadDigest, err := digestApplyActionPayload(request, task.Phase, validated.CanonicalBytes)
	if err != nil {
		return ApplyActionResult{}, domain.ErrInternal
	}
	fresh, err := s.observeVerifiedBinding(ctx, task.Repository.CanonicalRoot)
	if err != nil {
		return ApplyActionResult{}, err
	}
	if resolution.ObservedBindingDigest != fresh.BindingDigest {
		return ApplyActionResult{}, domain.ErrRepositoryDrift
	}
	decision, err := recovery.Reconcile(recovery.ReconcileInput{
		Task: task,
		Operation: recovery.OperationReference{
			OperationID: request.RequestID, SourcePhase: task.Phase,
			ExpectedRevision: request.ExpectedRevision, ActionID: request.ActionID, ActionKind: request.ActionKind,
		},
		IssuanceBindingDigest: request.RepositoryBindingDigest, OperationPayloadDigest: payloadDigest,
		Payload: &validated, FreshBinding: fresh,
	})
	if err != nil {
		return ApplyActionResult{}, domain.ErrInternal
	}
	if decision.Assessment.Classification != domain.RecoveryCompletedButUnrecorded ||
		decision.Directive != recovery.DirectiveNormalTransition {
		return ApplyActionResult{}, domain.ErrRepositoryDrift
	}
	return s.commitResolvedBlocker(ctx, task, request, validated, fresh, request.RequestID, payloadDigest)
}

func validateNormalTransition(
	task domain.Task,
	validated workflow.ValidatedPayload,
) ([]workflow.NormalizedEvidenceInput, error) {
	if validated.Delivery != nil {
		if err := workflow.ValidateDelivery(*validated.Delivery, task.Contract, task.Evidence); err != nil {
			return nil, domain.ErrInvalidArgument
		}
	}
	incomingEvidence, err := plannedActionEvidence(task.Phase, task.CurrentAction.Kind, validated)
	if err != nil {
		return nil, domain.ErrInternal
	}
	if err := workflow.EvaluateVerificationBudget(
		task.Contract.VerificationBudget(), task.Evidence, incomingEvidence, validated.ManualHandoffItems,
	); err != nil {
		return nil, err
	}
	return incomingEvidence, nil
}

func (s *Service) commitValidatedTransition(
	ctx context.Context,
	task domain.Task,
	request ApplyActionRequest,
	validated workflow.ValidatedPayload,
	incomingEvidence []workflow.NormalizedEvidenceInput,
	fresh domain.RepositoryBinding,
	operationID domain.ID,
	payloadDigest domain.Digest,
) (ApplyActionResult, error) {
	targetPhase, err := workflow.Evaluate(
		task.Phase, task.CurrentAction.Kind, validated.Result, nil, validated.Reason,
	)
	if err != nil {
		return ApplyActionResult{}, domain.ErrInternal
	}
	now := s.now().UTC()
	eventID, err := s.generateID("event")
	if err != nil {
		return ApplyActionResult{}, err
	}
	newEvidence, err := s.buildEvidenceSummaries(incomingEvidence, now)
	if err != nil {
		return ApplyActionResult{}, err
	}
	var nextActionID domain.ID
	if !targetPhase.Terminal() {
		nextActionID, err = s.generateID("action")
		if err != nil {
			return ApplyActionResult{}, err
		}
	}

	newRevision := task.Revision + 1
	actionID := request.ActionID
	operation := domain.LastOperation{
		OperationID: operationID, Kind: domain.OperationApplyAction, ActionID: &actionID,
		FromRevision: request.ExpectedRevision, ToRevision: newRevision,
		PayloadDigest: payloadDigest, CommittedAt: now,
	}
	candidate := task.Clone()
	candidate.Repository = fresh.Clone()
	candidate.Phase = targetPhase
	candidate.ResumePhase = nil
	candidate.Blocker = nil
	candidate.LastOperation = &operation
	candidate.Evidence = append(candidate.Evidence, newEvidence...)
	candidate.Outcome = nil
	candidate.Revision = newRevision
	candidate.UpdatedAt = now
	candidate.CompletedAt = nil

	claim := store.ClaimRetain
	if targetPhase == domain.PhaseDone {
		if validated.Delivery == nil {
			return ApplyActionResult{}, domain.ErrInternal
		}
		outcome := completedOutcome(*validated.Delivery, fresh.BindingDigest, validated.Summary, now)
		if outcome.Validate() != nil {
			return ApplyActionResult{}, domain.ErrInvalidArgument
		}
		candidate.CurrentAction = nil
		candidate.Outcome = &outcome
		candidate.CompletedAt = &now
		claim = store.ClaimRelease
	} else {
		nextAction, err := workflow.BuildNextAction(
			targetPhase, candidate.TaskID, newRevision, fresh.BindingDigest, nextActionID, now,
		)
		if err != nil {
			return ApplyActionResult{}, domain.ErrInternal
		}
		candidate.CurrentAction = &nextAction
	}
	if err := workflow.ValidateTask(candidate); err != nil {
		withoutIncomingEvidence := candidate.Clone()
		withoutIncomingEvidence.Evidence = append([]domain.EvidenceSummary(nil), task.Evidence...)
		if workflow.ValidateTask(withoutIncomingEvidence) == nil {
			return ApplyActionResult{}, domain.ErrVerificationBudgetExceeded
		}
		return ApplyActionResult{}, domain.ErrInternal
	}
	event := store.TaskEvent{
		EventID: eventID, TaskID: candidate.TaskID, Revision: newRevision,
		Kind: domain.OperationApplyAction, PhaseBefore: task.Phase, PhaseAfter: targetPhase,
		ActionID: &actionID, RequestID: operationID, PayloadDigest: payloadDigest, CreatedAt: now,
	}
	if err := s.taskStore.CommitTask(ctx, store.TaskMutation{
		ExpectedRevision: request.ExpectedRevision, Task: candidate, Event: event, Claim: claim,
	}); err != nil {
		return ApplyActionResult{}, mapStoreError(ctx, err)
	}
	return ApplyActionResult{Task: candidate.Clone()}, nil
}

func (s *Service) commitRecoveryBlocker(
	ctx context.Context,
	task domain.Task,
	request ApplyActionRequest,
	fresh domain.RepositoryBinding,
	payloadDigest domain.Digest,
	assessment recovery.RecoveryAssessment,
) (ApplyActionResult, error) {
	if assessment.Classification != domain.RecoveryPartiallyCompleted &&
		assessment.Classification != domain.RecoveryConflicting {
		return ApplyActionResult{}, domain.ErrInternal
	}
	if assessment.UnblockCondition == nil ||
		assessment.UnblockCondition.ExpectedBindingDigest != task.Repository.BindingDigest {
		return ApplyActionResult{}, domain.ErrInternal
	}
	blockerID, err := s.generateID("blocker")
	if err != nil {
		return ApplyActionResult{}, err
	}
	actionID, err := s.generateID("action")
	if err != nil {
		return ApplyActionResult{}, err
	}
	eventID, err := s.generateID("event")
	if err != nil {
		return ApplyActionResult{}, err
	}
	now := s.now().UTC()
	newRevision := task.Revision + 1
	resumePhase := request.RecoveryApply.SourcePhase
	blocker := domain.Blocker{
		BlockerID: blockerID, Code: domain.ErrorTaskBlocked, Cause: assessment.Classification,
		Message: recoveryBlockerMessage, ResumePhase: resumePhase,
		ObservedBindingDigest: fresh.BindingDigest, Condition: *assessment.UnblockCondition,
		RequiredResolution: recoveryBlockerResolution, CreatedAt: now,
	}
	resolveAction, err := workflow.BuildNextAction(
		domain.PhaseBlocked, task.TaskID, newRevision, task.Repository.BindingDigest, actionID, now,
	)
	if err != nil {
		return ApplyActionResult{}, domain.ErrInternal
	}
	originalActionID := request.ActionID
	operation := domain.LastOperation{
		OperationID: request.RecoveryApply.OperationID, Kind: domain.OperationApplyAction,
		ActionID: &originalActionID, FromRevision: request.ExpectedRevision, ToRevision: newRevision,
		PayloadDigest: payloadDigest, CommittedAt: now,
	}
	candidate := task.Clone()
	candidate.Phase = domain.PhaseBlocked
	candidate.ResumePhase = &resumePhase
	candidate.CurrentAction = &resolveAction
	candidate.Blocker = &blocker
	candidate.LastOperation = &operation
	candidate.Outcome = nil
	candidate.Revision = newRevision
	candidate.UpdatedAt = now
	candidate.CompletedAt = nil
	if workflow.ValidateTask(candidate) != nil {
		return ApplyActionResult{}, domain.ErrInternal
	}
	event := store.TaskEvent{
		EventID: eventID, TaskID: task.TaskID, Revision: newRevision,
		Kind: domain.OperationApplyAction, PhaseBefore: task.Phase, PhaseAfter: domain.PhaseBlocked,
		ActionID: &originalActionID, RequestID: request.RecoveryApply.OperationID,
		PayloadDigest: payloadDigest, CreatedAt: now,
	}
	if err := s.taskStore.CommitTask(ctx, store.TaskMutation{
		ExpectedRevision: request.ExpectedRevision, Task: candidate, Event: event, Claim: store.ClaimRetain,
	}); err != nil {
		return ApplyActionResult{}, mapStoreError(ctx, err)
	}
	return ApplyActionResult{Task: candidate.Clone()}, nil
}

func (s *Service) commitResolvedBlocker(
	ctx context.Context,
	task domain.Task,
	request ApplyActionRequest,
	validated workflow.ValidatedPayload,
	fresh domain.RepositoryBinding,
	operationID domain.ID,
	payloadDigest domain.Digest,
) (ApplyActionResult, error) {
	if task.Blocker == nil || task.ResumePhase == nil || validated.BlockerResolution == nil {
		return ApplyActionResult{}, domain.ErrInternal
	}
	targetPhase, err := workflow.Evaluate(
		task.Phase, task.CurrentAction.Kind, validated.Result, task.ResumePhase, validated.Reason,
	)
	if err != nil {
		return ApplyActionResult{}, domain.ErrInternal
	}
	eventID, err := s.generateID("event")
	if err != nil {
		return ApplyActionResult{}, err
	}
	now := s.now().UTC()
	newEvidence, err := s.buildEvidenceSummaries([]workflow.NormalizedEvidenceInput{{
		Source: domain.EvidenceSourceHostObserved, Name: "blocker_resolution",
		Status: domain.EvidenceObserved, Summary: validated.Summary,
	}}, now)
	if err != nil {
		return ApplyActionResult{}, err
	}
	resolutionDigest, err := digestValidatedPayload(validated.CanonicalBytes)
	if err != nil {
		return ApplyActionResult{}, domain.ErrInternal
	}
	newEvidence[0].Digest = resolutionDigest
	nextActionID, err := s.generateID("action")
	if err != nil {
		return ApplyActionResult{}, err
	}
	newRevision := task.Revision + 1
	resolveActionID := request.ActionID
	operation := domain.LastOperation{
		OperationID: operationID, Kind: domain.OperationApplyAction, ActionID: &resolveActionID,
		FromRevision: request.ExpectedRevision, ToRevision: newRevision,
		PayloadDigest: payloadDigest, CommittedAt: now,
	}
	candidate := task.Clone()
	candidate.Repository = fresh.Clone()
	candidate.Phase = targetPhase
	candidate.ResumePhase = nil
	candidate.Blocker = nil
	candidate.LastOperation = &operation
	candidate.Evidence = append(candidate.Evidence, newEvidence...)
	candidate.Outcome = nil
	candidate.Revision = newRevision
	candidate.UpdatedAt = now
	candidate.CompletedAt = nil
	nextAction, err := workflow.BuildNextAction(
		targetPhase, candidate.TaskID, newRevision, fresh.BindingDigest, nextActionID, now,
	)
	if err != nil {
		return ApplyActionResult{}, domain.ErrInternal
	}
	candidate.CurrentAction = &nextAction
	if workflow.ValidateTask(candidate) != nil {
		return ApplyActionResult{}, domain.ErrInternal
	}
	event := store.TaskEvent{
		EventID: eventID, TaskID: task.TaskID, Revision: newRevision,
		Kind: domain.OperationApplyAction, PhaseBefore: domain.PhaseBlocked, PhaseAfter: targetPhase,
		ActionID: &resolveActionID, RequestID: operationID, PayloadDigest: payloadDigest, CreatedAt: now,
	}
	if err := s.taskStore.CommitTask(ctx, store.TaskMutation{
		ExpectedRevision: request.ExpectedRevision, Task: candidate, Event: event, Claim: store.ClaimRetain,
	}); err != nil {
		return ApplyActionResult{}, mapStoreError(ctx, err)
	}
	return ApplyActionResult{Task: candidate.Clone()}, nil
}

func (s *Service) observeVerifiedBinding(
	ctx context.Context,
	repositoryPath string,
) (domain.RepositoryBinding, error) {
	fresh, err := s.repositoryObserver.Observe(ctx, repositoryPath)
	if err != nil {
		return domain.RepositoryBinding{}, mapRepositoryError(ctx, err)
	}
	if err := validateFreshBinding(fresh); err != nil {
		return domain.RepositoryBinding{}, err
	}
	return fresh, nil
}

func requestMatchesCurrentAction(task domain.Task, request ApplyActionRequest) bool {
	return task.CurrentAction != nil && request.ActionID == task.CurrentAction.ActionID &&
		request.ActionKind == task.CurrentAction.Kind &&
		request.RepositoryBindingDigest == task.CurrentAction.RepositoryBindingDigest
}

func validateApplyActionRequest(s *Service, ctx context.Context, request ApplyActionRequest) error {
	if s == nil || !s.valid() || ctx == nil || !request.RequestID.IsValid() ||
		!request.Host.IsValid() || !request.TaskID.IsValid() || request.ExpectedRevision == 0 ||
		request.ExpectedRevision == math.MaxUint64 || !request.ActionID.IsValid() ||
		!request.ActionKind.IsValid() || !request.RepositoryBindingDigest.IsValid() {
		return domain.ErrInvalidArgument
	}
	if request.RecoveryApply == nil {
		if nilActionPayload(request.Payload) {
			return domain.ErrInvalidArgument
		}
		return nil
	}
	if !request.RecoveryApply.OperationID.IsValid() ||
		(!request.RecoveryApply.SourcePhase.NormalNonTerminal() && request.RecoveryApply.SourcePhase != domain.PhaseBlocked) ||
		(request.Payload != nil && nilActionPayload(request.Payload)) {
		return domain.ErrInvalidArgument
	}
	return nil
}

func nilActionPayload(payload workflow.ActionPayload) bool {
	if payload == nil {
		return true
	}
	value := reflect.ValueOf(payload)
	return value.Kind() == reflect.Pointer && value.IsNil()
}

func plannedActionEvidence(
	phase domain.Phase,
	action domain.ActionKind,
	payload workflow.ValidatedPayload,
) ([]workflow.NormalizedEvidenceInput, error) {
	name, ok := actionSummaryEvidenceName(phase, action)
	if !ok {
		return nil, domain.ErrInternal
	}
	result := make([]workflow.NormalizedEvidenceInput, 0, 2+len(payload.Checks))
	result = append(result, workflow.NormalizedEvidenceInput{
		Source: domain.EvidenceSourceHostObserved, Name: name,
		Status: domain.EvidenceObserved, Summary: payload.Summary,
	})
	if payload.Reason != "" {
		result = append(result, workflow.NormalizedEvidenceInput{
			Source: domain.EvidenceSourceHostObserved, Name: "transition_reason",
			Status: domain.EvidenceObserved, Summary: payload.Reason,
		})
	}
	result = append(result, payload.Checks...)
	if len(result) > domain.MaxEvidencePerAction {
		return nil, domain.ErrInvalidArgument
	}
	return result, nil
}

func actionSummaryEvidenceName(phase domain.Phase, action domain.ActionKind) (string, bool) {
	switch {
	case phase == domain.PhaseIntake && action == domain.ActionAssessTask:
		return "assessment_summary", true
	case phase == domain.PhaseAssess && action == domain.ActionPlanChange:
		return "implementation_plan", true
	case phase == domain.PhasePlan && action == domain.ActionImplementChange:
		return "implementation_summary", true
	case phase == domain.PhaseImplement && action == domain.ActionVerifyChange:
		return "verification_summary", true
	case phase == domain.PhaseVerify && action == domain.ActionReviewChange:
		return "review_summary", true
	case phase == domain.PhaseReview && action == domain.ActionPrepareHandoff:
		return "handoff_preparation", true
	case phase == domain.PhaseHandoff && action == domain.ActionPrepareHandoff:
		return "delivery_summary", true
	default:
		return "", false
	}
}

func (s *Service) buildEvidenceSummaries(
	inputs []workflow.NormalizedEvidenceInput,
	recordedAt time.Time,
) ([]domain.EvidenceSummary, error) {
	result := make([]domain.EvidenceSummary, len(inputs))
	for i, input := range inputs {
		evidenceID, err := s.generateID("evidence")
		if err != nil {
			return nil, err
		}
		digest, err := digestCanonical(input)
		if err != nil {
			return nil, domain.ErrInternal
		}
		result[i] = domain.EvidenceSummary{
			EvidenceID: evidenceID, Source: input.Source, Name: input.Name,
			Status: input.Status, Summary: input.Summary, Digest: digest,
			CommandCount: input.CommandCount, FullSuite: input.FullSuite, RecordedAt: recordedAt,
		}
	}
	return result, nil
}

func digestApplyActionPayload(
	request ApplyActionRequest,
	sourcePhase domain.Phase,
	canonicalPayload []byte,
) (domain.Digest, error) {
	return digestCanonical(applyActionDigestPayload{
		Host: request.Host, TaskID: request.TaskID, ExpectedRevision: request.ExpectedRevision,
		ActionID: request.ActionID, ActionKind: request.ActionKind,
		RepositoryBindingDigest: request.RepositoryBindingDigest, SourcePhase: sourcePhase,
		Payload: append(json.RawMessage(nil), canonicalPayload...),
	})
}

func digestValidatedPayload(canonicalPayload []byte) (domain.Digest, error) {
	if len(canonicalPayload) == 0 {
		return "", domain.ErrInternal
	}
	digest := sha256.Sum256(canonicalPayload)
	return domain.Digest(hex.EncodeToString(digest[:])), nil
}

func completedOutcome(
	delivery workflow.DeliveryData,
	bindingDigest domain.Digest,
	summary string,
	completedAt time.Time,
) domain.Outcome {
	return domain.Outcome{
		Status:                       domain.TerminalCompleted,
		Acceptance:                   append([]domain.OutcomeCriterion(nil), delivery.Acceptance...),
		AutomatedEvidenceIDs:         append([]domain.ID(nil), delivery.AutomatedEvidenceIDs...),
		ManualEvidenceIDs:            append([]domain.ID(nil), delivery.ManualEvidenceIDs...),
		UnverifiedItems:              append([]string(nil), delivery.UnverifiedItems...),
		Risks:                        append([]string(nil), delivery.Risks...),
		FinalRepositoryBindingDigest: bindingDigest, Summary: summary, CompletedAt: completedAt,
	}
}
