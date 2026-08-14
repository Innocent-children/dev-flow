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

// Contract is immutable after construction. Slice accessors return copies.
type Contract struct {
	goal               string
	scope              []string
	outOfScope         []string
	acceptanceCriteria []string
	verificationBudget VerificationBudget
}

func NewContract(
	goal string,
	scope []string,
	outOfScope []string,
	acceptanceCriteria []string,
	budget VerificationBudget,
) (Contract, error) {
	normalizedGoal, err := normalizeRequiredText(goal, MaxGoalBytes)
	if err != nil {
		return Contract{}, err
	}
	normalizedScope, err := normalizeTextList(scope, MaxScopeItems, MaxScopeItemBytes, false)
	if err != nil {
		return Contract{}, err
	}
	normalizedOut, err := normalizeTextList(
		outOfScope,
		MaxOutOfScopeItems,
		MaxOutOfScopeItemBytes,
		false,
	)
	if err != nil {
		return Contract{}, err
	}
	normalizedAcceptance, err := normalizeTextList(
		acceptanceCriteria,
		MaxAcceptanceCriteriaItems,
		MaxAcceptanceCriterionBytes,
		true,
	)
	if err != nil || budget.Validate() != nil {
		return Contract{}, ErrInvalidArgument
	}
	return Contract{
		goal:               normalizedGoal,
		scope:              normalizedScope,
		outOfScope:         normalizedOut,
		acceptanceCriteria: normalizedAcceptance,
		verificationBudget: budget,
	}, nil
}

func (c Contract) Validate() error {
	if requireNormalizedText(c.goal, MaxGoalBytes, true) != nil ||
		validateNormalizedTextList(c.scope, MaxScopeItems, MaxScopeItemBytes, false) != nil ||
		validateNormalizedTextList(
			c.outOfScope,
			MaxOutOfScopeItems,
			MaxOutOfScopeItemBytes,
			false,
		) != nil ||
		validateNormalizedTextList(
			c.acceptanceCriteria,
			MaxAcceptanceCriteriaItems,
			MaxAcceptanceCriterionBytes,
			true,
		) != nil || c.verificationBudget.Validate() != nil {
		return ErrInvalidArgument
	}
	return nil
}

func (c Contract) Goal() string { return c.goal }

func (c Contract) Scope() []string { return append([]string(nil), c.scope...) }

func (c Contract) OutOfScope() []string { return append([]string(nil), c.outOfScope...) }

func (c Contract) AcceptanceCriteria() []string {
	return append([]string(nil), c.acceptanceCriteria...)
}

func (c Contract) VerificationBudget() VerificationBudget { return c.verificationBudget }

func (c Contract) Equal(other Contract) bool {
	if c.goal != other.goal || c.verificationBudget != other.verificationBudget ||
		len(c.scope) != len(other.scope) || len(c.outOfScope) != len(other.outOfScope) ||
		len(c.acceptanceCriteria) != len(other.acceptanceCriteria) {
		return false
	}
	for i := range c.scope {
		if c.scope[i] != other.scope[i] {
			return false
		}
	}
	for i := range c.outOfScope {
		if c.outOfScope[i] != other.outOfScope[i] {
			return false
		}
	}
	for i := range c.acceptanceCriteria {
		if c.acceptanceCriteria[i] != other.acceptanceCriteria[i] {
			return false
		}
	}
	return true
}
