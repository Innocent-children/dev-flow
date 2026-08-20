package domain

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
