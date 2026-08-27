package mcp

import (
	"encoding/json"
	"strings"
	"testing"

	"github.com/Innocent-children/dev-flow/internal/domain"
)

func decodeEnvelope(t *testing.T, encoded EncodedResult) Envelope {
	t.Helper()
	var envelope Envelope
	if err := json.Unmarshal(encoded.JSON, &envelope); err != nil {
		t.Fatal(err)
	}
	return envelope
}

// TestApplyErrorDetailsProjectClosedFieldViolations covers the public
// INVALID_ARGUMENT shape with field-level detail.
func TestApplyErrorDetailsProjectClosedFieldViolations(t *testing.T) {
	failure := domain.InvalidArgumentViolations(
		domain.Violation("payload.node_result.checks[3].command_count", domain.RuleNonAutomatedCommandCountZero),
	)
	encoded := EncodeError("request-detail", ToolSubmitTest, failure)
	if !encoded.IsError {
		t.Fatal("a contract failure must be an error result")
	}
	envelope := decodeEnvelope(t, encoded)
	if envelope.Error == nil || envelope.Error.Code != domain.ErrorInvalidArgument {
		t.Fatalf("error=%#v", envelope.Error)
	}
	if envelope.Error.Message != "The request does not match the closed Core contract." {
		t.Fatalf("message=%q", envelope.Error.Message)
	}
	if len(envelope.Error.Details) != 1 {
		t.Fatalf("details=%#v", envelope.Error.Details)
	}
	detail := envelope.Error.Details[0]
	if detail.Path != "node_result.checks[3].command_count" || detail.Rule != domain.RuleNonAutomatedCommandCountZero {
		t.Fatalf("detail=%#v", detail)
	}
	if !strings.Contains(detail.Message, "command_count must equal 0") {
		t.Fatalf("detail message=%q", detail.Message)
	}
	if envelope.Recovery == nil || !envelope.Recovery.RetrySafe || envelope.Recovery.Action != correctCurrentAction {
		t.Fatalf("recovery=%#v", envelope.Recovery)
	}
	if len(envelope.Recovery.AllowedPaths) != 1 || envelope.Recovery.AllowedPaths[0] != detail.Path {
		t.Fatalf("allowed paths=%#v", envelope.Recovery.AllowedPaths)
	}
}

// TestApplyErrorGuardProjectsClosedGuardFailure covers the public
// TRANSITION_NOT_ALLOWED shape with guard detail.
func TestApplyErrorGuardProjectsClosedGuardFailure(t *testing.T) {
	failure := domain.TransitionGuardFailure("implementation_report_complete",
		domain.GuardViolation("payload.node_result.findings", domain.GuardForwardFindingsEmpty),
	)
	envelope := decodeEnvelope(t, EncodeError("request-guard", ToolSubmitImplementation, failure))
	if envelope.Error == nil || envelope.Error.Code != domain.ErrorTransitionNotAllowed {
		t.Fatalf("error=%#v", envelope.Error)
	}
	if envelope.Error.Message != "The transition guard was not satisfied." {
		t.Fatalf("message=%q", envelope.Error.Message)
	}
	if envelope.Error.Guard == nil || envelope.Error.Guard.GuardID != "implementation_report_complete" {
		t.Fatalf("guard=%#v", envelope.Error.Guard)
	}
	if len(envelope.Error.Guard.Failures) != 1 {
		t.Fatalf("guard failures=%#v", envelope.Error.Guard.Failures)
	}
	failureDetail := envelope.Error.Guard.Failures[0]
	if failureDetail.Path != "node_result.findings" || string(failureDetail.Rule) != string(domain.GuardForwardFindingsEmpty) {
		t.Fatalf("guard failure=%#v", failureDetail)
	}
	if envelope.Recovery == nil || !envelope.Recovery.RetrySafe || len(envelope.Recovery.AllowedPaths) != 1 {
		t.Fatalf("recovery=%#v", envelope.Recovery)
	}
}

// TestApplyErrorGuardRejectsUnknownGuardIdentity keeps a guard shape out of the
// public result unless the identifier exists in the live Process Definition.
func TestApplyErrorGuardRejectsUnknownGuardIdentity(t *testing.T) {
	failure := &domain.Error{Code: domain.ErrorTransitionNotAllowed, Message: "the transition is not allowed from the current node", ZeroWrite: true,
		Guard: &domain.GuardFailure{GuardID: "invented_guard", Failures: []domain.ContractViolation{{Path: "payload.node_result.findings", Rule: domain.ViolationRule(domain.GuardForwardFindingsEmpty), Message: domain.GuardForwardFindingsEmpty.Message()}}}}
	envelope := decodeEnvelope(t, EncodeError("request-unknown-guard", ToolSubmitImplementation, failure))
	if envelope.Error == nil || envelope.Error.Guard != nil {
		t.Fatalf("guard=%#v", envelope.Error)
	}
	if envelope.Recovery == nil || envelope.Recovery.RetrySafe {
		t.Fatalf("recovery=%#v", envelope.Recovery)
	}
}

