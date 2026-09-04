package workflow

import (
	"encoding/json"
	"errors"
	"fmt"
	"testing"

	"github.com/Innocent-children/dev-flow/internal/domain"
)

func evidenceInput(source domain.EvidenceSource, status domain.EvidenceStatus, name string, commands int, full bool) EvidenceInput {
	reason := ""
	if full {
		reason = "The changed shared contract reaches every package in the suite."
	}
	return EvidenceInput{Source: source, Name: name, Status: status, Summary: "Evidence summary.", CommandCount: commands, FullSuite: full, FullSuiteReason: reason}
}

// TestEvidenceSourceMatrixRulesAndViolationPaths covers the four evidence source
// branches and proves the boolean validator and the published violation agree.
func TestEvidenceSourceMatrixRulesAndViolationPaths(t *testing.T) {
	cases := []struct {
		name  string
		input EvidenceInput
		rules []domain.ViolationRule
	}{
		{"automated one command", evidenceInput(domain.EvidenceSourceAutomated, domain.EvidencePassed, "targeted", 1, false), nil},
		{"automated full suite", evidenceInput(domain.EvidenceSourceAutomated, domain.EvidencePassed, "targeted", 20, true), nil},
		{"automated zero commands", evidenceInput(domain.EvidenceSourceAutomated, domain.EvidencePassed, "targeted", 0, false), []domain.ViolationRule{domain.RuleAutomatedCommandCountPositive}},
		{"automated over limit", evidenceInput(domain.EvidenceSourceAutomated, domain.EvidencePassed, "targeted", 21, false), []domain.ViolationRule{domain.RuleAutomatedCommandCountLimit}},
		{"user zero commands", evidenceInput(domain.EvidenceSourceUser, domain.EvidencePassed, "manual", 0, false), nil},
		{"user one command", evidenceInput(domain.EvidenceSourceUser, domain.EvidencePassed, "manual", 1, false), []domain.ViolationRule{domain.RuleNonAutomatedCommandCountZero}},
		{"user full suite", evidenceInput(domain.EvidenceSourceUser, domain.EvidencePassed, "manual", 0, true), []domain.ViolationRule{domain.RuleNonAutomatedFullSuiteFalse}},
		{"static zero commands", evidenceInput(domain.EvidenceSourceStatic, domain.EvidencePassed, "static", 0, false), nil},
		{"static one command", evidenceInput(domain.EvidenceSourceStatic, domain.EvidencePassed, "static", 1, false), []domain.ViolationRule{domain.RuleNonAutomatedCommandCountZero}},
		{"host observed zero commands", evidenceInput(domain.EvidenceSourceHostObserved, "observed", "observed", 0, false), nil},
		{"host observed full suite", evidenceInput(domain.EvidenceSourceHostObserved, "observed", "observed", 0, true), []domain.ViolationRule{domain.RuleNonAutomatedFullSuiteFalse}},
		{"invalid source", evidenceInput("manual", domain.EvidencePassed, "manual", 0, false), []domain.ViolationRule{domain.RuleEvidenceSourceInvalid}},
		{"invalid status", evidenceInput(domain.EvidenceSourceUser, "done", "manual", 0, false), []domain.ViolationRule{domain.RuleEvidenceStatusInvalid}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			err := validateNormalizedEvidenceInput(tc.input)
			if (err == nil) != (len(tc.rules) == 0) {
				t.Fatalf("validator=%v rules=%v", err, tc.rules)
			}
			violations := EvidenceViolations("payload.node_result.checks[2]", tc.input)
			if len(violations) != len(tc.rules) {
				t.Fatalf("violations=%#v want rules=%v", violations, tc.rules)
			}
			for index, want := range tc.rules {
				if violations[index].Rule != want {
					t.Fatalf("violation %d rule=%s want=%s", index, violations[index].Rule, want)
				}
				if !domain.ValidViolationPath(violations[index].Path) {
					t.Fatalf("violation %d path=%q", index, violations[index].Path)
				}
				if violations[index].Message != want.Message() {
					t.Fatalf("violation %d message=%q", index, violations[index].Message)
				}
			}
		})
	}
}

