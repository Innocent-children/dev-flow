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
		evidence := make([]string, len(node.RequiredEvidence))
		for i, v := range node.RequiredEvidence {
			evidence[i] = string(v.Kind)
		}
		steps := make([]string, len(node.SemanticMethodSteps))
		for i, v := range node.SemanticMethodSteps {
			steps[i] = string(v.StepID)
		}
		outgoing := make([]string, len(node.OutgoingTransitions))
		for i, v := range node.OutgoingTransitions {
			outgoing[i] = string(v.TransitionID)
		}
		nodes = append(nodes, map[string]any{"node_id": string(node.NodeID), "action_kind": string(node.ActionKind), "payload_contract": node.PayloadContract, "entry_condition_ids": node.EntryConditionIDs, "completion_condition_ids": node.CompletionConditionIDs, "allowed_effects": effects, "required_evidence": evidence, "method_step_ids": steps, "outgoing_transition_ids": outgoing})
	}
	transitions := make([]any, 0, len(definition.Transitions))
	for _, v := range definition.Transitions {
		transitions = append(transitions, map[string]any{"transition_id": string(v.TransitionID), "source": string(v.Source), "destination": string(v.Destination), "guard_id": string(v.Guard), "reason_required": v.ReasonRequired})
	}
	projection := map[string]any{"process_id": string(definition.Reference.ID), "process_version": definition.Reference.Version, "entry_node": string(definition.EntryNode), "nodes": nodes, "transitions": transitions}
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
