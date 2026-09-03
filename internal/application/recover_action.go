package application

import (
	"context"
	"encoding/json"

	"github.com/Innocent-children/dev-flow/internal/domain"
	"github.com/Innocent-children/dev-flow/internal/recovery"
	"github.com/Innocent-children/dev-flow/internal/store"
	"github.com/Innocent-children/dev-flow/internal/workflow"
)

func (s *Service) RecoverAction(ctx context.Context, request RecoverActionRequest) (ApplyActionResult, error) {
	if !s.valid() || ctx == nil || !request.Host.IsValid() || !request.TaskID.IsValid() || !request.ActionID.IsValid() {
		return ApplyActionResult{}, domain.ErrInvalidArgument
	}
	task, err := s.loadOwned(ctx, request.Host, request.TaskID)
	if err != nil {
		return ApplyActionResult{}, err
	}
	operationStore, ok := s.taskStore.(store.ActionOperationStore)
	if !ok {
		return ApplyActionResult{}, domain.ErrInternal
	}
	stored, found, err := operationStore.LoadActionOperation(ctx, task.TaskID)
	if err != nil {
		return ApplyActionResult{}, mapStoreError(err)
	}
	if !found || stored.Commit.Operation.ActionID != request.ActionID || workflow.ValidateActionCommit(task, stored.Commit) != nil {
		return ApplyActionResult{}, domain.ErrRecoveryUnavailable
	}
	if stored.RecordedBy(task) {
		return ApplyActionResult{Task: task}, nil
	}
	commit := stored.Commit
	if task.CurrentNode == domain.NodeBlocked && task.Blocker != nil &&
		task.Blocker.Cause == domain.BlockerCauseTaskRelocationPending &&
		commit.Operation.SourceCursor == domain.NodeBlocked {
		payload, canonical, decodeErr := workflow.DecodeBlockerResolutionPayload(commit.Payload)
		if decodeErr != nil {
			return ApplyActionResult{}, domain.ErrInternal
		}
		apply := applyRequestFromCommit(request.Host, task.TaskID, commit)
		return s.resolveTaskRelocationPayload(ctx, apply, task, payload, canonical)
	}
	fresh, err := s.observeTaskRepositories(ctx, task)
	if err != nil {
		return ApplyActionResult{}, err
	}
	decision, err := recovery.Reconcile(recovery.ReconcileInput{Host: request.Host, Task: task, Operation: commit.Operation, Payload: commit.Payload, ObservedScope: &fresh})
	if err != nil {
		return ApplyActionResult{}, err
	}
	apply := applyRequestFromCommit(request.Host, task.TaskID, commit)
	switch decision.Directive {
	case recovery.DirectiveNoWrite:
		if decision.Assessment.Classification != domain.RecoveryNotStarted {
			return ApplyActionResult{Task: task}, nil
		}
		comparison, comparisonErr := recovery.CompareRepositoryScope(task, fresh)
		if comparisonErr != nil {
			return ApplyActionResult{}, domain.ErrInternal
		}
		return s.commitStandardActionOperation(ctx, operationStore, apply, task, fresh, comparison)
	case recovery.DirectiveReturnExistingBlocker:
		return ApplyActionResult{Task: task}, nil
	case recovery.DirectiveCommitRecoveredTransition:
		if commit.Operation.SourceCursor == domain.NodeBlocked {
			payload, canonical, decodeErr := workflow.DecodeBlockerResolutionPayload(commit.Payload)
			if decodeErr != nil {
				return ApplyActionResult{}, domain.ErrInternal
			}
			mutation, planErr := s.planResolveBlockerMutation(apply, task, fresh, payload, canonical)
			if planErr != nil {
				return ApplyActionResult{}, planErr
			}
			if commitErr := operationStore.CommitActionOperation(ctx, apply.RequestID, mutation); commitErr != nil {
				return ApplyActionResult{}, mapStoreError(commitErr)
			}
			return ApplyActionResult{Task: mutation.Task}, nil
		}
		comparison, comparisonErr := recovery.CompareRepositoryScope(task, fresh)
		if comparisonErr != nil {
			return ApplyActionResult{}, domain.ErrInternal
		}
		return s.commitStandardActionOperation(ctx, operationStore, apply, task, fresh, comparison)
	case recovery.DirectiveCreateBlocker:
		mutation, planErr := s.planRecoveryBlocker(apply, task, fresh, decision)
		if planErr != nil {
			return ApplyActionResult{}, planErr
		}
		if commitErr := operationStore.CommitActionOperation(ctx, apply.RequestID, mutation); commitErr != nil {
			return ApplyActionResult{}, mapStoreError(commitErr)
		}
		return ApplyActionResult{Task: mutation.Task}, nil
	case recovery.DirectiveRevisionConflict:
		return ApplyActionResult{}, domain.ErrRevisionConflict
	case recovery.DirectiveActionStale:
		return ApplyActionResult{}, domain.ErrActionStale
	default:
		return ApplyActionResult{}, domain.ErrInternal
	}
}

