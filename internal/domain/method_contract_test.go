package domain

import (
	"strings"
	"testing"
)

func TestMethodProfileClosedVocabulary(t *testing.T) {
	for _, profile := range []MethodProfile{MethodPlain, MethodSpecKit, MethodOpenSpec} {
		if !profile.IsValid() {
			t.Fatalf("valid profile rejected: %s", profile)
		}
	}
	for _, profile := range []MethodProfile{"", "future", "speckit", "open-spec"} {
		if profile.IsValid() {
			t.Fatalf("invalid profile accepted: %s", profile)
		}
	}
}

func TestMethodEvidenceExactRequiredCoverage(t *testing.T) {
	steps := methodContractSteps()
	for _, tc := range []struct {
		name       string
		status     MethodStepStatus
		capability string
	}{
		{"completed", MethodStepCompleted, "installed-capability"},
		{"plain fallback", MethodStepPlainFallback, ""},
	} {
		t.Run(tc.name, func(t *testing.T) {
			if err := ValidateMethodEvidence(methodContractEvidence(steps, tc.status, tc.capability), steps); err != nil {
				t.Fatal(err)
			}
		})
	}

	for _, status := range []MethodStepStatus{MethodStepUnavailable, MethodStepNotRun} {
		evidence := methodContractEvidence(steps, status, "missing-capability")
		if err := ValidateMethodEvidence(evidence, steps); err != ErrTransitionNotAllowed {
			t.Fatalf("status=%s error=%v", status, err)
		}
	}
	if err := ValidateMethodEvidence(nil, steps); err != ErrTransitionNotAllowed {
		t.Fatalf("empty evidence error=%v", err)
	}
	missing := methodContractEvidence(steps[:2], MethodStepPlainFallback, "")
	if err := ValidateMethodEvidence(missing, steps); err != ErrTransitionNotAllowed {
		t.Fatalf("missing evidence error=%v", err)
	}
	outOfOrder := methodContractEvidence(steps, MethodStepPlainFallback, "")
	outOfOrder[0], outOfOrder[1] = outOfOrder[1], outOfOrder[0]
	if err := ValidateMethodEvidence(outOfOrder, steps); err != ErrTransitionNotAllowed {
		t.Fatalf("out-of-order evidence error=%v", err)
	}
}

func TestMethodEvidenceMalformedUnknownAndDuplicate(t *testing.T) {
	steps := methodContractSteps()
	valid := methodContractEvidence(steps, MethodStepPlainFallback, "")
	tests := []struct {
		name   string
		mutate func([]MethodEvidence) []MethodEvidence
	}{
		{"unknown step", func(items []MethodEvidence) []MethodEvidence { items[0].StepID = "other.step"; return items }},
		{"previous node step", func(items []MethodEvidence) []MethodEvidence {
			items[0].StepID = "design.choose_approach"
			return items
		}},
		{"duplicate step", func(items []MethodEvidence) []MethodEvidence { items[1].StepID = items[0].StepID; return items }},
		{"invalid status", func(items []MethodEvidence) []MethodEvidence { items[0].Status = "future"; return items }},
		{"invalid capability", func(items []MethodEvidence) []MethodEvidence { items[0].Capability = "bad capability"; return items }},
		{"completed without capability", func(items []MethodEvidence) []MethodEvidence {
			items[0].Status = MethodStepCompleted
			items[0].Capability = ""
			return items
		}},
		{"fallback with capability", func(items []MethodEvidence) []MethodEvidence { items[0].Capability = "fake-capability"; return items }},
		{"empty summary", func(items []MethodEvidence) []MethodEvidence { items[0].Summary = ""; return items }},
		{"untrimmed summary", func(items []MethodEvidence) []MethodEvidence { items[0].Summary = " summary"; return items }},
		{"oversized summary", func(items []MethodEvidence) []MethodEvidence {
			items[0].Summary = strings.Repeat("s", MaxEvidenceSummaryBytes+1)
			return items
		}},
		{"invalid UTF-8 summary", func(items []MethodEvidence) []MethodEvidence { items[0].Summary = string([]byte{0xff}); return items }},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			items := append([]MethodEvidence(nil), valid...)
			if err := ValidateMethodEvidence(tc.mutate(items), steps); err != ErrInvalidArgument {
				t.Fatalf("error=%v", err)
			}
		})
	}
}

func methodContractSteps() []SemanticMethodStep {
	return []SemanticMethodStep{
		{StepID: "requirements.capture", Purpose: "Capture requirements.", Required: true},
		{StepID: "requirements.clarify", Purpose: "Clarify requirements.", Required: true},
		{StepID: "requirements.validate", Purpose: "Validate requirements.", Required: true},
	}
}

func methodContractEvidence(steps []SemanticMethodStep, status MethodStepStatus, capability string) []MethodEvidence {
	items := make([]MethodEvidence, len(steps))
	for i, step := range steps {
		items[i] = MethodEvidence{StepID: step.StepID, Status: status, Capability: capability, Summary: "Completed the semantic method step."}
	}
	return items
}
