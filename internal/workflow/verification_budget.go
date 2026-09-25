package workflow

import (
	"strings"
	"unicode/utf8"

	"github.com/Innocent-children/taskbelay/internal/domain"
)

type NormalizedEvidenceInput = EvidenceInput

// EvaluateVerificationBudget applies the task-wide verification policy to
// retained evidence plus one normalized incoming action. It performs no I/O.
func EvaluateVerificationBudget(
	budget domain.VerificationBudget,
	taskPlanRevision uint32,
	existing []domain.EvidenceSummary,
	incoming []NormalizedEvidenceInput,
	manualHandoffItems []string,
) error {
	if budget.Validate() != nil || taskPlanRevision == 0 || len(incoming) > domain.MaxEvidencePerAction {
		return domain.WithExplanation(domain.ErrInvalidArgument, "Budget evaluation requires a valid current budget, a positive plan revision and no more than 32 incoming checks.")
	}
	normalizedManualItems, err := normalizePayloadList(manualHandoffItems, false)
	if err != nil || !sameStrings(manualHandoffItems, normalizedManualItems) {
		return domain.WithExplanation(domain.ErrInvalidArgument, "manual_handoff_items must contain bounded, normalized, unique non-empty text entries.")
	}
	if len(existing)+len(incoming) > domain.MaxRetainedEvidenceItems {
		return budgetExceeded("verification.usage.evidence_items", domain.RuleEvidenceCapacityExceeded, len(existing), len(incoming), domain.MaxRetainedEvidenceItems)
	}

	automaticCommands := 0
	existingIDs := make(map[domain.ID]struct{}, len(existing))
	for _, item := range existing {
		if item.Validate() != nil {
			return domain.WithExplanation(domain.ErrInvalidArgument, "An existing evidence record is invalid and cannot be counted against the budget.")
		}
		if _, duplicate := existingIDs[item.EvidenceID]; duplicate {
			return domain.WithExplanation(domain.ErrInvalidArgument, "The retained evidence set contains a duplicate evidence identifier.")
		}
		existingIDs[item.EvidenceID] = struct{}{}
		if item.TaskPlanRevision != taskPlanRevision {
			continue
		}
		if item.Source == domain.EvidenceSourceAutomated {
			automaticCommands += item.CommandCount
			if item.FullSuite && !budget.AllowFullSuite {
				return verificationNotAllowed("verification.current_budget.allow_full_suite", domain.RuleFullSuiteNotAllowed)
			}
		}
	}

	incomingNames := make(map[string]struct{}, len(incoming))
	for _, item := range incoming {
		if validateNormalizedEvidenceInput(item) != nil {
			return domain.WithExplanation(domain.ErrInvalidArgument, "An incoming check violates the source, status, text or command-count requirements.")
		}
		if _, duplicate := incomingNames[item.Name]; duplicate {
			return domain.WithExplanation(domain.ErrInvalidArgument, "Incoming checks must have unique names.")
		}
		incomingNames[item.Name] = struct{}{}
		if item.Source == domain.EvidenceSourceAutomated {
			automaticCommands += item.CommandCount
			if item.FullSuite && !budget.AllowFullSuite {
				return verificationNotAllowed("verification.current_budget.allow_full_suite", domain.RuleFullSuiteNotAllowed)
			}
		}
	}
	if automaticCommands > budget.MaxAutomaticCommands {
		requested := 0
		for _, item := range incoming {
			if item.Source == domain.EvidenceSourceAutomated {
				requested += item.CommandCount
			}
		}
		return budgetExceeded("verification.current_budget.max_automatic_commands", domain.RuleAutomaticBudgetExceeded, automaticCommands-requested, requested, budget.MaxAutomaticCommands)
	}
	if len(normalizedManualItems) != 0 && !budget.AllowManualHandoff {
		return verificationNotAllowed("node_result.manual_handoff_items", domain.RuleManualHandoffNotAllowed)
	}
	return nil
}

func ValidateComprehensionConfirmation(existing []domain.EvidenceSummary, input NormalizedEvidenceInput) error {
	if len(existing)+1 > domain.MaxRetainedEvidenceItems {
		return budgetExceeded("verification.usage.evidence_items", domain.RuleEvidenceCapacityExceeded, len(existing), 1, domain.MaxRetainedEvidenceItems)
	}
	seen := make(map[domain.ID]bool, len(existing))
	for _, item := range existing {
		if item.Validate() != nil || seen[item.EvidenceID] {
			return domain.WithExplanation(domain.ErrInvalidArgument, "Existing evidence must be valid and have unique identifiers before recording comprehension confirmation.")
		}
		seen[item.EvidenceID] = true
	}
	if validateNormalizedEvidenceInput(input) != nil || input.Source != domain.EvidenceSourceUser || input.Status != domain.EvidencePassed {
		return domain.WithExplanation(domain.ErrInvalidArgument, "Comprehension confirmation requires a valid passed check whose source is user.")
	}
	return nil
}

