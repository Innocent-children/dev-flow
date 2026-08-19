package domain

import "strings"

type ProcessID string

const ProcessStandardDevelopment ProcessID = "standard-development"

func (id ProcessID) IsValid() bool { return id == ProcessStandardDevelopment }

type NodeID string

const (
	NodeRequirements        NodeID = "REQUIREMENTS"
	NodeDesign              NodeID = "DESIGN"
	NodeTasks               NodeID = "TASKS"
	NodeImplement           NodeID = "IMPLEMENT"
	NodeTest                NodeID = "TEST"
	NodeComprehensionReview NodeID = "COMPREHENSION_REVIEW"
	NodeRefactor            NodeID = "REFACTOR"
	NodeDelivery            NodeID = "DELIVERY"
	NodeDone                NodeID = "DONE"
	NodeBlocked             NodeID = "BLOCKED"
	NodeCancelled           NodeID = "CANCELLED"
)

func (id NodeID) IsValid() bool {
	switch id {
	case NodeRequirements, NodeDesign, NodeTasks, NodeImplement, NodeTest,
		NodeComprehensionReview, NodeRefactor, NodeDelivery, NodeDone, NodeBlocked, NodeCancelled:
		return true
	default:
		return false
	}
}

func (id NodeID) Terminal() bool { return id == NodeDone || id == NodeCancelled }
func (id NodeID) Normal() bool   { return id.IsValid() && id != NodeBlocked && !id.Terminal() }

type TransitionID string
type TransitionGuardID string

func (id TransitionID) IsValid() bool      { return validSemanticID(string(id)) }
func (id TransitionGuardID) IsValid() bool { return validSemanticID(string(id)) }

type ProcessReference struct {
	ID               ProcessID `json:"process_id"`
	Version          uint32    `json:"process_version"`
	DefinitionDigest Digest    `json:"process_definition_digest"`
}

func (r ProcessReference) Validate() error {
	if !r.ID.IsValid() || r.Version != 1 || !r.DefinitionDigest.IsValid() {
		return ErrInvalidArgument
	}
	return nil
}

type TransitionDefinition struct {
	TransitionID   TransitionID      `json:"transition_id"`
	Source         NodeID            `json:"source"`
	Destination    NodeID            `json:"destination"`
	Guard          TransitionGuardID `json:"guard_id"`
	ReasonRequired bool              `json:"reason_required"`
}

func (d TransitionDefinition) Validate() error {
	if !d.TransitionID.IsValid() || !d.Source.Normal() || !d.Destination.IsValid() ||
		d.Destination == NodeBlocked || d.Destination == NodeCancelled || !d.Guard.IsValid() {
		return ErrInvalidArgument
	}
	return nil
}

type NodeDefinition struct {
	NodeID                 NodeID                 `json:"node_id"`
	Purpose                string                 `json:"purpose"`
	EntryConditionIDs      []string               `json:"entry_condition_ids"`
	EntryAssumptions       []string               `json:"entry_assumptions"`
	CompletionConditionIDs []string               `json:"completion_condition_ids"`
	CompletionConditions   []string               `json:"completion_conditions"`
	AllowedEffects         []AllowedEffect        `json:"allowed_effects"`
	RequiredEvidence       []EvidenceRequirement  `json:"required_evidence"`
	SemanticMethodSteps    []SemanticMethodStep   `json:"semantic_method_steps"`
	OutgoingTransitions    []TransitionDefinition `json:"outgoing_transitions"`
	ActionKind             ActionKind             `json:"action_kind"`
	PayloadContract        string                 `json:"payload_contract"`
}

type ProcessDefinition struct {
	Reference   ProcessReference       `json:"reference"`
	EntryNode   NodeID                 `json:"entry_node"`
	Nodes       []NodeDefinition       `json:"nodes"`
	Transitions []TransitionDefinition `json:"transitions"`
}

