package workflow

import (
	"crypto/sha256"
	"encoding/json"
	"github.com/Innocent-children/dev-flow/internal/domain"
	"testing"
)

const requirementsMethodEvidenceJSON = `[{"step_id":"requirements.capture","status":"plain_fallback","capability":"","summary":"Captured requirements."},{"step_id":"requirements.clarify","status":"plain_fallback","capability":"","summary":"Clarified requirements."},{"step_id":"requirements.validate","status":"plain_fallback","capability":"","summary":"Validated requirements."}]`
const requirementsMethodEvidenceReorderedJSON = `[{"summary":"Captured requirements.","capability":"","status":"plain_fallback","step_id":"requirements.capture"},{"summary":"Clarified requirements.","capability":"","status":"plain_fallback","step_id":"requirements.clarify"},{"summary":"Validated requirements.","capability":"","status":"plain_fallback","step_id":"requirements.validate"}]`
const designMethodEvidenceJSON = `[{"step_id":"design.choose_approach","status":"plain_fallback","capability":"","summary":"Selected the approach."},{"step_id":"design.review_complexity","status":"plain_fallback","capability":"","summary":"Reviewed complexity."},{"step_id":"design.record_decisions","status":"plain_fallback","capability":"","summary":"Recorded decisions."}]`

func TestV2PayloadDispatchIsClosedAndTransitionAware(t *testing.T) {
	valid := []byte(`{"transition_id":"requirements_ready","summary":"Requirements ready.","reason":"","artifacts":[],"method_evidence":` + requirementsMethodEvidenceJSON + `,"node_result":{"problem_class":"none","baseline":{"goal":"Goal","scope":[],"out_of_scope":[],"acceptance_criteria":["Accepted"],"constraints":[],"assumptions":[]},"unresolved_questions":[]}}`)
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

func TestMethodEvidenceChangesCanonicalPayloadDigest(t *testing.T) {
	result := &RequirementsResult{ProblemClass: ProblemNone, Baseline: &RequirementsBaselineInput{Goal: "Goal", AcceptanceCriteria: []string{"Accepted"}}, UnresolvedQuestions: []string{}}
	base := StandardPayload{TransitionID: "requirements_ready", Summary: "Ready.", Reason: "", Artifacts: []domain.ArtifactReference{}, MethodEvidence: []domain.MethodEvidence{
		{StepID: "requirements.capture", Status: domain.MethodStepCompleted, Capability: "capability-a", Summary: "Captured requirements."},
		{StepID: "requirements.clarify", Status: domain.MethodStepCompleted, Capability: "capability-a", Summary: "Clarified requirements."},
		{StepID: "requirements.validate", Status: domain.MethodStepCompleted, Capability: "capability-a", Summary: "Validated requirements."},
	}}
	canonical, err := CanonicalValidatedPayload(base, result)
	if err != nil {
		t.Fatal(err)
	}
	wantDifferent := sha256.Sum256(canonical)
	for name, mutate := range map[string]func(*StandardPayload){
		"step": func(value *StandardPayload) { value.MethodEvidence[0].StepID = "requirements.capture_v2" },
		"status": func(value *StandardPayload) {
			value.MethodEvidence[0].Status = domain.MethodStepPlainFallback
			value.MethodEvidence[0].Capability = ""
		},
		"capability": func(value *StandardPayload) { value.MethodEvidence[0].Capability = "capability-b" },
		"summary":    func(value *StandardPayload) { value.MethodEvidence[0].Summary = "Different summary." },
	} {
		t.Run(name, func(t *testing.T) {
			changed := base
			changed.MethodEvidence = append([]domain.MethodEvidence(nil), base.MethodEvidence...)
			mutate(&changed)
			raw, err := CanonicalValidatedPayload(changed, result)
			if err != nil || sha256.Sum256(raw) == wantDifferent {
				t.Fatal("MethodEvidence change did not change canonical payload digest")
			}
		})
	}
}

func TestV2PayloadReasonRulesAndForbiddenTransitions(t *testing.T) {
	raw := []byte(`{"transition_id":"design_requires_requirements","summary":"Gap found.","reason":"","artifacts":[],"method_evidence":` + designMethodEvidenceJSON + `,"node_result":{"problem_class":"requirement_gap","baseline":null,"findings":["Acceptance is unclear"]}}`)
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
	left := []byte(`{"transition_id":"requirements_ready","summary":"Ready.","reason":"","artifacts":[],"method_evidence":` + requirementsMethodEvidenceJSON + `,"node_result":{"problem_class":"none","baseline":{"goal":"Goal","scope":[],"out_of_scope":[],"acceptance_criteria":["Accepted"],"constraints":[],"assumptions":[]},"unresolved_questions":[]}}`)
	right := []byte(`{ "node_result": {"unresolved_questions":[],"problem_class":"none","baseline":{"assumptions":[],"constraints":[],"acceptance_criteria":["Accepted"],"out_of_scope":[],"scope":[],"goal":"Goal"}},"method_evidence":` + requirementsMethodEvidenceReorderedJSON + `,"artifacts":[],"reason":"","summary":"Ready.","transition_id":"requirements_ready"}`)
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
