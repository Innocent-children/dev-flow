package workflow

import (
	"time"

	"github.com/Innocent-children/dev-flow/internal/domain"
)

func NodeDefinition(definition domain.ProcessDefinition, nodeID domain.NodeID) (domain.NodeDefinition, error) {
	if err := ValidateDefinition(definition); err != nil {
		return domain.NodeDefinition{}, err
	}
	for _, node := range definition.Nodes {
		if node.NodeID == nodeID {
			return node, nil
		}
	}
	return domain.NodeDefinition{}, domain.NewError(domain.ErrorInvalidArgument, "node is not part of the process")
}
func TransitionFor(definition domain.ProcessDefinition, source domain.NodeID, id domain.TransitionID) (domain.TransitionDefinition, error) {
	node, err := NodeDefinition(definition, source)
	if err != nil {
		return domain.TransitionDefinition{}, err
	}
	for _, transition := range node.OutgoingTransitions {
		if transition.TransitionID == id {
			return transition, nil
		}
	}
	return domain.TransitionDefinition{}, domain.NewError(domain.ErrorInvalidArgument, "transition is not allowed from the current node")
}

func BuildProcessAction(definition domain.ProcessDefinition, nodeID domain.NodeID, taskID domain.ID, revision uint64, binding domain.Digest, profile domain.MethodProfile, actionID domain.ID, issuedAt time.Time) (domain.ProcessAction, error) {
	node, err := NodeDefinition(definition, nodeID)
	if err != nil || nodeID.Terminal() {
		return domain.ProcessAction{}, domain.ErrInvalidArgument
	}
	available := make([]domain.TransitionProjection, len(node.OutgoingTransitions))
	for i, v := range node.OutgoingTransitions {
		available[i] = domain.TransitionProjection{TransitionID: v.TransitionID, Destination: v.Destination, Guard: v.Guard, Description: v.Description, SelectionCondition: v.SelectionCondition, ReasonRequired: v.ReasonRequired}
	}
	action := domain.ProcessAction{ActionID: actionID, Kind: node.ActionKind, TaskID: taskID, Revision: revision, Process: definition.Reference, NodeID: nodeID, RepositoryBindingDigest: binding, AllowedEffects: append([]domain.AllowedEffect(nil), node.AllowedEffects...), RequiredEvidence: append([]domain.EvidenceRequirement(nil), node.RequiredEvidence...), PayloadContract: node.PayloadContract, NodeContract: domain.NodeContractProjection{Purpose: node.Purpose, EntryConditions: append([]string(nil), node.EntryAssumptions...), CompletionConditions: append([]string(nil), node.CompletionConditions...)}, AvailableTransitions: available, MethodProfile: profile, SemanticMethodSteps: append([]domain.SemanticMethodStep(nil), node.SemanticMethodSteps...), Guidance: "Complete the current node contract and select one available transition.", IssuedAt: issuedAt}
	if action.Process != StandardProcess().Reference || !profile.IsValid() || !actionID.IsValid() || !taskID.IsValid() || revision == 0 || !binding.IsValid() {
		return domain.ProcessAction{}, domain.ErrInvalidArgument
	}
	return action, nil
}

func ValidateProcessTask(task domain.ProcessTask) error {
	if err := task.Validate(); err != nil {
		return err
	}
	definition, err := ResolveDefinition(task.Process)
	if err != nil {
		return err
	}
	if task.CurrentAction == nil {
		return nil
	}
	expected, err := BuildProcessAction(definition, task.CurrentNode, task.TaskID, task.Revision, task.Repository.BindingDigest, task.Intent.MethodProfile, task.CurrentAction.ActionID, task.CurrentAction.IssuedAt)
	if err != nil || !sameAction(expected, *task.CurrentAction) {
		return domain.ErrInvalidArgument
	}
	return nil
}
func sameAction(a, b domain.ProcessAction) bool {
	if a.ActionID != b.ActionID || a.Kind != b.Kind || a.TaskID != b.TaskID || a.Revision != b.Revision || a.Process != b.Process || a.NodeID != b.NodeID || a.RepositoryBindingDigest != b.RepositoryBindingDigest || a.PayloadContract != b.PayloadContract || a.MethodProfile != b.MethodProfile || !a.IssuedAt.Equal(b.IssuedAt) {
		return false
	}
	return slicesEqual(a.AllowedEffects, b.AllowedEffects) &&
		slicesEqual(a.RequiredEvidence, b.RequiredEvidence) &&
		sameMethodStepAuthority(a.SemanticMethodSteps, b.SemanticMethodSteps) &&
		sameTransitionAuthority(a.AvailableTransitions, b.AvailableTransitions)
}
func sameMethodStepAuthority(a, b []domain.SemanticMethodStep) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i].StepID != b[i].StepID || a[i].Required != b[i].Required {
			return false
		}
	}
	return true
}
func sameTransitionAuthority(a, b []domain.TransitionProjection) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i].TransitionID != b[i].TransitionID || a[i].Destination != b[i].Destination ||
			a[i].Guard != b[i].Guard || a[i].ReasonRequired != b[i].ReasonRequired {
			return false
		}
	}
	return true
}
func slicesEqual[T comparable](a, b []T) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}
