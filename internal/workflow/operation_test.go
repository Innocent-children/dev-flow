package workflow

import (
	"encoding/json"
	"testing"

	"github.com/Innocent-children/dev-flow/internal/domain"
)

func TestGraphOperationReferenceRejectsProcessSourceAndActionMismatch(t *testing.T) {
	process := StandardProcess().Reference
	base := domain.OperationReference{OperationID: "operation", Process: process, SourceCursor: domain.NodeRefactor, ExpectedRevision: 3, ActionID: "action", ActionKind: domain.ActionCompleteRefactor, RepositoryBindingDigest: process.DefinitionDigest}
	if err := ValidateOperationReference(base); err != nil {
		t.Fatal(err)
	}
	for name, mutate := range map[string]func(*domain.OperationReference){
		"process id": func(v *domain.OperationReference) { v.Process.ID = "alternate" },
		"digest": func(v *domain.OperationReference) {
			v.Process.DefinitionDigest = domain.Digest("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")
		},
		"terminal source": func(v *domain.OperationReference) { v.SourceCursor = domain.NodeDone },
		"action mismatch": func(v *domain.OperationReference) { v.ActionKind = domain.ActionCompleteTest },
	} {
		t.Run(name, func(t *testing.T) {
			candidate := base
			mutate(&candidate)
			if ValidateOperationReference(candidate) == nil {
				t.Fatal("invalid reference accepted")
			}
		})
	}
}

func TestGraphOperationDigestUsesCanonicalPayload(t *testing.T) {
	process := StandardProcess().Reference
	operation := domain.OperationReference{OperationID: "operation", Process: process, SourceCursor: domain.NodeRequirements, ExpectedRevision: 1, ActionID: "action", ActionKind: domain.ActionCompleteRequirements, RepositoryBindingDigest: process.DefinitionDigest}
	leftEnvelope, leftResult, err := DecodeStandardPayload(domain.NodeRequirements, []byte(`{"transition_id":"requirements_ready","summary":"Ready.","reason":"","artifacts":[],"method_evidence":[{"step_id":"requirements.capture","status":"plain_fallback","capability":"","summary":"Done."},{"step_id":"requirements.clarify","status":"plain_fallback","capability":"","summary":"Done."},{"step_id":"requirements.validate","status":"plain_fallback","capability":"","summary":"Done."}],"node_result":{"problem_class":"none","baseline":{"goal":"Goal","scope":[],"out_of_scope":[],"acceptance_criteria":["Works"],"constraints":[],"assumptions":[]},"unresolved_questions":[]}}`))
	if err != nil {
		t.Fatal(err)
	}
	canonical, err := CanonicalValidatedPayload(leftEnvelope, leftResult)
	if err != nil {
		t.Fatal(err)
	}
	digestOne, err := GraphOperationDigest(domain.HostCodex, "task", operation, json.RawMessage(canonical))
	if err != nil {
		t.Fatal(err)
	}
	digestTwo, err := GraphOperationDigest(domain.HostCodex, "task", operation, json.RawMessage(canonical))
	if err != nil || digestOne != digestTwo {
		t.Fatal("canonical digest unstable")
	}
}
