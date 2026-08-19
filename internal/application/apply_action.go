package application

import (
	"context"
	"encoding/json"

	"github.com/Innocent-children/dev-flow/internal/domain"
	"github.com/Innocent-children/dev-flow/internal/recovery"
	"github.com/Innocent-children/dev-flow/internal/store"
	"github.com/Innocent-children/dev-flow/internal/workflow"
)

func (s *Service) ApplyAction(ctx context.Context, r ApplyActionRequest) (ApplyActionResult, error) {
	task, err := s.loadOwned(ctx, r.Host, r.TaskID)
	if err != nil {
		return ApplyActionResult{}, err
	}
	if task.CurrentNode.Terminal() {
		return ApplyActionResult{}, domain.ErrTaskTerminal
	}
	if task.CurrentNode == domain.NodeBlocked {
		return ApplyActionResult{}, domain.ErrTaskBlocked
	}
	if task.CurrentAction == nil {
		return ApplyActionResult{}, domain.ErrInternal
	}
	if task.Revision != r.ExpectedRevision {
		return ApplyActionResult{}, domain.ErrRevisionConflict
	}
	if r.ProcessID != task.Process.ID || r.ProcessVersion != task.Process.Version || r.ProcessDefinitionDigest != task.Process.DefinitionDigest {
		return ApplyActionResult{}, domain.ErrProcessUnsupported
	}
	if r.SourceCursor != task.CurrentNode || task.CurrentAction.ActionID != r.ActionID || task.CurrentAction.Kind != r.ActionKind || task.Repository.BindingDigest != r.RepositoryBindingDigest {
		return ApplyActionResult{}, domain.ErrActionStale
	}

	envelope, result, err := workflow.DecodeStandardPayload(task.CurrentNode, r.Payload)
	if err != nil {
		return ApplyActionResult{}, domain.ErrInvalidArgument
	}
	definition := workflow.StandardProcess()
	transition, err := workflow.TransitionFor(definition, task.CurrentNode, envelope.TransitionID)
	if err != nil {
		return ApplyActionResult{}, domain.ErrTransitionNotAllowed
	}
	if err := workflow.ValidatePayload(definition, task.CurrentNode, envelope, result, task.CurrentAction.SemanticMethodSteps); err != nil {
		return ApplyActionResult{}, domain.ErrInvalidArgument
	}

	fresh, err := s.repositoryObserver.Observe(ctx, task.Repository.CanonicalRoot)
	if err != nil || fresh.Validate() != nil {
		return ApplyActionResult{}, domain.ErrInternal
	}
	relation, err := recovery.CompareRepositoryBindings(task.Repository, fresh)
	if err != nil {
		return ApplyActionResult{}, domain.ErrInternal
	}
	accepted, err := recovery.BindingAcceptedForAction(task.CurrentAction.Kind, relation)
	if err != nil {
		return ApplyActionResult{}, domain.ErrInternal
	}
	if !accepted {
		return ApplyActionResult{}, domain.ErrRepositoryDrift
	}

	canonicalPayload, err := workflow.CanonicalValidatedPayload(envelope, result)
	if err != nil {
		return ApplyActionResult{}, domain.ErrInternal
	}
	operationDigest, err := digestApplyRequest(r, canonicalPayload)
	if err != nil {
		return ApplyActionResult{}, domain.ErrInternal
	}
	next, err := cloneProcessTask(task)
	if err != nil {
		return ApplyActionResult{}, domain.ErrInternal
	}
	now := s.now().UTC()

	switch value := result.(type) {
	case *workflow.RequirementsResult:
		err = applyRequirementsResult(&next, envelope, value, now)
	case *workflow.DesignResult:
		err = applyDesignResult(&next, transition, envelope, value, now)
	case *workflow.TasksResult:
		err = applyTaskPlanResult(&next, transition, envelope, value, now)
	case *workflow.ImplementationResult:
		err = applyImplementationResult(&next, transition, envelope, value, fresh, relation, now)
	case *workflow.TestResult:
		err = s.applyTestResult(&next, transition, value, now)
	case *workflow.ComprehensionResult:
		err = s.applyComprehensionResult(&next, transition, value, now)
	case *workflow.RefactorResult:
		err = applyRefactorResult(&next, transition, envelope, value, fresh, relation, now)
	case *workflow.DeliveryResult:
		err = applyDeliveryResult(&next, transition, envelope, value, now)
	default:
		err = domain.ErrTransitionNotAllowed
	}
	if err != nil {
		if err == domain.ErrTransitionNotAllowed || err == domain.ErrRepositoryDrift || err == domain.ErrVerificationBudgetExceeded {
			return ApplyActionResult{}, err
		}
		return ApplyActionResult{}, domain.ErrInvalidArgument
	}

	next.CurrentNode = transition.Destination
	next.Revision++
	next.UpdatedAt = now
	claim := store.ClaimRetain
	if next.CurrentNode.Terminal() {
		next.CurrentAction = nil
		claim = store.ClaimRelease
	} else {
		nextID, err := s.id("action")
		if err != nil {
			return ApplyActionResult{}, err
		}
		action, err := workflow.BuildProcessAction(definition, next.CurrentNode, next.TaskID, next.Revision, next.Repository.BindingDigest, next.Intent.MethodProfile, nextID, now)
		if err != nil {
			return ApplyActionResult{}, domain.ErrInternal
		}
		next.CurrentAction = &action
	}
	actionID := r.ActionID
	next.LastOperation = &domain.LastOperation{OperationID: r.RequestID, Kind: domain.OperationApplyAction, ActionID: &actionID, FromRevision: r.ExpectedRevision, ToRevision: next.Revision, PayloadDigest: operationDigest, CommittedAt: now}
	if workflow.ValidateProcessTask(next) != nil {
		return ApplyActionResult{}, domain.ErrInvalidArgument
	}
	eventID, err := s.id("event")
	if err != nil {
		return ApplyActionResult{}, err
	}
	tid := transition.TransitionID
	event := store.TaskEvent{EventID: eventID, TaskID: next.TaskID, Revision: next.Revision, Kind: domain.OperationApplyAction, SourceNode: task.CurrentNode, DestinationNode: next.CurrentNode, TransitionID: &tid, TransitionReason: envelope.Reason, ActionID: &actionID, RequestID: r.RequestID, PayloadDigest: operationDigest, CreatedAt: now}
	if err := s.taskStore.CommitTask(ctx, store.TaskMutation{ExpectedRevision: r.ExpectedRevision, Task: next, Event: event, Claim: claim}); err != nil {
		return ApplyActionResult{}, mapStoreError(err)
	}
	return ApplyActionResult{Task: next}, nil
}

