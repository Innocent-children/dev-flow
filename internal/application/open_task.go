package application

import (
	"context"
	"errors"
	"github.com/Innocent-children/dev-flow/internal/domain"
	"github.com/Innocent-children/dev-flow/internal/store"
	"github.com/Innocent-children/dev-flow/internal/workflow"
	"reflect"
	"sort"
	"strings"
	"unicode/utf8"
)

func (s *Service) OpenTask(ctx context.Context, r OpenTaskRequest) (OpenTaskResult, error) {
	if !s.valid() || ctx == nil || !r.RequestID.IsValid() || !r.Host.IsValid() || !validRepositoryPathInput(r.RepositoryPath) {
		return OpenTaskResult{}, domain.ErrInvalidArgument
	}
	if r.NewTask == nil {
		if r.PrimaryRepositoryKey != "" || len(r.AdditionalRepositories) != 0 {
			return OpenTaskResult{}, domain.ErrInvalidArgument
		}
		return s.resumeTask(ctx, r)
	}
	intent, err := normalizedIntent(*r.NewTask)
	if err != nil {
		return OpenTaskResult{}, err
	}
	primaryKey, additionalInput, err := normalizeOpenRepositoryInput(r.PrimaryRepositoryKey, r.AdditionalRepositories)
	if err != nil {
		return OpenTaskResult{}, err
	}
	primary, additional, err := s.observeOpenRepositoryScope(ctx, r.RepositoryPath, additionalInput)
	if err != nil {
		return OpenTaskResult{}, err
	}
	primaryKey, additional, err = domain.NormalizeRepositoryScope(primaryKey, primary, additional)
	if err != nil {
		return OpenTaskResult{}, domain.ErrInvalidArgument
	}
	active, err := s.taskStore.LoadActiveTask(ctx, primary.RepositoryIdentity)
	if err == nil {
		if active.OriginHost != r.Host {
			return OpenTaskResult{}, domain.ErrHostOwnershipConflict
		}
		requestedScope := domain.ProcessTask{PrimaryRepositoryKey: primaryKey, Repository: primary, AdditionalRepositories: additional}
		if !reflect.DeepEqual(active.Intent, intent) || !domain.RepositoryScopeMembershipEqual(active, requestedScope) {
			return OpenTaskResult{}, domain.ErrActiveTaskConflict
		}
		return OpenTaskResult{Task: active}, nil
	}
	if !errors.Is(err, store.ErrTaskNotFound) {
		return OpenTaskResult{}, mapStoreError(err)
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
	task := domain.ProcessTask{TaskID: taskID, OriginHost: r.Host, Intent: intent, Process: definition.Reference, CurrentNode: domain.NodeRequirements, PrimaryRepositoryKey: primaryKey, Repository: primary, AdditionalRepositories: additional, Revision: 1, CreatedAt: now, UpdatedAt: now}
	effectiveDigest, err := task.EffectiveRepositoryBindingDigest()
	if err != nil {
		return OpenTaskResult{}, domain.ErrInvalidArgument
	}
	action, err := workflow.BuildProcessAction(definition, domain.NodeRequirements, taskID, 1, effectiveDigest, intent.MethodProfile, actionID, now)
	if err != nil {
		return OpenTaskResult{}, domain.ErrInternal
	}
	payloadDigest, err := digestCanonical(struct {
		Host                   domain.Host                 `json:"host"`
		RepositoryPath         string                      `json:"repository_path"`
		PrimaryRepositoryKey   domain.RepositoryKey        `json:"primary_repository_key"`
		AdditionalRepositories []AdditionalRepositoryInput `json:"additional_repositories"`
		Intent                 domain.TaskIntent           `json:"intent"`
	}{r.Host, r.RepositoryPath, primaryKey, additionalInput, intent})
	if err != nil {
		return OpenTaskResult{}, domain.ErrInternal
	}
	operation := &domain.LastOperation{OperationID: r.RequestID, Kind: domain.OperationOpenTask, FromRevision: 0, ToRevision: 1, PayloadDigest: payloadDigest, CommittedAt: now}
	task.CurrentAction = &action
	task.LastOperation = operation
	event := store.TaskEvent{EventID: eventID, TaskID: taskID, Revision: 1, Kind: domain.OperationOpenTask, SourceNode: domain.NodeRequirements, DestinationNode: domain.NodeRequirements, RequestID: r.RequestID, PayloadDigest: payloadDigest, CreatedAt: now}
	if err := s.taskStore.CommitTask(ctx, store.TaskMutation{Task: task, Event: event, Claim: store.ClaimAcquire}); err != nil {
		return OpenTaskResult{}, mapStoreError(err)
	}
	return OpenTaskResult{Created: true, Task: task}, nil
}

func (s *Service) resumeTask(ctx context.Context, r OpenTaskRequest) (OpenTaskResult, error) {
	binding, err := s.repositoryObserver.Observe(ctx, r.RepositoryPath)
	if err != nil {
		return OpenTaskResult{}, domain.ErrNotGitRepository
	}
	active, err := s.taskStore.LoadActiveTask(ctx, binding.RepositoryIdentity)
	if err != nil {
		return OpenTaskResult{}, mapStoreError(err)
	}
	if active.OriginHost != r.Host {
		return OpenTaskResult{}, domain.ErrHostOwnershipConflict
	}
	return OpenTaskResult{Task: active}, nil
}

func normalizeOpenRepositoryInput(primaryKey domain.RepositoryKey, additional []AdditionalRepositoryInput) (domain.RepositoryKey, []AdditionalRepositoryInput, error) {
	if primaryKey == "" {
		primaryKey = domain.DefaultPrimaryRepositoryKey
	}
	if !primaryKey.IsValid() || len(additional) > domain.MaxAdditionalRepositories {
		return "", nil, domain.ErrInvalidArgument
	}
	normalized := append([]AdditionalRepositoryInput(nil), additional...)
	sort.Slice(normalized, func(i, j int) bool { return normalized[i].Key < normalized[j].Key })
	keys := map[domain.RepositoryKey]bool{primaryKey: true}
	for _, entry := range normalized {
		if !entry.Key.IsValid() || keys[entry.Key] || !validRepositoryPathInput(entry.RepositoryPath) {
			return "", nil, domain.ErrInvalidArgument
		}
		keys[entry.Key] = true
	}
	return primaryKey, normalized, nil
}

func (s *Service) observeOpenRepositoryScope(ctx context.Context, primaryPath string, additional []AdditionalRepositoryInput) (domain.RepositoryBinding, []domain.RepositoryScopeEntry, error) {
	primary, err := s.repositoryObserver.Observe(ctx, primaryPath)
	if err != nil {
		return domain.RepositoryBinding{}, nil, domain.ErrNotGitRepository
	}
	entries := make([]domain.RepositoryScopeEntry, len(additional))
	for i, input := range additional {
		binding, err := s.repositoryObserver.Observe(ctx, input.RepositoryPath)
		if err != nil {
			return domain.RepositoryBinding{}, nil, domain.ErrNotGitRepository
		}
		entries[i] = domain.RepositoryScopeEntry{Key: input.Key, Binding: binding}
	}
	return primary, entries, nil
}

func validRepositoryPathInput(path string) bool {
	return path != "" && len(path) <= domain.MaxRepositoryPathBytes && utf8.ValidString(path)
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
