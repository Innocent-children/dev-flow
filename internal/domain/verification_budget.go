package domain

import "time"

// VerificationBudget bounds evidence the host may submit for one Task Plan revision.
type VerificationBudget struct {
	Level                VerificationLevel `json:"level"`
	MaxAutomaticCommands int               `json:"max_automatic_commands"`
	AllowFullSuite       bool              `json:"allow_full_suite"`
	AllowManualHandoff   bool              `json:"allow_manual_handoff"`
}

func (b VerificationBudget) Validate() error {
	if !b.Level.IsValid() || b.MaxAutomaticCommands < 0 ||
		b.MaxAutomaticCommands > MaxTotalAutomaticVerificationCommands {
		return ErrInvalidArgument
	}
	return nil
}

type VerificationPlanCheck struct {
	Name      string `json:"name"`
	Rationale string `json:"rationale"`
}

func (c VerificationPlanCheck) Validate() error {
	if requireNormalizedText(c.Name, MaxEvidenceNameBytes, true) != nil ||
		requireNormalizedText(c.Rationale, MaxEvidenceSummaryBytes, true) != nil {
		return ErrInvalidArgument
	}
	return nil
}

type VerificationPlan struct {
	Checks                  []VerificationPlanCheck `json:"checks"`
	InitialBudget           VerificationBudget      `json:"initial_budget"`
	FullSuiteExpected       bool                    `json:"full_suite_expected"`
	TestCodeChangesExpected bool                    `json:"test_code_changes_expected"`
}

func (p VerificationPlan) Validate() error {
	if len(p.Checks) == 0 || len(p.Checks) > MaxBoundedStringListItems ||
		p.InitialBudget.Validate() != nil || p.FullSuiteExpected != p.InitialBudget.AllowFullSuite {
		return ErrInvalidArgument
	}
	seen := make(map[string]bool, len(p.Checks))
	for _, check := range p.Checks {
		if check.Validate() != nil || seen[check.Name] {
			return ErrInvalidArgument
		}
		seen[check.Name] = true
	}
	return nil
}

type VerificationBudgetAdjustmentBasis string

const (
	VerificationAdjustmentNewImpact VerificationBudgetAdjustmentBasis = "new_impact"
	VerificationAdjustmentNewRisk   VerificationBudgetAdjustmentBasis = "new_risk"
	VerificationAdjustmentFailure   VerificationBudgetAdjustmentBasis = "verification_failure"
	VerificationAdjustmentGap       VerificationBudgetAdjustmentBasis = "verification_gap"
)

func (b VerificationBudgetAdjustmentBasis) IsValid() bool {
	return b == VerificationAdjustmentNewImpact || b == VerificationAdjustmentNewRisk ||
		b == VerificationAdjustmentFailure || b == VerificationAdjustmentGap
}

type VerificationBudgetAdjustment struct {
	Revision                    uint32                            `json:"revision"`
	TaskPlanRevision            uint32                            `json:"task_plan_revision"`
	Basis                       VerificationBudgetAdjustmentBasis `json:"basis"`
	Reason                      string                            `json:"reason"`
	AdditionalChecks            []VerificationPlanCheck           `json:"additional_checks"`
	AdditionalAutomaticCommands int                               `json:"additional_automatic_commands"`
	AllowFullSuite              bool                              `json:"allow_full_suite"`
	AllowManualHandoff          bool                              `json:"allow_manual_handoff"`
	PreviousBudget              VerificationBudget                `json:"previous_budget"`
	CurrentBudget               VerificationBudget                `json:"current_budget"`
	CreatedAt                   time.Time                         `json:"created_at"`
}

