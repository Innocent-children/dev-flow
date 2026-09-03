package application

import (
	"context"
	"errors"
	"strings"
	"unicode/utf8"

	"github.com/Innocent-children/dev-flow/internal/domain"
	"github.com/Innocent-children/dev-flow/internal/store"
)

func (s *Service) AbandonTask(ctx context.Context, request AbandonTaskRequest) (AbandonTaskResult, error) {
	if !s.valid() || ctx == nil || !request.RequestID.IsValid() || !request.Host.IsValid() || !request.TaskID.IsValid() || request.ExpectedRevision == 0 || !utf8.ValidString(request.Reason) || strings.TrimSpace(request.Reason) != request.Reason || request.Reason == "" || len(request.Reason) > domain.MaxReasonBytes {
		return AbandonTaskResult{}, domain.ErrInvalidArgument
	}
	task, err := s.loadOwned(ctx, request.Host, request.TaskID)
	if err != nil {
		return AbandonTaskResult{}, err
	}
	if task.CurrentNode.Terminal() {
		return AbandonTaskResult{}, domain.ErrTaskTerminal
	}
	if task.Revision != request.ExpectedRevision {
		return AbandonTaskResult{}, domain.ErrRevisionConflict
	}
	fresh, observeErr := s.observeTaskRepositories(ctx, task)
	unavailable := errors.Is(observeErr, domain.ErrWorkspaceUnavailable)
	if observeErr != nil && !unavailable {
		return AbandonTaskResult{}, observeErr
	}
	if observeErr == nil {
		unavailable = scopeHasUnavailableWorkspace(task, fresh)
	}
	if !unavailable {
		return AbandonTaskResult{}, domain.ErrWorkspaceUnavailable
	}
	next, err := cloneProcessTask(task)
	if err != nil {
		return AbandonTaskResult{}, domain.ErrInternal
	}
	eventID, err := s.id("event")
	if err != nil {
		return AbandonTaskResult{}, err
	}
	now := s.now().UTC()
	source := task.CurrentNode
	next.CurrentNode = domain.NodeCancelled
	next.CurrentAction, next.Blocker, next.ResumeNode, next.Relocation = nil, nil, nil, nil
	next.Revision++
	next.UpdatedAt = now
	next.CompletedAt = &now
	digest, err := next.EffectiveRepositoryBindingDigest()
	if err != nil {
		return AbandonTaskResult{}, domain.ErrInternal
	}
	requirementsRevision := uint32(0)
	if next.Requirements != nil {
		requirementsRevision = next.Requirements.Revision
	}
	next.Outcome = &domain.ProcessOutcome{Status: domain.TerminalCancelled, Summary: request.Reason, RequirementsRevision: requirementsRevision, FinalRepositoryDigest: digest, CompletedAt: now}
	payloadDigest, err := digestCanonical(request)
	if err != nil {
		return AbandonTaskResult{}, domain.ErrInternal
	}
	next.LastOperation = &domain.LastOperation{OperationID: request.RequestID, Kind: domain.OperationAbandonTask, FromRevision: task.Revision, ToRevision: next.Revision, PayloadDigest: payloadDigest, CommittedAt: now}
	event := store.TaskEvent{EventID: eventID, TaskID: task.TaskID, Revision: next.Revision, Kind: domain.OperationAbandonTask, SourceNode: source, DestinationNode: domain.NodeCancelled, TransitionReason: request.Reason, RequestID: request.RequestID, PayloadDigest: payloadDigest, CreatedAt: now}
	if err := s.taskStore.CommitTask(ctx, store.TaskMutation{ExpectedRevision: task.Revision, Task: next, Event: event, Claim: store.ClaimRelease}); err != nil {
		return AbandonTaskResult{}, mapStoreError(err)
	}
	return AbandonTaskResult{Task: next}, nil
}
