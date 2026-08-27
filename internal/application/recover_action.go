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
	if task.ActionCommit == nil || task.ActionCommit.Operation.ActionID != request.ActionID {
		return ApplyActionResult{}, domain.ErrRecoveryUnavailable
	}
	commit := *task.ActionCommit
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
		return s.applyStandardMutation(ctx, apply, task, fresh, comparison)
	case recovery.DirectiveReturnExistingBlocker:
		return ApplyActionResult{Task: task}, nil
	case recovery.DirectiveCommitRecoveredTransition:
		if commit.Operation.SourceCursor == domain.NodeBlocked {
			payload, canonical, decodeErr := workflow.DecodeBlockerResolutionPayload(commit.Payload)
			if decodeErr != nil {
				return ApplyActionResult{}, domain.ErrInternal
			}
			return s.resolveBlockerMutation(ctx, apply, task, fresh, payload, canonical)
		}
		comparison, comparisonErr := recovery.CompareRepositoryScope(task, fresh)
		if comparisonErr != nil {
			return ApplyActionResult{}, domain.ErrInternal
		}
		return s.applyStandardMutation(ctx, apply, task, fresh, comparison)
	case recovery.DirectiveCreateBlocker:
		return s.createRecoveryBlocker(ctx, apply, task, fresh, decision)
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
	if task.ActionCommit != nil && task.ActionCommit.Operation.ActionID == request.ActionID {
		if actionCommitRecorded(task, *task.ActionCommit) {
			return ApplyActionResult{Task: task}, nil
		}
		return ApplyActionResult{}, domain.ErrRecoveryUnavailable
	}
	if task.CurrentNode != domain.NodeBlocked || task.CurrentAction == nil || task.CurrentAction.ActionID != request.ActionID || task.Blocker == nil {
		return ApplyActionResult{}, domain.ErrActionStale
	}
	fresh, err := s.observeTaskRepositories(ctx, task)
	if err != nil {
		return ApplyActionResult{}, err
	}
	comparison, err := recovery.CompareRepositoryScope(task, fresh)
	if err != nil {
		return ApplyActionResult{}, domain.ErrInternal
	}
	if comparison.Relation != recovery.RepositoryExact {
		return ApplyActionResult{}, repositoryDriftError(comparison)
	}
	payload := domain.BlockerResolutionPayload{BlockerID: task.Blocker.BlockerID, Condition: task.Blocker.Condition, ObservedBindingDigest: comparison.ObservedDigest}
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
	prepared := task
	prepared.ActionCommit = &domain.ActionCommit{Operation: operation, Payload: canonical, PayloadDigest: digest, PreparedAt: s.now().UTC()}
	if workflow.ValidateProcessTask(prepared) != nil {
		return ApplyActionResult{}, domain.ErrInternal
	}
	commitStore, ok := s.taskStore.(store.ActionCommitStore)
	if !ok {
		return ApplyActionResult{}, domain.ErrInternal
	}
	if err := commitStore.StageActionCommit(ctx, prepared); err != nil {
		return ApplyActionResult{}, mapStoreError(err)
	}
	return s.resolveBlockerMutation(ctx, apply, prepared, fresh, payload, canonical)
}

func applyRequestFromCommit(host domain.Host, taskID domain.ID, commit domain.ActionCommit) ApplyActionRequest {
	operation := commit.Operation
	return ApplyActionRequest{
		RequestID: operation.OperationID, Host: host, TaskID: taskID, ExpectedRevision: operation.ExpectedRevision,
		ActionID: operation.ActionID, ActionKind: operation.ActionKind, ProcessID: operation.Process.ID,
		ProcessDefinitionDigest: operation.Process.DefinitionDigest, SourceCursor: operation.SourceCursor,
		RepositoryBindingDigest: operation.RepositoryBindingDigest, Payload: commit.Payload,
	}
}