// TestApplyErrorKeepsPreviousShapeWithoutSafeDetail proves the public result is
// unchanged when Core has no field-level detail.
func TestApplyErrorKeepsPreviousShapeWithoutSafeDetail(t *testing.T) {
	for _, failure := range []error{domain.ErrInvalidArgument, domain.ErrTransitionNotAllowed, domain.ErrInternal, domain.ErrRepositoryDrift, domain.ErrActionStale, domain.ErrRevisionConflict} {
		envelope := decodeEnvelope(t, EncodeError("request-plain", ToolSubmitTest, failure))
		if envelope.Error == nil || len(envelope.Error.Details) != 0 || envelope.Error.Guard != nil {
			t.Fatalf("%v projected detail: %#v", failure, envelope.Error)
		}
		if envelope.Recovery == nil || envelope.Recovery.RetrySafe || len(envelope.Recovery.AllowedPaths) != 0 {
			t.Fatalf("%v recovery=%#v", failure, envelope.Recovery)
		}
	}
}

// TestApplyErrorUncertainWriteKeepsNoCorrection proves an unproven zero-write
// failure never offers a bounded correction.
func TestApplyErrorUncertainWriteKeepsNoCorrection(t *testing.T) {
	proven := domain.InvalidArgumentViolations(domain.Violation("payload.node_result.checks[0].full_suite", domain.RuleNonAutomatedFullSuiteFalse))
	uncertain := domain.WithoutZeroWriteProof(proven)
	envelope := decodeEnvelope(t, EncodeError("request-uncertain", ToolSubmitTest, uncertain))
	if envelope.Error == nil || len(envelope.Error.Details) != 1 {
		t.Fatalf("error=%#v", envelope.Error)
	}
	if envelope.Recovery == nil || envelope.Recovery.RetrySafe || len(envelope.Recovery.AllowedPaths) != 0 {
		t.Fatalf("recovery=%#v", envelope.Recovery)
	}
	if envelope.Recovery.Action == correctCurrentAction {
		t.Fatal("an uncertain write offered a correction")
	}
}

// TestApplyErrorDetailRejectsUnsafePathsAndRules keeps unknown rules and unsafe
// paths out of the public result.
func TestApplyErrorDetailRejectsUnsafePathsAndRules(t *testing.T) {
	failure := &domain.Error{Code: domain.ErrorInvalidArgument, Message: "the domain value is invalid", ZeroWrite: true, Violations: []domain.ContractViolation{
		{Path: "/Users/private/secret.db", Rule: domain.RuleTextNotNormalized, Message: "unsafe path"},
		{Path: "payload.node_result.findings", Rule: "invented_rule", Message: "unknown rule"},
		{Path: "payload.node_result.changed_paths", Rule: domain.RuleRepositoryMutationInconsistent, Message: domain.RuleRepositoryMutationInconsistent.Message()},
	}}
	envelope := decodeEnvelope(t, EncodeError("request-unsafe", ToolSubmitTest, failure))
	if len(envelope.Error.Details) != 1 || envelope.Error.Details[0].Path != "node_result.changed_paths" {
		t.Fatalf("details=%#v", envelope.Error.Details)
	}
	text := string(EncodeError("request-unsafe", ToolSubmitTest, failure).JSON)
	for _, forbidden := range []string{"/Users/", "secret.db", "invented_rule"} {
		if strings.Contains(text, forbidden) {
			t.Fatalf("public result leaked %q: %s", forbidden, text)
		}
	}
}

// TestApplyErrorDetailIsStableAcrossEncodes proves the same failure always
// produces the same paths, rules and order.
func TestApplyErrorDetailIsStableAcrossEncodes(t *testing.T) {
	build := func() error {
		return domain.InvalidArgumentViolations(
			domain.Violation("payload.node_result.checks[1].full_suite", domain.RuleNonAutomatedFullSuiteFalse),
			domain.Violation("payload.node_result.checks[0].command_count", domain.RuleNonAutomatedCommandCountZero),
			domain.Violation("payload.node_result.checks[0].source", domain.RuleEvidenceSourceInvalid),
		)
	}
	first := EncodeError("request-stable", ToolSubmitTest, build())
	for attempt := 0; attempt < 8; attempt++ {
		again := EncodeError("request-stable", ToolSubmitTest, build())
		if string(again.JSON) != string(first.JSON) {
			t.Fatalf("unstable public failure:\n%s\n%s", first.JSON, again.JSON)
		}
	}
	envelope := decodeEnvelope(t, first)
	want := []string{"node_result.checks[0].command_count", "node_result.checks[0].source", "node_result.checks[1].full_suite"}
	if len(envelope.Error.Details) != len(want) {
		t.Fatalf("details=%#v", envelope.Error.Details)
	}
	for index, path := range want {
		if envelope.Error.Details[index].Path != path {
			t.Fatalf("detail %d path=%s want=%s", index, envelope.Error.Details[index].Path, path)
		}
	}
	if envelope.Recovery.RetrySafe || len(envelope.Recovery.AllowedPaths) != 0 {
		t.Fatalf("a mixed deterministic and non-deterministic failure offered correction: %#v", envelope.Recovery)
	}
}

