package workflow

import "github.com/Innocent-children/dev-flow/internal/domain"

func knownFailureAcceptanceSchema() map[string]any {
	return schemaObject([]string{"source", "summary", "failed_checks", "comparison_check", "task_plan_revision", "content_digest"}, map[string]any{
		"source": map[string]any{"const": "user"}, "summary": schemaString(),
		"failed_checks":    map[string]any{"type": "array", "minItems": 1, "maxItems": domain.MaxEvidencePerAction, "items": schemaString()},
		"comparison_check": schemaString(), "task_plan_revision": map[string]any{"type": "integer", "minimum": 1}, "content_digest": schemaDigest(),
	})
}

func validateKnownFailureAcceptance(transition domain.TransitionDefinition, result *TestResult) error {
	accepting := transition.TransitionID == "tests_accepted_with_known_failures"
	if !accepting {
		if result.KnownFailureAcceptance != nil {
			return domain.InvalidArgumentViolations(domain.Violation("payload.node_result.known_failure_acceptance", domain.RuleCollectionMustBeEmpty))
		}
		return nil
	}
	a := result.KnownFailureAcceptance
	if a == nil {
		return domain.InvalidArgumentViolations(domain.Violation("payload.node_result.known_failure_acceptance", domain.RuleRequiredMemberMissing))
	}
	checks := make([]domain.EvidenceSummary, 0, len(result.Checks))
	failedNames := make(map[string]bool)
	for _, check := range result.Checks {
		checks = append(checks, domain.EvidenceSummary{Name: check.Name, Source: check.Source, Status: check.Status})
		if check.Status == domain.EvidenceFailed {
			failedNames[check.Name] = true
		}
	}
	if !domain.KnownFailuresAccepted(a, checks, a.TaskPlanRevision, a.ContentDigest) {
		return domain.InvalidArgumentViolations(domain.Violation("payload.node_result.known_failure_acceptance", domain.RuleKnownFailureAcceptanceRequired))
	}
	for _, name := range result.FailedItems {
		delete(failedNames, name)
	}
	if len(failedNames) != 0 || len(result.FailedItems) != len(a.FailedChecks) {
		return domain.InvalidArgumentViolations(domain.Violation("payload.node_result.failed_items", domain.RuleKnownFailureAcceptanceRequired))
	}
	if len(result.UnverifiedItems) != 0 || len(result.ManualHandoffItems) != 0 || len(result.Findings) != 0 {
		return domain.InvalidArgumentViolations(domain.Violation("payload.node_result.known_failure_acceptance", domain.RuleKnownFailureAcceptanceRequired))
	}
	return nil
}
