package recovery

import (
	"strings"

	"github.com/Innocent-children/dev-flow/internal/domain"
	"github.com/Innocent-children/dev-flow/internal/workflow"
)

/**
 * ActionCorrectionPaths keeps correction eligibility independent of transport.
 * Every reported failure must be safe to correct; filtering an unknown failure
 * out of a public response must never turn a rejected operation into a retry.
 */
func ActionCorrectionPaths(failure *domain.Error) []string {
	if failure == nil || !failure.ZeroWrite {
		return nil
	}
	var entries []domain.ContractViolation
	switch failure.Code {
	case domain.ErrorInvalidArgument:
		if failure.Guard != nil {
			return nil
		}
		entries = failure.Violations
	case domain.ErrorTransitionNotAllowed:
		if failure.Guard == nil || !workflow.KnownTransitionGuard(failure.Guard.GuardID) || len(failure.Violations) != 0 {
			return nil
		}
		entries = failure.Guard.Failures
	default:
		return nil
	}
	if len(entries) == 0 {
		return nil
	}
	paths := make([]string, 0, len(entries))
	seen := make(map[string]bool, len(entries))
	for _, entry := range entries {
		if !domain.ValidViolationPath(entry.Path) || entry.Message == "" || !actionCorrectionRule(entry.Rule) || !actionCorrectionMember(entry.Path, entry.Rule) {
			return nil
		}
		if entry.Rule == domain.RuleArtifactManifestIncomplete && len(domain.ViolationRepositoryPaths(failure)) == 0 {
			return nil
		}
		if !seen[entry.Path] {
			paths = append(paths, entry.Path)
			seen[entry.Path] = true
		}
	}
	return paths
}

/**
 * A missing decision or whole result cannot be reconstructed by correction.
 * A confirmation's summary may describe a verdict already supplied in the other
 * confirmation fields; that narrow correction is part of the current contract.
 */
func actionCorrectionMember(path string, rule domain.ViolationRule) bool {
	path = strings.TrimPrefix(path, "payload.")
	if path == "payload" || path == "node_result" {
		return false
	}
	for _, decision := range []string{"choice", "history_resolution", "relocation_id", "relocation_destinations", "node_result.known_failure_acceptance"} {
		if path == decision || strings.HasPrefix(path, decision+".") || strings.HasPrefix(path, decision+"[") {
			return false
		}
	}
	if path == "node_result.user_confirmation" || strings.HasPrefix(path, "node_result.user_confirmation.") {
		return path == "node_result.user_confirmation.summary" && rule == domain.RuleRequiredMemberMissing
	}
	return path != "reason" || rule != domain.RuleRequiredMemberMissing
}

func actionCorrectionRule(rule domain.ViolationRule) bool {
	switch rule {
	case domain.RuleRequiredMemberMissing,
		domain.RuleArtifactManifestIncomplete,
		domain.RuleBudgetChecksRequired,
		domain.RuleNonAutomatedCommandCountZero,
		domain.RuleNonAutomatedFullSuiteFalse,
		domain.RuleUnknownMember,
		domain.RuleCurrentValueRequired,
		domain.RuleCurrentSetRequired,
		domain.RuleAcceptanceSetCurrent,
		domain.ViolationRule(domain.GuardForwardFindingsEmpty):
		return true
	default:
		return false
	}
}