func (s *Service) ResolveBlockerAction(ctx context.Context, request RecoverActionRequest, requestID domain.ID) (ApplyActionResult, error) {
	if !s.valid() || ctx == nil || !requestID.IsValid() || !request.Host.IsValid() || !request.TaskID.IsValid() || !request.ActionID.IsValid() {
		return ApplyActionResult{}, domain.ErrInvalidArgument
	}
	task, err := s.loadOwned(ctx, request.Host, request.TaskID)
	if err != nil {
		return ApplyActionResult{}, err
	}
	operationStore, ok := s.taskStore.(store.ActionOperationStore)
	if !ok {
		return ApplyActionResult{}, domain.ErrInternal
	}
	existing, found, err := operationStore.LoadActionOperation(ctx, task.TaskID)
	if err != nil {
		return ApplyActionResult{}, mapStoreError(err)
	}
	if found && existing.Commit.Operation.ActionID == request.ActionID {
		if existing.RecordedBy(task) {
			return ApplyActionResult{Task: task}, nil
		}
		return ApplyActionResult{}, domain.ErrRecoveryUnavailable
	}
	if task.CurrentNode != domain.NodeBlocked || task.CurrentAction == nil || task.CurrentAction.ActionID != request.ActionID || task.Blocker == nil {
		return ApplyActionResult{}, domain.ErrActionStale
	}
	if task.Blocker.Cause == domain.BlockerCauseTaskRelocationPending {
		if request.RelocationID == "" || request.FileScopeDecision != nil || request.HistoryResolution != nil {
			return ApplyActionResult{}, domain.ErrInvalidArgument
		}
		return s.resolveTaskRelocation(ctx, request, requestID, task, "", nil)
	}
	fileScopeBlocker := task.Blocker.Cause == domain.BlockerCauseFileScopeDecision
	if fileScopeBlocker {
		if request.FileScopeDecision == nil || request.FileScopeDecision.Validate() != nil {
			return ApplyActionResult{}, domain.ErrInvalidArgument
		}
	} else if request.FileScopeDecision != nil || request.RelocationID != "" || len(request.RelocationDestinations) != 0 {
		return ApplyActionResult{}, domain.ErrInvalidArgument
	}
	if task.Blocker.Cause == domain.BlockerCauseWorkspaceHistoryConflict {
		if request.HistoryResolution == nil || request.HistoryResolution.Validate() != nil {
			return ApplyActionResult{}, domain.ErrInvalidArgument
		}
	} else if request.HistoryResolution != nil {
		return ApplyActionResult{}, domain.ErrInvalidArgument
	}
	fresh, err := s.observeTaskRepositories(ctx, task)
	if err != nil {
		return ApplyActionResult{}, err
	}
	comparison, err := recovery.CompareRepositoryScope(task, fresh)
	if err != nil {
		return ApplyActionResult{}, domain.ErrInternal
	}
	historyBlocker := task.Blocker.Cause == domain.BlockerCauseWorkspaceHistoryConflict
	if fileScopeBlocker {
		if !fileScopeResolutionRepositoryCurrent(task, fresh, comparison) {
			return ApplyActionResult{}, repositoryDriftError(comparison)
		}
	} else if historyBlocker {
		if !historyResolutionMatchesReviewedWorkspace(task, fresh, comparison) {
			return ApplyActionResult{}, domain.ErrWorkspaceHistoryConflict
		}
	} else if comparison.Relation != recovery.RepositoryExact {
		return ApplyActionResult{}, repositoryDriftError(comparison)
	}
	payload := domain.BlockerResolutionPayload{BlockerID: task.Blocker.BlockerID, Condition: task.Blocker.Condition, ObservedBindingDigest: comparison.ObservedDigest, FileScopeDecision: request.FileScopeDecision, HistoryResolution: request.HistoryResolution}
	raw, err := json.Marshal(payload)
	if err != nil {
		return ApplyActionResult{}, domain.ErrInternal
	}
	_, canonical, err := workflow.DecodeBlockerResolutionPayload(raw)
	if err != nil {
		return ApplyActionResult{}, domain.ErrInternal
	}
	apply := applyRequestForCurrentAction(requestID, request.Host, task, canonical)
	operation := operationFromApply(apply)
	digest, err := workflow.GraphOperationDigest(request.Host, task.TaskID, operation, canonical)
	if err != nil {
		return ApplyActionResult{}, domain.ErrInternal
	}
	mutation, err := s.planResolveBlockerMutation(apply, task, fresh, payload, canonical)
	if err != nil {
		return ApplyActionResult{}, err
	}
	commit := domain.ActionCommit{Operation: operation, Payload: canonical, PayloadDigest: digest, PreparedAt: mutation.Task.LastOperation.CommittedAt}
	if workflow.ValidateActionCommit(task, commit) != nil {
		return ApplyActionResult{}, domain.ErrInternal
	}
	if err := operationStore.StageActionOperation(ctx, task, commit); err != nil {
		return ApplyActionResult{}, mapStoreError(err)
	}
	if err := operationStore.CommitActionOperation(ctx, operation.OperationID, mutation); err != nil {
		return ApplyActionResult{}, mapStoreError(err)
	}
	return ApplyActionResult{Task: mutation.Task}, nil
}

