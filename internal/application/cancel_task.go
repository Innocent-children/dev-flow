package application

import (
	"context"
	"strings"
	"unicode/utf8"

	"github.com/Innocent-children/dev-flow/internal/domain"
	"github.com/Innocent-children/dev-flow/internal/recovery"
	"github.com/Innocent-children/dev-flow/internal/store"
)

func (s *Service) CancelTask(ctx context.Context, r CancelTaskRequest) (CancelTaskResult, error) {
	if !s.valid() || ctx == nil || !r.RequestID.IsValid() || !r.Host.IsValid() || !r.TaskID.IsValid() {
		return CancelTaskResult{}, domain.ErrInvalidArgument
	}
	task, err := s.loadOwned(ctx, r.Host, r.TaskID)
	if err != nil {
		return CancelTaskResult{}, err
	}
	if task.CurrentNode.Terminal() {
		return CancelTaskResult{}, domain.ErrTaskTerminal
	}
	if task.Revision != r.ExpectedRevision {
		return CancelTaskResult{}, domain.ErrRevisionConflict
	}
	if !utf8.ValidString(r.Reason) || strings.TrimSpace(r.Reason) == "" || r.Reason != strings.TrimSpace(r.Reason) || len(r.Reason) > domain.MaxReasonBytes {
		return CancelTaskResult{}, domain.ErrInvalidArgument
	}
	fresh, err := s.observeTaskRepositories(ctx, task)
	if err != nil {
		return CancelTaskResult{}, err
	}
	comparison, err := recovery.CompareRepositoryScope(task, fresh)
	if err != nil {
		return CancelTaskResult{}, domain.ErrInternal
	}
	if comparison.Relation == recovery.RepositoryForbiddenChange {
		return CancelTaskResult{}, repositoryDriftError(comparison)
	}
	source := task.CurrentNode
	next, err := cloneProcessTask(task)
	if err != nil {
		return CancelTaskResult{}, domain.ErrInternal
	}
	now := s.now().UTC()
	next.CurrentNode = domain.NodeCancelled
	next.CurrentAction = nil
	next.Blocker = nil
	next.ResumeNode = nil
	next.Revision++
	next.UpdatedAt = now
	next.CompletedAt = &now
	rebindProcessAuthorities(&next, fresh)
	rev := uint32(0)
	if next.Requirements != nil {
		rev = next.Requirements.Revision
	}
	effectiveDigest, err := next.EffectiveRepositoryBindingDigest()
	if err != nil {
		return CancelTaskResult{}, domain.ErrInternal
	}
	next.Outcome = &domain.ProcessOutcome{Status: domain.TerminalCancelled, Summary: r.Reason, RequirementsRevision: rev, FinalRepositoryDigest: effectiveDigest, CompletedAt: now}
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
