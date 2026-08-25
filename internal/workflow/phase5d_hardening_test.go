package workflow

import (
	"errors"
	"testing"

	"github.com/Innocent-children/dev-flow/internal/domain"
)

func TestProblemClassMappingsCoverAll29Transitions(t *testing.T) {
	if len(standardTransitions) != 29 || len(problemClassByTransition) != 29 {
		t.Fatalf("transitions=%d mappings=%d", len(standardTransitions), len(problemClassByTransition))
	}
	for _, transition := range standardTransitions {
		class, ok := problemClassByTransition[transition.TransitionID]
		if !ok || !problemClassValidForNode(transition.Source, class) {
			t.Fatalf("missing/invalid class for %s", transition.TransitionID)
		}
		if transition.ReasonRequired == (class == ProblemNone) {
			t.Fatalf("reason/class mismatch for %s", transition.TransitionID)
		}
	}
}

func TestProblemClassMismatchRejectsTransitionSelection(t *testing.T) {
	definition := StandardProcess()
	tests := []struct {
		name       string
		source     domain.NodeID
		transition domain.TransitionID
		result     any
	}{
		{
			name: "implementation failure cannot choose design issue", source: domain.NodeTest,
			transition: "tests_expose_design_issue",
			result:     &TestResult{ProblemClass: ProblemImplementationFailure, Checks: []EvidenceInput{{Source: domain.EvidenceSourceAutomated, Name: "test", Status: domain.EvidenceFailed, Summary: "Failed.", CommandCount: 1}}, FailedItems: []string{"failure"}, Findings: []string{"Implementation failure"}},
		},
		{
			name: "code complexity cannot choose design complexity", source: domain.NodeComprehensionReview,
			transition: "design_too_complex",
			result:     &ComprehensionResult{ProblemClass: ProblemCodeComplexity, UnnecessaryAbstractions: []string{"factory"}, Findings: []string{"Code complexity"}},
		},
		{
			name: "delivery test gap cannot choose requirements", source: domain.NodeDelivery,
			transition: "delivery_needs_requirements",
			result:     &DeliveryResult{ProblemClass: ProblemTestGap, Findings: []string{"Test gap"}},
		},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			steps, evidence := phase5DMethodEvidence(t, definition, tc.source)
			envelope := StandardPayload{TransitionID: tc.transition, Summary: "Classified result.", Reason: "Remediation is required.", Artifacts: []domain.ArtifactReference{}, MethodEvidence: evidence}
			if err := ValidatePayload(definition, tc.source, envelope, tc.result, steps); !errors.Is(err, domain.ErrTransitionNotAllowed) {
				t.Fatalf("error=%v", err)
			}
		})
	}
}

func TestProblemClassClosedFactsAndForwardRules(t *testing.T) {
	definition := StandardProcess()
	steps, evidence := phase5DMethodEvidence(t, definition, domain.NodeDesign)
	unknown := &DesignResult{ProblemClass: "future", Baseline: &DesignBaselineInput{RequirementsRevision: 1, Approach: "Direct.", Decisions: []string{"Reuse."}}}
	if err := ValidatePayload(definition, domain.NodeDesign, StandardPayload{TransitionID: "design_ready", Summary: "Ready.", Artifacts: []domain.ArtifactReference{}, MethodEvidence: evidence}, unknown, steps); !errors.Is(err, domain.ErrInvalidArgument) {
		t.Fatalf("unknown class error=%v", err)
	}
	forwardWithFinding := &DesignResult{ProblemClass: ProblemNone, Baseline: &DesignBaselineInput{RequirementsRevision: 1, Approach: "Direct.", Decisions: []string{"Reuse."}}, Findings: []string{"Unexpected classification"}}
	if err := ValidatePayload(definition, domain.NodeDesign, StandardPayload{TransitionID: "design_ready", Summary: "Ready.", Artifacts: []domain.ArtifactReference{}, MethodEvidence: evidence}, forwardWithFinding, steps); !errors.Is(err, domain.ErrTransitionNotAllowed) {
		t.Fatalf("forward finding error=%v", err)
	}
	remediationWithoutFinding := &DesignResult{ProblemClass: ProblemRequirementGap}
	if err := ValidatePayload(definition, domain.NodeDesign, StandardPayload{TransitionID: "design_requires_requirements", Summary: "Gap.", Reason: "Requirement gap.", Artifacts: []domain.ArtifactReference{}, MethodEvidence: evidence}, remediationWithoutFinding, steps); !errors.Is(err, domain.ErrTransitionNotAllowed) {
		t.Fatalf("empty remediation finding error=%v", err)
	}
}

func phase5DMethodEvidence(t *testing.T, definition domain.ProcessDefinition, node domain.NodeID) ([]domain.SemanticMethodStep, []domain.MethodEvidence) {
	t.Helper()
	nodeDefinition, err := NodeDefinition(definition, node)
	if err != nil {
		t.Fatal(err)
	}
	items := make([]domain.MethodEvidence, len(nodeDefinition.SemanticMethodSteps))
	for i, step := range nodeDefinition.SemanticMethodSteps {
		items[i] = domain.MethodEvidence{StepID: step.StepID, Status: domain.MethodStepPlainFallback, Summary: "Completed the current semantic method step."}
	}
	return nodeDefinition.SemanticMethodSteps, items
}
