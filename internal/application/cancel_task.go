package application

import (
	"context"
	"github.com/Innocent-children/dev-flow/internal/domain"
	"github.com/Innocent-children/dev-flow/internal/store"
	"strings"
)

func (s *Service) CancelTask(ctx context.Context, r CancelTaskRequest) (CancelTaskResult, error) {
	task, err := s.loadOwned(ctx, r.Host, r.TaskID)
	if err != nil {
		return CancelTaskResult{}, err
	}
	if task.Revision != r.ExpectedRevision {
		return CancelTaskResult{}, domain.ErrRevisionConflict
	}
	if strings.TrimSpace(r.Reason) == "" || r.Reason != strings.TrimSpace(r.Reason) {
		return CancelTaskResult{}, domain.ErrInvalidArgument
	}
	source := task.CurrentNode
	next, err := cloneProcessTask(task)
	if err != nil {
		return CancelTaskResult{}, domain.ErrInternal
	}
	now := s.now().UTC()
	next.CurrentNode = domain.NodeCancelled
	next.CurrentAction = nil
	next.Revision++
	next.UpdatedAt = now
	next.CompletedAt = &now
	rev := uint32(0)
	if next.Requirements != nil {
		rev = next.Requirements.Revision
	}
	next.Outcome = &domain.ProcessOutcome{Status: domain.TerminalCancelled, Summary: r.Reason, RequirementsRevision: rev, FinalRepositoryDigest: next.Repository.BindingDigest, CompletedAt: now}
	digest, err := digestCanonical(r)
	if err != nil {
		return CancelTaskResult{}, domain.ErrInternal
	}
	next.LastOperation = &domain.LastOperation{OperationID: r.RequestID, Kind: domain.OperationCancelTask, FromRevision: r.ExpectedRevision, ToRevision: next.Revision, PayloadDigest: digest, CommittedAt: now}
	eventID, err := s.id("event")
	if err != nil {
		return CancelTaskResult{}, err
	}
	event := store.TaskEvent{EventID: eventID, TaskID: next.TaskID, Revision: next.Revision, Kind: domain.OperationCancelTask, SourceNode: source, DestinationNode: domain.NodeCancelled, RequestID: r.RequestID, PayloadDigest: digest, CreatedAt: now}
	if err := s.taskStore.CommitTask(ctx, store.TaskMutation{ExpectedRevision: r.ExpectedRevision, Task: next, Event: event, Claim: store.ClaimRelease}); err != nil {
		return CancelTaskResult{}, mapStoreError(err)
	}
	return CancelTaskResult{Task: next}, nil
}
