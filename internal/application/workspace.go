package application

import (
	"context"
	"errors"
	"sort"

	"github.com/Innocent-children/dev-flow/internal/domain"
	"github.com/Innocent-children/dev-flow/internal/recovery"
	"github.com/Innocent-children/dev-flow/internal/repository"
	"github.com/Innocent-children/dev-flow/internal/store"
	"github.com/Innocent-children/dev-flow/internal/workflow"
)

func originSelection(input WorkspaceOriginInput) repository.WorkspaceOriginSelection {
	return repository.WorkspaceOriginSelection{Mode: input.Mode, RemoteName: input.RemoteName, BaseBranch: input.BaseBranch, BaseCommit: input.BaseCommit, TaskBranch: input.TaskBranch, ProvisioningReceiptID: input.ProvisioningReceiptID}
}

func persistedOriginSelection(origin domain.WorkspaceOrigin) repository.WorkspaceOriginSelection {
	return repository.WorkspaceOriginSelection{Mode: origin.Mode, RemoteName: origin.RemoteName, BaseBranch: origin.BaseBranch, BaseCommit: origin.BaseCommit, TaskBranch: origin.TaskBranch, ProvisioningReceiptID: origin.ProvisioningReceiptID}
}

func mapWorkspaceOpenError(err error) error {
	if errors.Is(err, repository.ErrInconsistentWorktree) {
		return domain.ErrWorkspaceObservationUnstable
	}
	if errors.Is(err, repository.ErrProvisioningRequired) || errors.Is(err, repository.ErrNotGitRepository) || errors.Is(err, repository.ErrInvalidRepositoryPath) {
		return domain.ErrWorktreeProvisioningRequired
	}
	return domain.ErrInternal
}

func mapWorkspaceObservationError(err error) error {
	if errors.Is(err, repository.ErrInconsistentWorktree) {
		return domain.ErrWorkspaceObservationUnstable
	}
	if errors.Is(err, repository.ErrNotGitRepository) || errors.Is(err, repository.ErrInvalidRepositoryPath) {
		return domain.ErrWorkspaceUnavailable
	}
	return domain.ErrInternal
}

func currentRepositoryScopePaths(primaryKey domain.RepositoryKey, primary domain.RepositoryBinding, additional []domain.RepositoryScopeEntry) []string {
	return domain.RepositoryScopeTaskSurfacePaths(primaryKey, primary, additional)
}

func (s *Service) observeTaskRepositories(ctx context.Context, task domain.ProcessTask) (recovery.RepositoryScopeObservation, error) {
	observer, contextual := s.repositoryObserver.(repository.WorkspaceRepositoryObserver)
	observe := func(path string, origin domain.WorkspaceOrigin, previous domain.RepositoryBinding) (domain.RepositoryBinding, error) {
		if contextual {
			observedOrigin, binding, err := observer.ObserveWorkspace(ctx, path, persistedOriginSelection(origin), &previous)
			if err != nil {
				return domain.RepositoryBinding{}, mapWorkspaceObservationError(err)
			}
			if observedOrigin != origin {
				return domain.RepositoryBinding{}, domain.ErrWorkspaceUnavailable
			}
			return binding, nil
		}
		binding, err := s.repositoryObserver.Observe(ctx, path)
		if err != nil {
			return domain.RepositoryBinding{}, mapWorkspaceObservationError(err)
		}
		return binding, nil
	}
	observeScope := func() (recovery.RepositoryScopeObservation, error) {
		primary, err := observe(task.WorkspaceOrigin.CanonicalWorktreeRoot, task.WorkspaceOrigin, task.Repository)
		if err != nil {
			return recovery.RepositoryScopeObservation{}, err
		}
		additional := make([]domain.RepositoryScopeEntry, len(task.AdditionalRepositories))
		for i, entry := range task.AdditionalRepositories {
			binding, observeErr := observe(entry.Origin.CanonicalWorktreeRoot, entry.Origin, entry.Binding)
			if observeErr != nil {
				return recovery.RepositoryScopeObservation{}, observeErr
			}
			additional[i] = domain.RepositoryScopeEntry{Key: entry.Key, Origin: entry.Origin, Binding: binding}
		}
		return recovery.RepositoryScopeObservation{Primary: primary, Additional: additional}, nil
	}
	first, err := observeScope()
	if err != nil || len(task.AdditionalRepositories) == 0 {
		return first, err
	}
	second, err := observeScope()
	if err != nil {
		return recovery.RepositoryScopeObservation{}, err
	}
	if !sameRepositoryScopeObservation(first, second) {
		return recovery.RepositoryScopeObservation{}, domain.ErrWorkspaceObservationUnstable
	}
	return second, nil
}

