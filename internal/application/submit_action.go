package application

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"

	"github.com/Innocent-children/taskbelay/internal/domain"
	"github.com/Innocent-children/taskbelay/internal/recovery"
	"github.com/Innocent-children/taskbelay/internal/store"
	"github.com/Innocent-children/taskbelay/internal/workflow"
)

func (s *Service) SubmitAction(ctx context.Context, request SubmitActionRequest) (ApplyActionResult, error) {
	if !s.valid() || ctx == nil || !request.RequestID.IsValid() || !request.Host.IsValid() ||
		!request.TaskID.IsValid() || !request.ActionID.IsValid() || !request.ExpectedActionKind.IsValid() ||
		!request.TransitionID.IsValid() || len(request.NodeResult) == 0 || !json.Valid(request.NodeResult) {
		return ApplyActionResult{}, domain.WithExplanation(domain.ErrInvalidArgument, "The application service, request context or required request identity is invalid.")
	}
	task, err := s.loadOwned(ctx, request.Host, request.TaskID)
	if err != nil {
		return ApplyActionResult{}, err
	}
	operationStore, ok := s.taskStore.(store.ActionOperationStore)
	if !ok {
		return ApplyActionResult{}, domain.WithExplanation(domain.ErrInternal, "The connected Task store does not support retaining and recovering Action operations.")
	}
	existing, found, err := operationStore.LoadActionOperation(ctx, task.TaskID)
	if err != nil {
		return ApplyActionResult{}, mapStoreError(err)
	}
	if found && existing.Commit.Operation.ActionID == request.ActionID {
		if existing.RecordedBy(task) {
			return ApplyActionResult{Task: task}, nil
		}
		return ApplyActionResult{}, domain.WithExplanation(domain.ErrRecoveryUnavailable, "This Action has a saved operation whose outcome is not yet recorded; recover that operation before submitting again.")
	}
	if request.ExpectedRevision != 0 && task.Revision != request.ExpectedRevision {
		return ApplyActionResult{}, domain.WithExplanation(domain.ErrRevisionConflict, "The supplied revision does not match the saved Task revision.")
	}
	if task.CurrentNode == domain.NodeBlocked {
		return ApplyActionResult{}, domain.WithExplanation(domain.ErrActionStale, "The Task is BLOCKED; resolve its current blocker before submitting a node result.")
	}
	if task.CurrentNode.Terminal() {
		return ApplyActionResult{}, domain.WithExplanation(domain.ErrActionStale, "The Task is DONE or CANCELLED and has no node Action to submit.")
	}
	if task.CurrentAction == nil || task.CurrentAction.ActionID != request.ActionID {
		return ApplyActionResult{}, domain.WithExplanation(domain.ErrActionStale, "action_id does not identify the currently saved Task Action.")
	}
	if task.CurrentAction.Kind != request.ExpectedActionKind {
		return ApplyActionResult{}, domain.WithExplanation(domain.ErrActionStale, "This submission tool handles a different node from the current Action.")
	}

	if err := workflow.ValidateSubmissionNodeResultSyntax(request.NodeResult); err != nil {
		return ApplyActionResult{}, err
	}
	nodeResult, err := hydrateSubmissionNodeResult(task, request.TransitionID, request.NodeResult)
	if err != nil {
		return ApplyActionResult{}, err
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
		NodeResult:     append(json.RawMessage(nil), nodeResult...),
	}
	raw, err := json.Marshal(envelope)
	if err != nil {
		return ApplyActionResult{}, domain.WithExplanation(domain.ErrInvalidArgument, "Core could not encode the prepared operation payload as JSON.")
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
		return ApplyActionResult{}, domain.WithExplanation(domain.ErrInternal, "The repository observations could not be compared with the Task repository scope.")
	}
	if scopeHasUnavailableWorkspace(task, fresh) {
		return ApplyActionResult{}, domain.WithExplanation(domain.ErrWorkspaceUnavailable, "An observed worktree is missing or no longer has the instance identity retained by the Task.")
	}
	if scopeHasHistoryConflict(fresh) {
		blocked, blockErr := s.createWorkspaceHistoryBlocker(ctx, task, fresh, request.RequestID)
		return ApplyActionResult{Task: blocked}, blockErr
	}
	if implementationContentMustRemainCurrent(task.CurrentNode) && contentDiffersFromCurrentAuthority(task, fresh) {
		updated, updateErr := s.invalidateContentEvidence(ctx, task, fresh, request.RequestID)
		return ApplyActionResult{Task: updated}, updateErr
	}
	if _, outside, err := validatedRepositoryEffect(task, raw, fresh, comparison); err != nil {
		if errors.Is(err, domain.ErrRepositoryDrift) {
			return ApplyActionResult{}, repositoryDriftError(comparison)
		}
		return ApplyActionResult{}, err
	} else if len(outside) != 0 {
		if task.TaskPlan == nil || task.CurrentNode != domain.NodeImplement && task.CurrentNode != domain.NodeRefactor {
			return ApplyActionResult{}, domain.WithExplanation(domain.ErrRepositoryDrift, "Observed file changes fall outside the approved scope, and this node cannot open an implementation file-scope decision.")
		}
		blocked, blockErr := s.createObservedFileScopeBlocker(ctx, task, fresh, outside, request.RequestID)
		return ApplyActionResult{Task: blocked}, blockErr
	}
	decodedEnvelope, result, err := workflow.DecodeStandardPayload(task.CurrentNode, raw)
	if err != nil {
		return ApplyActionResult{}, err
	}
	canonical, err := workflow.CanonicalValidatedPayload(decodedEnvelope, result)
	if err != nil {
		return ApplyActionResult{}, domain.WithExplanation(domain.ErrInternal, "The validated node result could not be encoded into a canonical Action payload.")
	}
	apply.Payload = canonical
	operation := operationFromApply(apply)
	digest, err := workflow.GraphOperationDigest(request.Host, task.TaskID, operation, canonical)
	if err != nil {
		return ApplyActionResult{}, domain.WithExplanation(domain.ErrInternal, "The Action identity or canonical payload could not be encoded into an operation digest.")
	}
	mutation, err := s.planStandardMutation(apply, task, fresh, comparison)
	if err != nil {
		return ApplyActionResult{}, err
	}
	commit := domain.ActionCommit{Operation: operation, Payload: canonical, PayloadDigest: digest, PreparedAt: mutation.Task.LastOperation.CommittedAt}
	if workflow.ValidateActionCommit(task, commit) != nil {
		return ApplyActionResult{}, domain.WithExplanation(domain.ErrInternal, "The prepared Action operation does not match the Task, payload or operation digest.")
	}
	if err := operationStore.StageActionOperation(ctx, task, commit); err != nil {
		return ApplyActionResult{}, mapStoreError(err)
	}
	if err := operationStore.CommitActionOperation(ctx, operation.OperationID, mutation); err != nil {
		return ApplyActionResult{}, mapStoreError(err)
	}
	return ApplyActionResult{Task: mutation.Task}, nil
}