func (d ProcessDefinition) Validate() error {
	if d.Reference.Validate() != nil || !d.EntryNode.Normal() || len(d.Nodes) == 0 ||
		len(d.Nodes) > MaxStandardProcessNodes || len(d.Transitions) > MaxStandardProcessTransitions {
		return ErrInvalidArgument
	}
	nodes := make(map[NodeID]NodeDefinition, len(d.Nodes))
	for _, node := range d.Nodes {
		if !node.NodeID.IsValid() || nodeDefinitionInvalid(node) {
			return ErrInvalidArgument
		}
		if _, exists := nodes[node.NodeID]; exists {
			return ErrInvalidArgument
		}
		nodes[node.NodeID] = node
	}
	if _, exists := nodes[d.EntryNode]; !exists {
		return ErrInvalidArgument
	}
	transitions := make(map[TransitionID]TransitionDefinition, len(d.Transitions))
	for _, transition := range d.Transitions {
		if transition.Validate() != nil {
			return ErrInvalidArgument
		}
		if _, exists := nodes[transition.Source]; !exists {
			return ErrInvalidArgument
		}
		if _, exists := nodes[transition.Destination]; !exists {
			return ErrInvalidArgument
		}
		if _, exists := transitions[transition.TransitionID]; exists {
			return ErrInvalidArgument
		}
		transitions[transition.TransitionID] = transition
	}
	usedTransitions := make(map[TransitionID]bool, len(d.Transitions))
	for _, node := range d.Nodes {
		if node.NodeID.Terminal() && len(node.OutgoingTransitions) != 0 {
			return ErrInvalidArgument
		}
		for _, transition := range node.OutgoingTransitions {
			canonical, exists := transitions[transition.TransitionID]
			if !exists || canonical != transition || transition.Source != node.NodeID || usedTransitions[transition.TransitionID] {
				return ErrInvalidArgument
			}
			usedTransitions[transition.TransitionID] = true
		}
	}
	if len(usedTransitions) != len(transitions) {
		return ErrInvalidArgument
	}
	return nil
}

func nodeDefinitionInvalid(node NodeDefinition) bool {
	if node.NodeID.Terminal() {
		return node.ActionKind != "" || node.PayloadContract != "" || len(node.OutgoingTransitions) != 0
	}
	if requireNormalizedText(node.Purpose, MaxGuidanceBytes, true) != nil ||
		len(node.EntryConditionIDs) == 0 || len(node.CompletionConditionIDs) == 0 ||
		len(node.EntryAssumptions) == 0 || len(node.CompletionConditions) == 0 ||
		len(node.AllowedEffects) == 0 || len(node.RequiredEvidence) == 0 ||
		len(node.SemanticMethodSteps) == 0 || !node.ActionKind.IsValidV2() ||
		!validSemanticID(node.PayloadContract) {
		return true
	}
	if !uniqueSemanticIDs(node.EntryConditionIDs) || !uniqueSemanticIDs(node.CompletionConditionIDs) {
		return true
	}
	effects := map[AllowedEffect]bool{}
	for _, effect := range node.AllowedEffects {
		if !effect.IsValidV2() || effects[effect] {
			return true
		}
		effects[effect] = true
	}
	evidence := map[EvidenceRequirementKind]bool{}
	for _, item := range node.RequiredEvidence {
		if item.ValidateV2() != nil || evidence[item.Kind] {
			return true
		}
		evidence[item.Kind] = true
	}
	steps := map[MethodStepID]bool{}
	for _, step := range node.SemanticMethodSteps {
		if step.Validate() != nil || steps[step.StepID] {
			return true
		}
		steps[step.StepID] = true
	}
	return false
}

func uniqueSemanticIDs(items []string) bool {
	seen := map[string]bool{}
	for _, item := range items {
		if !validSemanticID(item) || seen[item] {
			return false
		}
		seen[item] = true
	}
	return true
}

func validSemanticID(value string) bool {
	if value == "" || value != strings.TrimSpace(value) || len(value) > MaxIdentifierBytes {
		return false
	}
	for _, r := range value {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == '_' || r == '-' || r == '.' || r == '@' {
			continue
		}
		return false
	}
	return true
}