func sameRepositoryScopeObservation(left, right recovery.RepositoryScopeObservation) bool {
	if left.Primary.BindingDigest != right.Primary.BindingDigest || len(left.Additional) != len(right.Additional) {
		return false
	}
	for index := range left.Additional {
		if left.Additional[index].Key != right.Additional[index].Key ||
			left.Additional[index].Binding.BindingDigest != right.Additional[index].Binding.BindingDigest {
			return false
		}
	}
	return true
}

func scopeWorkspaceDigests(task domain.ProcessTask, fresh recovery.RepositoryScopeObservation) (domain.WorkspaceDigests, error) {
	copy := task
	rebindTaskRepositories(&copy, fresh)
	return copy.EffectiveWorkspaceDigests()
}

func scopeHasUnavailableWorkspace(task domain.ProcessTask, fresh recovery.RepositoryScopeObservation) bool {
	if task.Repository.WorktreeInstanceDigest != fresh.Primary.WorktreeInstanceDigest || task.Repository.IdentityDigest != fresh.Primary.IdentityDigest {
		return true
	}
	for i := range task.AdditionalRepositories {
		if task.AdditionalRepositories[i].Binding.WorktreeInstanceDigest != fresh.Additional[i].Binding.WorktreeInstanceDigest || task.AdditionalRepositories[i].Binding.IdentityDigest != fresh.Additional[i].Binding.IdentityDigest {
			return true
		}
	}
	return false
}

func scopeHasHistoryConflict(fresh recovery.RepositoryScopeObservation) bool {
	conflict := func(binding domain.RepositoryBinding) bool {
		return binding.HistoryRelation != domain.RepositoryHistoryExact && binding.HistoryRelation != domain.RepositoryHistoryLinearAdvance
	}
	if conflict(fresh.Primary) {
		return true
	}
	for _, entry := range fresh.Additional {
		if conflict(entry.Binding) {
			return true
		}
	}
	return false
}

func scopeAtRetainedBranch(task domain.ProcessTask, fresh recovery.RepositoryScopeObservation) bool {
	match := func(origin domain.WorkspaceOrigin, binding domain.RepositoryBinding) bool {
		return !binding.Detached && binding.CurrentBranch != nil && *binding.CurrentBranch == origin.TaskBranch && binding.BaseCommitAncestor
	}
	if !match(task.WorkspaceOrigin, fresh.Primary) {
		return false
	}
	for i, entry := range task.AdditionalRepositories {
		if !match(entry.Origin, fresh.Additional[i].Binding) {
			return false
		}
	}
	return true
}

func historyResolutionMatchesReviewedWorkspace(task domain.ProcessTask, fresh recovery.RepositoryScopeObservation, comparison recovery.RepositoryScopeComparison) bool {
	if task.Blocker == nil || task.Blocker.Cause != domain.BlockerCauseWorkspaceHistoryConflict ||
		scopeHasUnavailableWorkspace(task, fresh) || !scopeAtRetainedBranch(task, fresh) {
		return false
	}
	return comparison.ObservedDigest == task.Blocker.ObservedBindingDigest ||
		comparison.ObservedDigest == task.Blocker.Condition.ExpectedBindingDigest ||
		!scopeHasHistoryConflict(fresh)
}

func contentDiffersFromCurrentAuthority(task domain.ProcessTask, fresh recovery.RepositoryScopeObservation) bool {
	digests, err := scopeWorkspaceDigests(task, fresh)
	if err != nil {
		return true
	}
	switch task.CurrentNode {
	case domain.NodeTest:
		return task.Implementation != nil && task.Implementation.ContentDigest != digests.Content
	case domain.NodeComprehensionReview, domain.NodeDelivery:
		return task.Test != nil && task.Test.ContentDigest != digests.Content
	default:
		return false
	}
}

func implementationContentMustRemainCurrent(node domain.NodeID) bool {
	return node == domain.NodeTest || node == domain.NodeComprehensionReview || node == domain.NodeDelivery
}

