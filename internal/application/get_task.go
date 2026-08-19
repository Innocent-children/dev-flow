package application

import (
	"context"
	"github.com/Innocent-children/dev-flow/internal/domain"
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
		return GetTaskResult{}, domain.ErrRecoveryUnavailable
	}
	task, err := s.loadOwned(ctx, r.Host, r.TaskID)
	return GetTaskResult{Task: task}, err
}
func validateProbeInput(p *OperationProbe) error {
	if p == nil || !p.OperationID.IsValid() || !p.ProcessID.IsValid() || p.ProcessVersion != 1 ||
		!p.ProcessDefinitionDigest.IsValid() || !p.SourceCursor.Normal() || p.ExpectedRevision == 0 ||
		!p.ActionID.IsValid() || !p.ActionKind.IsValidV2() || !p.RepositoryBindingDigest.IsValid() || len(p.Payload) == 0 {
		return domain.ErrInvalidArgument
	}
	if string(p.Payload) != "null" {
		if err := workflow.ValidateRetainedPayload(p.SourceCursor, p.Payload); err != nil {
			return domain.ErrInvalidArgument
		}
	}
	return nil
}
