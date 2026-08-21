package application

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"

	"github.com/Innocent-children/dev-flow/internal/domain"
	"github.com/Innocent-children/dev-flow/internal/recovery"
	"github.com/Innocent-children/dev-flow/internal/store"
	"github.com/Innocent-children/dev-flow/internal/workflow"
)

func (s *Service) ApplyAction(ctx context.Context, r ApplyActionRequest) (ApplyActionResult, error) {
	operation := operationFromApply(r)
	if !s.valid() || ctx == nil || !r.RequestID.IsValid() || !r.Host.IsValid() || !r.TaskID.IsValid() ||
		!validApplyIdentity(operation) || len(r.Payload) == 0 || !json.Valid(r.Payload) {
		return ApplyActionResult{}, domain.ErrInvalidArgument
	}
	if r.RecoveryApply != nil {
		if r.RecoveryApply.OperationID != r.RequestID || r.RecoveryApply.SourceCursor != r.SourceCursor {
			return ApplyActionResult{}, domain.ErrInvalidArgument
		}
		if workflow.ValidateOperationReference(operation) != nil {
			return ApplyActionResult{}, domain.ErrInvalidArgument
		}
		if err := validateRecoveryPayload(r.SourceCursor, r.Payload); err != nil {
			return ApplyActionResult{}, err
		}
		task, err := s.loadOwned(ctx, r.Host, r.TaskID)
		if err != nil {
			return ApplyActionResult{}, err
		}
		fresh, err := s.observeTaskRepository(ctx, task)
		if err != nil {
			return ApplyActionResult{}, err
		}
		decision, err := recovery.Reconcile(recovery.ReconcileInput{Host: r.Host, Task: task, Operation: operation, Payload: r.Payload, Observed: fresh})
		if err != nil {
			return ApplyActionResult{}, err
		}
		switch decision.Directive {
		case recovery.DirectiveNoWrite, recovery.DirectiveReturnExistingBlocker:
			return ApplyActionResult{Task: task}, nil
		case recovery.DirectiveCommitRecoveredTransition:
			if task.CurrentNode == domain.NodeBlocked && r.SourceCursor == domain.NodeBlocked {
				payload, canonical, decodeErr := recovery.DecodeBlockerResolutionPayload(r.Payload)
				if decodeErr != nil {
					return ApplyActionResult{}, decodeErr
				}
				return s.resolveBlockerMutation(ctx, r, task, fresh, payload, canonical)
			}
			relation, _ := recovery.CompareRepositoryBindings(task.Repository, fresh)
			return s.applyStandardMutation(ctx, r, task, fresh, relation)
		case recovery.DirectiveCreateBlocker:
			return s.createRecoveryBlocker(ctx, r, task, fresh, decision)
		case recovery.DirectiveRevisionConflict:
			return ApplyActionResult{}, domain.ErrRevisionConflict
		case recovery.DirectiveActionStale:
			return ApplyActionResult{}, domain.ErrActionStale
		default:
			return ApplyActionResult{}, domain.ErrInternal
		}
	}
	if bytes.Equal(bytes.TrimSpace(r.Payload), []byte("null")) {
		return ApplyActionResult{}, domain.ErrInvalidArgument
	}
	task, err := s.loadOwned(ctx, r.Host, r.TaskID)
	if err != nil {
		return ApplyActionResult{}, err
	}
	if task.CurrentNode.Terminal() {
		return ApplyActionResult{}, domain.ErrTaskTerminal
	}
	if task.CurrentNode == domain.NodeBlocked {
		return s.resolveBlocker(ctx, r, task)
	}
	if err := validateStandardRequestAgainstTask(r, task); err != nil {
		return ApplyActionResult{}, err
	}
	fresh, err := s.observeTaskRepository(ctx, task)
	if err != nil {
		return ApplyActionResult{}, err
	}
	relation, err := recovery.CompareRepositoryBindings(task.Repository, fresh)
	if err != nil {
		return ApplyActionResult{}, domain.ErrInternal
	}
	if _, err := validatedRepositoryEffect(task.CurrentNode, r.Payload, relation, fresh); err != nil {
		return ApplyActionResult{}, domain.ErrRepositoryDrift
	}
	return s.applyStandardMutation(ctx, r, task, fresh, relation)
}

