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
	now := s.now().UTC()
	task.CurrentNode = domain.NodeCancelled
	task.CurrentAction = nil
	task.Revision++
	task.UpdatedAt = now
	task.CompletedAt = &now
	rev := uint32(0)
	if task.Requirements != nil {
		rev = task.Requirements.Revision
	}
	task.Outcome = &domain.ProcessOutcome{Status: domain.TerminalCancelled, Summary: r.Reason, RequirementsRevision: rev, FinalRepositoryDigest: task.Repository.BindingDigest, CompletedAt: now}
	eventID, _ := s.id("event")
	digest, _ := digestCanonical(r)
	event := store.TaskEvent{EventID: eventID, TaskID: task.TaskID, Revision: task.Revision, Kind: domain.OperationCancelTask, SourceNode: source, DestinationNode: domain.NodeCancelled, RequestID: r.RequestID, PayloadDigest: digest, CreatedAt: now}
	if err := s.taskStore.CommitTask(ctx, store.TaskMutation{ExpectedRevision: r.ExpectedRevision, Task: task, Event: event, Claim: store.ClaimRelease}); err != nil {
		return CancelTaskResult{}, mapStoreError(err)
	}
	return CancelTaskResult{Task: task}, nil
}
