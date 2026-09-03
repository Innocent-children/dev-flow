package application

import (
	"context"
	"encoding/json"
	"path/filepath"
	"sort"

	"github.com/Innocent-children/dev-flow/internal/domain"
	"github.com/Innocent-children/dev-flow/internal/recovery"
	"github.com/Innocent-children/dev-flow/internal/repository"
	"github.com/Innocent-children/dev-flow/internal/store"
	"github.com/Innocent-children/dev-flow/internal/workflow"
)

func (s *Service) PrepareTaskRelocation(ctx context.Context, request PrepareTaskRelocationRequest) (PrepareTaskRelocationResult, error) {
	if !s.valid() || ctx == nil || !request.RequestID.IsValid() || !request.Host.IsValid() || !request.TaskID.IsValid() || request.ExpectedRevision == 0 {
		return PrepareTaskRelocationResult{}, domain.ErrInvalidArgument
	}
	task, err := s.loadOwned(ctx, request.Host, request.TaskID)
	if err != nil {
		return PrepareTaskRelocationResult{}, err
	}
	if task.CurrentNode == domain.NodeBlocked && task.Blocker != nil && task.Blocker.Cause == domain.BlockerCauseTaskRelocationPending && task.Relocation != nil && request.ExpectedRevision+1 == task.Revision {
		return PrepareTaskRelocationResult{Task: task, RelocationID: task.Relocation.RelocationID}, nil
	}
	if task.CurrentNode.Terminal() {
		return PrepareTaskRelocationResult{}, domain.ErrTaskTerminal
	}
	if task.CurrentNode == domain.NodeBlocked || task.Revision != request.ExpectedRevision {
		return PrepareTaskRelocationResult{}, domain.ErrRevisionConflict
	}
	fresh, err := s.observeTaskRepositories(ctx, task)
	if err != nil {
		return PrepareTaskRelocationResult{}, err
	}
	if scopeHasUnavailableWorkspace(task, fresh) {
		return PrepareTaskRelocationResult{}, domain.ErrWorkspaceUnavailable
	}
	if scopeHasHistoryConflict(fresh) {
		return PrepareTaskRelocationResult{}, domain.ErrWorkspaceHistoryConflict
	}
	next, err := cloneProcessTask(task)
	if err != nil {
		return PrepareTaskRelocationResult{}, domain.ErrInternal
	}
	relocationID, err := s.id("relocation")
	if err != nil {
		return PrepareTaskRelocationResult{}, err
	}
	blockerID, err := s.id("blocker")
	if err != nil {
		return PrepareTaskRelocationResult{}, err
	}
	actionID, err := s.id("action")
	if err != nil {
		return PrepareTaskRelocationResult{}, err
	}
	eventID, err := s.id("event")
	if err != nil {
		return PrepareTaskRelocationResult{}, err
	}
	now := s.now().UTC()
	resume := task.CurrentNode
	workspace, err := scopeWorkspaceDigests(task, fresh)
	if err != nil {
		return PrepareTaskRelocationResult{}, domain.ErrInternal
	}
	surface := currentRepositoryScopePaths(task.EffectivePrimaryRepositoryKey(), fresh.Primary, fresh.Additional)
	next.Relocation = &domain.TaskRelocation{
		RelocationID:         relocationID,
		SourceBindingDigest:  workspace.Binding,
		SourceIdentityDigest: workspace.Identity,
		SourceHistoryDigest:  workspace.History,
		SourceContentDigest:  workspace.Content,
		SourceTaskSurface:    surface,
		ResumeNode:           resume,
		PreparedAt:           now,
	}
	retainedWorkspace, err := next.EffectiveWorkspaceDigests()
	if err != nil {
		return PrepareTaskRelocationResult{}, domain.ErrInternal
	}
	condition := domain.BlockerCondition{
		Kind:                   domain.BlockerConditionResolveRelocation,
		ExpectedBindingDigest:  retainedWorkspace.Binding,
		ExpectedIdentityDigest: retainedWorkspace.Identity,
		ExpectedHistoryDigest:  retainedWorkspace.History,
		ExpectedContentDigest:  retainedWorkspace.Content,
		RelocationID:           relocationID,
	}
	next.CurrentNode, next.ResumeNode = domain.NodeBlocked, &resume
	next.Revision++
	next.UpdatedAt = now
	next.Blocker = &domain.ProcessBlocker{
		BlockerID:             blockerID,
		Code:                  domain.ErrorTaskBlocked,
		Cause:                 domain.BlockerCauseTaskRelocationPending,
		Message:               "Task relocation is prepared and waiting for the Host to hand off the same workspace content.",
		ResumeNode:            resume,
		ObservedBindingDigest: workspace.Binding,
		Condition:             condition,
		RequiredResolution:    "Complete one same-machine Host handoff, then resolve with the relocation ID and every destination repository path.",
		CreatedAt:             now,
	}
	blockedWorkspace := retainedWorkspace
	action, err := workflow.BuildProcessActionForWorkspace(workflow.StandardProcess(), domain.NodeBlocked, next.TaskID, next.Revision, blockedWorkspace, next.Intent.MethodProfile, actionID, now)
	if err != nil {
		return PrepareTaskRelocationResult{}, domain.ErrInternal
	}
	next.CurrentAction = &action
	payloadDigest, err := digestCanonical(struct {
		TaskID       domain.ID `json:"task_id"`
		Revision     uint64    `json:"revision"`
		RelocationID domain.ID `json:"relocation_id"`
	}{task.TaskID, task.Revision, relocationID})
	if err != nil {
		return PrepareTaskRelocationResult{}, domain.ErrInternal
	}
	next.LastOperation = &domain.LastOperation{
		OperationID:   request.RequestID,
		Kind:          domain.OperationPrepareTaskRelocation,
		FromRevision:  task.Revision,
		ToRevision:    next.Revision,
		PayloadDigest: payloadDigest,
		CommittedAt:   now,
	}
	sourceBindingDigest := workspace.Binding
	event := store.TaskEvent{
		EventID:               eventID,
		TaskID:                task.TaskID,
		Revision:              next.Revision,
		Kind:                  domain.OperationPrepareTaskRelocation,
		SourceNode:            resume,
		DestinationNode:       domain.NodeBlocked,
		TransitionReason:      next.Blocker.Message,
		ObservedBindingDigest: &sourceBindingDigest,
		RequestID:             request.RequestID,
		PayloadDigest:         payloadDigest,
		CreatedAt:             now,
	}
	if err := s.taskStore.CommitTask(ctx, store.TaskMutation{ExpectedRevision: task.Revision, Task: next, Event: event, Claim: store.ClaimRetain}); err != nil {
		return PrepareTaskRelocationResult{}, mapStoreError(err)
	}
	return PrepareTaskRelocationResult{Task: next, RelocationID: relocationID}, nil
}

