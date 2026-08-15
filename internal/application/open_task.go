package application

import (
	"context"
	"errors"

	"github.com/Innocent-children/dev-flow/internal/domain"
	"github.com/Innocent-children/dev-flow/internal/store"
	"github.com/Innocent-children/dev-flow/internal/workflow"
)

type openTaskContractPayload struct {
	Goal               string                    `json:"goal"`
	Scope              []string                  `json:"scope"`
	OutOfScope         []string                  `json:"out_of_scope"`
	AcceptanceCriteria []string                  `json:"acceptance_criteria"`
	VerificationBudget domain.VerificationBudget `json:"verification_budget"`
}

type openTaskPayload struct {
	Host               domain.Host             `json:"host"`
	RepositoryIdentity domain.Digest           `json:"repository_identity"`
	Contract           openTaskContractPayload `json:"contract"`
}

// OpenTask creates the sole active task for an observed repository or resumes
// its persisted same-host task without regenerating workflow identity.
func (s *Service) OpenTask(
	ctx context.Context,
	request OpenTaskRequest,
) (OpenTaskResult, error) {
	contract, err := s.validateOpenTaskRequest(ctx, request)
	if err != nil {
		return OpenTaskResult{}, err
	}

	binding, err := s.repositoryObserver.Observe(ctx, request.RepositoryPath)
	if err != nil {
		return OpenTaskResult{}, mapRepositoryError(ctx, err)
	}
	if binding.Validate() != nil {
		return OpenTaskResult{}, domain.ErrInternal
	}

	active, err := s.taskStore.LoadActiveTask(ctx, binding.RepositoryIdentity)
	switch {
	case err == nil:
		return reconcileActiveTask(active, request.Host, contract)
	case errors.Is(err, store.ErrTaskNotFound):
		if contract == nil {
			return OpenTaskResult{}, domain.ErrInvalidArgument
		}
	case err != nil:
		return OpenTaskResult{}, mapStoreError(ctx, err)
	}

	return s.createTask(ctx, request, *contract, binding)
}

func (s *Service) validateOpenTaskRequest(
	ctx context.Context,
	request OpenTaskRequest,
) (*domain.Contract, error) {
	if !s.valid() || ctx == nil || !request.RequestID.IsValid() || !request.Host.IsValid() {
		return nil, domain.ErrInvalidArgument
	}
	if request.NewTask == nil {
		return nil, nil
	}
	input := request.NewTask
	contract, err := domain.NewContract(
		input.Goal,
		input.Scope,
		input.OutOfScope,
		input.AcceptanceCriteria,
		input.VerificationBudget,
	)
	if err != nil {
		return nil, domain.ErrInvalidArgument
	}
	return &contract, nil
}

func reconcileActiveTask(
	task domain.Task,
	host domain.Host,
	contract *domain.Contract,
) (OpenTaskResult, error) {
	if task.OriginHost != host {
		return OpenTaskResult{}, domain.ErrHostOwnershipConflict
	}
	if workflow.ValidateTask(task) != nil {
		return OpenTaskResult{}, domain.ErrInternal
	}
	if contract != nil && !task.Contract.Equal(*contract) {
		return OpenTaskResult{}, domain.ErrActiveTaskConflict
	}
	return OpenTaskResult{Created: false, Task: task.Clone()}, nil
}

func (s *Service) createTask(
	ctx context.Context,
	request OpenTaskRequest,
	contract domain.Contract,
	binding domain.RepositoryBinding,
) (OpenTaskResult, error) {
	taskID, err := s.generateID("task")
	if err != nil {
		return OpenTaskResult{}, err
	}
	actionID, err := s.generateID("action")
	if err != nil {
		return OpenTaskResult{}, err
	}
	eventID, err := s.generateID("event")
	if err != nil {
		return OpenTaskResult{}, err
	}
	now := s.now().UTC()
	payloadDigest, err := digestOpenTaskPayload(request.Host, binding.RepositoryIdentity, contract)
	if err != nil {
		return OpenTaskResult{}, domain.ErrInternal
	}
	action, err := workflow.BuildNextAction(
		domain.PhaseIntake,
		taskID,
		1,
		binding.BindingDigest,
		actionID,
		now,
	)
	if err != nil {
		return OpenTaskResult{}, domain.ErrInternal
	}
	operation := domain.LastOperation{
		OperationID:   request.RequestID,
		Kind:          domain.OperationOpenTask,
		ActionID:      nil,
		FromRevision:  0,
		ToRevision:    1,
		PayloadDigest: payloadDigest,
		CommittedAt:   now,
	}
	task := domain.Task{
		TaskID:        taskID,
		OriginHost:    request.Host,
		Contract:      contract,
		Repository:    binding.Clone(),
		Phase:         domain.PhaseIntake,
		CurrentAction: &action,
		LastOperation: &operation,
		Evidence:      []domain.EvidenceSummary{},
		Revision:      1,
		CreatedAt:     now,
		UpdatedAt:     now,
	}
	event := store.TaskEvent{
		EventID:       eventID,
		TaskID:        taskID,
		Revision:      1,
		Kind:          domain.OperationOpenTask,
		PhaseBefore:   domain.PhaseIntake,
		PhaseAfter:    domain.PhaseIntake,
		ActionID:      nil,
		RequestID:     request.RequestID,
		PayloadDigest: payloadDigest,
		CreatedAt:     now,
	}
	if workflow.ValidateTask(task) != nil {
		return OpenTaskResult{}, domain.ErrInternal
	}
	mutation := store.TaskMutation{
		ExpectedRevision: 0,
		Task:             task,
		Event:            event,
		Claim:            store.ClaimAcquire,
	}
	if err := s.taskStore.CommitTask(ctx, mutation); err != nil {
		if errors.Is(err, store.ErrActiveTaskConflict) {
			winner, loadErr := s.taskStore.LoadActiveTask(ctx, binding.RepositoryIdentity)
			if loadErr != nil {
				if contextErr := contextFailure(ctx, loadErr); contextErr != nil {
					return OpenTaskResult{}, contextErr
				}
				if errors.Is(loadErr, store.ErrSchemaUnsupported) {
					return OpenTaskResult{}, domain.ErrSchemaUnsupported
				}
				return OpenTaskResult{}, domain.ErrStorageUnavailable
			}
			return reconcileActiveTask(winner, request.Host, &contract)
		}
		return OpenTaskResult{}, mapStoreError(ctx, err)
	}
	return OpenTaskResult{Created: true, Task: task.Clone()}, nil
}

func digestOpenTaskPayload(
	host domain.Host,
	repositoryIdentity domain.Digest,
	contract domain.Contract,
) (domain.Digest, error) {
	payload := openTaskPayload{
		Host:               host,
		RepositoryIdentity: repositoryIdentity,
		Contract: openTaskContractPayload{
			Goal:               contract.Goal(),
			Scope:              contract.Scope(),
			OutOfScope:         contract.OutOfScope(),
			AcceptanceCriteria: contract.AcceptanceCriteria(),
			VerificationBudget: contract.VerificationBudget(),
		},
	}
	return digestCanonical(payload)
}