func digestApplyRequest(r ApplyActionRequest, canonicalPayload json.RawMessage) (domain.Digest, error) {
	return digestCanonical(struct {
		Host                    domain.Host       `json:"host"`
		TaskID                  domain.ID         `json:"task_id"`
		ExpectedRevision        uint64            `json:"expected_revision"`
		ActionID                domain.ID         `json:"action_id"`
		ActionKind              domain.ActionKind `json:"action_kind"`
		ProcessID               domain.ProcessID  `json:"process_id"`
		ProcessVersion          uint32            `json:"process_version"`
		ProcessDefinitionDigest domain.Digest     `json:"process_definition_digest"`
		SourceCursor            domain.NodeID     `json:"source_cursor"`
		RepositoryBindingDigest domain.Digest     `json:"repository_binding_digest"`
		Payload                 json.RawMessage   `json:"payload"`
	}{r.Host, r.TaskID, r.ExpectedRevision, r.ActionID, r.ActionKind, r.ProcessID, r.ProcessVersion, r.ProcessDefinitionDigest, r.SourceCursor, r.RepositoryBindingDigest, canonicalPayload})
}

func cloneProcessTask(task domain.ProcessTask) (domain.ProcessTask, error) {
	raw, err := json.Marshal(task)
	if err != nil {
		return domain.ProcessTask{}, err
	}
	var clone domain.ProcessTask
	err = json.Unmarshal(raw, &clone)
	return clone, err
}
