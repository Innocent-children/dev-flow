package application

import (
	"context"
	"github.com/Innocent-children/dev-flow/internal/domain"
)

func (s *Service) GetTask(ctx context.Context, r GetTaskRequest) (GetTaskResult, error) {
	if !s.valid() || ctx == nil || !r.Host.IsValid() || !r.TaskID.IsValid() {
		return GetTaskResult{}, domain.ErrInvalidArgument
	}
	task, err := s.loadOwned(ctx, r.Host, r.TaskID)
	return GetTaskResult{Task: task}, err
}
