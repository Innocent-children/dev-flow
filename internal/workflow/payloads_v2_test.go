package workflow

import (
	"encoding/json"
	"github.com/Innocent-children/dev-flow/internal/domain"
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
func TestCanonicalValidatedPayloadIgnoresJSONFormatting(t *testing.T) {
	left := []byte(`{"transition_id":"requirements_ready","summary":"Ready.","reason":"","artifacts":[],"method_evidence":[],"node_result":{"baseline":{"goal":"Goal","scope":[],"out_of_scope":[],"acceptance_criteria":["Accepted"],"constraints":[],"assumptions":[]},"unresolved_questions":[]}}`)
	right := []byte(`{ "node_result": {"unresolved_questions":[],"baseline":{"assumptions":[],"constraints":[],"acceptance_criteria":["Accepted"],"out_of_scope":[],"scope":[],"goal":"Goal"}},"method_evidence":[],"artifacts":[],"reason":"","summary":"Ready.","transition_id":"requirements_ready"}`)
	a, ar, err := DecodeStandardPayload(domain.NodeRequirements, left)
	if err != nil {
		t.Fatal(err)
	}
	b, br, err := DecodeStandardPayload(domain.NodeRequirements, right)
	if err != nil {
		t.Fatal(err)
	}
	ca, _ := CanonicalValidatedPayload(a, ar)
	cb, _ := CanonicalValidatedPayload(b, br)
	if string(ca) != string(cb) {
		t.Fatalf("canonical drift\n%s\n%s", ca, cb)
	}
}
