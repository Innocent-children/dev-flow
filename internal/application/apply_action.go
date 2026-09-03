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
		// Recovery reconciliation cannot prove that the original mutation left no
		// write behind, so no failure on this route offers a bounded correction.
		result, err := s.applyRecovery(ctx, r, operation)
		return result, domain.WithoutZeroWriteProof(err)
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
	fresh, err := s.observeTaskRepositories(ctx, task)
	if err != nil {
		return ApplyActionResult{}, err
	}
	comparison, err := recovery.CompareRepositoryScope(task, fresh)
	if err != nil {
		return ApplyActionResult{}, domain.ErrInternal
	}
	if scopeHasUnavailableWorkspace(task, fresh) {
		return ApplyActionResult{}, domain.ErrWorkspaceUnavailable
	}
	if scopeHasHistoryConflict(fresh) {
		blocked, blockErr := s.createWorkspaceHistoryBlocker(ctx, task, fresh, r.RequestID)
		return ApplyActionResult{Task: blocked}, blockErr
	}
	if implementationContentMustRemainCurrent(task.CurrentNode) && contentDiffersFromCurrentAuthority(task, fresh) {
		updated, updateErr := s.invalidateContentEvidence(ctx, task, fresh, r.RequestID)
		return ApplyActionResult{Task: updated}, updateErr
	}
	if _, outside, err := validatedRepositoryEffect(task, r.Payload, fresh, comparison); err != nil {
		if errors.Is(err, domain.ErrRepositoryDrift) {
			return ApplyActionResult{}, repositoryDriftError(comparison)
		}
		return ApplyActionResult{}, err
	} else if len(outside) != 0 {
		if task.TaskPlan == nil || task.CurrentNode != domain.NodeImplement && task.CurrentNode != domain.NodeRefactor {
			return ApplyActionResult{}, domain.ErrRepositoryDrift
		}
		blocked, blockErr := s.createObservedFileScopeBlocker(ctx, task, fresh, outside, r.RequestID)
		return ApplyActionResult{Task: blocked}, blockErr
	}
	return s.applyStandardMutation(ctx, r, task, fresh, comparison)
}

