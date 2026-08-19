package application

import (
	"context"
	"github.com/Innocent-children/dev-flow/internal/domain"
	"github.com/Innocent-children/dev-flow/internal/store"
	"github.com/Innocent-children/dev-flow/internal/workflow"
)

func (s *Service) ApplyAction(ctx context.Context, r ApplyActionRequest) (ApplyActionResult, error) {
	task, err := s.loadOwned(ctx, r.Host, r.TaskID)
	if err != nil {
		return ApplyActionResult{}, err
	}
	if task.Revision != r.ExpectedRevision {
		return ApplyActionResult{}, domain.ErrRevisionConflict
	}
	if task.CurrentAction == nil || task.CurrentAction.ActionID != r.ActionID || task.CurrentAction.Kind != r.ActionKind || task.Process.DefinitionDigest != r.ProcessDefinitionDigest || task.Repository.BindingDigest != r.RepositoryBindingDigest {
		return ApplyActionResult{}, domain.ErrActionStale
	}
	envelope, result, err := workflow.DecodeStandardPayload(task.CurrentNode, r.Payload)
	if err != nil {
		return ApplyActionResult{}, domain.ErrInvalidArgument
	}
	definition := workflow.StandardProcess()
	if err := workflow.ValidatePayload(definition, task.CurrentNode, envelope, result, task.CurrentAction.SemanticMethodSteps); err != nil {
		return ApplyActionResult{}, domain.ErrTransitionNotAllowed
	}
	transition, err := workflow.TransitionFor(definition, task.CurrentNode, envelope.TransitionID)
	if err != nil {
		return ApplyActionResult{}, domain.ErrTransitionNotAllowed
	}
	if task.CurrentNode != domain.NodeRequirements || transition.TransitionID != "requirements_ready" {
		return ApplyActionResult{}, domain.ErrTransitionNotAllowed
	}
	requirements := result.(*workflow.RequirementsResult).Baseline
	now := s.now().UTC()
	task.Requirements = &domain.RequirementsBaseline{Revision: 1, Digest: domain.Digest(task.Process.DefinitionDigest), Goal: requirements.Goal, Scope: requirements.Scope, OutOfScope: requirements.OutOfScope, AcceptanceCriteria: requirements.AcceptanceCriteria, Constraints: requirements.Constraints, Assumptions: requirements.Assumptions, ArtifactRefs: envelope.Artifacts, CreatedAt: now}
	task.CurrentNode = transition.Destination
	task.Revision++
	task.UpdatedAt = now
	nextID, _ := s.id("action")
	action, err := workflow.BuildProcessAction(definition, task.CurrentNode, task.TaskID, task.Revision, task.Repository.BindingDigest, task.Intent.MethodProfile, nextID, now)
	if err != nil {
		return ApplyActionResult{}, domain.ErrInternal
	}
	task.CurrentAction = &action
	eventID, _ := s.id("event")
	payloadDigest, _ := digestCanonical(jsonRaw(r.Payload))
	tid := transition.TransitionID
	event := store.TaskEvent{EventID: eventID, TaskID: task.TaskID, Revision: task.Revision, Kind: domain.OperationApplyAction, SourceNode: domain.NodeRequirements, DestinationNode: task.CurrentNode, TransitionID: &tid, ActionID: &r.ActionID, RequestID: r.RequestID, PayloadDigest: payloadDigest, CreatedAt: now}
	if err := s.taskStore.CommitTask(ctx, store.TaskMutation{ExpectedRevision: r.ExpectedRevision, Task: task, Event: event, Claim: store.ClaimRetain}); err != nil {
		return ApplyActionResult{}, mapStoreError(err)
	}
	return ApplyActionResult{Task: task}, nil
}

type jsonRaw []byte
