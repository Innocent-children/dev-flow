package workflow

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"

	"github.com/Innocent-children/dev-flow/internal/domain"
)

func DefinitionDigest(definition domain.ProcessDefinition) (domain.Digest, error) {
	nodes := make([]any, 0, len(definition.Nodes))
	for _, node := range definition.Nodes {
		effects := make([]string, len(node.AllowedEffects))
		for i, v := range node.AllowedEffects {
			effects[i] = string(v)
		}
		evidence := make([]any, len(node.RequiredEvidence))
		for i, v := range node.RequiredEvidence {
			evidence[i] = map[string]any{"kind": v.Kind, "required": v.Required}
		}
		steps := make([]any, len(node.SemanticMethodSteps))
		for i, v := range node.SemanticMethodSteps {
			steps[i] = map[string]any{"required": v.Required, "step_id": v.StepID}
		}
		outgoing := make([]domain.TransitionID, len(node.OutgoingTransitions))
		for i, v := range node.OutgoingTransitions {
			outgoing[i] = v.TransitionID
		}
		nodes = append(nodes, map[string]any{
			"action_kind":              node.ActionKind,
			"allowed_effects":          effects,
			"completion_condition_ids": node.CompletionConditionIDs,
			"entry_condition_ids":      node.EntryConditionIDs,
			"method_steps":             steps,
			"node_id":                  node.NodeID,
			"outgoing_transition_ids":  outgoing,
			"payload_contract":         node.PayloadContract,
			"required_evidence":        evidence,
		})
	}
	transitions := make([]any, 0, len(definition.Transitions))
	for _, v := range definition.Transitions {
		transitions = append(transitions, map[string]any{
			"destination":     v.Destination,
			"guard_id":        v.Guard,
			"reason_required": v.ReasonRequired,
			"source":          v.Source,
			"transition_id":   v.TransitionID,
		})
	}
	projection := map[string]any{
		"entry_node":  definition.EntryNode,
		"nodes":       nodes,
		"process_id":  definition.Reference.ID,
		"transitions": transitions,
	}
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