func validateStandardRequestAgainstTask(r ApplyActionRequest, task domain.ProcessTask) error {
	if task.CurrentAction == nil || task.Revision != r.ExpectedRevision {
		return domain.ErrRevisionConflict
	}
	if r.ProcessID != task.Process.ID || r.ProcessDefinitionDigest != task.Process.DefinitionDigest {
		return domain.ErrProcessUnsupported
	}
	if r.SourceCursor != task.CurrentNode || task.CurrentAction.ActionID != r.ActionID || task.CurrentAction.Kind != r.ActionKind || task.Repository.BindingDigest != r.RepositoryBindingDigest {
		return domain.ErrActionStale
	}
	envelope, result, err := workflow.DecodeStandardPayload(task.CurrentNode, r.Payload)
	if err != nil {
		return domain.ErrInvalidArgument
	}
	if _, err := workflow.TransitionFor(workflow.StandardProcess(), task.CurrentNode, envelope.TransitionID); err != nil {
		return domain.ErrTransitionNotAllowed
	}
	if err := workflow.ValidatePayload(workflow.StandardProcess(), task.CurrentNode, envelope, result, task.CurrentAction.SemanticMethodSteps); err != nil {
		if errors.Is(err, domain.ErrTransitionNotAllowed) {
			return domain.ErrTransitionNotAllowed
		}
		return domain.ErrInvalidArgument
	}
	return nil
}