// TestEvidenceViolationOrderIsStable proves the same input always produces the
// same paths, rules and order.
func TestEvidenceViolationOrderIsStable(t *testing.T) {
	input := evidenceInput(domain.EvidenceSourceUser, domain.EvidencePassed, "manual", 4, true)
	first := EvidenceViolations("payload.node_result.checks[0]", input)
	for attempt := 0; attempt < 8; attempt++ {
		again := EvidenceViolations("payload.node_result.checks[0]", input)
		if len(again) != len(first) {
			t.Fatalf("unstable violation count %d vs %d", len(again), len(first))
		}
		for index := range first {
			if again[index] != first[index] {
				t.Fatalf("unstable violation %d: %#v vs %#v", index, again[index], first[index])
			}
		}
	}
	if len(first) != 2 || first[0].Path != "payload.node_result.checks[0].command_count" || first[1].Path != "payload.node_result.checks[0].full_suite" {
		t.Fatalf("violations=%#v", first)
	}
}

// TestPayloadProblemClassGuardFailuresNameTheLiveGuard covers the forward and
// remediation guard rules.
func TestPayloadProblemClassGuardFailuresNameTheLiveGuard(t *testing.T) {
	definition := StandardProcess()
	node, err := NodeDefinition(definition, domain.NodeImplement)
	if err != nil {
		t.Fatal(err)
	}
	evidence := make([]domain.MethodEvidence, 0, len(node.SemanticMethodSteps))
	for _, step := range node.SemanticMethodSteps {
		evidence = append(evidence, domain.MethodEvidence{StepID: step.StepID, Status: domain.MethodStepPlainFallback, Summary: "Completed the current semantic method step."})
	}
	forwardWithFindings := &ImplementationResult{ProblemClass: ProblemNone, TaskPlanRevision: 1, CompletedWorkItemIDs: []domain.ID{"work-a"}, Findings: []string{"An unresolved design gap"}}
	envelope := StandardPayload{TransitionID: "implementation_ready_for_test", Summary: "Implementation complete.", Artifacts: []domain.ArtifactReference{}, MethodEvidence: evidence}
	err = ValidatePayload(definition, domain.NodeImplement, envelope, forwardWithFindings, node.SemanticMethodSteps)
	if !errors.Is(err, domain.ErrTransitionNotAllowed) {
		t.Fatalf("error=%v", err)
	}
	var typed *domain.Error
	if !errors.As(err, &typed) || typed.Guard == nil {
		t.Fatalf("failure carries no guard detail: %v", err)
	}
	if typed.Guard.GuardID != "implementation_report_complete" || !KnownTransitionGuard(typed.Guard.GuardID) {
		t.Fatalf("guard=%#v", typed.Guard)
	}
	if len(typed.Guard.Failures) != 1 || typed.Guard.Failures[0].Path != "payload.node_result.findings" || typed.Guard.Failures[0].Rule != domain.ViolationRule(domain.GuardForwardFindingsEmpty) {
		t.Fatalf("guard failures=%#v", typed.Guard.Failures)
	}

	remediationWithoutFindings := &ImplementationResult{ProblemClass: ProblemDesignGap, TaskPlanRevision: 1, CompletedWorkItemIDs: []domain.ID{}, Findings: []string{}}
	remediation := StandardPayload{TransitionID: "implementation_requires_design", Summary: "Design gap found.", Reason: "Design gap.", Artifacts: []domain.ArtifactReference{}, MethodEvidence: evidence}
	err = ValidatePayload(definition, domain.NodeImplement, remediation, remediationWithoutFindings, node.SemanticMethodSteps)
	if !errors.As(err, &typed) || typed.Guard == nil || typed.Guard.Failures[0].Rule != domain.ViolationRule(domain.GuardProblemFindingsPresent) {
		t.Fatalf("remediation guard=%v", err)
	}

	mismatch := &ImplementationResult{ProblemClass: ProblemRequirementGap, TaskPlanRevision: 1, CompletedWorkItemIDs: []domain.ID{}, Findings: []string{"A requirement gap"}}
	err = ValidatePayload(definition, domain.NodeImplement, remediation, mismatch, node.SemanticMethodSteps)
	if !errors.As(err, &typed) || typed.Guard == nil || typed.Guard.Failures[0].Rule != domain.ViolationRule(domain.GuardProblemClassTransitionMismatch) {
		t.Fatalf("mismatch guard=%v", err)
	}
}