func (s *Service) resolveTaskRelocationPayload(ctx context.Context, apply ApplyActionRequest, task domain.ProcessTask, payload recovery.BlockerResolutionPayload, canonical json.RawMessage) (ApplyActionResult, error) {
	if task.Blocker == nil || task.Relocation == nil ||
		payload.BlockerID != task.Blocker.BlockerID || payload.Condition != task.Blocker.Condition ||
		payload.RelocationID != task.Relocation.RelocationID {
		return ApplyActionResult{}, domain.ErrInvalidArgument
	}
	request := RecoverActionRequest{
		Host:                   apply.Host,
		TaskID:                 apply.TaskID,
		ActionID:               apply.ActionID,
		RelocationID:           payload.RelocationID,
		RelocationDestinations: payload.RelocationDestinations,
	}
	return s.resolveTaskRelocation(ctx, request, apply.RequestID, task, payload.ObservedBindingDigest, canonical)
}

func (s *Service) resolveTaskRelocation(ctx context.Context, request RecoverActionRequest, requestID domain.ID, task domain.ProcessTask, expectedObservedDigest domain.Digest, retainedCanonical json.RawMessage) (ApplyActionResult, error) {
	if task.Relocation == nil || task.Blocker == nil || task.ResumeNode == nil || task.CurrentAction == nil ||
		request.ActionID != task.CurrentAction.ActionID || !requestID.IsValid() ||
		request.RelocationID != task.Relocation.RelocationID ||
		len(request.RelocationDestinations) != len(task.AdditionalRepositories)+1 {
		return ApplyActionResult{}, domain.ErrInvalidArgument
	}
	target, err := s.validateTaskRelocationDestination(ctx, task, request.RelocationDestinations, expectedObservedDigest)
	if err != nil {
		return ApplyActionResult{}, err
	}
	primaryOrigin := target.primaryOrigin
	primary := target.scope.Primary
	additional := target.scope.Additional
	fresh := target.scope
	workspace := target.workspace
	current := target.currentChangedPaths
	next, err := cloneProcessTask(task)
	if err != nil {
		return ApplyActionResult{}, domain.ErrInternal
	}
	previousClaims := store.RepositoryClaimIdentities(task)
	next.WorkspaceOrigin, next.Repository, next.AdditionalRepositories = primaryOrigin, primary, additional
	next.CurrentChangedPaths = current
	destination := *task.ResumeNode
	contentAuthorityChanged := destination == domain.NodeTest && task.Implementation != nil && task.Implementation.ContentDigest != workspace.Content ||
		(destination == domain.NodeComprehensionReview || destination == domain.NodeDelivery) && task.Test != nil && task.Test.ContentDigest != workspace.Content
	if contentAuthorityChanged {
		next.Implementation, next.Test, next.Comprehension = nil, nil, nil
		destination = domain.NodeImplement
	}
	next.CurrentNode = destination
	next.ResumeNode, next.Blocker, next.Relocation = nil, nil, nil
	next.Revision++
	now := s.now().UTC()
	next.UpdatedAt = now
	actionID, err := s.id("action")
	if err != nil {
		return ApplyActionResult{}, err
	}
	eventID, err := s.id("event")
	if err != nil {
		return ApplyActionResult{}, err
	}
	workspace, err = next.EffectiveWorkspaceDigests()
	if err != nil {
		return ApplyActionResult{}, domain.ErrInternal
	}
	action, err := workflow.BuildProcessActionForWorkspace(workflow.StandardProcess(), destination, next.TaskID, next.Revision, workspace, next.Intent.MethodProfile, actionID, now)
	if err != nil {
		return ApplyActionResult{}, domain.ErrInternal
	}
	next.CurrentAction = &action
	canonical := append(json.RawMessage(nil), retainedCanonical...)
	if len(canonical) == 0 {
		payload := domain.BlockerResolutionPayload{
			BlockerID:              task.Blocker.BlockerID,
			Condition:              task.Blocker.Condition,
			ObservedBindingDigest:  workspace.Binding,
			RelocationID:           request.RelocationID,
			RelocationDestinations: append([]domain.RelocationDestination(nil), request.RelocationDestinations...),
		}
		raw, marshalErr := json.Marshal(payload)
		if marshalErr != nil {
			return ApplyActionResult{}, domain.ErrInternal
		}
		_, canonical, err = workflow.DecodeBlockerResolutionPayload(raw)
		if err != nil {
			return ApplyActionResult{}, domain.ErrInternal
		}
	}
	apply := applyRequestForCurrentAction(requestID, request.Host, task, canonical)
	operation := operationFromApply(apply)
	payloadDigest, err := workflow.GraphOperationDigest(request.Host, task.TaskID, operation, canonical)
	if err != nil {
		return ApplyActionResult{}, domain.ErrInternal
	}
	resolvedAction := task.CurrentAction.ActionID
	next.LastOperation = &domain.LastOperation{OperationID: requestID, Kind: domain.OperationApplyAction, ActionID: &resolvedAction, FromRevision: task.Revision, ToRevision: next.Revision, PayloadDigest: payloadDigest, CommittedAt: now}
	event := store.TaskEvent{EventID: eventID, TaskID: task.TaskID, Revision: next.Revision, Kind: domain.OperationApplyAction, SourceNode: domain.NodeBlocked, DestinationNode: destination, TransitionReason: "Task relocation verified and claims moved to the destination worktree instances.", ActionID: &resolvedAction, RepositoryDeltaPaths: observedTaskDeltaPaths(task, fresh), RequestID: requestID, PayloadDigest: payloadDigest, CreatedAt: now}
	mutation := store.TaskMutation{ExpectedRevision: task.Revision, Task: next, Event: event, Claim: store.ClaimReplace, PreviousClaims: previousClaims}
	operationStore, ok := s.taskStore.(store.ActionOperationStore)
	if !ok {
		return ApplyActionResult{}, domain.ErrInternal
	}
	commit := domain.ActionCommit{Operation: operation, Payload: canonical, PayloadDigest: payloadDigest, PreparedAt: now}
	if workflow.ValidateActionCommit(task, commit) != nil {
		return ApplyActionResult{}, domain.ErrInternal
	}
	existing, found, err := operationStore.LoadActionOperation(ctx, task.TaskID)
	if err != nil {
		return ApplyActionResult{}, mapStoreError(err)
	}
	staged := false
	if found && existing.Commit.Operation.ActionID == operation.ActionID {
		if existing.RecordedBy(task) {
			return ApplyActionResult{Task: task}, nil
		}
		expected := commit
		expected.PreparedAt = existing.Commit.PreparedAt
		if !existing.Commit.Equal(expected) || existing.AppliedRevision != nil {
			return ApplyActionResult{}, domain.ErrRecoveryUnavailable
		}
		commit = existing.Commit
		staged = true
	}
	if !staged {
		if err := operationStore.StageActionOperation(ctx, task, commit); err != nil {
			return ApplyActionResult{}, mapStoreError(err)
		}
	}
	if err := operationStore.CommitActionOperation(ctx, operation.OperationID, mutation); err != nil {
		return ApplyActionResult{}, mapStoreError(err)
	}
	return ApplyActionResult{Task: next}, nil
}

