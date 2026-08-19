package workflow

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"

	"github.com/Innocent-children/dev-flow/internal/domain"
)

func DefinitionDigest(definition domain.ProcessDefinition) (domain.Digest, error) {
	type evidenceItem struct {
		Kind     domain.EvidenceRequirementKind `json:"kind"`
		Required bool                           `json:"required"`
	}
	type stepItem struct {
		ID       domain.MethodStepID `json:"step_id"`
		Purpose  string              `json:"purpose"`
		Required bool                `json:"required"`
	}
	type nodeItem struct {
		ID                     domain.NodeID         `json:"node_id"`
		Purpose                string                `json:"purpose"`
		EntryIDs               []string              `json:"entry_condition_ids"`
		EntryDescriptions      []string              `json:"entry_condition_descriptions"`
		CompletionIDs          []string              `json:"completion_condition_ids"`
		CompletionDescriptions []string              `json:"completion_condition_descriptions"`
		Effects                []string              `json:"allowed_effects"`
		Evidence               []evidenceItem        `json:"required_evidence"`
		Steps                  []stepItem            `json:"method_steps"`
		Action                 domain.ActionKind     `json:"action_kind"`
		Payload                string                `json:"payload_contract"`
		Outgoing               []domain.TransitionID `json:"outgoing_transition_ids"`
	}
	type transitionItem struct {
		ID                 domain.TransitionID      `json:"transition_id"`
		Source             domain.NodeID            `json:"source"`
		Destination        domain.NodeID            `json:"destination"`
		Guard              domain.TransitionGuardID `json:"guard_id"`
		Description        string                   `json:"description"`
		SelectionCondition string                   `json:"selection_condition"`
		ReasonRequired     bool                     `json:"reason_required"`
	}
	type definitionItem struct {
		ProcessID      domain.ProcessID `json:"process_id"`
		ProcessVersion uint32           `json:"process_version"`
		EntryNode      domain.NodeID    `json:"entry_node"`
		Nodes          []nodeItem       `json:"nodes"`
		Transitions    []transitionItem `json:"transitions"`
	}
	nodes := make([]nodeItem, 0, len(definition.Nodes))
	for _, node := range definition.Nodes {
		effects := make([]string, len(node.AllowedEffects))
		for i, v := range node.AllowedEffects {
			effects[i] = string(v)
		}
		evidence := make([]evidenceItem, len(node.RequiredEvidence))
		for i, v := range node.RequiredEvidence {
			evidence[i] = evidenceItem{v.Kind, v.Required}
		}
		steps := make([]stepItem, len(node.SemanticMethodSteps))
		for i, v := range node.SemanticMethodSteps {
			steps[i] = stepItem{v.StepID, v.Purpose, v.Required}
		}
		outgoing := make([]domain.TransitionID, len(node.OutgoingTransitions))
		for i, v := range node.OutgoingTransitions {
			outgoing[i] = v.TransitionID
		}
		nodes = append(nodes, nodeItem{node.NodeID, node.Purpose, node.EntryConditionIDs, node.EntryAssumptions, node.CompletionConditionIDs, node.CompletionConditions, effects, evidence, steps, node.ActionKind, node.PayloadContract, outgoing})
	}
	transitions := make([]transitionItem, 0, len(definition.Transitions))
	for _, v := range definition.Transitions {
		transitions = append(transitions, transitionItem{v.TransitionID, v.Source, v.Destination, v.Guard, v.Description, v.SelectionCondition, v.ReasonRequired})
	}
	projection := definitionItem{definition.Reference.ID, definition.Reference.Version, definition.EntryNode, nodes, transitions}
	var buffer bytes.Buffer
	encoder := json.NewEncoder(&buffer)
	encoder.SetEscapeHTML(false)
	if err := encoder.Encode(projection); err != nil {
		return "", err
	}
	raw := bytes.TrimSuffix(buffer.Bytes(), []byte("\n"))
	sum := sha256.Sum256(raw)
	return domain.Digest(hex.EncodeToString(sum[:])), nil
}

func ValidateDefinition(definition domain.ProcessDefinition) error {
	digest, err := DefinitionDigest(definition)
	if err != nil || digest != definition.Reference.DefinitionDigest {
		return domain.ErrInvalidArgument
	}
	return definition.Validate()
}
func ResolveDefinition(reference domain.ProcessReference) (domain.ProcessDefinition, error) {
	definition := StandardProcess()
	if reference != definition.Reference {
		return domain.ProcessDefinition{}, domain.NewError(domain.ErrorInvalidArgument, "unsupported process definition")
	}
	return definition, nil
}