func (s *Service) applyRecovery(ctx context.Context, r ApplyActionRequest, operation domain.OperationReference) (ApplyActionResult, error) {
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
	if task.CurrentNode == domain.NodeBlocked && task.Blocker != nil && task.Blocker.Cause == domain.BlockerCauseTaskRelocationPending {
		return s.resolveBlocker(ctx, r, task)
	}
	fresh, err := s.observeTaskRepositories(ctx, task)
	if err != nil {
		return ApplyActionResult{}, err
	}
	decision, err := recovery.Reconcile(recovery.ReconcileInput{Host: r.Host, Task: task, Operation: operation, Payload: r.Payload, ObservedScope: &fresh})
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
		comparison, comparisonErr := recovery.CompareRepositoryScope(task, fresh)
		if comparisonErr != nil {
			return ApplyActionResult{}, domain.ErrInternal
		}
		return s.applyStandardMutation(ctx, r, task, fresh, comparison)
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

func validateStandardRequestAgainstTask(r ApplyActionRequest, task domain.ProcessTask) error {
	if task.CurrentAction == nil || task.Revision != r.ExpectedRevision {
		return domain.ErrRevisionConflict
	}
	if r.ProcessID != task.Process.ID || r.ProcessDefinitionDigest != task.Process.DefinitionDigest {
		return domain.ErrProcessUnsupported
	}
	effectiveDigest, err := task.EffectiveRepositoryBindingDigest()
	if err != nil {
		return domain.ErrInternal
	}
	if r.SourceCursor != task.CurrentNode || task.CurrentAction.ActionID != r.ActionID || task.CurrentAction.Kind != r.ActionKind || effectiveDigest != r.RepositoryBindingDigest || task.CurrentAction.IssuanceIdentityDigest != r.IssuanceIdentityDigest || task.CurrentAction.IssuanceHistoryDigest != r.IssuanceHistoryDigest || task.CurrentAction.IssuanceContentDigest != r.IssuanceContentDigest {
		return domain.ErrActionStale
	}
	// Everything below is deterministic validation that runs before any Task,
	// Event, Claim or Evidence write, so a structured failure produced here is a
	// proven zero-write failure and may carry a bounded correction.
	envelope, result, err := workflow.DecodeStandardPayload(task.CurrentNode, r.Payload)
	if err != nil {
		return err
	}
	transition, err := workflow.TransitionFor(workflow.StandardProcess(), task.CurrentNode, envelope.TransitionID)
	if err != nil {
		return domain.ErrTransitionNotAllowed
	}
	if err := workflow.ValidatePayload(workflow.StandardProcess(), task.CurrentNode, envelope, result, task.CurrentAction.SemanticMethodSteps); err != nil {
		return err
	}
	return validateActionResultAgainstTask(task, transition, result)
}

func (s *Service) applyStandardMutation(ctx context.Context, r ApplyActionRequest, task domain.ProcessTask, fresh recovery.RepositoryScopeObservation, comparison recovery.RepositoryScopeComparison) (ApplyActionResult, error) {
	mutation, err := s.planStandardMutation(r, task, fresh, comparison)
	if err != nil {
		return ApplyActionResult{}, err
	}
	if err := s.taskStore.CommitTask(ctx, mutation); err != nil {
		return ApplyActionResult{}, mapStoreError(err)
	}
	return ApplyActionResult{Task: mutation.Task}, nil
}

func (s *Service) planStandardMutation(r ApplyActionRequest, task domain.ProcessTask, fresh recovery.RepositoryScopeObservation, comparison recovery.RepositoryScopeComparison) (store.TaskMutation, error) {
	if task.CurrentAction == nil || task.Revision != r.ExpectedRevision {
		return store.TaskMutation{}, domain.ErrRevisionConflict
	}
	if r.ProcessID != task.Process.ID || r.ProcessDefinitionDigest != task.Process.DefinitionDigest {
		return store.TaskMutation{}, domain.ErrProcessUnsupported
	}
	effectiveDigest, err := task.EffectiveRepositoryBindingDigest()
	if err != nil {
		return store.TaskMutation{}, domain.ErrInternal
	}
	if r.SourceCursor != task.CurrentNode || task.CurrentAction.ActionID != r.ActionID || task.CurrentAction.Kind != r.ActionKind || effectiveDigest != r.RepositoryBindingDigest || task.CurrentAction.IssuanceIdentityDigest != r.IssuanceIdentityDigest || task.CurrentAction.IssuanceHistoryDigest != r.IssuanceHistoryDigest || task.CurrentAction.IssuanceContentDigest != r.IssuanceContentDigest {
		return store.TaskMutation{}, domain.ErrActionStale
	}
	// This is the mutation path and it is also reachable from recovery
	// reconciliation, so it never claims a zero-write proof. The ordinary route
	// already produced the same structured detail in
	// validateStandardRequestAgainstTask.
	envelope, result, err := workflow.DecodeStandardPayload(task.CurrentNode, r.Payload)
	if err != nil {
		return store.TaskMutation{}, domain.WithoutZeroWriteProof(err)
	}
	definition := workflow.StandardProcess()
	transition, err := workflow.TransitionFor(definition, task.CurrentNode, envelope.TransitionID)
	if err != nil {
		return store.TaskMutation{}, domain.ErrTransitionNotAllowed
	}
	if err := workflow.ValidatePayload(definition, task.CurrentNode, envelope, result, task.CurrentAction.SemanticMethodSteps); err != nil {
		return store.TaskMutation{}, domain.WithoutZeroWriteProof(err)
	}
	effect, err := recovery.DeriveRepositoryEffect(task.CurrentNode, envelope, result)
	if err != nil {
		return store.TaskMutation{}, domain.WithoutZeroWriteProof(err)
	}
	if task.CurrentAction == nil || !recovery.RepositoryEffectAllowed(task.CurrentAction.AllowedEffects, effect) {
		return store.TaskMutation{}, domain.WithoutZeroWriteProof(domain.ErrRepositoryDrift)
	}
	if recovery.RepositoryScopeEffectEvidence(task, fresh, comparison, effect) != recovery.OperationEvidenceComplete {
		return store.TaskMutation{}, domain.WithoutZeroWriteProof(repositoryEffectEvidenceError(comparison, effect))
	}
	effect.Paths = recovery.RepositoryScopeDeltaPaths(task, fresh)
	canonicalPayload, err := workflow.CanonicalValidatedPayload(envelope, result)
	if err != nil {
		return store.TaskMutation{}, domain.ErrInternal
	}
	operationDigest, err := workflow.GraphOperationDigest(r.Host, r.TaskID, operationFromApply(r), canonicalPayload)
	if err != nil {
		return store.TaskMutation{}, domain.ErrInternal
	}
	next, err := cloneProcessTask(task)
	if err != nil {
		return store.TaskMutation{}, domain.ErrInternal
	}
	now := s.now().UTC()
	rebindProcessAuthorities(&next, fresh)
	var brakeDecision workflow.VerificationBrakeDecision
	switch value := result.(type) {
	case *workflow.RequirementsResult:
		err = applyRequirementsResult(&next, envelope, value, now)
	case *workflow.DesignResult:
		err = applyDesignResult(&next, transition, envelope, value, now)
	case *workflow.TasksResult:
		err = applyTaskPlanResult(&next, transition, envelope, value, now)
	case *workflow.ImplementationResult:
		err = applyImplementationResult(&next, transition, envelope, value, effect.Paths, now)
	case *workflow.TestResult:
		err = s.applyTestResult(&next, transition, value, now)
		if err == nil {
			brakeDecision, err = workflow.EvaluateVerificationBrake(next.VerificationAttempts, next.Evidence)
		}
	case *workflow.ComprehensionResult:
		err = s.applyComprehensionResult(&next, transition, value, now)
	case *workflow.RefactorResult:
		err = applyRefactorResult(&next, transition, envelope, value, effect.Paths, now)
	case *workflow.DeliveryResult:
		err = applyDeliveryResult(&next, transition, envelope, value, now)
	default:
		err = domain.ErrTransitionNotAllowed
	}
	if err != nil {
		if errors.Is(err, domain.ErrTransitionNotAllowed) || errors.Is(err, domain.ErrRepositoryDrift) || errors.Is(err, domain.ErrVerificationBudgetExceeded) {
			return store.TaskMutation{}, domain.WithoutZeroWriteProof(err)
		}
		return store.TaskMutation{}, domain.ErrInvalidArgument
	}
	if err := consumeFileScopeAuthorizations(&next, effect.Paths, r.ActionID); err != nil {
		return store.TaskMutation{}, err
	}
	next.CurrentChangedPaths = currentRepositoryScopePaths(next.EffectivePrimaryRepositoryKey(), fresh.Primary, fresh.Additional)
	destination := transition.Destination
	if brakeDecision.Triggered() {
		blocker, blockerErr := s.verificationBrakeBlocker(next, transition.Destination, brakeDecision, now)
		if blockerErr != nil {
			return store.TaskMutation{}, blockerErr
		}
		resume := transition.Destination
		next.ResumeNode = &resume
		next.Blocker = blocker
		destination = domain.NodeBlocked
	}
	next.CurrentNode = destination
	next.Revision++
	next.UpdatedAt = now
	claim := store.ClaimRetain
	if next.CurrentNode.Terminal() {
		next.CurrentAction = nil
		claim = store.ClaimRelease
	} else {
		nextID, err := s.id("action")
		if err != nil {
			return store.TaskMutation{}, err
		}
		nextWorkspace, digestErr := next.EffectiveWorkspaceDigests()
		if digestErr != nil {
			return store.TaskMutation{}, domain.ErrInternal
		}
		action, err := workflow.BuildProcessActionForWorkspace(definition, next.CurrentNode, next.TaskID, next.Revision, nextWorkspace, next.Intent.MethodProfile, nextID, now)
		if err != nil {
			return store.TaskMutation{}, domain.ErrInternal
		}
		next.CurrentAction = &action
	}
	actionID := r.ActionID
	next.LastOperation = &domain.LastOperation{OperationID: r.RequestID, Kind: domain.OperationApplyAction, ActionID: &actionID, FromRevision: r.ExpectedRevision, ToRevision: next.Revision, PayloadDigest: operationDigest, CommittedAt: now}
	if workflow.ValidateProcessTask(next) != nil {
		return store.TaskMutation{}, domain.ErrInvalidArgument
	}
	eventID, err := s.id("event")
	if err != nil {
		return store.TaskMutation{}, err
	}
	var transitionID *domain.TransitionID
	eventReason := envelope.Reason
	if brakeDecision.Triggered() {
		eventReason = next.Blocker.Message
	} else {
		tid := transition.TransitionID
		transitionID = &tid
	}
	event := store.TaskEvent{EventID: eventID, TaskID: next.TaskID, Revision: next.Revision, Kind: domain.OperationApplyAction, SourceNode: task.CurrentNode, DestinationNode: next.CurrentNode, TransitionID: transitionID, TransitionReason: eventReason, ActionID: &actionID, RepositoryDeltaPaths: append([]string(nil), effect.Paths...), RequestID: r.RequestID, PayloadDigest: operationDigest, CreatedAt: now}
	return store.TaskMutation{ExpectedRevision: r.ExpectedRevision, Task: next, Event: event, Claim: claim}, nil
}

func validatedRepositoryEffect(task domain.ProcessTask, raw json.RawMessage, fresh recovery.RepositoryScopeObservation, comparison recovery.RepositoryScopeComparison) (recovery.RepositoryEffect, []string, error) {
	envelope, result, err := workflow.DecodeStandardPayload(task.CurrentNode, raw)
	if err != nil {
		return recovery.RepositoryEffect{}, nil, err
	}
	effect, err := recovery.DeriveRepositoryEffect(task.CurrentNode, envelope, result)
	if err != nil {
		return recovery.RepositoryEffect{}, nil, err
	}
	actual := recovery.RepositoryScopeDeltaPaths(task, fresh)
	authorized := append([]string(nil), effect.Paths...)
	if task.CurrentAction == nil || !recovery.RepositoryEffectAllowed(task.CurrentAction.AllowedEffects, effect) {
		return recovery.RepositoryEffect{}, nil, domain.ErrRepositoryDrift
	}
	outside := []string{}
	if effect.Kind == recovery.EffectProductFileChange {
		outside = task.UnexplainedChangedPaths(fresh.Primary, fresh.Additional)
	}
	if effect.Kind == recovery.EffectProcessArtifactOnly {
		allowed := map[string]bool{}
		for _, path := range authorized {
			allowed[path] = true
		}
		for _, path := range actual {
			if !allowed[path] {
				outside = append(outside, path)
			}
		}
	}
	effect.Paths = actual
	if len(outside) != 0 {
		return effect, outside, nil
	}
	verificationEffect := effect
	if effect.Kind == recovery.EffectProcessArtifactOnly {
		verificationEffect.Paths = authorized
	}
	if recovery.RepositoryScopeEffectEvidence(task, fresh, comparison, verificationEffect) != recovery.OperationEvidenceComplete {
		return recovery.RepositoryEffect{}, nil, repositoryEffectEvidenceError(comparison, verificationEffect)
	}
	return effect, outside, nil
}

func repositoryEffectEvidenceError(comparison recovery.RepositoryScopeComparison, effect recovery.RepositoryEffect) error {
	return repositoryDriftError(comparison)
}

func rebindProcessAuthorities(task *domain.ProcessTask, fresh recovery.RepositoryScopeObservation) {
	rebindTaskRepositories(task, fresh)
	task.CurrentChangedPaths = currentRepositoryScopePaths(task.EffectivePrimaryRepositoryKey(), fresh.Primary, fresh.Additional)
}

func rebindTaskRepositories(task *domain.ProcessTask, fresh recovery.RepositoryScopeObservation) {
	task.Repository = fresh.Primary
	origins := make([]domain.WorkspaceOrigin, len(task.AdditionalRepositories))
	for i := range task.AdditionalRepositories {
		origins[i] = task.AdditionalRepositories[i].Origin
	}
	task.AdditionalRepositories = make([]domain.RepositoryScopeEntry, len(fresh.Additional))
	for i, entry := range fresh.Additional {
		copy := entry.Clone()
		copy.Origin = origins[i]
		task.AdditionalRepositories[i] = copy
	}
}

func (s *Service) createRecoveryBlocker(ctx context.Context, r ApplyActionRequest, task domain.ProcessTask, fresh recovery.RepositoryScopeObservation, decision recovery.RecoveryDecision) (ApplyActionResult, error) {
	mutation, err := s.planRecoveryBlocker(r, task, fresh, decision)
	if err != nil {
		return ApplyActionResult{}, err
	}
	if err := s.taskStore.CommitTask(ctx, mutation); err != nil {
		return ApplyActionResult{}, mapStoreError(err)
	}
	return ApplyActionResult{Task: mutation.Task}, nil
}

func (s *Service) planRecoveryBlocker(r ApplyActionRequest, task domain.ProcessTask, fresh recovery.RepositoryScopeObservation, decision recovery.RecoveryDecision) (store.TaskMutation, error) {
	if task.CurrentAction == nil || task.CurrentNode != r.SourceCursor || task.Revision != r.ExpectedRevision || decision.Assessment.UnblockCondition == nil {
		return store.TaskMutation{}, domain.ErrActionStale
	}
	next, err := cloneProcessTask(task)
	if err != nil {
		return store.TaskMutation{}, domain.ErrInternal
	}
	blockerID, err := s.id("blocker")
	if err != nil {
		return store.TaskMutation{}, err
	}
	actionID, err := s.id("action")
	if err != nil {
		return store.TaskMutation{}, err
	}
	eventID, err := s.id("event")
	if err != nil {
		return store.TaskMutation{}, err
	}
	now := s.now().UTC()
	resume := task.CurrentNode
	next.CurrentNode = domain.NodeBlocked
	next.ResumeNode = &resume
	next.Revision++
	next.UpdatedAt = now
	next.Blocker = &domain.ProcessBlocker{BlockerID: blockerID, Code: domain.ErrorTaskBlocked, Cause: domain.BlockerCause(decision.Assessment.Classification), Message: "The uncertain graph mutation requires exact repository restoration before work can continue.", ResumeNode: resume, ObservedBindingDigest: decision.Assessment.ObservedBindingDigest, Condition: *decision.Assessment.UnblockCondition, RequiredResolution: "Restore the exact repository binding recorded when the original action was issued.", CreatedAt: now}
	workspace, err := next.EffectiveWorkspaceDigests()
	if err != nil {
		return store.TaskMutation{}, domain.ErrInternal
	}
	action, err := workflow.BuildProcessActionForWorkspace(workflow.StandardProcess(), domain.NodeBlocked, next.TaskID, next.Revision, workspace, next.Intent.MethodProfile, actionID, now)
	if err != nil {
		return store.TaskMutation{}, domain.ErrInternal
	}
	next.CurrentAction = &action
	canonical := decision.CanonicalPayload
	if len(canonical) == 0 {
		canonical = json.RawMessage("null")
	}
	digest, err := workflow.GraphOperationDigest(r.Host, r.TaskID, operationFromApply(r), canonical)
	if err != nil {
		return store.TaskMutation{}, domain.ErrInternal
	}
	originalActionID := r.ActionID
	next.LastOperation = &domain.LastOperation{OperationID: r.RequestID, Kind: domain.OperationApplyAction, ActionID: &originalActionID, FromRevision: r.ExpectedRevision, ToRevision: next.Revision, PayloadDigest: digest, CommittedAt: now}
	event := store.TaskEvent{EventID: eventID, TaskID: next.TaskID, Revision: next.Revision, Kind: domain.OperationApplyAction, SourceNode: resume, DestinationNode: domain.NodeBlocked, TransitionReason: "Recovery blocker created for the uncertain graph mutation.", ActionID: &originalActionID, RepositoryDeltaPaths: observedTaskDeltaPaths(task, fresh), RequestID: r.RequestID, PayloadDigest: digest, CreatedAt: now}
	mutation := store.TaskMutation{ExpectedRevision: r.ExpectedRevision, Task: next, Event: event, Claim: store.ClaimRetain}
	if validateErr := workflow.ValidateProcessTask(next); validateErr != nil {
		return store.TaskMutation{}, domain.ErrInvalidArgument
	}
	return mutation, nil
}

func (s *Service) resolveBlocker(ctx context.Context, r ApplyActionRequest, task domain.ProcessTask) (ApplyActionResult, error) {
	if task.Blocker == nil || task.ResumeNode == nil || task.CurrentAction == nil || r.SourceCursor != domain.NodeBlocked ||
		task.Revision != r.ExpectedRevision || task.CurrentAction.ActionID != r.ActionID || r.ActionKind != domain.ActionResolveBlocker ||
		r.ProcessID != task.Process.ID || r.ProcessDefinitionDigest != task.Process.DefinitionDigest {
		return ApplyActionResult{}, domain.ErrActionStale
	}
	effectiveDigest, err := task.EffectiveRepositoryBindingDigest()
	if err != nil || r.RepositoryBindingDigest != effectiveDigest || task.CurrentAction.IssuanceIdentityDigest != r.IssuanceIdentityDigest || task.CurrentAction.IssuanceHistoryDigest != r.IssuanceHistoryDigest || task.CurrentAction.IssuanceContentDigest != r.IssuanceContentDigest {
		return ApplyActionResult{}, domain.ErrActionStale
	}
	payload, canonical, err := recovery.DecodeBlockerResolutionPayload(r.Payload)
	if err != nil {
		return ApplyActionResult{}, err
	}
	if task.Blocker.Cause == domain.BlockerCauseTaskRelocationPending {
		return s.resolveTaskRelocationPayload(ctx, r, task, payload, canonical)
	}
	fresh, err := s.observeTaskRepositories(ctx, task)
	if err != nil {
		return ApplyActionResult{}, err
	}
	return s.resolveBlockerMutation(ctx, r, task, fresh, payload, canonical)
}

func (s *Service) resolveBlockerMutation(ctx context.Context, r ApplyActionRequest, task domain.ProcessTask, fresh recovery.RepositoryScopeObservation, payload recovery.BlockerResolutionPayload, canonical json.RawMessage) (ApplyActionResult, error) {
	mutation, err := s.planResolveBlockerMutation(r, task, fresh, payload, canonical)
	if err != nil {
		return ApplyActionResult{}, err
	}
	if err := s.taskStore.CommitTask(ctx, mutation); err != nil {
		return ApplyActionResult{}, mapStoreError(err)
	}
	return ApplyActionResult{Task: mutation.Task}, nil
}

func (s *Service) planResolveBlockerMutation(r ApplyActionRequest, task domain.ProcessTask, fresh recovery.RepositoryScopeObservation, payload recovery.BlockerResolutionPayload, canonical json.RawMessage) (store.TaskMutation, error) {
	comparison, err := recovery.CompareRepositoryScope(task, fresh)
	if err != nil {
		return store.TaskMutation{}, domain.ErrInternal
	}
	fileScopeBlocker := task.Blocker != nil && task.Blocker.Cause == domain.BlockerCauseFileScopeDecision
	historyBlocker := task.Blocker != nil && task.Blocker.Cause == domain.BlockerCauseWorkspaceHistoryConflict
	if fileScopeBlocker {
		if payload.FileScopeDecision == nil || payload.FileScopeDecision.Validate() != nil {
			return store.TaskMutation{}, domain.ErrInvalidArgument
		}
		if !fileScopeResolutionRepositoryCurrent(task, fresh, comparison) {
			return store.TaskMutation{}, repositoryDriftError(comparison)
		}
	} else if payload.FileScopeDecision != nil {
		return store.TaskMutation{}, domain.ErrInvalidArgument
	} else if !historyBlocker && comparison.Relation != recovery.RepositoryExact {
		return store.TaskMutation{}, repositoryDriftError(comparison)
	}
	if payload.BlockerID != task.Blocker.BlockerID || payload.Condition != task.Blocker.Condition ||
		payload.Condition.ExpectedBindingDigest != task.Blocker.Condition.ExpectedBindingDigest || payload.ObservedBindingDigest != comparison.ObservedDigest {
		return store.TaskMutation{}, domain.ErrInvalidArgument
	}
	next, err := cloneProcessTask(task)
	if err != nil {
		return store.TaskMutation{}, domain.ErrInternal
	}
	now := s.now().UTC()
	destination := *task.ResumeNode
	resolvedCause := task.Blocker.Cause
	fileScopeRecordIndex := -1
	if fileScopeBlocker {
		for index := range next.FileScopeRecords {
			if next.FileScopeRecords[index].RequestID == task.Blocker.Condition.ScopeRequestID && next.FileScopeRecords[index].Decision == domain.FileScopePending {
				fileScopeRecordIndex = index
				break
			}
		}
		if fileScopeRecordIndex < 0 {
			return store.TaskMutation{}, domain.ErrInvalidArgument
		}
		record := &next.FileScopeRecords[fileScopeRecordIndex]
		if payload.FileScopeDecision.Choice == domain.FileScopeReject && len(unexplainedTaskPaths(task, fresh.Primary, fresh.Additional)) != 0 {
			return store.TaskMutation{}, domain.ErrRepositoryDrift
		}
		record.Decision = payload.FileScopeDecision.Choice
		record.Reason = payload.FileScopeDecision.Reason
		record.DecidedAt = &now
		switch record.Decision {
		case domain.FileScopeAllowOnce:
			record.Applicability = domain.FileScopeExactWrite
			if record.Observed {
				record.Consumed = true
				rebindProcessAuthorities(&next, fresh)
				states, stateErr := next.FileScopePathStates(record.Paths)
				if stateErr != nil {
					return store.TaskMutation{}, domain.ErrInternal
				}
				record.AcceptedPathStates = states
			}
		case domain.FileScopeReject:
			record.Applicability = domain.FileScopeTaskPlanRevision
		case domain.FileScopeExpandScope:
			record.Applicability = domain.FileScopeTaskPlanUpdate
			delta := observedTaskDeltaPaths(task, fresh)
			rebindProcessAuthorities(&next, fresh)
			if err := consumeFileScopeAuthorizations(&next, delta, record.SourceActionID); err != nil {
				return store.TaskMutation{}, err
			}
			if next.TaskPlan == nil {
				return store.TaskMutation{}, domain.ErrInvalidArgument
			}
			if err := appendBaselineHistory(&next, taskPlanReference(*next.TaskPlan)); err != nil {
				return store.TaskMutation{}, err
			}
			next.TaskPlan, next.Implementation, next.Test, next.Comprehension = nil, nil, nil, nil
			destination = domain.NodeTasks
		default:
			return store.TaskMutation{}, domain.ErrInvalidArgument
		}
	}
	if historyBlocker {
		if payload.HistoryResolution == nil || payload.HistoryResolution.Validate() != nil {
			return store.TaskMutation{}, domain.ErrInvalidArgument
		}
		if !historyResolutionMatchesReviewedWorkspace(task, fresh, comparison) {
			return store.TaskMutation{}, domain.ErrWorkspaceHistoryConflict
		}
		before, err := task.EffectiveWorkspaceDigests()
		if err != nil {
			return store.TaskMutation{}, domain.ErrInternal
		}
		rebindProcessAuthorities(&next, fresh)
		after, err := next.EffectiveWorkspaceDigests()
		if err != nil {
			return store.TaskMutation{}, domain.ErrInternal
		}
		if before.Content != after.Content && next.Implementation != nil {
			next.Implementation, next.Test, next.Comprehension = nil, nil, nil
			destination = domain.NodeImplement
		}
	}
	next.CurrentNode, next.ResumeNode, next.Blocker, next.Relocation = destination, nil, nil, nil
	next.Revision++
	next.UpdatedAt = now
	nextActionID, err := s.id("action")
	if err != nil {
		return store.TaskMutation{}, err
	}
	workspace, err := next.EffectiveWorkspaceDigests()
	if err != nil {
		return store.TaskMutation{}, domain.ErrInternal
	}
	action, err := workflow.BuildProcessActionForWorkspace(workflow.StandardProcess(), destination, next.TaskID, next.Revision, workspace, next.Intent.MethodProfile, nextActionID, now)
	if err != nil {
		return store.TaskMutation{}, domain.ErrInternal
	}
	next.CurrentAction = &action
	if fileScopeRecordIndex >= 0 && next.FileScopeRecords[fileScopeRecordIndex].Decision == domain.FileScopeAllowOnce {
		allowedActionID := action.ActionID
		next.FileScopeRecords[fileScopeRecordIndex].AllowedActionID = &allowedActionID
	}
	digest, err := workflow.GraphOperationDigest(r.Host, r.TaskID, operationFromApply(r), canonical)
	if err != nil {
		return store.TaskMutation{}, domain.ErrInternal
	}
	resolvedActionID := r.ActionID
	next.LastOperation = &domain.LastOperation{OperationID: r.RequestID, Kind: domain.OperationApplyAction, ActionID: &resolvedActionID, FromRevision: r.ExpectedRevision, ToRevision: next.Revision, PayloadDigest: digest, CommittedAt: now}
	eventID, err := s.id("event")
	if err != nil {
		return store.TaskMutation{}, err
	}
	eventReason := blockerResolvedReason(resolvedCause)
	if fileScopeBlocker {
		eventReason = "File-scope blocker resolved after the developer recorded a bounded decision."
	}
	event := store.TaskEvent{EventID: eventID, TaskID: next.TaskID, Revision: next.Revision, Kind: domain.OperationApplyAction, SourceNode: domain.NodeBlocked, DestinationNode: destination, TransitionReason: eventReason, ActionID: &resolvedActionID, RepositoryDeltaPaths: observedTaskDeltaPaths(task, fresh), RequestID: r.RequestID, PayloadDigest: digest, CreatedAt: now}
	if workflow.ValidateProcessTask(next) != nil {
		return store.TaskMutation{}, domain.ErrInvalidArgument
	}
	return store.TaskMutation{ExpectedRevision: r.ExpectedRevision, Task: next, Event: event, Claim: store.ClaimRetain}, nil
}

func repositoryDriftError(comparison recovery.RepositoryScopeComparison) error {
	if len(comparison.Repositories) <= 1 {
		return domain.ErrRepositoryDrift
	}
	for _, fact := range comparison.Repositories {
		if fact.Relation != recovery.RepositoryExact {
			return domain.NewError(domain.ErrorRepositoryDrift, `Repository "`+string(fact.RepositoryKey)+`" has repository drift: `+string(fact.Reason)+`.`)
		}
	}
	return domain.ErrRepositoryDrift
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
	return domain.OperationReference{OperationID: r.RequestID, Process: domain.ProcessReference{ID: r.ProcessID, DefinitionDigest: r.ProcessDefinitionDigest}, SourceCursor: r.SourceCursor, ExpectedRevision: r.ExpectedRevision, ActionID: r.ActionID, ActionKind: r.ActionKind, RepositoryBindingDigest: r.RepositoryBindingDigest, IssuanceIdentityDigest: r.IssuanceIdentityDigest, IssuanceHistoryDigest: r.IssuanceHistoryDigest, IssuanceContentDigest: r.IssuanceContentDigest}
}

func validApplyIdentity(operation domain.OperationReference) bool {
	return operation.OperationID.IsValid() && operation.Process.Validate() == nil && operation.SourceCursor.IsValid() &&
		operation.ExpectedRevision > 0 && operation.ActionID.IsValid() && operation.ActionKind.IsValid() && operation.RepositoryBindingDigest.IsValid() && operation.IssuanceIdentityDigest.IsValid() && operation.IssuanceHistoryDigest.IsValid() && operation.IssuanceContentDigest.IsValid()
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