type validatedRelocationTarget struct {
	primaryOrigin       domain.WorkspaceOrigin
	scope               recovery.RepositoryScopeObservation
	workspace           domain.WorkspaceDigests
	currentChangedPaths []string
}

func (s *Service) assessTaskRelocationCommit(ctx context.Context, host domain.Host, task domain.ProcessTask, commit domain.ActionCommit) (*recovery.RecoveryAssessment, error) {
	if host != task.OriginHost {
		return nil, domain.ErrHostOwnershipConflict
	}
	payload, _, err := workflow.DecodeBlockerResolutionPayload(commit.Payload)
	if err != nil || task.Blocker == nil || task.Relocation == nil ||
		payload.BlockerID != task.Blocker.BlockerID || payload.Condition != task.Blocker.Condition ||
		payload.RelocationID != task.Relocation.RelocationID {
		return nil, domain.ErrStorageUnavailable
	}
	target, err := s.validateTaskRelocationDestination(ctx, task, payload.RelocationDestinations, payload.ObservedBindingDigest)
	if err != nil {
		return nil, err
	}
	authoritative, err := task.EffectiveRepositoryBindingDigest()
	if err != nil {
		return nil, domain.ErrInternal
	}
	observedAt := target.scope.Primary.ObservedAt
	for _, repository := range target.scope.Additional {
		if repository.Binding.ObservedAt.After(observedAt) {
			observedAt = repository.Binding.ObservedAt
		}
	}
	var currentActionID *domain.ID
	if task.CurrentAction != nil {
		value := task.CurrentAction.ActionID
		currentActionID = &value
	}
	payloadDigest := commit.PayloadDigest
	condition := task.Blocker.Condition
	assessment := &recovery.RecoveryAssessment{
		Classification:             domain.RecoveryCompletedButUnrecorded,
		Operation:                  commit.Operation,
		TaskRevision:               task.Revision,
		CurrentActionID:            currentActionID,
		IssuanceBindingDigest:      commit.Operation.RepositoryBindingDigest,
		AuthoritativeBindingDigest: authoritative,
		ObservedBindingDigest:      target.workspace.Binding,
		RepositoryRelation:         recovery.RepositoryWorktreeOnlyChanged,
		LastOperationRelation:      recovery.LastOperationUnrelated,
		OperationEvidence:          recovery.OperationEvidenceComplete,
		OperationPayloadDigest:     &payloadDigest,
		ActionRetrySafe:            false,
		NextAdvice:                 recovery.AdviceSubmitRecoveryApply,
		UnblockCondition:           &condition,
		ObservedAt:                 observedAt,
	}
	if len(task.AdditionalRepositories) != 0 {
		assessment.Repositories = make([]recovery.RepositoryFact, 0, len(task.AdditionalRepositories)+1)
		assessment.Repositories = append(assessment.Repositories, recovery.RepositoryFact{
			RepositoryKey: task.EffectivePrimaryRepositoryKey(),
			Relation:      recovery.RepositoryWorktreeOnlyChanged,
			Reason:        recovery.RepositoryReasonWorktreeInstance,
		})
		for _, repository := range task.AdditionalRepositories {
			assessment.Repositories = append(assessment.Repositories, recovery.RepositoryFact{
				RepositoryKey: repository.Key,
				Relation:      recovery.RepositoryWorktreeOnlyChanged,
				Reason:        recovery.RepositoryReasonWorktreeInstance,
			})
		}
		sort.Slice(assessment.Repositories, func(i, j int) bool {
			return assessment.Repositories[i].RepositoryKey < assessment.Repositories[j].RepositoryKey
		})
	}
	return assessment, nil
}

