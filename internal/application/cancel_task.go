package application

import (
	"context"
	"math"
	"strings"
	"unicode/utf8"

	"github.com/Innocent-children/dev-flow/internal/domain"
	"github.com/Innocent-children/dev-flow/internal/store"
	"github.com/Innocent-children/dev-flow/internal/workflow"
)

type cancelTaskDigestPayload struct {
	Host             domain.Host `json:"host"`
	TaskID           domain.ID   `json:"task_id"`
	ExpectedRevision uint64      `json:"expected_revision"`
	Reason           string      `json:"reason"`
}

// CancelTask explicitly terminates one host-owned task. It never observes or
// mutates the repository and releases the active claim in the task mutation.
func (s *Service) CancelTask(
	ctx context.Context,
	request CancelTaskRequest,
) (CancelTaskResult, error) {
	reason, err := validateCancelTaskRequest(s, ctx, request)
	if err != nil {
		return CancelTaskResult{}, err
	}
	task, err := s.taskStore.LoadTask(ctx, request.TaskID)
	if err != nil {
		return CancelTaskResult{}, mapStoreError(ctx, err)
	}
	if task.TaskID != request.TaskID {
		return CancelTaskResult{}, domain.ErrInternal
	}
	if task.OriginHost != request.Host {
		return CancelTaskResult{}, domain.ErrHostOwnershipConflict
	}
	if task.Phase.Terminal() {
		return CancelTaskResult{}, domain.ErrTaskTerminal
	}
	if task.Revision != request.ExpectedRevision {
		return CancelTaskResult{}, domain.ErrRevisionConflict
	}
	if workflow.ValidateTask(task) != nil {
		return CancelTaskResult{}, domain.ErrInternal
	}

	now := s.now().UTC()
	eventID, err := s.generateID("event")
	if err != nil {
		return CancelTaskResult{}, err
	}
	payloadDigest, err := digestCanonical(cancelTaskDigestPayload{
		Host:             request.Host,
		TaskID:           request.TaskID,
		ExpectedRevision: request.ExpectedRevision,
		Reason:           reason,
	})
	if err != nil {
		return CancelTaskResult{}, domain.ErrInternal
	}

	acceptanceCriteria := task.Contract.AcceptanceCriteria()
	acceptance := make([]domain.OutcomeCriterion, len(acceptanceCriteria))
	for i, criterion := range acceptanceCriteria {
		acceptance[i] = domain.OutcomeCriterion{
			Criterion: criterion,
			Status:    domain.CriterionUnverified,
		}
	}
	automatedIDs := make([]domain.ID, 0)
	manualIDs := make([]domain.ID, 0)
	for _, evidence := range task.Evidence {
		switch evidence.Source {
		case domain.EvidenceSourceAutomated:
			automatedIDs = append(automatedIDs, evidence.EvidenceID)
		case domain.EvidenceSourceUser:
			manualIDs = append(manualIDs, evidence.EvidenceID)
		}
	}
	outcome := domain.Outcome{
		Status:                       domain.TerminalCancelled,
		Acceptance:                   acceptance,
		AutomatedEvidenceIDs:         automatedIDs,
		ManualEvidenceIDs:            manualIDs,
		UnverifiedItems:              append([]string(nil), acceptanceCriteria...),
		Risks:                        []string{reason},
		FinalRepositoryBindingDigest: task.Repository.BindingDigest,
		Summary:                      reason,
		CompletedAt:                  now,
	}
	if outcome.Validate() != nil {
		return CancelTaskResult{}, domain.ErrInternal
	}

	newRevision := task.Revision + 1
	operation := domain.LastOperation{
		OperationID:   request.RequestID,
		Kind:          domain.OperationCancelTask,
		ActionID:      nil,
		FromRevision:  request.ExpectedRevision,
		ToRevision:    newRevision,
		PayloadDigest: payloadDigest,
		CommittedAt:   now,
	}
	candidate := task.Clone()
	candidate.Phase = domain.PhaseCancelled
	candidate.ResumePhase = nil
	candidate.CurrentAction = nil
	candidate.Blocker = nil
	candidate.LastOperation = &operation
	candidate.Outcome = &outcome
	candidate.Revision = newRevision
	candidate.UpdatedAt = now
	candidate.CompletedAt = &now
	if workflow.ValidateTask(candidate) != nil {
		return CancelTaskResult{}, domain.ErrInternal
	}
	event := store.TaskEvent{
		EventID:       eventID,
		TaskID:        task.TaskID,
		Revision:      newRevision,
		Kind:          domain.OperationCancelTask,
		PhaseBefore:   task.Phase,
		PhaseAfter:    domain.PhaseCancelled,
		ActionID:      nil,
		RequestID:     request.RequestID,
		PayloadDigest: payloadDigest,
		CreatedAt:     now,
	}
	mutation := store.TaskMutation{
		ExpectedRevision: request.ExpectedRevision,
		Task:             candidate,
		Event:            event,
		Claim:            store.ClaimRelease,
	}
	if err := s.taskStore.CommitTask(ctx, mutation); err != nil {
		return CancelTaskResult{}, mapStoreError(ctx, err)
	}
	return CancelTaskResult{Task: candidate.Clone()}, nil
}

func validateCancelTaskRequest(
	s *Service,
	ctx context.Context,
	request CancelTaskRequest,
) (string, error) {
	if s == nil || !s.valid() || ctx == nil || !request.RequestID.IsValid() ||
		!request.Host.IsValid() || !request.TaskID.IsValid() || request.ExpectedRevision == 0 ||
		request.ExpectedRevision == math.MaxUint64 || !utf8.ValidString(request.Reason) {
		return "", domain.ErrInvalidArgument
	}
	reason := strings.TrimSpace(request.Reason)
	if reason == "" || len(reason) > domain.MaxReasonBytes {
		return "", domain.ErrInvalidArgument
	}
	return reason, nil
}
