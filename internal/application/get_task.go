package application

import (
	"context"

	"github.com/Innocent-children/dev-flow/internal/domain"
)

// GetTask returns the authoritative persisted task without observing or
// mutating repository or task state.
func (s *Service) GetTask(
	ctx context.Context,
	host domain.Host,
	taskID domain.ID,
) (domain.Task, error) {
	if !s.valid() {
		return domain.Task{}, domain.ErrInvalidArgument
	}
	if err := validateReadRequest(ctx, host, taskID); err != nil {
		return domain.Task{}, err
	}
	task, err := s.loadOwnedTask(ctx, host, taskID)
	if err != nil {
		return domain.Task{}, err
	}
	return task.Clone(), nil
}