func (s *Service) validateTaskRelocationDestination(ctx context.Context, task domain.ProcessTask, requested []domain.RelocationDestination, expectedObservedDigest domain.Digest) (validatedRelocationTarget, error) {
	observer, ok := s.repositoryObserver.(repository.WorkspaceRepositoryObserver)
	if !ok {
		return validatedRelocationTarget{}, domain.ErrInternal
	}
	destinations := append([]domain.RelocationDestination(nil), requested...)
	sort.Slice(destinations, func(i, j int) bool {
		return destinations[i].Key < destinations[j].Key
	})
	expectedKeys := []domain.RepositoryKey{task.EffectivePrimaryRepositoryKey()}
	for _, entry := range task.AdditionalRepositories {
		expectedKeys = append(expectedKeys, entry.Key)
	}
	sort.Slice(expectedKeys, func(i, j int) bool {
		return expectedKeys[i] < expectedKeys[j]
	})
	if len(destinations) != len(expectedKeys) {
		return validatedRelocationTarget{}, domain.ErrInvalidArgument
	}
	byKey := make(map[domain.RepositoryKey]domain.RelocationDestination, len(destinations))
	for index, key := range expectedKeys {
		destination := destinations[index]
		if destination.Key != key || !validRelocationRepositoryPath(destination.RepositoryPath) {
			return validatedRelocationTarget{}, domain.ErrInvalidArgument
		}
		byKey[destination.Key] = destination
	}
	observed, err := s.observeRelocationDestinations(ctx, observer, task, byKey)
	if err != nil {
		return validatedRelocationTarget{}, err
	}
	primary := observed.scope.Primary
	if primary.WorktreeInstanceDigest == task.Repository.WorktreeInstanceDigest {
		return validatedRelocationTarget{}, domain.ErrInvalidArgument
	}
	if !relocationDestinationHistoryAllowed(task.WorkspaceOrigin, primary) {
		return validatedRelocationTarget{}, domain.ErrWorkspaceHistoryConflict
	}
	if observed.primaryOrigin.SourceRepositoryGroupDigest != task.WorkspaceOrigin.SourceRepositoryGroupDigest {
		return validatedRelocationTarget{}, domain.ErrWorkspaceUnavailable
	}
	for index, source := range task.AdditionalRepositories {
		destination := observed.scope.Additional[index]
		if destination.Binding.WorktreeInstanceDigest == source.Binding.WorktreeInstanceDigest {
			return validatedRelocationTarget{}, domain.ErrInvalidArgument
		}
		if !relocationDestinationHistoryAllowed(source.Origin, destination.Binding) {
			return validatedRelocationTarget{}, domain.ErrWorkspaceHistoryConflict
		}
		if destination.Origin.SourceRepositoryGroupDigest != source.Origin.SourceRepositoryGroupDigest {
			return validatedRelocationTarget{}, domain.ErrWorkspaceUnavailable
		}
	}
	candidate := task
	candidate.WorkspaceOrigin = observed.primaryOrigin
	candidate.Repository = primary
	candidate.AdditionalRepositories = observed.scope.Additional
	workspace, err := candidate.EffectiveWorkspaceDigests()
	if err != nil {
		return validatedRelocationTarget{}, domain.ErrInternal
	}
	if workspace.Identity == task.Relocation.SourceIdentityDigest {
		return validatedRelocationTarget{}, domain.ErrInvalidArgument
	}
	if expectedObservedDigest != "" && (!expectedObservedDigest.IsValid() || expectedObservedDigest != workspace.Binding) {
		return validatedRelocationTarget{}, domain.ErrInvalidArgument
	}
	current := currentRepositoryScopePaths(candidate.EffectivePrimaryRepositoryKey(), observed.scope.Primary, observed.scope.Additional)
	if workspace.Content != task.Relocation.SourceContentDigest || !sameStrings(current, task.Relocation.SourceTaskSurface) {
		return validatedRelocationTarget{}, domain.ErrWorkspaceHistoryConflict
	}
	return validatedRelocationTarget{
		primaryOrigin:       observed.primaryOrigin,
		scope:               observed.scope,
		workspace:           workspace,
		currentChangedPaths: current,
	}, nil
}

