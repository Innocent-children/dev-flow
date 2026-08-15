package application

import (
	"context"
	"encoding/json"
	"math"
	"reflect"
	"time"

	"github.com/Innocent-children/dev-flow/internal/domain"
	"github.com/Innocent-children/dev-flow/internal/store"
	"github.com/Innocent-children/dev-flow/internal/workflow"
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

// ApplyAction validates and commits exactly the currently persisted action.
// Repository observation is read-only and occurs only after identity, payload,
// and verification-budget checks have passed.
func (s *Service) ApplyAction(
	ctx context.Context,
	request ApplyActionRequest,
) (ApplyActionResult, error) {
	if err := validateApplyActionRequest(s, ctx, request); err != nil {
		return ApplyActionResult{}, err
	}

	task, err := s.taskStore.LoadTask(ctx, request.TaskID)
	if err != nil {
		return ApplyActionResult{}, mapStoreError(ctx, err)
	}
	if task.TaskID != request.TaskID {
		return ApplyActionResult{}, domain.ErrInternal
	}
	if task.OriginHost != request.Host {
		return ApplyActionResult{}, domain.ErrHostOwnershipConflict
	}
	if task.Phase.Terminal() {
		return ApplyActionResult{}, domain.ErrTaskTerminal
	}
	if task.Phase == domain.PhaseBlocked {
		return ApplyActionResult{}, domain.ErrTaskBlocked
	}
	if task.Revision != request.ExpectedRevision {
		return ApplyActionResult{}, domain.ErrRevisionConflict
	}
	if task.CurrentAction == nil || task.CurrentAction.TaskID != task.TaskID ||
		task.CurrentAction.Revision != task.Revision ||
		task.CurrentAction.RepositoryBindingDigest != task.Repository.BindingDigest ||
		workflow.ValidateTask(task) != nil {
		return ApplyActionResult{}, domain.ErrInternal
	}
	currentAction := *task.CurrentAction
	if request.ActionID != currentAction.ActionID || request.ActionKind != currentAction.Kind ||
		request.RepositoryBindingDigest != currentAction.RepositoryBindingDigest {
		return ApplyActionResult{}, domain.ErrActionStale
	}

	validated, err := workflow.ValidatePayload(task.Phase, currentAction.Kind, request.Payload)
	if err != nil {
		return ApplyActionResult{}, domain.ErrInvalidArgument
	}
	if validated.Delivery != nil {
		if err := workflow.ValidateDelivery(*validated.Delivery, task.Contract, task.Evidence); err != nil {
			return ApplyActionResult{}, domain.ErrInvalidArgument
		}
	}
	incomingEvidence, err := plannedActionEvidence(task.Phase, currentAction.Kind, validated)
	if err != nil {
		return ApplyActionResult{}, domain.ErrInternal
	}
	if err := workflow.EvaluateVerificationBudget(
		task.Contract.VerificationBudget(),
		task.Evidence,
		incomingEvidence,
		validated.ManualHandoffItems,
	); err != nil {
		return ApplyActionResult{}, err
	}

	freshBinding, err := s.repositoryObserver.Observe(ctx, task.Repository.CanonicalRoot)
	if err != nil {
		return ApplyActionResult{}, mapRepositoryError(ctx, err)
	}
	if freshBinding.Validate() != nil {
		return ApplyActionResult{}, domain.ErrInternal
	}
	if !acceptsFreshBinding(currentAction.Kind, task.Repository, freshBinding) {
		return ApplyActionResult{}, domain.ErrRepositoryDrift
	}

	targetPhase, err := workflow.Evaluate(
		task.Phase,
		currentAction.Kind,
		validated.Result,
		nil,
		validated.Reason,
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
	payloadDigest, err := digestApplyActionPayload(request, task.Phase, validated.CanonicalBytes)
	if err != nil {
		return ApplyActionResult{}, domain.ErrInternal
	}

	newRevision := task.Revision + 1
	actionID := request.ActionID
	operation := domain.LastOperation{
		OperationID:   request.RequestID,
		Kind:          domain.OperationApplyAction,
		ActionID:      &actionID,
		FromRevision:  request.ExpectedRevision,
		ToRevision:    newRevision,
		PayloadDigest: payloadDigest,
		CommittedAt:   now,
	}
	candidate := task.Clone()
	candidate.Repository = freshBinding.Clone()
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
		outcome := completedOutcome(*validated.Delivery, freshBinding.BindingDigest, validated.Summary, now)
		if outcome.Validate() != nil {
			return ApplyActionResult{}, domain.ErrInvalidArgument
		}
		candidate.CurrentAction = nil
		candidate.Outcome = &outcome
		candidate.CompletedAt = &now
		claim = store.ClaimRelease
	} else {
		nextAction, err := workflow.BuildNextAction(
			targetPhase,
			candidate.TaskID,
			newRevision,
			freshBinding.BindingDigest,
			nextActionID,
			now,
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
		EventID:       eventID,
		TaskID:        candidate.TaskID,
		Revision:      newRevision,
		Kind:          domain.OperationApplyAction,
		PhaseBefore:   task.Phase,
		PhaseAfter:    targetPhase,
		ActionID:      &actionID,
		RequestID:     request.RequestID,
		PayloadDigest: payloadDigest,
		CreatedAt:     now,
	}
	mutation := store.TaskMutation{
		ExpectedRevision: request.ExpectedRevision,
		Task:             candidate,
		Event:            event,
		Claim:            claim,
	}
	if err := s.taskStore.CommitTask(ctx, mutation); err != nil {
		return ApplyActionResult{}, mapStoreError(ctx, err)
	}
	return ApplyActionResult{Task: candidate.Clone()}, nil
}

func validateApplyActionRequest(s *Service, ctx context.Context, request ApplyActionRequest) error {
	if s == nil || !s.valid() || ctx == nil || !request.RequestID.IsValid() ||
		!request.Host.IsValid() || !request.TaskID.IsValid() || request.ExpectedRevision == 0 ||
		request.ExpectedRevision == math.MaxUint64 || !request.ActionID.IsValid() ||
		!request.ActionKind.IsValid() || !request.RepositoryBindingDigest.IsValid() ||
		nilActionPayload(request.Payload) {
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
		Source:  domain.EvidenceSourceHostObserved,
		Name:    name,
		Status:  domain.EvidenceObserved,
		Summary: payload.Summary,
	})
	if payload.Reason != "" {
		result = append(result, workflow.NormalizedEvidenceInput{
			Source:  domain.EvidenceSourceHostObserved,
			Name:    "transition_reason",
			Status:  domain.EvidenceObserved,
			Summary: payload.Reason,
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
			EvidenceID:   evidenceID,
			Source:       input.Source,
			Name:         input.Name,
			Status:       input.Status,
			Summary:      input.Summary,
			Digest:       digest,
			CommandCount: input.CommandCount,
			FullSuite:    input.FullSuite,
			RecordedAt:   recordedAt,
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
		Host:                    request.Host,
		TaskID:                  request.TaskID,
		ExpectedRevision:        request.ExpectedRevision,
		ActionID:                request.ActionID,
		ActionKind:              request.ActionKind,
		RepositoryBindingDigest: request.RepositoryBindingDigest,
		SourcePhase:             sourcePhase,
		Payload:                 append(json.RawMessage(nil), canonicalPayload...),
	})
}

func acceptsFreshBinding(
	action domain.ActionKind,
	issued domain.RepositoryBinding,
	fresh domain.RepositoryBinding,
) bool {
	if action == domain.ActionImplementChange {
		return sameRepositoryIdentityBinding(issued, fresh) &&
			((issued.WorktreeFingerprint == fresh.WorktreeFingerprint) ==
				(issued.BindingDigest == fresh.BindingDigest))
	}
	return issued.BindingDigest == fresh.BindingDigest &&
		sameRepositoryIdentityBinding(issued, fresh) &&
		issued.WorktreeFingerprint == fresh.WorktreeFingerprint
}

func sameRepositoryIdentityBinding(left, right domain.RepositoryBinding) bool {
	return left.CanonicalRoot == right.CanonicalRoot &&
		left.GitCommonDirDigest == right.GitCommonDirDigest &&
		left.RepositoryIdentity == right.RepositoryIdentity &&
		sameOptionalString(left.Branch, right.Branch) &&
		left.Detached == right.Detached &&
		sameOptionalString(left.Head, right.Head) && left.Unborn == right.Unborn
}

func sameOptionalString(left, right *string) bool {
	if left == nil || right == nil {
		return left == nil && right == nil
	}
	return *left == *right
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
		FinalRepositoryBindingDigest: bindingDigest,
		Summary:                      summary,
		CompletedAt:                  completedAt,
	}
}
