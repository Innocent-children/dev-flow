package application

import (
	"context"

	"github.com/Innocent-children/dev-flow/internal/domain"
)

func (s *Service) GetNextAction(ctx context.Context, r GetNextActionRequest) (NextActionResult, error) {
	if !s.valid() || ctx == nil || !r.Host.IsValid() || !r.TaskID.IsValid() {
		return NextActionResult{}, domain.ErrInvalidArgument
	}
	if r.OperationProbe != nil {
		if err := validateProbeInput(r.OperationProbe); err != nil {
			return NextActionResult{}, err
		}
		return NextActionResult{}, domain.ErrRecoveryUnavailable
	}
	task, err := s.loadOwned(ctx, r.Host, r.TaskID)
	if err != nil {
		return NextActionResult{}, err
	}
	result := NextActionResult{TaskID: task.TaskID, Process: task.Process, CurrentNode: task.CurrentNode, Revision: task.Revision, MethodProfile: task.Intent.MethodProfile, Action: task.CurrentAction, Outcome: task.Outcome}
	return result, nil
}