func validRelocationRepositoryPath(path string) bool {
	return validRepositoryPathInput(path) && filepath.IsAbs(path) && filepath.Clean(path) == path
}

func relocationDestinationHistoryAllowed(origin domain.WorkspaceOrigin, binding domain.RepositoryBinding) bool {
	if binding.Detached || binding.CurrentBranch == nil || *binding.CurrentBranch != origin.TaskBranch || !binding.BaseCommitAncestor {
		return false
	}
	return binding.HistoryRelation == domain.RepositoryHistoryExact ||
		binding.HistoryRelation == domain.RepositoryHistoryLinearAdvance
}

type relocationObservation struct {
	primaryOrigin domain.WorkspaceOrigin
	scope         recovery.RepositoryScopeObservation
}

func (s *Service) observeRelocationDestinations(ctx context.Context, observer repository.WorkspaceRepositoryObserver, task domain.ProcessTask, destinations map[domain.RepositoryKey]domain.RelocationDestination) (relocationObservation, error) {
	observeScope := func() (relocationObservation, error) {
		primaryDestination := destinations[task.EffectivePrimaryRepositoryKey()]
		primaryOrigin, primary, err := observer.ObserveWorkspace(
			ctx,
			primaryDestination.RepositoryPath,
			persistedOriginSelection(task.WorkspaceOrigin),
			&task.Repository,
		)
		if err != nil {
			return relocationObservation{}, mapWorkspaceObservationError(err)
		}
		additional := make([]domain.RepositoryScopeEntry, len(task.AdditionalRepositories))
		for index, source := range task.AdditionalRepositories {
			destination := destinations[source.Key]
			origin, binding, observeErr := observer.ObserveWorkspace(
				ctx,
				destination.RepositoryPath,
				persistedOriginSelection(source.Origin),
				&source.Binding,
			)
			if observeErr != nil {
				return relocationObservation{}, mapWorkspaceObservationError(observeErr)
			}
			additional[index] = domain.RepositoryScopeEntry{
				Key:     source.Key,
				Origin:  origin,
				Binding: binding,
			}
		}
		return relocationObservation{
			primaryOrigin: primaryOrigin,
			scope: recovery.RepositoryScopeObservation{
				Primary:    primary,
				Additional: additional,
			},
		}, nil
	}

	first, err := observeScope()
	if err != nil || len(task.AdditionalRepositories) == 0 {
		return first, err
	}
	second, err := observeScope()
	if err != nil {
		return relocationObservation{}, err
	}
	if first.primaryOrigin != second.primaryOrigin || !sameRepositoryScopeObservation(first.scope, second.scope) {
		return relocationObservation{}, domain.ErrWorkspaceObservationUnstable
	}
	for index := range first.scope.Additional {
		if first.scope.Additional[index].Origin != second.scope.Additional[index].Origin {
			return relocationObservation{}, domain.ErrWorkspaceObservationUnstable
		}
	}
	return second, nil
}
