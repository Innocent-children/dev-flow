package application

import (
	"context"
	"errors"
	"math"

	"github.com/Innocent-children/dev-flow/internal/domain"
	"github.com/Innocent-children/dev-flow/internal/recovery"
	"github.com/Innocent-children/dev-flow/internal/workflow"
)

// GetTask returns the authoritative persisted task and, only when requested,
// a transient recovery assessment derived from one fresh repository read.
func (s *Service) GetTask(ctx context.Context, request GetTaskRequest) (GetTaskResult, error) {
	if !s.valid() || validateReadRequest(ctx, request.Host, request.TaskID) != nil {
		return GetTaskResult{}, domain.ErrInvalidArgument
	}
	task, err := s.loadOwnedTask(ctx, request.Host, request.TaskID)
	if err != nil {
		return GetTaskResult{}, err
	}
	assessment, err := s.assessOperationProbe(ctx, request.Host, task, request.OperationProbe)
	if err != nil {
		return GetTaskResult{}, err
	}
	return GetTaskResult{Task: task.Clone(), RecoveryAssessment: assessment}, nil
}

func (s *Service) assessOperationProbe(
	ctx context.Context,
	host domain.Host,
	task domain.Task,
	probe *OperationProbe,
) (*recovery.RecoveryAssessment, error) {
	if probe == nil {
		return nil, nil
	}
	operation := recovery.OperationReference{
		OperationID:      probe.OperationID,
		SourcePhase:      probe.SourcePhase,
		ExpectedRevision: probe.ExpectedRevision,
		ActionID:         probe.ActionID,
		ActionKind:       probe.ActionKind,
	}
	if operation.Validate() != nil || probe.ExpectedRevision == math.MaxUint64 ||
		!probe.RepositoryBindingDigest.IsValid() {
		return nil, domain.ErrInvalidArgument
	}
	expectedAction, ok := workflow.ActionForPhase(probe.SourcePhase)
	if !ok || expectedAction != probe.ActionKind {
		return nil, domain.ErrInvalidArgument
	}

	canonicalPayload := []byte("null")
	var validatedPayload *workflow.ValidatedPayload
	if probe.Payload != nil {
		if nilActionPayload(probe.Payload) {
			return nil, domain.ErrInvalidArgument
		}
		validated, err := workflow.ValidatePayload(probe.SourcePhase, probe.ActionKind, probe.Payload)
		if err != nil {
			return nil, domain.ErrInvalidArgument
		}
		canonicalPayload = validated.CanonicalBytes
		validatedPayload = &validated
	}
	payloadDigest, err := digestApplyActionPayload(ApplyActionRequest{
		Host:                    host,
		TaskID:                  task.TaskID,
		ExpectedRevision:        probe.ExpectedRevision,
		ActionID:                probe.ActionID,
		ActionKind:              probe.ActionKind,
		RepositoryBindingDigest: probe.RepositoryBindingDigest,
	}, probe.SourcePhase, canonicalPayload)
	if err != nil {
		return nil, domain.ErrInternal
	}
	fresh, err := s.repositoryObserver.Observe(ctx, task.Repository.CanonicalRoot)
	if err != nil {
		return nil, mapRepositoryError(ctx, err)
	}
	if err := validateFreshBinding(fresh); err != nil {
		return nil, err
	}
	decision, err := recovery.Reconcile(recovery.ReconcileInput{
		Task:                   task,
		Operation:              operation,
		IssuanceBindingDigest:  probe.RepositoryBindingDigest,
		OperationPayloadDigest: payloadDigest,
		Payload:                validatedPayload,
		FreshBinding:           fresh,
	})
	if err != nil {
		if errors.Is(err, domain.ErrInvalidArgument) {
			return nil, domain.ErrInvalidArgument
		}
		return nil, domain.ErrInternal
	}
	assessment := decision.Assessment
	return &assessment, nil
}
