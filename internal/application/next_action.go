package application

import (
	"context"

	"github.com/Innocent-children/dev-flow/internal/domain"
)

// GetNextAction projects the persisted action, blocker, or terminal outcome.
// It never generates workflow identity and recovery assessment remains read-only.
func (s *Service) GetNextAction(ctx context.Context, request GetNextActionRequest) (NextActionResult, error) {
	if !s.valid() || validateReadRequest(ctx, request.Host, request.TaskID) != nil {
		return NextActionResult{}, domain.ErrInvalidArgument
	}
	task, err := s.loadOwnedTask(ctx, request.Host, request.TaskID)
	if err != nil {
		return NextActionResult{}, err
	}
	assessment, err := s.assessOperationProbe(ctx, request.Host, task, request.OperationProbe)
	if err != nil {
		return NextActionResult{}, err
	}
	result := NextActionResult{
		TaskID: task.TaskID, Phase: task.Phase, Revision: task.Revision,
		RecoveryAssessment: assessment,
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
	if task.Phase == domain.PhaseBlocked {
		if task.Blocker == nil {
			return NextActionResult{}, domain.ErrInternal
		}
		blocker := *task.Blocker
		result.Blocker = &blocker
	}
	return result, nil
}