func (a VerificationBudgetAdjustment) Validate() error {
	if a.Revision == 0 || a.TaskPlanRevision == 0 || !a.Basis.IsValid() ||
		requireNormalizedText(a.Reason, MaxReasonBytes, true) != nil ||
		len(a.AdditionalChecks) == 0 || len(a.AdditionalChecks) > MaxBoundedStringListItems ||
		a.AdditionalAutomaticCommands < 0 || a.AdditionalAutomaticCommands > MaxAutomaticVerificationCommands ||
		a.PreviousBudget.Validate() != nil || a.CurrentBudget.Validate() != nil || validateUTC(a.CreatedAt) != nil {
		return ErrInvalidArgument
	}
	seen := make(map[string]bool, len(a.AdditionalChecks))
	for _, check := range a.AdditionalChecks {
		if check.Validate() != nil || seen[check.Name] {
			return ErrInvalidArgument
		}
		seen[check.Name] = true
	}
	expected := a.PreviousBudget
	if expected.MaxAutomaticCommands > MaxTotalAutomaticVerificationCommands-a.AdditionalAutomaticCommands {
		return ErrInvalidArgument
	}
	expected.MaxAutomaticCommands += a.AdditionalAutomaticCommands
	if a.AllowFullSuite {
		expected.AllowFullSuite = true
	}
	if a.AllowManualHandoff {
		expected.AllowManualHandoff = true
	}
	if expected == a.PreviousBudget || expected != a.CurrentBudget {
		return ErrInvalidArgument
	}
	return nil
}

type VerificationUsage struct {
	AutomaticCommands int `json:"automatic_commands"`
	FullSuiteRuns     int `json:"full_suite_runs"`
	EvidenceItems     int `json:"evidence_items"`
}

func (t ProcessTask) CurrentVerificationBudget() (VerificationBudget, bool) {
	if t.TaskPlan == nil || t.TaskPlan.VerificationPlan.Validate() != nil {
		return VerificationBudget{}, false
	}
	budget := t.TaskPlan.VerificationPlan.InitialBudget
	for _, adjustment := range t.VerificationBudgetAdjustments {
		if adjustment.TaskPlanRevision == t.TaskPlan.Revision {
			budget = adjustment.CurrentBudget
		}
	}
	return budget, true
}

func (t ProcessTask) CurrentVerificationUsage() VerificationUsage {
	if t.TaskPlan == nil {
		return VerificationUsage{}
	}
	var usage VerificationUsage
	for _, item := range t.Evidence {
		if item.TaskPlanRevision != t.TaskPlan.Revision {
			continue
		}
		usage.EvidenceItems++
		if item.Source == EvidenceSourceAutomated {
			usage.AutomaticCommands += item.CommandCount
			if item.FullSuite {
				usage.FullSuiteRuns++
			}
		}
	}
	return usage
}

func verificationBudgetAdjustmentsValid(t ProcessTask) bool {
	knownPlans := make(map[uint32]bool)
	if t.TaskPlan != nil {
		knownPlans[t.TaskPlan.Revision] = true
	}
	for _, reference := range t.BaselineHistory {
		if reference.Kind == BaselineTaskPlan {
			knownPlans[reference.Revision] = true
		}
	}
	for _, evidence := range t.Evidence {
		if !knownPlans[evidence.TaskPlanRevision] {
			return false
		}
	}
	currentByPlan := make(map[uint32]VerificationBudget)
	var previousPlanRevision uint32
	for index, adjustment := range t.VerificationBudgetAdjustments {
		if adjustment.Validate() != nil || adjustment.Revision != uint32(index+1) ||
			!knownPlans[adjustment.TaskPlanRevision] || adjustment.TaskPlanRevision < previousPlanRevision {
			return false
		}
		previous, exists := currentByPlan[adjustment.TaskPlanRevision]
		if !exists && t.TaskPlan != nil && adjustment.TaskPlanRevision == t.TaskPlan.Revision {
			previous = t.TaskPlan.VerificationPlan.InitialBudget
			exists = true
		}
		if exists && adjustment.PreviousBudget != previous {
			return false
		}
		currentByPlan[adjustment.TaskPlanRevision] = adjustment.CurrentBudget
		previousPlanRevision = adjustment.TaskPlanRevision
	}
	return true
}
