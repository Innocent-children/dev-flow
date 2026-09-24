package domain

import "fmt"

type OutcomeCriterion struct {
	Criterion   string                 `json:"criterion"`
	Status      OutcomeCriterionStatus `json:"status"`
	WorkItemIDs []ID                   `json:"work_item_ids"`
	EvidenceIDs []ID                   `json:"evidence_ids"`
}

func (c OutcomeCriterion) Validate() error {
	if err := requireNormalizedText(c.Criterion, MaxAcceptanceCriterionBytes, true); err != nil {
		return AtField("criterion", err)
	}
	if !c.Status.IsValid() {
		return InvalidArgumentViolations(ExplainedViolation("status", RuleEnumValueInvalid, "status must be satisfied or unverified"))
	}
	for _, list := range []struct {
		name  string
		ids   []ID
		limit int
	}{{"work_item_ids", c.WorkItemIDs, MaxWorkItemsPerTaskPlan}, {"evidence_ids", c.EvidenceIDs, MaxEvidencePerAction}} {
		if len(list.ids) == 0 || len(list.ids) > list.limit {
			return InvalidArgumentViolations(ExplainedViolation(list.name, RuleValueRange, fmt.Sprintf("the list must contain 1 to %d identifiers", list.limit)))
		}
		seen := map[ID]bool{}
		for index, id := range list.ids {
			member := fmt.Sprintf("%s[%d]", list.name, index)
			if !id.IsValid() {
				return InvalidArgumentViolations(Violation(member, RuleIdentifierInvalid))
			}
			if seen[id] {
				return InvalidArgumentViolations(Violation(member, RuleStringListDuplicate))
			}
			seen[id] = true
		}
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
