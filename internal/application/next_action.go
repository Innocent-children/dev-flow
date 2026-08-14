package application

import (
	"context"

	"github.com/Innocent-children/dev-flow/internal/domain"
)

// GetNextAction projects the persisted action or terminal outcome without
// deriving a new workflow identity or changing task state.
func (s *Service) GetNextAction(
	ctx context.Context,
	host domain.Host,
	taskID domain.ID,
) (NextActionResult, error) {
	if !s.valid() {
		return NextActionResult{}, domain.ErrInvalidArgument
	}
	if err := validateReadRequest(ctx, host, taskID); err != nil {
		return NextActionResult{}, err
	}
	task, err := s.loadOwnedTask(ctx, host, taskID)
	if err != nil {
		return NextActionResult{}, err
	}
	result := NextActionResult{
		TaskID:   task.TaskID,
		Phase:    task.Phase,
		Revision: task.Revision,
	}
	if task.Phase.Terminal() {
		if task.Outcome == nil {
			return NextActionResult{}, domain.ErrInternal
		}
		outcome := task.Outcome.Clone()
		result.Outcome = &outcome
		return result, nil
	}
	if task.CurrentAction == nil {
		return NextActionResult{}, domain.ErrInternal
	}
	action := task.CurrentAction.Clone()
	result.Action = &action
	return result, nil
}
