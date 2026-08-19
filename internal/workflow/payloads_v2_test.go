package workflow

import (
	"encoding/json"
	"testing"
)

func TestV2PayloadDispatchIsClosedAndTransitionAware(t *testing.T) {
	valid := []byte(`{"transition_id":"requirements_ready","summary":"Requirements ready.","reason":"","artifacts":[],"method_evidence":[],"node_result":{"baseline":{"goal":"Goal","scope":[],"out_of_scope":[],"acceptance_criteria":["Accepted"],"constraints":[],"assumptions":[]},"unresolved_questions":[]}}`)
	envelope, result, err := DecodeStandardPayload("REQUIREMENTS", valid)
	if err != nil {
		t.Fatal(err)
	}
	if err := ValidatePayload(StandardProcess(), "REQUIREMENTS", envelope, result, StandardProcess().Nodes[0].SemanticMethodSteps); err != nil {
		t.Fatal(err)
	}
	wrong := func() []byte {
		var value map[string]any
		_ = json.Unmarshal(valid, &value)
		value["node_result"] = map[string]any{"findings": []string{}}
		raw, _ := json.Marshal(value)
		return raw
	}()
	for name, raw := range map[string][]byte{"unknown": []byte(`{"transition_id":"requirements_ready","summary":"Ready","reason":"","artifacts":[],"method_evidence":[],"node_result":{},"destination":"DESIGN"}`), "duplicate": []byte(`{"transition_id":"requirements_ready","transition_id":"requirements_ready","summary":"Ready","reason":"","artifacts":[],"method_evidence":[],"node_result":{}}`), "wrong branch": wrong} {
		t.Run(name, func(t *testing.T) {
			if _, _, err := DecodeStandardPayload("REQUIREMENTS", raw); err == nil {
				t.Fatal("invalid payload accepted")
			}
		})
	}
}

func TestV2PayloadReasonRulesAndForbiddenTransitions(t *testing.T) {
	raw := []byte(`{"transition_id":"design_requires_requirements","summary":"Gap found.","reason":"","artifacts":[],"method_evidence":[],"node_result":{"baseline":null,"findings":["Acceptance is unclear"]}}`)
	envelope, result, err := DecodeStandardPayload("DESIGN", raw)
	if err != nil {
		t.Fatal(err)
	}
	if err := ValidatePayload(StandardProcess(), "DESIGN", envelope, result, StandardProcess().Nodes[1].SemanticMethodSteps); err == nil {
		t.Fatal("missing reason accepted")
	}
	envelope.Reason = "Acceptance is unclear."
	if err := ValidatePayload(StandardProcess(), "DESIGN", envelope, result, StandardProcess().Nodes[1].SemanticMethodSteps); err != nil {
		t.Fatal(err)
	}
	envelope.TransitionID = "delivery_complete"
	if err := ValidatePayload(StandardProcess(), "DESIGN", envelope, result, nil); err == nil {
		t.Fatal("forbidden destination accepted")
	}
}
