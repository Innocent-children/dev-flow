package application

import (
	"context"
	"errors"
	"github.com/Innocent-children/dev-flow/internal/domain"
	"github.com/Innocent-children/dev-flow/internal/store"
	"github.com/Innocent-children/dev-flow/internal/workflow"
	"reflect"
	"strings"
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
		if r.NewTask != nil {
			intent, e := normalizedIntent(*r.NewTask)
			if e != nil {
				return OpenTaskResult{}, e
			}
			if !reflect.DeepEqual(active.Intent, intent) {
				return OpenTaskResult{}, domain.ErrActiveTaskConflict
			}
		}
		return OpenTaskResult{Task: active}, nil
	}
	if !errors.Is(err, store.ErrTaskNotFound) || r.NewTask == nil {
		return OpenTaskResult{}, mapStoreError(err)
	}
	intent, err := normalizedIntent(*r.NewTask)
	if err != nil {
		return OpenTaskResult{}, err
	}
	taskID, err := s.id("task")
	if err != nil {
		return OpenTaskResult{}, err
	}
	actionID, err := s.id("action")
	if err != nil {
		return OpenTaskResult{}, err
	}
	eventID, err := s.id("event")
	if err != nil {
		return OpenTaskResult{}, err
	}
	now := s.now().UTC()
	definition := workflow.StandardProcess()
	action, err := workflow.BuildProcessAction(definition, domain.NodeRequirements, taskID, 1, binding.BindingDigest, intent.MethodProfile, actionID, now)
	if err != nil {
		return OpenTaskResult{}, domain.ErrInternal
	}
	payloadDigest, err := digestCanonical(struct {
		Host   domain.Host       `json:"host"`
		Intent domain.TaskIntent `json:"intent"`
	}{r.Host, intent})
	if err != nil {
		return OpenTaskResult{}, domain.ErrInternal
	}
	operation := &domain.LastOperation{OperationID: r.RequestID, Kind: domain.OperationOpenTask, FromRevision: 0, ToRevision: 1, PayloadDigest: payloadDigest, CommittedAt: now}
	task := domain.ProcessTask{TaskID: taskID, OriginHost: r.Host, Intent: intent, Process: definition.Reference, CurrentNode: domain.NodeRequirements, CurrentAction: &action, LastOperation: operation, Repository: binding, Revision: 1, CreatedAt: now, UpdatedAt: now}
	event := store.TaskEvent{EventID: eventID, TaskID: taskID, Revision: 1, Kind: domain.OperationOpenTask, SourceNode: domain.NodeRequirements, DestinationNode: domain.NodeRequirements, RequestID: r.RequestID, PayloadDigest: payloadDigest, CreatedAt: now}
	if err := s.taskStore.CommitTask(ctx, store.TaskMutation{Task: task, Event: event, Claim: store.ClaimAcquire}); err != nil {
		return OpenTaskResult{}, mapStoreError(err)
	}
	return OpenTaskResult{Created: true, Task: task}, nil
}
func normalizedIntent(input NewTaskInput) (domain.TaskIntent, error) {
	normalize := func(items []string) ([]string, error) {
		out := make([]string, len(items))
		seen := map[string]bool{}
		for i, v := range items {
			v = strings.TrimSpace(v)
			if v == "" || seen[v] {
				return nil, domain.ErrInvalidArgument
			}
			seen[v] = true
			out[i] = v
		}
		return out, nil
	}
	scope, err := normalize(input.InitialScope)
	if err != nil {
		return domain.TaskIntent{}, err
	}
	out, err := normalize(input.InitialOutOfScope)
	if err != nil {
		return domain.TaskIntent{}, err
	}
	acceptance, err := normalize(input.KnownAcceptanceCriteria)
	if err != nil {
		return domain.TaskIntent{}, err
	}
	intent := domain.TaskIntent{Request: strings.TrimSpace(input.Request), InitialScope: scope, InitialOutOfScope: out, KnownAcceptanceCriteria: acceptance, VerificationBudget: input.VerificationBudget, MethodProfile: input.MethodProfile}
	if intent.Validate() != nil {
		return domain.TaskIntent{}, domain.ErrInvalidArgument
	}
	return intent, nil
}
