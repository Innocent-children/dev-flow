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
	task, err := s.loadOwned(ctx, r.Host, r.TaskID)
	if err == nil {
		err = validateProbe(task, r.OperationProbe)
	}
	return GetTaskResult{Task: task}, err
}
func validateProbe(task domain.ProcessTask, p *OperationProbe) error {
	if p == nil {
		return nil
	}
	if !p.OperationID.IsValid() || p.ProcessID != task.Process.ID || p.ProcessVersion != task.Process.Version || p.ProcessDefinitionDigest != task.Process.DefinitionDigest || !p.SourceCursor.IsValid() || p.ExpectedRevision == 0 || !p.ActionID.IsValid() || !p.ActionKind.IsValidV2() || !p.RepositoryBindingDigest.IsValid() {
		return domain.ErrInvalidArgument
	}
	if len(p.Payload) != 0 && string(p.Payload) != "null" {
		if _, _, err := workflow.DecodeStandardPayload(p.SourceCursor, p.Payload); err != nil {
			return domain.ErrInvalidArgument
		}
	}
	return nil
}
