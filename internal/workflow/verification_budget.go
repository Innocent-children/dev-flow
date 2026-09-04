package workflow

import (
	"strings"
	"unicode/utf8"

	"github.com/Innocent-children/dev-flow/internal/domain"
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
		return domain.ErrInvalidArgument
	}
	normalizedManualItems, err := normalizePayloadList(manualHandoffItems, false)
	if err != nil || !sameStrings(manualHandoffItems, normalizedManualItems) {
		return domain.ErrInvalidArgument
	}
	if len(existing)+len(incoming) > domain.MaxRetainedEvidenceItems {
		return domain.ErrVerificationBudgetExceeded
	}

	automaticCommands := 0
	existingIDs := make(map[domain.ID]struct{}, len(existing))
	for _, item := range existing {
		if item.Validate() != nil {
			return domain.ErrInvalidArgument
		}
		if _, duplicate := existingIDs[item.EvidenceID]; duplicate {
			return domain.ErrInvalidArgument
		}
		existingIDs[item.EvidenceID] = struct{}{}
		if item.TaskPlanRevision != taskPlanRevision {
			continue
		}
		if item.Source == domain.EvidenceSourceAutomated {
			automaticCommands += item.CommandCount
			if item.FullSuite && !budget.AllowFullSuite {
				return domain.ErrVerificationBudgetExceeded
			}
		}
	}

	incomingNames := make(map[string]struct{}, len(incoming))
	for _, item := range incoming {
		if validateNormalizedEvidenceInput(item) != nil {
			return domain.ErrInvalidArgument
		}
		if _, duplicate := incomingNames[item.Name]; duplicate {
			return domain.ErrInvalidArgument
		}
		incomingNames[item.Name] = struct{}{}
		if item.Source == domain.EvidenceSourceAutomated {
			automaticCommands += item.CommandCount
			if item.FullSuite && !budget.AllowFullSuite {
				return domain.ErrVerificationBudgetExceeded
			}
		}
		if item.Source == domain.EvidenceSourceUser && !budget.AllowManualHandoff {
			return domain.ErrVerificationBudgetExceeded
		}
	}
	if automaticCommands > budget.MaxAutomaticCommands ||
		(len(normalizedManualItems) != 0 && !budget.AllowManualHandoff) {
		return domain.ErrVerificationBudgetExceeded
	}
	return nil
}

func ValidateComprehensionConfirmation(existing []domain.EvidenceSummary, input NormalizedEvidenceInput) error {
	if len(existing)+1 > domain.MaxRetainedEvidenceItems {
		return domain.ErrVerificationBudgetExceeded
	}
	seen := make(map[domain.ID]bool, len(existing))
	for _, item := range existing {
		if item.Validate() != nil || seen[item.EvidenceID] {
			return domain.ErrInvalidArgument
		}
		seen[item.EvidenceID] = true
	}
	if validateNormalizedEvidenceInput(input) != nil || input.Source != domain.EvidenceSourceUser || input.Status != domain.EvidencePassed {
		return domain.ErrInvalidArgument
	}
	return nil
}

func normalizeRequiredPayloadText(value string, max int) (string, error) {
	if !utf8.ValidString(value) {
		return "", domain.ErrInvalidArgument
	}
	normalized := strings.TrimSpace(value)
	if normalized == "" || len(normalized) > max {
		return "", domain.ErrInvalidArgument
	}
	return normalized, nil
}

func normalizePayloadList(items []string, required bool) ([]string, error) {
	if required && len(items) == 0 || len(items) > domain.MaxBoundedStringListItems {
		return nil, domain.ErrInvalidArgument
	}
	out := make([]string, len(items))
	seen := map[string]bool{}
	for i, item := range items {
		normalized, err := normalizeRequiredPayloadText(item, domain.MaxEvidenceSummaryBytes)
		if err != nil || seen[normalized] {
			return nil, domain.ErrInvalidArgument
		}
		seen[normalized] = true
		out[i] = normalized
	}
	return out, nil
}

func validateNormalizedEvidenceInput(input NormalizedEvidenceInput) error {
	if len(evidenceRuleFailures(input)) != 0 {
		return domain.ErrInvalidArgument
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
