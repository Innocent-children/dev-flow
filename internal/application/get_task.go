package application

import (
	"bytes"
	"context"

	"github.com/Innocent-children/dev-flow/internal/domain"
	"github.com/Innocent-children/dev-flow/internal/recovery"
	"github.com/Innocent-children/dev-flow/internal/store"
	"github.com/Innocent-children/dev-flow/internal/workflow"
)

func (s *Service) GetTask(ctx context.Context, r GetTaskRequest) (GetTaskResult, error) {
	if !s.valid() || ctx == nil || !r.Host.IsValid() || !r.TaskID.IsValid() {
		return GetTaskResult{}, domain.ErrInvalidArgument
	}
	if r.OperationProbe != nil {
		if err := validateProbeInput(r.OperationProbe); err != nil {
			return GetTaskResult{}, err
		}
		task, err := s.loadOwned(ctx, r.Host, r.TaskID)
		if err != nil {
			return GetTaskResult{}, err
		}
		fresh, err := s.observeTaskRepositories(ctx, task)
		if err != nil {
			return GetTaskResult{}, err
		}
		decision, err := recovery.Reconcile(recovery.ReconcileInput{Host: r.Host, Task: task, Operation: r.OperationProbe.Reference(), Payload: r.OperationProbe.Payload, ObservedScope: &fresh})
		if err != nil {
			return GetTaskResult{}, err
		}
		return GetTaskResult{Task: task, RecoveryAssessment: &decision.Assessment}, nil
	}
	task, err := s.loadOwned(ctx, r.Host, r.TaskID)
	if err != nil {
		return GetTaskResult{}, err
	}
	operationStore, ok := s.taskStore.(store.ActionOperationStore)
	if !ok {
		return GetTaskResult{Task: task}, nil
	}
	operation, found, err := operationStore.LoadActionOperation(ctx, task.TaskID)
	if err != nil {
		return GetTaskResult{}, mapStoreError(err)
	}
	if !found || workflow.ValidateActionCommit(task, operation.Commit) != nil {
		if found {
			return GetTaskResult{}, domain.ErrStorageUnavailable
		}
		return GetTaskResult{Task: task}, nil
	}
	if operation.RecordedBy(task) {
		assessment, err := assessRecordedActionCommit(r.Host, task, operation.Commit)
		if err != nil {
			return GetTaskResult{}, err
		}
		return GetTaskResult{Task: task, RecoveryAssessment: assessment}, nil
	}
	if task.CurrentNode == domain.NodeBlocked && task.Blocker != nil &&
		task.Blocker.Cause == domain.BlockerCauseTaskRelocationPending &&
		operation.AppliedRevision == nil && operation.Commit.Operation.SourceCursor == domain.NodeBlocked {
		assessment, err := s.assessTaskRelocationCommit(ctx, r.Host, task, operation.Commit)
		if err != nil {
			return GetTaskResult{}, err
		}
		return GetTaskResult{Task: task, RecoveryAssessment: assessment}, nil
	}
	assessment, err := s.assessActionCommit(ctx, r.Host, task, operation.Commit)
	if err != nil {
		return GetTaskResult{}, err
	}
	return GetTaskResult{Task: task, RecoveryAssessment: assessment}, nil
}

func assessRecordedActionCommit(host domain.Host, task domain.ProcessTask, commit domain.ActionCommit) (*recovery.RecoveryAssessment, error) {
	additional := make([]domain.RepositoryScopeEntry, len(task.AdditionalRepositories))
	for index, repository := range task.AdditionalRepositories {
		additional[index] = repository.Clone()
	}
	observed := recovery.RepositoryScopeObservation{
		Primary:    task.Repository.Clone(),
		Additional: additional,
	}
	decision, err := recovery.Reconcile(recovery.ReconcileInput{
		Host:          host,
		Task:          task,
		Operation:     commit.Operation,
		Payload:       commit.Payload,
		ObservedScope: &observed,
	})
	if err != nil || decision.Assessment.Classification != domain.RecoveryCompletedAndRecorded {
		return nil, domain.ErrStorageUnavailable
	}
	return &decision.Assessment, nil
}

func (s *Service) assessActionCommit(ctx context.Context, host domain.Host, task domain.ProcessTask, commit domain.ActionCommit) (*recovery.RecoveryAssessment, error) {
	fresh, err := s.observeTaskRepositories(ctx, task)
	if err != nil {
		return nil, err
	}
	decision, err := recovery.Reconcile(recovery.ReconcileInput{Host: host, Task: task, Operation: commit.Operation, Payload: commit.Payload, ObservedScope: &fresh})
	if err != nil {
		return nil, err
	}
	return &decision.Assessment, nil
}
func validateProbeInput(p *OperationProbe) error {
	if p == nil || len(p.Payload) == 0 || workflow.ValidateOperationReference(p.Reference()) != nil {
		return domain.ErrInvalidArgument
	}
	if !bytes.Equal(bytes.TrimSpace(p.Payload), []byte("null")) {
		if p.SourceCursor == domain.NodeBlocked {
			if _, _, err := recovery.DecodeBlockerResolutionPayload(p.Payload); err != nil {
				return domain.ErrInvalidArgument
			}
			return nil
		}
		if err := workflow.ValidateRetainedPayload(p.SourceCursor, p.Payload); err != nil {
			return domain.ErrInvalidArgument
		}
	}
	return nil
}