// guardTaskWorkspace performs the proactive guard used by resume and
// GetNextAction. Ordinary content changes remain bound to the issued Action;
// only blockers mutate Task state here.
func (s *Service) guardTaskWorkspace(ctx context.Context, task domain.ProcessTask, requestID domain.ID) (domain.ProcessTask, error) {
	if task.CurrentNode.Terminal() {
		return task, nil
	}
	pendingRecovery, err := s.hasPendingActionOperation(ctx, task)
	if err != nil {
		return domain.ProcessTask{}, err
	}
	if pendingRecovery {
		return task, nil
	}
	fresh, err := s.observeTaskRepositories(ctx, task)
	if err != nil {
		return domain.ProcessTask{}, err
	}
	if scopeHasUnavailableWorkspace(task, fresh) {
		return domain.ProcessTask{}, domain.ErrWorkspaceUnavailable
	}
	if scopeHasHistoryConflict(fresh) {
		return s.createWorkspaceHistoryBlocker(ctx, task, fresh, requestID)
	}
	if implementationContentMustRemainCurrent(task.CurrentNode) && contentDiffersFromCurrentAuthority(task, fresh) {
		return s.invalidateContentEvidence(ctx, task, fresh, requestID)
	}
	if task.TaskPlan != nil {
		outside := task.UnexplainedChangedPaths(fresh.Primary, fresh.Additional)
		if len(outside) != 0 && task.CurrentNode != domain.NodeBlocked {
			return s.createObservedFileScopeBlocker(ctx, task, fresh, outside, requestID)
		}
	}
	return task, nil
}

func (s *Service) hasPendingActionOperation(ctx context.Context, task domain.ProcessTask) (bool, error) {
	operationStore, ok := s.taskStore.(store.ActionOperationStore)
	if !ok {
		return false, nil
	}
	operation, found, err := operationStore.LoadActionOperation(ctx, task.TaskID)
	if err != nil {
		return false, mapStoreError(err)
	}
	if !found {
		return false, nil
	}
	if workflow.ValidateActionCommit(task, operation.Commit) != nil {
		return false, domain.ErrStorageUnavailable
	}
	if operation.AppliedRevision == nil {
		return true, nil
	}
	if !operation.RecordedBy(task) {
		return false, domain.ErrStorageUnavailable
	}
	return false, nil
}

func (s *Service) invalidateContentEvidence(ctx context.Context, task domain.ProcessTask, fresh recovery.RepositoryScopeObservation, requestID domain.ID) (domain.ProcessTask, error) {
	next, err := cloneProcessTask(task)
	if err != nil {
		return domain.ProcessTask{}, domain.ErrInternal
	}
	eventID, err := s.id("event")
	if err != nil {
		return domain.ProcessTask{}, err
	}
	actionID, err := s.id("action")
	if err != nil {
		return domain.ProcessTask{}, err
	}
	now := s.now().UTC()
	source := task.CurrentNode
	rebindProcessAuthorities(&next, fresh)
	next.Implementation, next.Test, next.Comprehension = nil, nil, nil
	next.CurrentNode = domain.NodeImplement
	next.Blocker, next.ResumeNode, next.Relocation = nil, nil, nil
	next.Revision++
	next.UpdatedAt = now
	workspace, err := next.EffectiveWorkspaceDigests()
	if err != nil {
		return domain.ProcessTask{}, domain.ErrInternal
	}
	action, err := workflow.BuildProcessActionForWorkspace(workflow.StandardProcess(), domain.NodeImplement, next.TaskID, next.Revision, workspace, next.Intent.MethodProfile, actionID, now)
	if err != nil {
		return domain.ProcessTask{}, domain.ErrInternal
	}
	next.CurrentAction = &action
	previousContent := task.Implementation.ContentDigest
	if task.Test != nil {
		previousContent = task.Test.ContentDigest
	}
	payloadDigest, err := digestCanonical(struct {
		Previous domain.Digest `json:"previous_content_digest"`
		Current  domain.Digest `json:"current_content_digest"`
	}{previousContent, workspace.Content})
	if err != nil {
		return domain.ProcessTask{}, domain.ErrInternal
	}
	oldAction := task.CurrentAction.ActionID
	next.LastOperation = &domain.LastOperation{OperationID: requestID, Kind: domain.OperationObserveWorkspace, ActionID: &oldAction, FromRevision: task.Revision, ToRevision: next.Revision, PayloadDigest: payloadDigest, CommittedAt: now}
	event := store.TaskEvent{EventID: eventID, TaskID: task.TaskID, Revision: next.Revision, Kind: domain.OperationObserveWorkspace, SourceNode: source, DestinationNode: domain.NodeImplement, TransitionReason: "Repository content changed after implementation verification; implementation, Test and comprehension must be re-established.", ActionID: &oldAction, RepositoryDeltaPaths: observedTaskDeltaPaths(task, fresh), RequestID: requestID, PayloadDigest: payloadDigest, CreatedAt: now}
	if err := s.taskStore.CommitTask(ctx, store.TaskMutation{ExpectedRevision: task.Revision, Task: next, Event: event, Claim: store.ClaimRetain}); err != nil {
		return domain.ProcessTask{}, mapStoreError(err)
	}
	return next, nil
}