func (s *Service) applyStandardMutation(ctx context.Context, r ApplyActionRequest, task domain.ProcessTask, fresh domain.RepositoryBinding, relation recovery.RepositoryRelation) (ApplyActionResult, error) {
	if task.CurrentAction == nil || task.Revision != r.ExpectedRevision {
		return ApplyActionResult{}, domain.ErrRevisionConflict
	}
	if r.ProcessID != task.Process.ID || r.ProcessDefinitionDigest != task.Process.DefinitionDigest {
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
		if errors.Is(err, domain.ErrTransitionNotAllowed) {
			return ApplyActionResult{}, domain.ErrTransitionNotAllowed
		}
		return ApplyActionResult{}, domain.ErrInvalidArgument
	}
	effect, err := recovery.DeriveRepositoryEffect(task.CurrentNode, envelope, result)
	if err != nil || !recovery.RepositoryEffectMatches(effect, relation, fresh) {
		return ApplyActionResult{}, domain.ErrRepositoryDrift
	}
	canonicalPayload, err := workflow.CanonicalValidatedPayload(envelope, result)
	if err != nil {
		return ApplyActionResult{}, domain.ErrInternal
	}
	operationDigest, err := workflow.GraphOperationDigest(r.Host, r.TaskID, operationFromApply(r), canonicalPayload)
	if err != nil {
		return ApplyActionResult{}, domain.ErrInternal
	}
	next, err := cloneProcessTask(task)
	if err != nil {
		return ApplyActionResult{}, domain.ErrInternal
	}
	now := s.now().UTC()
	if effect.Kind == recovery.EffectProcessArtifactOnly && relation == recovery.RepositoryWorktreeOnlyChanged {
		rebindProcessAuthorities(&next, fresh)
	}
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

func validatedRepositoryEffect(source domain.NodeID, raw json.RawMessage, relation recovery.RepositoryRelation, fresh domain.RepositoryBinding) (recovery.RepositoryEffect, error) {
	envelope, result, err := workflow.DecodeStandardPayload(source, raw)
	if err != nil {
		return recovery.RepositoryEffect{}, err
	}
	effect, err := recovery.DeriveRepositoryEffect(source, envelope, result)
	if err != nil || !recovery.RepositoryEffectMatches(effect, relation, fresh) {
		return recovery.RepositoryEffect{}, domain.ErrRepositoryDrift
	}
	return effect, nil
}

func rebindProcessAuthorities(task *domain.ProcessTask, fresh domain.RepositoryBinding) {
	task.Repository = fresh
	if task.Implementation != nil {
		task.Implementation.RepositoryBindingDigest = fresh.BindingDigest
	}
	if task.Test != nil {
		task.Test.RepositoryBindingDigest = fresh.BindingDigest
	}
	if task.Comprehension != nil {
		task.Comprehension.RepositoryBindingDigest = fresh.BindingDigest
	}
}

func (s *Service) createRecoveryBlocker(ctx context.Context, r ApplyActionRequest, task domain.ProcessTask, fresh domain.RepositoryBinding, decision recovery.RecoveryDecision) (ApplyActionResult, error) {
	if task.CurrentAction == nil || task.CurrentNode != r.SourceCursor || task.Revision != r.ExpectedRevision || decision.Assessment.UnblockCondition == nil {
		return ApplyActionResult{}, domain.ErrActionStale
	}
	next, err := cloneProcessTask(task)
	if err != nil {
		return ApplyActionResult{}, domain.ErrInternal
	}
	blockerID, err := s.id("blocker")
	if err != nil {
		return ApplyActionResult{}, err
	}
	actionID, err := s.id("action")
	if err != nil {
		return ApplyActionResult{}, err
	}
	eventID, err := s.id("event")
	if err != nil {
		return ApplyActionResult{}, err
	}
	now := s.now().UTC()
	resume := task.CurrentNode
	next.CurrentNode = domain.NodeBlocked
	next.ResumeNode = &resume
	next.Revision++
	next.UpdatedAt = now
	next.Blocker = &domain.ProcessBlocker{BlockerID: blockerID, Code: domain.ErrorTaskBlocked, Cause: decision.Assessment.Classification, Message: "The uncertain graph mutation requires exact repository restoration before work can continue.", ResumeNode: resume, ObservedBindingDigest: fresh.BindingDigest, Condition: *decision.Assessment.UnblockCondition, RequiredResolution: "Restore the exact repository binding recorded when the original action was issued.", CreatedAt: now}
	action, err := workflow.BuildProcessAction(workflow.StandardProcess(), domain.NodeBlocked, next.TaskID, next.Revision, next.Repository.BindingDigest, next.Intent.MethodProfile, actionID, now)
	if err != nil {
		return ApplyActionResult{}, domain.ErrInternal
	}
	next.CurrentAction = &action
	canonical := decision.CanonicalPayload
	if len(canonical) == 0 {
		canonical = json.RawMessage("null")
	}
	digest, err := workflow.GraphOperationDigest(r.Host, r.TaskID, operationFromApply(r), canonical)
	if err != nil {
		return ApplyActionResult{}, domain.ErrInternal
	}
	originalActionID := r.ActionID
	next.LastOperation = &domain.LastOperation{OperationID: r.RequestID, Kind: domain.OperationApplyAction, ActionID: &originalActionID, FromRevision: r.ExpectedRevision, ToRevision: next.Revision, PayloadDigest: digest, CommittedAt: now}
	event := store.TaskEvent{EventID: eventID, TaskID: next.TaskID, Revision: next.Revision, Kind: domain.OperationApplyAction, SourceNode: resume, DestinationNode: domain.NodeBlocked, TransitionReason: "Recovery blocker created for the uncertain graph mutation.", ActionID: &originalActionID, RequestID: r.RequestID, PayloadDigest: digest, CreatedAt: now}
	if err := s.taskStore.CommitTask(ctx, store.TaskMutation{ExpectedRevision: r.ExpectedRevision, Task: next, Event: event, Claim: store.ClaimRetain}); err != nil {
		return ApplyActionResult{}, mapStoreError(err)
	}
	return ApplyActionResult{Task: next}, nil
}

func (s *Service) resolveBlocker(ctx context.Context, r ApplyActionRequest, task domain.ProcessTask) (ApplyActionResult, error) {
	if task.Blocker == nil || task.ResumeNode == nil || task.CurrentAction == nil || r.SourceCursor != domain.NodeBlocked ||
		task.Revision != r.ExpectedRevision || task.CurrentAction.ActionID != r.ActionID || r.ActionKind != domain.ActionResolveBlocker ||
		r.ProcessID != task.Process.ID || r.ProcessDefinitionDigest != task.Process.DefinitionDigest ||
		r.RepositoryBindingDigest != task.Repository.BindingDigest {
		return ApplyActionResult{}, domain.ErrActionStale
	}
	payload, canonical, err := recovery.DecodeBlockerResolutionPayload(r.Payload)
	if err != nil {
		return ApplyActionResult{}, err
	}
	fresh, err := s.observeTaskRepository(ctx, task)
	if err != nil {
		return ApplyActionResult{}, err
	}
	return s.resolveBlockerMutation(ctx, r, task, fresh, payload, canonical)
}

func (s *Service) resolveBlockerMutation(ctx context.Context, r ApplyActionRequest, task domain.ProcessTask, fresh domain.RepositoryBinding, payload recovery.BlockerResolutionPayload, canonical json.RawMessage) (ApplyActionResult, error) {
	relation, err := recovery.CompareRepositoryBindings(task.Repository, fresh)
	if err != nil || relation != recovery.RepositoryExact {
		return ApplyActionResult{}, domain.ErrRepositoryDrift
	}
	if payload.BlockerID != task.Blocker.BlockerID || payload.Condition != task.Blocker.Condition ||
		payload.Condition.ExpectedBindingDigest != task.Repository.BindingDigest || payload.ObservedBindingDigest != fresh.BindingDigest {
		return ApplyActionResult{}, domain.ErrInvalidArgument
	}
	next, err := cloneProcessTask(task)
	if err != nil {
		return ApplyActionResult{}, domain.ErrInternal
	}
	now := s.now().UTC()
	destination := *task.ResumeNode
	next.CurrentNode, next.ResumeNode, next.Blocker = destination, nil, nil
	next.Revision++
	next.UpdatedAt = now
	nextActionID, err := s.id("action")
	if err != nil {
		return ApplyActionResult{}, err
	}
	action, err := workflow.BuildProcessAction(workflow.StandardProcess(), destination, next.TaskID, next.Revision, next.Repository.BindingDigest, next.Intent.MethodProfile, nextActionID, now)
	if err != nil {
		return ApplyActionResult{}, domain.ErrInternal
	}
	next.CurrentAction = &action
	digest, err := workflow.GraphOperationDigest(r.Host, r.TaskID, operationFromApply(r), canonical)
	if err != nil {
		return ApplyActionResult{}, domain.ErrInternal
	}
	resolvedActionID := r.ActionID
	next.LastOperation = &domain.LastOperation{OperationID: r.RequestID, Kind: domain.OperationApplyAction, ActionID: &resolvedActionID, FromRevision: r.ExpectedRevision, ToRevision: next.Revision, PayloadDigest: digest, CommittedAt: now}
	eventID, err := s.id("event")
	if err != nil {
		return ApplyActionResult{}, err
	}
	event := store.TaskEvent{EventID: eventID, TaskID: next.TaskID, Revision: next.Revision, Kind: domain.OperationApplyAction, SourceNode: domain.NodeBlocked, DestinationNode: destination, TransitionReason: "Recovery blocker resolved after exact repository restoration.", ActionID: &resolvedActionID, RequestID: r.RequestID, PayloadDigest: digest, CreatedAt: now}
	if err := s.taskStore.CommitTask(ctx, store.TaskMutation{ExpectedRevision: r.ExpectedRevision, Task: next, Event: event, Claim: store.ClaimRetain}); err != nil {
		return ApplyActionResult{}, mapStoreError(err)
	}
	return ApplyActionResult{Task: next}, nil
}

func (s *Service) observeTaskRepository(ctx context.Context, task domain.ProcessTask) (domain.RepositoryBinding, error) {
	fresh, err := s.repositoryObserver.Observe(ctx, task.Repository.CanonicalRoot)
	if err != nil || fresh.Validate() != nil {
		return domain.RepositoryBinding{}, domain.ErrInternal
	}
	return fresh, nil
}

func validateRecoveryPayload(source domain.NodeID, payload json.RawMessage) error {
	if bytes.Equal(bytes.TrimSpace(payload), []byte("null")) {
		return nil
	}
	if source == domain.NodeBlocked {
		_, _, err := recovery.DecodeBlockerResolutionPayload(payload)
		return err
	}
	if err := workflow.ValidateRetainedPayload(source, payload); err != nil {
		return domain.ErrInvalidArgument
	}
	return nil
}

func operationFromApply(r ApplyActionRequest) domain.OperationReference {
	return domain.OperationReference{OperationID: r.RequestID, Process: domain.ProcessReference{ID: r.ProcessID, DefinitionDigest: r.ProcessDefinitionDigest}, SourceCursor: r.SourceCursor, ExpectedRevision: r.ExpectedRevision, ActionID: r.ActionID, ActionKind: r.ActionKind, RepositoryBindingDigest: r.RepositoryBindingDigest}
}

func validApplyIdentity(operation domain.OperationReference) bool {
	return operation.OperationID.IsValid() && operation.Process.Validate() == nil && operation.SourceCursor.IsValid() &&
		operation.ExpectedRevision > 0 && operation.ActionID.IsValid() && operation.ActionKind.IsValid() && operation.RepositoryBindingDigest.IsValid()
}

func digestApplyRequest(r ApplyActionRequest, canonicalPayload json.RawMessage) (domain.Digest, error) {
	return workflow.GraphOperationDigest(r.Host, r.TaskID, operationFromApply(r), canonicalPayload)
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
