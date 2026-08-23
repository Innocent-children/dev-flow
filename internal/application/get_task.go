package application

import (
	"bytes"
	"context"

	"github.com/Innocent-children/dev-flow/internal/domain"
	"github.com/Innocent-children/dev-flow/internal/recovery"
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
	return GetTaskResult{Task: task}, err
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
