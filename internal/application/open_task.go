package application

import (
	"context"
	"errors"
	"path/filepath"
	"sort"
	"strings"
	"unicode/utf8"

	"github.com/Innocent-children/dev-flow/internal/domain"
	"github.com/Innocent-children/dev-flow/internal/recovery"
	"github.com/Innocent-children/dev-flow/internal/repository"
	"github.com/Innocent-children/dev-flow/internal/store"
	"github.com/Innocent-children/dev-flow/internal/workflow"
)

func (s *Service) OpenTask(ctx context.Context, r OpenTaskRequest) (OpenTaskResult, error) {
	if !s.valid() || ctx == nil || !r.RequestID.IsValid() || !r.Host.IsValid() || !validRepositoryPathInput(r.RepositoryPath) {
		return OpenTaskResult{}, domain.ErrInvalidArgument
	}
	if r.NewTask == nil {
		if r.WorkspaceOrigin != nil || r.PrimaryRepositoryKey != "" || len(r.AdditionalRepositories) != 0 {
			return OpenTaskResult{}, domain.ErrInvalidArgument
		}
		return s.resumeTask(ctx, r)
	}
	if r.WorkspaceOrigin == nil || !validWorkspaceOriginInput(*r.WorkspaceOrigin) {
		return OpenTaskResult{}, domain.ErrWorktreeProvisioningRequired
	}
	intent, err := normalizedIntent(*r.NewTask)
	if err != nil {
		return OpenTaskResult{}, err
	}
	primaryKey, additionalInput, err := normalizeOpenRepositoryInput(r.PrimaryRepositoryKey, r.AdditionalRepositories)
	if err != nil {
		return OpenTaskResult{}, err
	}
	primaryOrigin, primary, additional, err := s.observeOpenRepositoryScope(ctx, r.RepositoryPath, *r.WorkspaceOrigin, additionalInput)
	if err != nil {
		return OpenTaskResult{}, err
	}
	primaryKey, additional, err = domain.NormalizeRepositoryScope(primaryKey, primaryOrigin, primary, additional)
	if err != nil {
		return OpenTaskResult{}, domain.ErrInvalidArgument
	}
	_, err = s.taskStore.LoadActiveTask(ctx, primary.WorktreeInstanceDigest)
	if err == nil {
		return OpenTaskResult{}, domain.ErrActiveTaskConflict
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
	task := domain.ProcessTask{TaskID: taskID, OriginHost: r.Host, Intent: intent, Process: definition.Reference, CurrentNode: domain.NodeRequirements, PrimaryRepositoryKey: primaryKey, WorkspaceOrigin: primaryOrigin, Repository: primary, AdditionalRepositories: additional, CurrentChangedPaths: currentRepositoryScopePaths(primaryKey, primary, additional), Revision: 1, CreatedAt: now, UpdatedAt: now}
	workspace, err := task.EffectiveWorkspaceDigests()
	if err != nil {
		return OpenTaskResult{}, domain.ErrInvalidArgument
	}
	action, err := workflow.BuildProcessActionForWorkspace(definition, domain.NodeRequirements, taskID, 1, workspace, intent.MethodProfile, actionID, now)
	if err != nil {
		return OpenTaskResult{}, domain.ErrInternal
	}
	payloadDigest, err := digestCanonical(struct {
		Host                   domain.Host                 `json:"host"`
		RepositoryPath         string                      `json:"repository_path"`
		WorkspaceOrigin        WorkspaceOriginInput        `json:"workspace_origin"`
		PrimaryRepositoryKey   domain.RepositoryKey        `json:"primary_repository_key"`
		AdditionalRepositories []AdditionalRepositoryInput `json:"additional_repositories"`
		Intent                 domain.TaskIntent           `json:"intent"`
	}{r.Host, r.RepositoryPath, *r.WorkspaceOrigin, primaryKey, additionalInput, intent})
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
	root := filepath.Clean(r.RepositoryPath)
	if absolute, absoluteErr := filepath.Abs(root); absoluteErr == nil {
		root = absolute
	}
	instance := domain.Digest("")
	identifyErr := error(nil)
	if identifier, ok := s.repositoryObserver.(repository.WorktreeIdentifier); ok {
		root, instance, identifyErr = identifier.IdentifyWorkspace(ctx, r.RepositoryPath)
	} else {
		binding, err := s.repositoryObserver.Observe(ctx, r.RepositoryPath)
		if err == nil {
			instance = binding.WorktreeInstanceDigest
		} else {
			identifyErr = err
		}
	}
	var active domain.ProcessTask
	var err error
	if lookup, ok := s.taskStore.(store.WorkspaceLookupStore); ok {
		active, err = lookup.LoadActiveTaskByCanonicalRoot(ctx, root)
	} else if instance.IsValid() {
		active, err = s.taskStore.LoadActiveTask(ctx, instance)
	} else {
		err = store.ErrTaskNotFound
	}
	if err != nil {
		return OpenTaskResult{}, mapStoreError(err)
	}
	if identifyErr != nil || !taskContainsWorkspaceInstance(active, root, instance) {
		return OpenTaskResult{}, domain.ErrWorkspaceUnavailable
	}
	if active.OriginHost != r.Host {
		return OpenTaskResult{}, domain.ErrHostOwnershipConflict
	}
	read, err := s.GetTask(ctx, GetTaskRequest{Host: r.Host, TaskID: active.TaskID})
	if err != nil {
		return OpenTaskResult{}, err
	}
	if read.RecoveryAssessment != nil && read.RecoveryAssessment.Classification != domain.RecoveryCompletedAndRecorded {
		return OpenTaskResult{Task: read.Task, RecoveryAssessment: read.RecoveryAssessment}, nil
	}
	guarded, err := s.guardTaskWorkspace(ctx, read.Task, r.RequestID)
	if err != nil {
		return OpenTaskResult{}, err
	}
	assessment := read.RecoveryAssessment
	if guarded.Revision != read.Task.Revision {
		assessment = nil
	}
	return OpenTaskResult{Task: guarded, RecoveryAssessment: assessment}, nil
}

func taskContainsWorkspaceInstance(task domain.ProcessTask, root string, instance domain.Digest) bool {
	if task.WorkspaceOrigin.CanonicalWorktreeRoot == root {
		return task.Repository.WorktreeInstanceDigest == instance
	}
	for _, entry := range task.AdditionalRepositories {
		if entry.Origin.CanonicalWorktreeRoot == root {
			return entry.Binding.WorktreeInstanceDigest == instance
		}
	}
	return false
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
		if !entry.Key.IsValid() || keys[entry.Key] || !validRepositoryPathInput(entry.RepositoryPath) || !validWorkspaceOriginInput(entry.WorkspaceOrigin) {
			return "", nil, domain.ErrInvalidArgument
		}
		keys[entry.Key] = true
	}
	return primaryKey, normalized, nil
}