func applyRequestForCurrentAction(requestID domain.ID, host domain.Host, task domain.ProcessTask, payload json.RawMessage) ApplyActionRequest {
	action := task.CurrentAction
	return ApplyActionRequest{
		RequestID: requestID, Host: host, TaskID: task.TaskID, ExpectedRevision: task.Revision,
		ActionID: action.ActionID, ActionKind: action.Kind, ProcessID: action.Process.ID,
		ProcessDefinitionDigest: action.Process.DefinitionDigest, SourceCursor: action.NodeID,
		RepositoryBindingDigest: action.RepositoryBindingDigest, IssuanceIdentityDigest: action.IssuanceIdentityDigest,
		IssuanceHistoryDigest: action.IssuanceHistoryDigest, IssuanceContentDigest: action.IssuanceContentDigest, Payload: payload,
	}
}

// hydrateSubmissionNodeResult completes Core-owned members from the Task
// snapshot that already passed the Action identity checks. Core-owned members
// are absent from the submission contract and rejected when supplied.
// The snapshot is never re-read, so a submitted result cannot bind to Task state
// newer than the current Action. Every failure here happens before any Task,
// Event, Evidence or operation write.
func hydrateSubmissionNodeResult(task domain.ProcessTask, transition domain.TransitionID, raw json.RawMessage) (json.RawMessage, error) {
	members, ok := jsonObjectMembers(raw)
	if !ok {
		return raw, nil
	}
	switch task.CurrentNode {
	case domain.NodeDesign:
		value, present := members["baseline"]
		if !present || isNullJSON(value) {
			return raw, nil
		}
		if task.Requirements == nil {
			return nil, domain.WithExplanation(domain.ErrInternal, "The current DESIGN Action has no saved requirements revision to bind its result to.")
		}
		filled, err := hydrateRevisionMember(value, "requirements_revision", task.Requirements.Revision, "payload.node_result.baseline.requirements_revision")
		if err != nil {
			return raw, err
		}
		return rebuildJSON(members, "baseline", filled)
	case domain.NodeTasks:
		value, present := members["baseline"]
		if !present || isNullJSON(value) {
			return raw, nil
		}
		if task.Design == nil {
			return nil, domain.WithExplanation(domain.ErrInternal, "The current TASKS Action has no saved design revision to bind its result to.")
		}
		filled, err := hydrateRevisionMember(value, "design_revision", task.Design.Revision, "payload.node_result.baseline.design_revision")
		if err != nil {
			return raw, err
		}
		return rebuildJSON(members, "baseline", filled)
	case domain.NodeImplement:
		if task.TaskPlan == nil {
			return nil, domain.WithExplanation(domain.ErrInternal, "The current Action requires a saved Task Plan, but none is available.")
		}
		filled, err := hydrateRevisionMember(raw, "task_plan_revision", task.TaskPlan.Revision, "payload.node_result.task_plan_revision")
		if err != nil {
			return raw, err
		}
		return filled, nil
	case domain.NodeDelivery:
		return hydrateDeliveryNodeResult(task, transition, members)
	default:
		return raw, nil
	}
}

