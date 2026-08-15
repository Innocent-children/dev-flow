package workflow

import "github.com/Innocent-children/dev-flow/internal/domain"

// EvaluateVerificationBudget applies the task-wide verification policy to
// retained evidence plus one normalized incoming action. It performs no I/O.
func EvaluateVerificationBudget(
	budget domain.VerificationBudget,
	existing []domain.EvidenceSummary,
	incoming []NormalizedEvidenceInput,
	manualHandoffItems []string,
) error {
	if budget.Validate() != nil || len(incoming) > domain.MaxEvidencePerAction {
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

func validateNormalizedEvidenceInput(input NormalizedEvidenceInput) error {
	name, err := normalizeRequiredPayloadText(input.Name, domain.MaxEvidenceNameBytes)
	if err != nil || name != input.Name {
		return domain.ErrInvalidArgument
	}
	summary, err := normalizeRequiredPayloadText(input.Summary, domain.MaxEvidenceSummaryBytes)
	if err != nil || summary != input.Summary || !input.Source.IsValid() || !input.Status.IsValid() ||
		input.CommandCount < 0 || input.CommandCount > domain.MaxAutomaticVerificationCommands ||
		(input.Source != domain.EvidenceSourceAutomated && (input.CommandCount != 0 || input.FullSuite)) {
		return domain.ErrInvalidArgument
	}
	return nil
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