func normalizeRequiredPayloadText(value string, max int) (string, error) {
	if !utf8.ValidString(value) {
		return "", domain.WithExplanation(domain.ErrInvalidArgument, "Payload text must be valid UTF-8.")
	}
	normalized := strings.TrimSpace(value)
	if normalized == "" || len(normalized) > max {
		return "", domain.WithExplanation(domain.ErrInvalidArgument, "Payload text must be non-empty and within its byte limit.")
	}
	return normalized, nil
}

func normalizePayloadList(items []string, required bool) ([]string, error) {
	if required && len(items) == 0 || len(items) > domain.MaxBoundedStringListItems {
		return nil, domain.WithExplanation(domain.ErrInvalidArgument, "The payload list is missing required items or exceeds its item limit.")
	}
	out := make([]string, len(items))
	seen := map[string]bool{}
	for i, item := range items {
		normalized, err := normalizeRequiredPayloadText(item, domain.MaxEvidenceSummaryBytes)
		if err != nil || seen[normalized] {
			return nil, domain.WithExplanation(domain.ErrInvalidArgument, "Payload list items must be valid non-empty text and unique after trimming.")
		}
		seen[normalized] = true
		out[i] = normalized
	}
	return out, nil
}

func validateNormalizedEvidenceInput(input NormalizedEvidenceInput) error {
	if len(evidenceRuleFailures(input)) != 0 {
		return domain.WithExplanation(domain.ErrInvalidArgument, "The evidence input violates its source, status, text, command-count or full-suite rules.")
	}
	return nil
}

// evidenceMemberRule pairs one evidence member with the closed rule it breaks.
type evidenceMemberRule struct {
	Member string
	Rule   domain.ViolationRule
}

// evidenceRuleFailures is the single authority for the evidence source matrix.
// Both the boolean validator and the field-level violation projection read it,
// so a public violation can never disagree with the accepted input set.
func evidenceRuleFailures(input NormalizedEvidenceInput) []evidenceMemberRule {
	var out []evidenceMemberRule
	if !input.Source.IsValid() {
		out = append(out, evidenceMemberRule{"source", domain.RuleEvidenceSourceInvalid})
	}
	if name, err := normalizeRequiredPayloadText(input.Name, domain.MaxEvidenceNameBytes); err != nil || name != input.Name {
		out = append(out, evidenceMemberRule{"name", domain.RuleTextNotNormalized})
	}
	if summary, err := normalizeRequiredPayloadText(input.Summary, domain.MaxEvidenceSummaryBytes); err != nil || summary != input.Summary {
		out = append(out, evidenceMemberRule{"summary", domain.RuleTextNotNormalized})
	}
	if !input.Status.IsValid() {
		out = append(out, evidenceMemberRule{"status", domain.RuleEvidenceStatusInvalid})
	}
	automated := input.Source == domain.EvidenceSourceAutomated
	switch {
	case input.CommandCount > domain.MaxAutomaticVerificationCommands:
		out = append(out, evidenceMemberRule{"command_count", domain.RuleAutomatedCommandCountLimit})
	case automated && input.CommandCount == 0:
		out = append(out, evidenceMemberRule{"command_count", domain.RuleAutomatedCommandCountPositive})
	case !automated && input.CommandCount != 0:
		out = append(out, evidenceMemberRule{"command_count", domain.RuleNonAutomatedCommandCountZero})
	case input.CommandCount < 0:
		out = append(out, evidenceMemberRule{"command_count", domain.RuleAutomatedCommandCountPositive})
	}
	if !automated && input.FullSuite {
		out = append(out, evidenceMemberRule{"full_suite", domain.RuleNonAutomatedFullSuiteFalse})
	}
	if input.FullSuite {
		if reason, err := normalizeRequiredPayloadText(input.FullSuiteReason, domain.MaxEvidenceSummaryBytes); err != nil || reason != input.FullSuiteReason {
			out = append(out, evidenceMemberRule{"full_suite_reason", domain.RuleFullSuiteReasonRequired})
		}
	} else if input.FullSuiteReason != "" {
		out = append(out, evidenceMemberRule{"full_suite_reason", domain.RuleFullSuiteReasonEmpty})
	}
	return out
}

// EvidenceViolations projects the evidence rules one input breaks onto request paths.
func EvidenceViolations(path string, input NormalizedEvidenceInput) []domain.ContractViolation {
	failures := evidenceRuleFailures(input)
	out := make([]domain.ContractViolation, 0, len(failures))
	for _, failure := range failures {
		out = append(out, domain.Violation(path+"."+failure.Member, failure.Rule))
	}
	return out
}

func sameStrings(left, right []string) bool {
	if len(left) != len(right) {
		return false
	}
	for i := range left {
		if left[i] != right[i] {
			return false
		}
	}
	return true
}

func budgetExceeded(path string, rule domain.ViolationRule, used, requested, limit int) error {
	return &domain.Error{Code: domain.ErrorVerificationBudgetExceeded, Message: rule.Message(), Violations: []domain.ContractViolation{domain.Violation(path, rule)}, Budget: &domain.BudgetFailure{Used: used, Requested: requested, Limit: limit}}
}
func verificationNotAllowed(path string, rule domain.ViolationRule) error {
	return &domain.Error{Code: domain.ErrorVerificationNotAllowed, Message: rule.Message(), Violations: []domain.ContractViolation{domain.Violation(path, rule)}}
}
