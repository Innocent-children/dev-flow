package application

import (
	"context"
	"encoding/json"

	"github.com/Innocent-children/dev-flow/internal/domain"
	"github.com/Innocent-children/dev-flow/internal/recovery"
)

type SubmitControlCenterActionRequest struct {
	RequestID               domain.ID
	TaskID                  domain.ID
	ExpectedRevision        uint64
	ActionID                domain.ID
	ActionKind              domain.ActionKind
	ProcessID               domain.ProcessID
	ProcessDefinitionDigest domain.Digest
	SourceNode              domain.NodeID
	RepositoryBindingDigest domain.Digest
	IssuanceIdentityDigest  domain.Digest
	IssuanceHistoryDigest   domain.Digest
	IssuanceContentDigest   domain.Digest
	Payload                 json.RawMessage
}

type AssessControlCenterRecoveryRequest struct {
	TaskID    domain.ID
	Operation OperationProbe
}

type ApplyControlCenterRecoveryRequest struct {
	TaskID         domain.ID
	Operation      OperationProbe
	RecoveryAction recovery.RecoveryAdvice
}

type ControlCenterActionResult struct {
	Task       domain.ProcessTask
	Assessment *recovery.RecoveryAssessment
	Committed  bool
}

func (c *ControlCenter) SubmitCurrentAction(ctx context.Context, request SubmitControlCenterActionRequest) (ControlCenterActionResult, error) {
	if !c.valid() || ctx == nil {
		return ControlCenterActionResult{}, domain.ErrInvalidArgument
	}
	host, err := c.controlCenterTaskHost(ctx, request.TaskID)
	if err != nil {
		return ControlCenterActionResult{}, err
	}
	result, err := c.core.ApplyAction(ctx, ApplyActionRequest{
		RequestID: request.RequestID, Host: host, TaskID: request.TaskID, ExpectedRevision: request.ExpectedRevision,
		ActionID: request.ActionID, ActionKind: request.ActionKind, ProcessID: request.ProcessID,
		ProcessDefinitionDigest: request.ProcessDefinitionDigest, SourceCursor: request.SourceNode,
		RepositoryBindingDigest: request.RepositoryBindingDigest, IssuanceIdentityDigest: request.IssuanceIdentityDigest,
		IssuanceHistoryDigest: request.IssuanceHistoryDigest, IssuanceContentDigest: request.IssuanceContentDigest, Payload: append([]byte(nil), request.Payload...),
	})
	if err != nil {
		return ControlCenterActionResult{}, err
	}
	return ControlCenterActionResult{Task: result.Task, Committed: true}, nil
}

func (c *ControlCenter) AssessTaskOperation(ctx context.Context, request AssessControlCenterRecoveryRequest) (ControlCenterActionResult, error) {
	if !c.valid() || ctx == nil {
		return ControlCenterActionResult{}, domain.ErrInvalidArgument
	}
	host, err := c.controlCenterTaskHost(ctx, request.TaskID)
	if err != nil {
		return ControlCenterActionResult{}, err
	}
	probe := cloneOperationProbe(request.Operation)
	result, err := c.core.GetTask(ctx, GetTaskRequest{Host: host, TaskID: request.TaskID, OperationProbe: &probe})
	if err != nil {
		return ControlCenterActionResult{}, err
	}
	if result.RecoveryAssessment == nil {
		return ControlCenterActionResult{}, domain.ErrRecoveryUnavailable
	}
	return ControlCenterActionResult{Task: result.Task, Assessment: result.RecoveryAssessment}, nil
}

func (c *ControlCenter) ApplyTaskRecovery(ctx context.Context, request ApplyControlCenterRecoveryRequest) (ControlCenterActionResult, error) {
	assessed, err := c.AssessTaskOperation(ctx, AssessControlCenterRecoveryRequest{TaskID: request.TaskID, Operation: request.Operation})
	if err != nil {
		return ControlCenterActionResult{}, err
	}
	if assessed.Assessment.NextAdvice != request.RecoveryAction {
		return ControlCenterActionResult{}, domain.ErrRecoveryUnavailable
	}
	switch request.RecoveryAction {
	case recovery.AdviceReadNextAction, recovery.AdviceResolveBlocker, recovery.AdviceStopForRepositoryDrift:
		return assessed, nil
	case recovery.AdviceRetryCurrentAction, recovery.AdviceSubmitRecoveryApply:
	default:
		return ControlCenterActionResult{}, domain.ErrRecoveryUnavailable
	}
	host, err := c.controlCenterTaskHost(ctx, request.TaskID)
	if err != nil {
		return ControlCenterActionResult{}, err
	}
	operation := request.Operation
	apply := ApplyActionRequest{
		RequestID: operation.OperationID, Host: host, TaskID: request.TaskID, ExpectedRevision: operation.ExpectedRevision,
		ActionID: operation.ActionID, ActionKind: operation.ActionKind, ProcessID: operation.ProcessID,
		ProcessDefinitionDigest: operation.ProcessDefinitionDigest, SourceCursor: operation.SourceCursor,
		RepositoryBindingDigest: operation.RepositoryBindingDigest, IssuanceIdentityDigest: operation.IssuanceIdentityDigest,
		IssuanceHistoryDigest: operation.IssuanceHistoryDigest, IssuanceContentDigest: operation.IssuanceContentDigest, Payload: append([]byte(nil), operation.Payload...),
	}
	if request.RecoveryAction == recovery.AdviceSubmitRecoveryApply {
		apply.RecoveryApply = &RecoveryApplyInput{OperationID: operation.OperationID, SourceCursor: operation.SourceCursor}
	}
	result, err := c.core.ApplyAction(ctx, apply)
	if err != nil {
		return ControlCenterActionResult{}, err
	}
	return ControlCenterActionResult{Task: result.Task, Assessment: assessed.Assessment, Committed: result.Task.Revision != assessed.Task.Revision}, nil
}

func (c *ControlCenter) controlCenterTaskHost(ctx context.Context, taskID domain.ID) (domain.Host, error) {
	if !taskID.IsValid() {
		return "", domain.ErrInvalidArgument
	}
	stored, err := c.tasks.LoadControlCenterTask(ctx, taskID)
	if err != nil {
		return "", mapStoreError(err)
	}
	if !stored.Task.OriginHost.IsValid() {
		return "", domain.ErrInternal
	}
	return stored.Task.OriginHost, nil
}

func cloneOperationProbe(probe OperationProbe) OperationProbe {
	probe.Payload = append([]byte(nil), probe.Payload...)
	return probe
}
