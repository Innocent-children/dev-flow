package application

import (
	"context"
	"errors"
	"github.com/Innocent-children/dev-flow/internal/domain"
	"github.com/Innocent-children/dev-flow/internal/store"
	"github.com/Innocent-children/dev-flow/internal/workflow"
)

func (s *Service) OpenTask(ctx context.Context, r OpenTaskRequest) (OpenTaskResult, error) {
	if !s.valid() || ctx == nil || !r.RequestID.IsValid() || !r.Host.IsValid() {
		return OpenTaskResult{}, domain.ErrInvalidArgument
	}
	binding, err := s.repositoryObserver.Observe(ctx, r.RepositoryPath)
	if err != nil {
		return OpenTaskResult{}, domain.ErrNotGitRepository
	}
	active, err := s.taskStore.LoadActiveTask(ctx, binding.RepositoryIdentity)
	if err == nil {
		if active.OriginHost != r.Host {
			return OpenTaskResult{}, domain.ErrHostOwnershipConflict
		}
		return OpenTaskResult{Task: active}, nil
	}
	if !errors.Is(err, store.ErrTaskNotFound) || r.NewTask == nil {
		return OpenTaskResult{}, mapStoreError(err)
	}
	intent := domain.TaskIntent{Request: r.NewTask.Request, InitialScope: r.NewTask.InitialScope, InitialOutOfScope: r.NewTask.InitialOutOfScope, KnownAcceptanceCriteria: r.NewTask.KnownAcceptanceCriteria, VerificationBudget: r.NewTask.VerificationBudget, MethodProfile: r.NewTask.MethodProfile}
	if intent.Validate() != nil {
		return OpenTaskResult{}, domain.ErrInvalidArgument
	}
	taskID, _ := s.id("task")
	actionID, _ := s.id("action")
	eventID, _ := s.id("event")
	now := s.now().UTC()
	definition := workflow.StandardProcess()
	action, err := workflow.BuildProcessAction(definition, domain.NodeRequirements, taskID, 1, binding.BindingDigest, intent.MethodProfile, actionID, now)
	if err != nil {
		return OpenTaskResult{}, domain.ErrInternal
	}
	payloadDigest, err := digestCanonical(struct {
		Host   domain.Host
		Intent domain.TaskIntent
	}{r.Host, intent})
	if err != nil {
		return OpenTaskResult{}, domain.ErrInternal
	}
	task := domain.ProcessTask{TaskID: taskID, OriginHost: r.Host, Intent: intent, Process: definition.Reference, CurrentNode: domain.NodeRequirements, CurrentAction: &action, Repository: binding, Revision: 1, CreatedAt: now, UpdatedAt: now}
	event := store.TaskEvent{EventID: eventID, TaskID: taskID, Revision: 1, Kind: domain.OperationOpenTask, SourceNode: domain.NodeRequirements, DestinationNode: domain.NodeRequirements, RequestID: r.RequestID, PayloadDigest: payloadDigest, CreatedAt: now}
	if err := s.taskStore.CommitTask(ctx, store.TaskMutation{Task: task, Event: event, Claim: store.ClaimAcquire}); err != nil {
		return OpenTaskResult{}, mapStoreError(err)
	}
	return OpenTaskResult{Created: true, Task: task}, nil
}