func TestApplyErrorCorrectionRequiresDeterministicRulesOnly(t *testing.T) {
	cases := []struct {
		name        string
		failure     error
		correctable bool
	}{
		{"user command count", domain.InvalidArgumentViolations(domain.Violation("payload.node_result.checks[0].command_count", domain.RuleNonAutomatedCommandCountZero)), true},
		{"non-automated full suite", domain.InvalidArgumentViolations(domain.Violation("payload.node_result.checks[0].full_suite", domain.RuleNonAutomatedFullSuiteFalse)), true},
		{"unknown member", domain.InvalidArgumentViolations(domain.Violation("payload.node_result.extra", domain.RuleUnknownMember)), true},
		{"forward findings", domain.TransitionGuardFailure("implementation_report_complete", domain.GuardViolation("payload.node_result.findings", domain.GuardForwardFindingsEmpty)), true},
		{"missing member", domain.InvalidArgumentViolations(domain.Violation("payload.node_result.summary", domain.RuleRequiredMemberMissing)), false},
		{"invalid source", domain.InvalidArgumentViolations(domain.Violation("payload.node_result.checks[0].source", domain.RuleEvidenceSourceInvalid)), false},
		{"text normalization", domain.InvalidArgumentViolations(domain.Violation("payload.summary", domain.RuleTextNotNormalized)), false},
		{"problem class mismatch", domain.TransitionGuardFailure("implementation_report_complete", domain.GuardViolation("payload.node_result.problem_class", domain.GuardProblemClassTransitionMismatch)), false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			envelope := decodeEnvelope(t, EncodeError("request-deterministic", ToolSubmitTest, tc.failure))
			if envelope.Recovery.RetrySafe != tc.correctable {
				t.Fatalf("recovery=%#v correctable=%v", envelope.Recovery, tc.correctable)
			}
			if tc.correctable && (envelope.Recovery.Action != correctCurrentAction || len(envelope.Recovery.AllowedPaths) != 1) {
				t.Fatalf("correctable recovery=%#v", envelope.Recovery)
			}
			if !tc.correctable && len(envelope.Recovery.AllowedPaths) != 0 {
				t.Fatalf("non-correctable recovery=%#v", envelope.Recovery)
			}
		})
	}
}

// TestApplyToolBoundaryReportsFieldViolations proves the MCP boundary produces
// the same field-level detail before the application service is reached.
func TestApplyToolBoundaryReportsFieldViolations(t *testing.T) {
	base := map[string]any{
		"host": "codex", "task_id": "task", "action_id": "action", "transition_id": "tests_passed",
		"summary": "Tests passed.", "reason": "", "artifacts": map[string]any{"current": []any{}, "other_process": []any{}},
		"method_results": map[string]any{
			"test.run_budgeted_checks": map[string]any{"capability": "", "summary": "Checks completed."},
			"test.record_evidence":     map[string]any{"capability": "", "summary": "Results recorded."},
			"test.classify_failure":    map[string]any{"capability": "", "summary": "No failure found."},
		},
		"node_result": map[string]any{},
	}
	missing := map[string]any{}
	for key, value := range base {
		if key == "summary" {
			continue
		}
		missing[key] = value
	}
	raw, err := json.Marshal(missing)
	if err != nil {
		t.Fatal(err)
	}
	violationErr := ValidateToolInput(ToolSubmitTest, raw)
	envelope := decodeEnvelope(t, EncodeError("request-boundary", ToolSubmitTest, violationErr))
	if len(envelope.Error.Details) != 1 || envelope.Error.Details[0].Path != "summary" || envelope.Error.Details[0].Rule != domain.RuleRequiredMemberMissing {
		t.Fatalf("details=%#v", envelope.Error.Details)
	}
	if envelope.Recovery.RetrySafe {
		t.Fatalf("a missing member offered a guessed correction: %#v", envelope.Recovery)
	}

	unknown := map[string]any{"unexpected_member": true}
	for key, value := range base {
		unknown[key] = value
	}
	raw, err = json.Marshal(unknown)
	if err != nil {
		t.Fatal(err)
	}
	envelope = decodeEnvelope(t, EncodeError("request-boundary", ToolSubmitTest, ValidateToolInput(ToolSubmitTest, raw)))
	if len(envelope.Error.Details) != 1 || envelope.Error.Details[0].Rule != domain.RuleUnknownMember {
		t.Fatalf("unknown member details=%#v", envelope.Error.Details)
	}
	if !envelope.Recovery.RetrySafe || envelope.Recovery.Action != correctCurrentAction {
		t.Fatalf("unknown member recovery=%#v", envelope.Recovery)
	}

}