// TestPayloadDeviationsDoNotBlockForwardTransition keeps the current semantics.
func TestPayloadDeviationsDoNotBlockForwardTransition(t *testing.T) {
	definition := StandardProcess()
	node, err := NodeDefinition(definition, domain.NodeImplement)
	if err != nil {
		t.Fatal(err)
	}
	evidence := make([]domain.MethodEvidence, 0, len(node.SemanticMethodSteps))
	for _, step := range node.SemanticMethodSteps {
		evidence = append(evidence, domain.MethodEvidence{StepID: step.StepID, Status: domain.MethodStepPlainFallback, Summary: "Completed the current semantic method step."})
	}
	result := &ImplementationResult{ProblemClass: ProblemNone, TaskPlanRevision: 1, CompletedWorkItemIDs: []domain.ID{"work-a"}, Deviations: []string{"Renamed one helper"}, Findings: []string{}}
	envelope := StandardPayload{TransitionID: "implementation_ready_for_test", Summary: "Implementation complete.", Artifacts: []domain.ArtifactReference{}, MethodEvidence: evidence}
	if err := ValidatePayload(definition, domain.NodeImplement, envelope, result, node.SemanticMethodSteps); err != nil {
		t.Fatalf("recorded deviations blocked the forward transition: %v", err)
	}
}

// TestPayloadRequiredAndUnknownMemberViolations covers the closed-contract rules.
func TestPayloadRequiredAndUnknownMemberViolations(t *testing.T) {
	node, err := NodeDefinition(StandardProcess(), domain.NodeTest)
	if err != nil {
		t.Fatal(err)
	}
	methodEvidence := make([]any, 0, len(node.SemanticMethodSteps))
	for _, step := range node.SemanticMethodSteps {
		methodEvidence = append(methodEvidence, map[string]any{"step_id": step.StepID, "status": string(domain.MethodStepPlainFallback), "capability": "", "summary": "Completed the current semantic method step."})
	}
	base := map[string]any{
		"transition_id":   "tests_passed",
		"summary":         "Tests passed.",
		"reason":          "",
		"artifacts":       []any{},
		"method_evidence": methodEvidence,
		"node_result": map[string]any{
			"problem_class": "none", "checks": []any{}, "failed_items": []any{}, "unverified_items": []any{},
			"manual_handoff_items": []any{}, "findings": []any{}, "budget_adjustment": nil,
		},
	}
	missing := cloneMap(base)
	delete(missing["node_result"].(map[string]any), "manual_handoff_items")
	assertPayloadViolation(t, missing, "payload.node_result.manual_handoff_items", domain.RuleRequiredMemberMissing)

	unknown := cloneMap(base)
	unknown["node_result"].(map[string]any)["extra_member"] = true
	assertPayloadViolation(t, unknown, "payload.node_result.extra_member", domain.RuleUnknownMember)

	nestedUnknown := cloneMap(base)
	nestedUnknown["node_result"].(map[string]any)["checks"] = []any{map[string]any{
		"source": "user", "name": "manual", "status": "passed", "summary": "Manual check.",
		"command_count": 0, "full_suite": false, "full_suite_reason": "", "extra_member": true,
	}}
	assertPayloadViolation(t, nestedUnknown, "payload.node_result.checks[0].extra_member", domain.RuleUnknownMember)

	missingEnvelope := cloneMap(base)
	delete(missingEnvelope, "reason")
	assertPayloadViolation(t, missingEnvelope, "payload.reason", domain.RuleRequiredMemberMissing)

	legacyPaths := cloneMap(base)
	legacyPaths["node_result"].(map[string]any)["changed_paths"] = []any{}
	assertPayloadViolation(t, legacyPaths, "payload.node_result.changed_paths", domain.RuleUnknownMember)
	legacyNoFileChanges := cloneMap(base)
	legacyNoFileChanges["node_result"].(map[string]any)["no_file_changes"] = true
	assertPayloadViolation(t, legacyNoFileChanges, "payload.node_result.no_file_changes", domain.RuleUnknownMember)

	tooManyFailedItems := make([]any, domain.MaxBoundedStringListItems+1)
	for index := range tooManyFailedItems {
		tooManyFailedItems[index] = fmt.Sprintf("failure-%d", index)
	}
	oversizedList := cloneMap(base)
	oversizedList["node_result"].(map[string]any)["failed_items"] = tooManyFailedItems
	assertPayloadViolation(t, oversizedList, "payload.node_result.failed_items", domain.RuleStringListTooLong)
}

