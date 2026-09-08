package domain

// CompletedWorkItemsCoverPlan validates the complete set of work required by the current plan.
func CompletedWorkItemsCoverPlan(plan *TaskPlanBaseline, completed []ID) bool {
	if plan == nil || len(plan.WorkItems) == 0 || len(completed) != len(plan.WorkItems) || !boundedUniqueIDs(completed, MaxWorkItemsPerTaskPlan) {
		return false
	}
	known := make(map[ID]bool, len(plan.WorkItems))
	for _, item := range plan.WorkItems {
		known[item.WorkItemID] = true
	}
	for _, id := range completed {
		if !known[id] {
			return false
		}
	}
	return true
}

// AcceptanceLinksCurrent validates the relationship between acceptance, completed work and current test results.
func AcceptanceLinksCurrent(task ProcessTask, acceptance []OutcomeCriterion) bool {
	if task.Requirements == nil || task.TaskPlan == nil || task.Implementation == nil || task.Test == nil ||
		!CompletedWorkItemsCoverPlan(task.TaskPlan, task.Implementation.CompletedWorkItemIDs) ||
		len(acceptance) != len(task.Requirements.AcceptanceCriteria) {
		return false
	}
	work := make(map[ID]WorkItem, len(task.TaskPlan.WorkItems))
	for _, item := range task.TaskPlan.WorkItems {
		work[item.WorkItemID] = item
	}
	current := make(map[ID]bool, len(task.Test.EvidenceIDs))
	for _, id := range task.Test.EvidenceIDs {
		current[id] = true
	}
	passed := make(map[ID]bool, len(current))
	for _, item := range task.Evidence {
		if current[item.EvidenceID] && item.Status == EvidencePassed && item.TaskPlanRevision == task.TaskPlan.Revision {
			passed[item.EvidenceID] = true
		}
	}
	for index, criterion := range acceptance {
		if criterion.Validate() != nil || criterion.Criterion != task.Requirements.AcceptanceCriteria[index] || criterion.Status != CriterionSatisfied {
			return false
		}
		for _, id := range criterion.WorkItemIDs {
			item, exists := work[id]
			mapped := false
			for _, target := range item.AcceptanceIndexes {
				if int(target) == index {
					mapped = true
				}
			}
			if !exists || !mapped {
				return false
			}
		}
		for _, id := range criterion.EvidenceIDs {
			if !passed[id] {
				return false
			}
		}
	}
	return true
}
