package workflow

import (
	"encoding/json"
	"github.com/Innocent-children/dev-flow/internal/domain"
	"testing"
)

func TestV2PayloadDispatchIsClosedAndTransitionAware(t *testing.T) {
	valid := []byte(`{"transition_id":"requirements_ready","summary":"Requirements ready.","reason":"","artifacts":[],"method_evidence":[],"node_result":{"problem_class":"none","baseline":{"goal":"Goal","scope":[],"out_of_scope":[],"acceptance_criteria":["Accepted"],"constraints":[],"assumptions":[]},"unresolved_questions":[]}}`)
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
	raw := []byte(`{"transition_id":"design_requires_requirements","summary":"Gap found.","reason":"","artifacts":[],"method_evidence":[],"node_result":{"problem_class":"requirement_gap","baseline":null,"findings":["Acceptance is unclear"]}}`)
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
	left := []byte(`{"transition_id":"requirements_ready","summary":"Ready.","reason":"","artifacts":[],"method_evidence":[],"node_result":{"problem_class":"none","baseline":{"goal":"Goal","scope":[],"out_of_scope":[],"acceptance_criteria":["Accepted"],"constraints":[],"assumptions":[]},"unresolved_questions":[]}}`)
	right := []byte(`{ "node_result": {"unresolved_questions":[],"problem_class":"none","baseline":{"assumptions":[],"constraints":[],"acceptance_criteria":["Accepted"],"out_of_scope":[],"scope":[],"goal":"Goal"}},"method_evidence":[],"artifacts":[],"reason":"","summary":"Ready.","transition_id":"requirements_ready"}`)
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

func TestPhase5BReasonRulesMatchAllStandardTransitions(t *testing.T) {
	reasonFree := map[domain.TransitionID]bool{
		"requirements_ready": true, "design_ready": true, "tasks_ready": true,
		"implementation_ready_for_test": true, "tests_passed": true, "comprehension_passed": true,
		"refactor_ready_for_test": true, "delivery_complete": true,
	}
	if len(standardTransitions) != 29 {
		t.Fatalf("transition count=%d", len(standardTransitions))
	}
	for _, transition := range standardTransitions {
		if transition.ReasonRequired == reasonFree[transition.TransitionID] {
			t.Fatalf("reason rule mismatch for %s", transition.TransitionID)
		}
		if transition.ReasonRequired {
			if validReason("", true) || !validReason("bounded reason", true) {
				t.Fatalf("required reason validation mismatch for %s", transition.TransitionID)
			}
		} else if validReason("unexpected", false) || !validReason("", false) {
			t.Fatalf("reason-free validation mismatch for %s", transition.TransitionID)
		}
	}
}