func cloneMap(value map[string]any) map[string]any {
	raw, err := json.Marshal(value)
	if err != nil {
		panic(err)
	}
	var out map[string]any
	if err := json.Unmarshal(raw, &out); err != nil {
		panic(err)
	}
	return out
}
func assertPayloadViolation(t *testing.T, payload map[string]any, path string, rule domain.ViolationRule) {
	t.Helper()
	raw, err := json.Marshal(payload)
	if err != nil {
		t.Fatal(err)
	}
	validationErr := ValidateRetainedPayload(domain.NodeTest, raw)
	if !errors.Is(validationErr, domain.ErrInvalidArgument) {
		t.Fatalf("error=%v", validationErr)
	}
	var typed *domain.Error
	if !errors.As(validationErr, &typed) {
		t.Fatalf("failure is not structured: %v", validationErr)
	}
	for _, violation := range typed.Violations {
		if violation.Path == path && violation.Rule == rule {
			return
		}
	}
	t.Fatalf("no %s violation at %s: %#v", rule, path, typed.Violations)
}

// TestVerificationBudgetKeepsAutomaticAttributionForUserEvidence proves a
// completed user verification does not consume the automatic command budget.
func TestVerificationBudgetKeepsAutomaticAttributionForUserEvidence(t *testing.T) {
	budget := domain.VerificationBudget{Level: domain.VerificationTargeted, MaxAutomaticCommands: 4, AllowManualHandoff: true}
	incoming := []NormalizedEvidenceInput{
		evidenceInput(domain.EvidenceSourceAutomated, domain.EvidencePassed, "workflow", 1, false),
		evidenceInput(domain.EvidenceSourceAutomated, domain.EvidencePassed, "application", 1, false),
		evidenceInput(domain.EvidenceSourceAutomated, domain.EvidencePassed, "mcp", 1, false),
		evidenceInput(domain.EvidenceSourceAutomated, domain.EvidencePassed, "host", 1, false),
		evidenceInput(domain.EvidenceSourceUser, domain.EvidencePassed, "manual-manager-check", 0, false),
	}
	if err := EvaluateVerificationBudget(budget, 1, nil, incoming, nil); err != nil {
		t.Fatalf("user evidence consumed the automatic budget: %v", err)
	}
	overBudget := append(append([]NormalizedEvidenceInput(nil), incoming...), evidenceInput(domain.EvidenceSourceAutomated, domain.EvidencePassed, "extra", 1, false))
	if err := EvaluateVerificationBudget(budget, 1, nil, overBudget, nil); !errors.Is(err, domain.ErrVerificationBudgetExceeded) {
		t.Fatalf("budget error=%v", err)
	}
}
