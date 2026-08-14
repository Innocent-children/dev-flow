package domain

import "time"

type OutcomeCriterion struct {
	Criterion string                 `json:"criterion"`
	Status    OutcomeCriterionStatus `json:"status"`
}

func (c OutcomeCriterion) Validate() error {
	if requireNormalizedText(c.Criterion, MaxAcceptanceCriterionBytes, true) != nil || !c.Status.IsValid() {
		return ErrInvalidArgument
	}
	return nil
}

type Outcome struct {
	Status                       TerminalStatus     `json:"status"`
	Acceptance                   []OutcomeCriterion `json:"acceptance"`
	AutomatedChecks              []EvidenceSummary  `json:"automated_checks"`
	ManualChecks                 []EvidenceSummary  `json:"manual_checks"`
	UnverifiedItems              []string           `json:"unverified_items"`
	Risks                        []string           `json:"risks"`
	FinalRepositoryBindingDigest Digest             `json:"final_repository_binding_digest"`
	Summary                      string             `json:"summary"`
	CompletedAt                  time.Time          `json:"completed_at"`
}

func (o Outcome) Validate() error {
	if !o.Status.IsValid() || len(o.Acceptance) == 0 || len(o.Acceptance) > MaxAcceptanceCriteriaItems ||
		len(o.AutomatedChecks)+len(o.ManualChecks) > MaxRetainedEvidenceItems ||
		validateNormalizedTextList(o.UnverifiedItems, MaxBoundedStringListItems, MaxReasonBytes, false) != nil ||
		validateNormalizedTextList(o.Risks, MaxBoundedStringListItems, MaxReasonBytes, false) != nil ||
		validateDigest(o.FinalRepositoryBindingDigest) != nil ||
		requireNormalizedText(o.Summary, MaxOutcomeSummaryBytes, true) != nil || validateUTC(o.CompletedAt) != nil {
		return ErrInvalidArgument
	}
	criteria := make(map[string]struct{}, len(o.Acceptance))
	for _, criterion := range o.Acceptance {
		if criterion.Validate() != nil {
			return ErrInvalidArgument
		}
		if _, duplicate := criteria[criterion.Criterion]; duplicate {
			return ErrInvalidArgument
		}
		criteria[criterion.Criterion] = struct{}{}
	}
	evidenceIDs := make(map[ID]struct{}, len(o.AutomatedChecks)+len(o.ManualChecks))
	for _, evidence := range o.AutomatedChecks {
		if evidence.Validate() != nil || evidence.Source != EvidenceSourceAutomated {
			return ErrInvalidArgument
		}
		if _, duplicate := evidenceIDs[evidence.EvidenceID]; duplicate {
			return ErrInvalidArgument
		}
		evidenceIDs[evidence.EvidenceID] = struct{}{}
	}
	for _, evidence := range o.ManualChecks {
		if evidence.Validate() != nil || evidence.Source != EvidenceSourceUser {
			return ErrInvalidArgument
		}
		if _, duplicate := evidenceIDs[evidence.EvidenceID]; duplicate {
			return ErrInvalidArgument
		}
		evidenceIDs[evidence.EvidenceID] = struct{}{}
	}
	return nil
}

func (o Outcome) Clone() Outcome {
	o.Acceptance = append([]OutcomeCriterion(nil), o.Acceptance...)
	o.AutomatedChecks = append([]EvidenceSummary(nil), o.AutomatedChecks...)
	o.ManualChecks = append([]EvidenceSummary(nil), o.ManualChecks...)
	o.UnverifiedItems = append([]string(nil), o.UnverifiedItems...)
	o.Risks = append([]string(nil), o.Risks...)
	return o
}
