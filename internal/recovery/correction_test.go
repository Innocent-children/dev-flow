package recovery

import (
	"reflect"
	"testing"

	"github.com/Innocent-children/dev-flow/internal/domain"
)

func TestActionCorrectionRejectsUnprovenOrMixedFailures(t *testing.T) {
	safe := domain.Violation("payload.node_result.summary", domain.RuleRequiredMemberMissing)
	cases := map[string]*domain.Error{
		"no failure":                         nil,
		"uncertain write":                    {Code: domain.ErrorInvalidArgument, Violations: []domain.ContractViolation{safe}},
		"unknown rule alongside safe detail": {Code: domain.ErrorInvalidArgument, ZeroWrite: true, Violations: []domain.ContractViolation{safe, {Path: "payload.node_result.extra", Rule: "unknown_rule", Message: "unrecognized"}}},
		"unsafe path alongside safe detail":  {Code: domain.ErrorInvalidArgument, ZeroWrite: true, Violations: []domain.ContractViolation{safe, {Path: "/private/file", Rule: domain.RuleUnknownMember, Message: "unsafe"}}},
		"missing user decision":              domain.TransitionGuardFailure("current_user_comprehension_confirmed", domain.GuardViolation("payload.node_result.user_confirmation", domain.GuardUserConfirmationRequired)),
		"unknown result":                     domain.InvalidArgumentViolations(safe, domain.Violation("payload.node_result.checks[0].status", domain.RuleEvidenceStatusInvalid)),
		"permission":                         {Code: domain.ErrorVerificationNotAllowed, ZeroWrite: true, Violations: []domain.ContractViolation{safe}},
		"unknown guard":                      {Code: domain.ErrorTransitionNotAllowed, ZeroWrite: true, Guard: &domain.GuardFailure{GuardID: "invented_guard", Failures: []domain.ContractViolation{domain.GuardViolation("payload.node_result.findings", domain.GuardForwardFindingsEmpty)}}},
		"manifest without paths":             domain.InvalidArgumentViolations(domain.Violation("artifacts.other_process", domain.RuleArtifactManifestIncomplete)),
	}
	for name, failure := range cases {
		t.Run(name, func(t *testing.T) {
			if paths := ActionCorrectionPaths(failure); len(paths) != 0 {
				t.Fatalf("unsafe correction: %v", paths)
			}
		})
	}
}

func TestActionCorrectionPreservesSemanticPathsWithoutDuplicates(t *testing.T) {
	path := "payload.node_result.manual_evidence_ids"
	failure := &domain.Error{Code: domain.ErrorInvalidArgument, ZeroWrite: true, Violations: []domain.ContractViolation{
		domain.Violation(path, domain.RuleRequiredMemberMissing),
		domain.Violation(path, domain.RuleCurrentSetRequired),
	}}
	if paths := ActionCorrectionPaths(failure); !reflect.DeepEqual(paths, []string{path}) {
		t.Fatalf("paths=%v", paths)
	}
	guard := domain.TransitionGuardFailure("delivery_current_and_complete", domain.GuardViolation(path, domain.GuardCurrentSetRequired))
	if paths := ActionCorrectionPaths(guard); !reflect.DeepEqual(paths, []string{path}) {
		t.Fatalf("guard paths=%v", paths)
	}
}

func TestActionCorrectionDoesNotSupplyMissingUserDecisions(t *testing.T) {
	for _, path := range []string{
		"node_result", "payload.node_result", "payload.choice", "payload.reason",
		"payload.history_resolution", "payload.history_resolution.choice", "payload.history_resolution.reason",
		"node_result.user_confirmation", "node_result.user_confirmation.source", "node_result.user_confirmation.status",
		"node_result.user_confirmation.task_plan_revision", "node_result.known_failure_acceptance",
	} {
		t.Run(path, func(t *testing.T) {
			failure := domain.InvalidArgumentViolations(domain.Violation(path, domain.RuleRequiredMemberMissing))
			if paths := ActionCorrectionPaths(failure); len(paths) != 0 {
				t.Fatalf("missing decision offered correction: %v", paths)
			}
		})
	}
	path := "payload.node_result.user_confirmation.summary"
	failure := domain.InvalidArgumentViolations(domain.Violation(path, domain.RuleRequiredMemberMissing))
	if paths := ActionCorrectionPaths(failure); !reflect.DeepEqual(paths, []string{path}) {
		t.Fatalf("existing verdict summary correction changed: %v", paths)
	}
}