func applyRequestFromCommit(host domain.Host, taskID domain.ID, commit domain.ActionCommit) ApplyActionRequest {
	operation := commit.Operation
	return ApplyActionRequest{
		RequestID: operation.OperationID, Host: host, TaskID: taskID, ExpectedRevision: operation.ExpectedRevision,
		ActionID: operation.ActionID, ActionKind: operation.ActionKind, ProcessID: operation.Process.ID,
		ProcessDefinitionDigest: operation.Process.DefinitionDigest, SourceCursor: operation.SourceCursor,
		RepositoryBindingDigest: operation.RepositoryBindingDigest, IssuanceIdentityDigest: operation.IssuanceIdentityDigest,
		IssuanceHistoryDigest: operation.IssuanceHistoryDigest, IssuanceContentDigest: operation.IssuanceContentDigest, Payload: commit.Payload,
	}
}

func (s *Service) commitStandardActionOperation(ctx context.Context, operationStore store.ActionOperationStore, apply ApplyActionRequest, task domain.ProcessTask, fresh recovery.RepositoryScopeObservation, comparison recovery.RepositoryScopeComparison) (ApplyActionResult, error) {
	mutation, err := s.planStandardMutation(apply, task, fresh, comparison)
	if err != nil {
		return ApplyActionResult{}, err
	}
	if err := operationStore.CommitActionOperation(ctx, apply.RequestID, mutation); err != nil {
		return ApplyActionResult{}, mapStoreError(err)
	}
	return ApplyActionResult{Task: mutation.Task}, nil
}
