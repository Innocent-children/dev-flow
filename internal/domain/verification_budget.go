package domain

// VerificationBudget bounds evidence the host may submit for one task.
type VerificationBudget struct {
	Level                VerificationLevel `json:"level"`
	MaxAutomaticCommands int               `json:"max_automatic_commands"`
	AllowFullSuite       bool              `json:"allow_full_suite"`
	AllowManualHandoff   bool              `json:"allow_manual_handoff"`
}

func (b VerificationBudget) Validate() error {
	if !b.Level.IsValid() || b.MaxAutomaticCommands < 0 ||
		b.MaxAutomaticCommands > MaxAutomaticVerificationCommands {
		return ErrInvalidArgument
	}
	return nil
}