func workspaceCondition(task domain.ProcessTask, relocationID domain.ID, kind domain.BlockerConditionKind) (domain.BlockerCondition, error) {
	digests, err := task.EffectiveWorkspaceDigests()
	if err != nil {
		return domain.BlockerCondition{}, err
	}
	return domain.BlockerCondition{Kind: kind, ExpectedBindingDigest: digests.Binding, ExpectedIdentityDigest: digests.Identity, ExpectedHistoryDigest: digests.History, ExpectedContentDigest: digests.Content, RelocationID: relocationID}, nil
}

func (s *Service) createWorkspaceHistoryBlocker(ctx context.Context, task domain.ProcessTask, fresh recovery.RepositoryScopeObservation, requestID domain.ID) (domain.ProcessTask, error) {
	refreshing := task.CurrentNode == domain.NodeBlocked && task.Blocker != nil && task.Blocker.Cause == domain.BlockerCauseWorkspaceHistoryConflict
	if task.CurrentNode == domain.NodeBlocked && !refreshing {
		return task, nil
	}
	next, err := cloneProcessTask(task)
	if err != nil {
		return domain.ProcessTask{}, domain.ErrInternal
	}
	blockerID, err := s.id("blocker")
	if err != nil {
		return domain.ProcessTask{}, err
	}
	actionID, err := s.id("action")
	if err != nil {
		return domain.ProcessTask{}, err
	}
	eventID, err := s.id("event")
	if err != nil {
		return domain.ProcessTask{}, err
	}
	condition := domain.BlockerCondition{}
	if refreshing {
		condition = task.Blocker.Condition
	} else {
		condition, err = workspaceCondition(task, "", domain.BlockerConditionResolveHistory)
		if err != nil {
			return domain.ProcessTask{}, domain.ErrInternal
		}
	}
	observed, err := scopeWorkspaceDigests(task, fresh)
	if err != nil {
		return domain.ProcessTask{}, domain.ErrInternal
	}
	if refreshing && observed.Binding == task.Blocker.ObservedBindingDigest {
		return task, nil
	}
	observedHistory, err := workspaceHistorySnapshot(task, fresh, observed)
	if err != nil {
		return domain.ProcessTask{}, domain.ErrInternal
	}
	now := s.now().UTC()
	resume := task.CurrentNode
	if refreshing {
		resume = *task.ResumeNode
	}
	sourceNode := task.CurrentNode
	next.CurrentNode, next.ResumeNode = domain.NodeBlocked, &resume
	next.Revision++
	next.UpdatedAt = now
	next.Blocker = &domain.ProcessBlocker{
		BlockerID:                blockerID,
		Code:                     domain.ErrorTaskBlocked,
		Cause:                    domain.BlockerCauseWorkspaceHistoryConflict,
		Message:                  workspaceHistoryBlockerMessage(observedHistory),
		ResumeNode:               resume,
		ObservedBindingDigest:    observed.Binding,
		ObservedWorkspaceHistory: &observedHistory,
		Condition:                condition,
		RequiredResolution:       "Restore the retained history or explicitly accept the reviewed same-branch history after confirming its content and task surface.",
		CreatedAt:                now,
	}
	workspace, err := next.EffectiveWorkspaceDigests()
	if err != nil {
		return domain.ProcessTask{}, domain.ErrInternal
	}
	action, err := workflow.BuildProcessActionForWorkspace(workflow.StandardProcess(), domain.NodeBlocked, next.TaskID, next.Revision, workspace, next.Intent.MethodProfile, actionID, now)
	if err != nil {
		return domain.ProcessTask{}, domain.ErrInternal
	}
	next.CurrentAction = &action
	payloadDigest, err := digestCanonical(struct {
		TaskID   domain.ID     `json:"task_id"`
		Observed domain.Digest `json:"observed_binding_digest"`
	}{task.TaskID, observed.Binding})
	if err != nil {
		return domain.ProcessTask{}, domain.ErrInternal
	}
	sourceAction := task.CurrentAction.ActionID
	next.LastOperation = &domain.LastOperation{OperationID: requestID, Kind: domain.OperationObserveWorkspace, ActionID: &sourceAction, FromRevision: task.Revision, ToRevision: next.Revision, PayloadDigest: payloadDigest, CommittedAt: now}
	event := store.TaskEvent{EventID: eventID, TaskID: task.TaskID, Revision: next.Revision, Kind: domain.OperationObserveWorkspace, SourceNode: sourceNode, DestinationNode: domain.NodeBlocked, TransitionReason: next.Blocker.Message, ActionID: &sourceAction, RepositoryDeltaPaths: observedTaskDeltaPaths(task, fresh), RequestID: requestID, PayloadDigest: payloadDigest, CreatedAt: now}
	if err := s.taskStore.CommitTask(ctx, store.TaskMutation{ExpectedRevision: task.Revision, Task: next, Event: event, Claim: store.ClaimRetain}); err != nil {
		return domain.ProcessTask{}, mapStoreError(err)
	}
	return next, nil
}