// hydrateDeliveryNodeResult builds the canonical Delivery authority fields from
// the same Task snapshot that owns the current Action. Node submissions cannot
// provide these members; internal apply and Recovery payloads remain complete.
func hydrateDeliveryNodeResult(task domain.ProcessTask, transition domain.TransitionID, members map[string]json.RawMessage) (json.RawMessage, error) {
	var violations []domain.ContractViolation
	for _, name := range workflow.DeliveryAuthorityMembers() {
		if _, present := members[name]; present {
			violations = append(violations, domain.Violation("payload.node_result."+name, domain.RuleUnknownMember))
		}
	}
	if len(violations) != 0 {
		return nil, domain.InvalidArgumentViolations(violations...)
	}

	automated := []domain.ID{}
	manual := []domain.ID{}
	testRecordID := domain.ID("")
	comprehensionRecordID := domain.ID("")
	if transition == "delivery_complete" {
		if task.Requirements == nil || task.Test == nil || task.Comprehension == nil {
			return nil, domain.WithExplanation(domain.ErrTransitionNotAllowed, "delivery_complete requires saved requirements, a current Test record and a current comprehension record.")
		}
		var current bool
		automated, manual, current = currentDeliveryEvidence(task)
		if !current {
			return nil, domain.WithExplanation(domain.ErrTransitionNotAllowed, "The saved Test or user confirmation no longer supplies eligible current delivery evidence.")
		}
		if automated == nil {
			automated = []domain.ID{}
		}
		if manual == nil {
			manual = []domain.ID{}
		}
		testRecordID = task.Test.RecordID
		comprehensionRecordID = task.Comprehension.RecordID
	}

	values := map[string]any{
		"automated_evidence_ids":  automated,
		"manual_evidence_ids":     manual,
		"test_record_id":          testRecordID,
		"comprehension_record_id": comprehensionRecordID,
	}
	for name, value := range values {
		encoded, err := json.Marshal(value)
		if err != nil {
			return nil, domain.WithExplanation(domain.ErrInternal, "Core could not encode the prepared operation payload as JSON.")
		}
		members[name] = encoded
	}
	filled, err := json.Marshal(members)
	if err != nil {
		return nil, domain.WithExplanation(domain.ErrInternal, "Core could not encode the prepared operation payload as JSON.")
	}
	return filled, nil
}

