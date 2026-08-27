package application

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/Innocent-children/dev-flow/internal/domain"
	"github.com/Innocent-children/dev-flow/internal/recovery"
	"github.com/Innocent-children/dev-flow/internal/store"
	"github.com/Innocent-children/dev-flow/internal/workflow"
)

func (s *Service) SubmitAction(ctx context.Context, request SubmitActionRequest) (ApplyActionResult, error) {
	if !s.valid() || ctx == nil || !request.RequestID.IsValid() || !request.Host.IsValid() ||
		!request.TaskID.IsValid() || !request.ActionID.IsValid() || !request.ExpectedActionKind.IsValid() ||
		!request.TransitionID.IsValid() || len(request.NodeResult) == 0 || !json.Valid(request.NodeResult) {
		return ApplyActionResult{}, domain.ErrInvalidArgument
	}
	task, err := s.loadOwned(ctx, request.Host, request.TaskID)
	if err != nil {
		return ApplyActionResult{}, err
	}
	if task.ActionCommit != nil && task.ActionCommit.Operation.ActionID == request.ActionID {
		if actionCommitRecorded(task, *task.ActionCommit) {
			return ApplyActionResult{Task: task}, nil
		}
		return ApplyActionResult{}, domain.ErrRecoveryUnavailable
	}
	if task.CurrentAction == nil || task.CurrentAction.ActionID != request.ActionID ||
		task.CurrentAction.Kind != request.ExpectedActionKind || task.CurrentNode == domain.NodeBlocked || task.CurrentNode.Terminal() {
		return ApplyActionResult{}, domain.ErrActionStale
	}
	artifacts, err := submissionArtifacts(task.CurrentNode, request.CurrentArtifacts, request.OtherProcessArtifacts)
	if err != nil {
		return ApplyActionResult{}, err
	}
	methodEvidence, err := submissionMethodEvidence(task.CurrentAction.SemanticMethodSteps, request.MethodResults)
	if err != nil {
		return ApplyActionResult{}, err
	}
	envelope := workflow.StandardPayload{
		TransitionID:   request.TransitionID,
		Summary:        request.Summary,
		Reason:         request.Reason,
		Artifacts:      artifacts,
		MethodEvidence: methodEvidence,
		NodeResult:     append(json.RawMessage(nil), request.NodeResult...),
	}
	raw, err := json.Marshal(envelope)
	if err != nil {
		return ApplyActionResult{}, domain.ErrInvalidArgument
	}
	apply := applyRequestForCurrentAction(request.RequestID, request.Host, task, raw)
	if err := validateStandardRequestAgainstTask(apply, task); err != nil {
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
	if _, err := validatedRepositoryEffect(task, raw, fresh, comparison); err != nil {
		if errors.Is(err, domain.ErrRepositoryDrift) {
			return ApplyActionResult{}, repositoryDriftError(comparison)
		}
		return ApplyActionResult{}, err
	}
	decodedEnvelope, result, err := workflow.DecodeStandardPayload(task.CurrentNode, raw)
	if err != nil {
		return ApplyActionResult{}, err
	}
	canonical, err := workflow.CanonicalValidatedPayload(decodedEnvelope, result)
	if err != nil {
		return ApplyActionResult{}, domain.ErrInternal
	}
	apply.Payload = canonical
	operation := operationFromApply(apply)
	digest, err := workflow.GraphOperationDigest(request.Host, task.TaskID, operation, canonical)
	if err != nil {
		return ApplyActionResult{}, domain.ErrInternal
	}
	prepared := task
	prepared.ActionCommit = &domain.ActionCommit{Operation: operation, Payload: canonical, PayloadDigest: digest, PreparedAt: s.now().UTC()}
	if workflow.ValidateProcessTask(prepared) != nil {
		return ApplyActionResult{}, domain.ErrInternal
	}
	commitStore, ok := s.taskStore.(store.ActionCommitStore)
	if !ok {
		return ApplyActionResult{}, domain.ErrInternal
	}
	if err := commitStore.StageActionCommit(ctx, prepared); err != nil {
		return ApplyActionResult{}, mapStoreError(err)
	}
	return s.applyStandardMutation(ctx, apply, prepared, fresh, comparison)
}

func applyRequestForCurrentAction(requestID domain.ID, host domain.Host, task domain.ProcessTask, payload json.RawMessage) ApplyActionRequest {
	action := task.CurrentAction
	return ApplyActionRequest{
		RequestID: requestID, Host: host, TaskID: task.TaskID, ExpectedRevision: task.Revision,
		ActionID: action.ActionID, ActionKind: action.Kind, ProcessID: action.Process.ID,
		ProcessDefinitionDigest: action.Process.DefinitionDigest, SourceCursor: action.NodeID,
		RepositoryBindingDigest: action.RepositoryBindingDigest, Payload: payload,
	}
}

func submissionArtifacts(node domain.NodeID, current, other []ArtifactSubmission) ([]domain.ArtifactReference, error) {
	primaryRole, primaryAllowed := workflow.PrimaryArtifactRoleForNode(node)
	if len(current) != 0 && !primaryAllowed {
		return nil, domain.InvalidArgumentViolations(domain.Violation("artifacts.current", domain.RuleArtifactRoleNotAllowed))
	}
	items := make([]domain.ArtifactReference, 0, len(current)+len(other))
	paths := map[string]bool{}
	appendItems := func(role domain.ArtifactRole, input []ArtifactSubmission) error {
		for _, value := range input {
			item := domain.ArtifactReference{Role: role, Path: value.Path, Digest: value.Digest, Summary: value.Summary}
			if item.Validate() != nil || paths[item.Path] {
				return domain.ErrInvalidArgument
			}
			paths[item.Path] = true
			items = append(items, item)
		}
		return nil
	}
	if primaryAllowed {
		if err := appendItems(primaryRole, current); err != nil {
			return nil, err
		}
	}
	if err := appendItems(domain.ArtifactOtherProcess, other); err != nil {
		return nil, err
	}
	return items, nil
}

func submissionMethodEvidence(steps []domain.SemanticMethodStep, results map[domain.MethodStepID]MethodResultSubmission) ([]domain.MethodEvidence, error) {
	if len(results) != len(steps) {
		return nil, domain.ErrInvalidArgument
	}
	items := make([]domain.MethodEvidence, len(steps))
	for index, step := range steps {
		result, ok := results[step.StepID]
		if !ok {
			return nil, domain.InvalidArgumentViolations(domain.Violation("method_results."+string(step.StepID), domain.RuleRequiredMemberMissing))
		}
		status := domain.MethodStepPlainFallback
		if result.Capability != "" {
			status = domain.MethodStepCompleted
		}
		items[index] = domain.MethodEvidence{StepID: step.StepID, Status: status, Capability: result.Capability, Summary: result.Summary}
	}
	if domain.ValidateMethodEvidence(items, steps) != nil {
		return nil, domain.ErrInvalidArgument
	}
	return items, nil
}

func actionCommitRecorded(task domain.ProcessTask, commit domain.ActionCommit) bool {
	last := task.LastOperation
	return last != nil && last.Kind == domain.OperationApplyAction && last.ActionID != nil &&
		last.OperationID == commit.Operation.OperationID && *last.ActionID == commit.Operation.ActionID &&
		last.PayloadDigest == commit.PayloadDigest && last.FromRevision == commit.Operation.ExpectedRevision
}
