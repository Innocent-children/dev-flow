package domain

type OutcomeCriterion struct {
	Criterion   string                 `json:"criterion"`
	Status      OutcomeCriterionStatus `json:"status"`
	WorkItemIDs []ID                   `json:"work_item_ids"`
	EvidenceIDs []ID                   `json:"evidence_ids"`
}

func (c OutcomeCriterion) Validate() error {
	if requireNormalizedText(c.Criterion, MaxAcceptanceCriterionBytes, true) != nil || !c.Status.IsValid() {
		return ErrInvalidArgument
	}
	if !boundedUniqueIDs(c.WorkItemIDs, MaxWorkItemsPerTaskPlan) || !boundedUniqueIDs(c.EvidenceIDs, MaxEvidencePerAction) {
		return ErrInvalidArgument
	}
	return nil
}

func boundedUniqueIDs(ids []ID, limit int) bool {
	if len(ids) == 0 || len(ids) > limit {
		return false
	}
	seen := make(map[ID]bool, len(ids))
	for _, id := range ids {
		if !id.IsValid() || seen[id] {
			return false
		}
		seen[id] = true
	}
	return true
}