// hydrateRevisionMember adds one Core-owned revision to the canonical object.
// Host submissions cannot supply the member.
func hydrateRevisionMember(object json.RawMessage, member string, current uint32, path string) (json.RawMessage, error) {
	members, ok := jsonObjectMembers(object)
	if !ok {
		return nil, domain.WithExplanation(domain.ErrInvalidArgument, "The baseline to receive the current revision must be a JSON object.")
	}
	if _, present := members[member]; present {
		return nil, domain.InvalidArgumentViolations(domain.Violation(path, domain.RuleUnknownMember))
	}
	members[member] = json.RawMessage(strconv.FormatUint(uint64(current), 10))
	filled, err := json.Marshal(members)
	if err != nil {
		return nil, domain.WithExplanation(domain.ErrInternal, "Core could not encode the prepared operation payload as JSON.")
	}
	return filled, nil
}

// rebuildJSON re-marshals one object after replacing the raw value of one
// member. The members came from a validated JSON value, so re-marshaling cannot
// fail; an unexpected encoder failure is an internal error.
func rebuildJSON(members map[string]json.RawMessage, name string, value json.RawMessage) (json.RawMessage, error) {
	members[name] = value
	filled, err := json.Marshal(members)
	if err != nil {
		return nil, domain.WithExplanation(domain.ErrInternal, "Core could not encode the prepared operation payload as JSON.")
	}
	return filled, nil
}

func jsonObjectMembers(raw json.RawMessage) (map[string]json.RawMessage, bool) {
	var members map[string]json.RawMessage
	if json.Unmarshal(raw, &members) != nil || members == nil {
		return nil, false
	}
	return members, true
}

func isNullJSON(raw json.RawMessage) bool {
	return bytes.Equal(bytes.TrimSpace(raw), []byte("null"))
}

func submissionArtifacts(node domain.NodeID, current, other []ArtifactSubmission) ([]domain.ArtifactReference, error) {
	primaryRole, primaryAllowed := workflow.PrimaryArtifactRoleForNode(node)
	if len(current) != 0 && !primaryAllowed {
		return nil, domain.InvalidArgumentViolations(domain.Violation("artifacts.current", domain.RuleArtifactRoleNotAllowed))
	}
	items := make([]domain.ArtifactReference, 0, len(current)+len(other))
	paths := map[string]bool{}
	appendItems := func(role domain.ArtifactRole, slot string, input []ArtifactSubmission) error {
		for index, value := range input {
			item := domain.ArtifactReference{Role: role, Path: value.Path, Digest: value.Digest, Summary: value.Summary}
			member := fmt.Sprintf("artifacts.%s[%d]", slot, index)
			if err := item.Validate(); err != nil {
				return domain.AtField(member, err)
			}
			if paths[item.Path] {
				return domain.InvalidArgumentViolations(domain.ExplainedViolation(member+".path", domain.RuleStringListDuplicate, "artifact paths must be unique across current and other_process"))
			}
			paths[item.Path] = true
			items = append(items, item)
		}
		return nil
	}
	if primaryAllowed {
		if err := appendItems(primaryRole, "current", current); err != nil {
			return nil, err
		}
	}
	if err := appendItems(domain.ArtifactOtherProcess, "other_process", other); err != nil {
		return nil, err
	}
	return items, nil
}

func submissionMethodEvidence(steps []domain.SemanticMethodStep, results map[domain.MethodStepID]MethodResultSubmission) ([]domain.MethodEvidence, error) {
	if len(results) != len(steps) {
		return nil, domain.WithExplanation(domain.ErrInvalidArgument, "method_results must contain exactly the method steps required by the current Action.")
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
		if err := items[index].Validate(steps); err != nil {
			return nil, domain.AtField("method_results."+string(step.StepID), err)
		}
	}
	if domain.ValidateMethodEvidence(items, steps) != nil {
		return nil, domain.WithExplanation(domain.ErrInvalidArgument, "Method results must match the current Action steps, use valid capability identifiers and include non-empty normalized summaries.")
	}
	return items, nil
}