func workspaceHistorySnapshot(task domain.ProcessTask, fresh recovery.RepositoryScopeObservation, digests domain.WorkspaceDigests) (domain.WorkspaceHistorySnapshot, error) {
	repositories := make([]domain.WorkspaceHistoryRepositorySnapshot, 0, len(fresh.Additional)+1)
	observedAt := fresh.Primary.ObservedAt
	appendRepository := func(key domain.RepositoryKey, binding domain.RepositoryBinding) {
		var branch *string
		if binding.CurrentBranch != nil {
			value := *binding.CurrentBranch
			branch = &value
		}
		repositories = append(repositories, domain.WorkspaceHistoryRepositorySnapshot{
			RepositoryKey:      key,
			HistoryRelation:    binding.HistoryRelation,
			CurrentBranch:      branch,
			Detached:           binding.Detached,
			CurrentHead:        binding.CurrentHead,
			BaseCommitAncestor: binding.BaseCommitAncestor,
			ContentDigest:      binding.ContentDigest,
			TaskSurface:        domain.RepositoryChangedPaths(binding.TaskSurface),
		})
		if binding.ObservedAt.After(observedAt) {
			observedAt = binding.ObservedAt
		}
	}
	appendRepository(task.EffectivePrimaryRepositoryKey(), fresh.Primary)
	for _, repository := range fresh.Additional {
		appendRepository(repository.Key, repository.Binding)
	}
	sort.Slice(repositories, func(i, j int) bool {
		return repositories[i].RepositoryKey < repositories[j].RepositoryKey
	})
	snapshot := domain.WorkspaceHistorySnapshot{
		BindingDigest:       digests.Binding,
		IdentityDigest:      digests.Identity,
		HistoryDigest:       digests.History,
		ContentDigest:       digests.Content,
		CurrentChangedPaths: currentRepositoryScopePaths(task.EffectivePrimaryRepositoryKey(), fresh.Primary, fresh.Additional),
		Repositories:        repositories,
		ObservedAt:          observedAt,
	}
	if snapshot.Validate() != nil {
		return domain.WorkspaceHistorySnapshot{}, domain.ErrInvalidArgument
	}
	return snapshot, nil
}

func workspaceHistoryBlockerMessage(snapshot domain.WorkspaceHistorySnapshot) string {
	for _, repository := range snapshot.Repositories {
		if repository.HistoryRelation == domain.RepositoryHistoryExact || repository.HistoryRelation == domain.RepositoryHistoryLinearAdvance {
			continue
		}
		return `Repository "` + string(repository.RepositoryKey) + `" history is ` + string(repository.HistoryRelation) + "."
	}
	return "The Task worktree history no longer has an allowed linear relationship to the issued Action."
}
