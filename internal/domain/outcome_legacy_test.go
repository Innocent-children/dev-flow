package domain

import "time"

// Outcome is the frozen frozen linear contract test-only terminal projection.
type Outcome struct {
	Status                       TerminalStatus     `json:"status"`
	Acceptance                   []OutcomeCriterion `json:"acceptance"`
	AutomatedEvidenceIDs         []ID               `json:"automated_evidence_ids"`
	ManualEvidenceIDs            []ID               `json:"manual_evidence_ids"`
	UnverifiedItems              []string           `json:"unverified_items"`
	Risks                        []string           `json:"risks"`
	FinalRepositoryBindingDigest Digest             `json:"final_repository_binding_digest"`
	Summary                      string             `json:"summary"`
	CompletedAt                  time.Time          `json:"completed_at"`
}

func (o Outcome) Validate() error {
	if !o.Status.IsValid() || len(o.Acceptance) == 0 || len(o.Acceptance) > MaxAcceptanceCriteriaItems ||
		len(o.AutomatedEvidenceIDs)+len(o.ManualEvidenceIDs) > MaxRetainedEvidenceItems ||
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
	evidenceIDs := make(map[ID]struct{}, len(o.AutomatedEvidenceIDs)+len(o.ManualEvidenceIDs))
	for _, evidenceID := range o.AutomatedEvidenceIDs {
		if validateID(evidenceID) != nil {
			return ErrInvalidArgument
		}
		if _, duplicate := evidenceIDs[evidenceID]; duplicate {
			return ErrInvalidArgument
		}
		evidenceIDs[evidenceID] = struct{}{}
	}
	for _, evidenceID := range o.ManualEvidenceIDs {
		if validateID(evidenceID) != nil {
			return ErrInvalidArgument
		}
		if _, duplicate := evidenceIDs[evidenceID]; duplicate {
			return ErrInvalidArgument
		}
		evidenceIDs[evidenceID] = struct{}{}
	}
	if validateOutcomeNarrativeAggregate(o) != nil {
		return ErrInvalidArgument
	}
	return nil
}

func (o Outcome) Clone() Outcome {
	o.Acceptance = append([]OutcomeCriterion(nil), o.Acceptance...)
	o.AutomatedEvidenceIDs = append([]ID(nil), o.AutomatedEvidenceIDs...)
	o.ManualEvidenceIDs = append([]ID(nil), o.ManualEvidenceIDs...)
	o.UnverifiedItems = append([]string(nil), o.UnverifiedItems...)
	o.Risks = append([]string(nil), o.Risks...)
	return o
}

type outcomeNarrativeProjection struct {
	Acceptance      []OutcomeCriterion `json:"acceptance"`
	UnverifiedItems []string           `json:"unverified_items"`
	Risks           []string           `json:"risks"`
	Summary         string             `json:"summary"`
}

func validateOutcomeNarrativeAggregate(o Outcome) error {
	size, err := outcomeNarrativeAggregateSize(o)
	if err != nil || size > MaxOutcomeNarrativeAggregateBytes {
		return ErrInvalidArgument
	}
	return nil
}

func outcomeNarrativeAggregateSize(o Outcome) (int, error) {
	return compactJSONSize(outcomeNarrativeProjection{
		Acceptance:      o.Acceptance,
		UnverifiedItems: o.UnverifiedItems,
		Risks:           o.Risks,
		Summary:         o.Summary,
	})
}
