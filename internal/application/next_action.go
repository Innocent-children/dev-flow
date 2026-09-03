package application

import (
	"context"

	"github.com/Innocent-children/dev-flow/internal/domain"
	"github.com/Innocent-children/dev-flow/internal/recovery"
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
	if read.RecoveryAssessment != nil && read.RecoveryAssessment.Classification != domain.RecoveryCompletedAndRecorded {
		return nextActionResult(task, read.RecoveryAssessment), nil
	}
	originalRevision := task.Revision
	if !task.CurrentNode.Terminal() {
		requestID, idErr := s.id("workspace")
		if idErr != nil {
			return NextActionResult{}, idErr
		}
		task, err = s.guardTaskWorkspace(ctx, task, requestID)
		if err != nil {
			return NextActionResult{}, err
		}
	}
	assessment := read.RecoveryAssessment
	if task.Revision != originalRevision {
		assessment = nil
	}
	return nextActionResult(task, assessment), nil
}

func nextActionResult(task domain.ProcessTask, assessment *recovery.RecoveryAssessment) NextActionResult {
	return NextActionResult{
		TaskID:             task.TaskID,
		Process:            task.Process,
		CurrentNode:        task.CurrentNode,
		Revision:           task.Revision,
		MethodProfile:      task.Intent.MethodProfile,
		Action:             task.CurrentAction,
		Outcome:            task.Outcome,
		Blocker:            task.Blocker,
		RecoveryAssessment: assessment,
	}
}