func (s *Service) observeOpenRepositoryScope(ctx context.Context, primaryPath string, primaryInput WorkspaceOriginInput, additional []AdditionalRepositoryInput) (domain.WorkspaceOrigin, domain.RepositoryBinding, []domain.RepositoryScopeEntry, error) {
	observer, ok := s.repositoryObserver.(repository.WorkspaceRepositoryObserver)
	if !ok {
		return domain.WorkspaceOrigin{}, domain.RepositoryBinding{}, nil, domain.ErrWorktreeProvisioningRequired
	}
	type observedScope struct {
		primaryOrigin domain.WorkspaceOrigin
		primary       domain.RepositoryBinding
		additional    []domain.RepositoryScopeEntry
	}
	observeScope := func(previous *observedScope) (observedScope, error) {
		var previousPrimary *domain.RepositoryBinding
		if previous != nil {
			previousPrimary = &previous.primary
		}
		primaryOrigin, primary, err := observer.ObserveWorkspace(ctx, primaryPath, originSelection(primaryInput), previousPrimary)
		if err != nil {
			return observedScope{}, mapWorkspaceOpenError(err)
		}
		entries := make([]domain.RepositoryScopeEntry, len(additional))
		for index, input := range additional {
			var previousBinding *domain.RepositoryBinding
			if previous != nil {
				previousBinding = &previous.additional[index].Binding
			}
			origin, binding, observeErr := observer.ObserveWorkspace(ctx, input.RepositoryPath, originSelection(input.WorkspaceOrigin), previousBinding)
			if observeErr != nil {
				return observedScope{}, mapWorkspaceOpenError(observeErr)
			}
			entries[index] = domain.RepositoryScopeEntry{Key: input.Key, Origin: origin, Binding: binding}
		}
		return observedScope{primaryOrigin: primaryOrigin, primary: primary, additional: entries}, nil
	}
	first, err := observeScope(nil)
	if err != nil || len(additional) == 0 {
		return first.primaryOrigin, first.primary, first.additional, err
	}
	second, err := observeScope(&first)
	if err != nil {
		return domain.WorkspaceOrigin{}, domain.RepositoryBinding{}, nil, err
	}
	firstObservation := recovery.RepositoryScopeObservation{Primary: first.primary, Additional: first.additional}
	secondObservation := recovery.RepositoryScopeObservation{Primary: second.primary, Additional: second.additional}
	if first.primaryOrigin != second.primaryOrigin || !sameRepositoryScopeObservation(firstObservation, secondObservation) {
		return domain.WorkspaceOrigin{}, domain.RepositoryBinding{}, nil, domain.ErrWorkspaceObservationUnstable
	}
	for index := range first.additional {
		if first.additional[index].Origin != second.additional[index].Origin {
			return domain.WorkspaceOrigin{}, domain.RepositoryBinding{}, nil, domain.ErrWorkspaceObservationUnstable
		}
	}
	return second.primaryOrigin, second.primary, second.additional, nil
}

func validWorkspaceOriginInput(input WorkspaceOriginInput) bool {
	return repository.ValidWorkspaceOriginSelection(originSelection(input))
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
