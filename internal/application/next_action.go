package application

import "context"

func (s *Service) GetNextAction(ctx context.Context, r GetNextActionRequest) (NextActionResult, error) {
	task, err := s.loadOwned(ctx, r.Host, r.TaskID)
	if err != nil {
		return NextActionResult{}, err
	}
	if err := validateProbe(task, r.OperationProbe); err != nil {
		return NextActionResult{}, err
	}
	result := NextActionResult{TaskID: task.TaskID, Process: task.Process, CurrentNode: task.CurrentNode, Revision: task.Revision, Action: task.CurrentAction, Outcome: task.Outcome}
	return result, nil
}
