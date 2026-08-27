package application

import (
	"context"

	"github.com/Innocent-children/dev-flow/internal/domain"
)

func (s *Service) GetNextAction(ctx context.Context, r GetNextActionRequest) (NextActionResult, error) {
	if !s.valid() || ctx == nil || !r.Host.IsValid() || !r.TaskID.IsValid() {
		return NextActionResult{}, domain.ErrInvalidArgument
	}
	read, err := s.GetTask(ctx, GetTaskRequest{Host: r.Host, TaskID: r.TaskID, OperationProbe: r.OperationProbe})
	if err != nil {
		return NextActionResult{}, err
	}
	task := read.Task
	result := NextActionResult{TaskID: task.TaskID, Process: task.Process, CurrentNode: task.CurrentNode, Revision: task.Revision, MethodProfile: task.Intent.MethodProfile, Action: task.CurrentAction, Outcome: task.Outcome, Blocker: task.Blocker, RecoveryAssessment: read.RecoveryAssessment}
	return result, nil
}
