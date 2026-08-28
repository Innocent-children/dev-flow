package application

import (
	"fmt"

	"github.com/Innocent-children/dev-flow/internal/domain"
	"github.com/Innocent-children/dev-flow/internal/workflow"
)

// validateActionResultAgainstTask checks LLM-supplied semantic references before
// SubmitAction stages an ActionCommit. The apply functions keep their checks as
// mutation-boundary defenses; this preflight provides safe field detail while
// the failure is still proven zero-write.
func validateActionResultAgainstTask(task domain.ProcessTask, transition domain.TransitionDefinition, result any) error {
	var violations []domain.ContractViolation
	var guardFailures []domain.ContractViolation
	add := func(path string, rule domain.ViolationRule) {
		violations = append(violations, domain.Violation("payload.node_result."+path, rule))
	}
	guard := func(path string, rule domain.GuardRule) {
		guardFailures = append(guardFailures, domain.GuardViolation("payload.node_result."+path, rule))
	}

	switch value := result.(type) {
	case *workflow.RequirementsResult:
		if value.Baseline == nil {
			add("baseline", domain.RuleRequiredMemberMissing)
		}
		if len(value.UnresolvedQuestions) != 0 {
			add("unresolved_questions", domain.RuleCollectionMustBeEmpty)
		}
	case *workflow.DesignResult:
		if transition.TransitionID == "design_ready" {
			if value.Baseline == nil {
				add("baseline", domain.RuleRequiredMemberMissing)
			} else if task.Requirements == nil || value.Baseline.RequirementsRevision != task.Requirements.Revision {
				add("baseline.requirements_revision", domain.RuleCurrentValueRequired)
			}
		}
	case *workflow.TasksResult:
		if transition.TransitionID == "tasks_ready" {
			if value.Baseline == nil {
				add("baseline", domain.RuleRequiredMemberMissing)
			} else {
				if task.Design == nil || value.Baseline.DesignRevision != task.Design.Revision {
					add("baseline.design_revision", domain.RuleCurrentValueRequired)
				}
				if task.Requirements == nil || !acceptanceCovered(value.Baseline.WorkItems, len(task.Requirements.AcceptanceCriteria)) {
					add("baseline.work_items", domain.RuleAcceptanceCoverageRequired)
				}
				for index, item := range value.Baseline.WorkItems {
					if len(item.VerificationSteps) == 0 {
						add(fmt.Sprintf("baseline.work_items[%d].verification_steps", index), domain.RuleRequiredCollectionNonEmpty)
					}
					for acceptanceIndex, criterionIndex := range item.AcceptanceIndexes {
						if task.Requirements == nil || int(criterionIndex) >= len(task.Requirements.AcceptanceCriteria) {
							add(fmt.Sprintf("baseline.work_items[%d].acceptance_indexes[%d]", index, acceptanceIndex), domain.RuleKnownIdentifierRequired)
						}
					}
				}
			}
		}
	case *workflow.ImplementationResult:
		if task.TaskPlan == nil || value.TaskPlanRevision != task.TaskPlan.Revision {
			add("task_plan_revision", domain.RuleCurrentValueRequired)
		} else {
			known := make(map[domain.ID]bool, len(task.TaskPlan.WorkItems))
			for _, item := range task.TaskPlan.WorkItems {
				known[item.WorkItemID] = true
			}
			for index, id := range value.CompletedWorkItemIDs {
				if !known[id] {
					add(fmt.Sprintf("completed_work_item_ids[%d]", index), domain.RuleKnownIdentifierRequired)
				}
			}
		}
	case *workflow.TestResult:
		if transition.TransitionID == "tests_passed" {
			if len(value.Checks) == 0 {
				guard("checks", domain.GuardRequiredCollectionNonEmpty)
			}
			if len(value.FailedItems) != 0 {
				guard("failed_items", domain.GuardCollectionMustBeEmpty)
			}
			for index, check := range value.Checks {
				if check.Status != domain.EvidencePassed {
					guard(fmt.Sprintf("checks[%d].status", index), domain.GuardPassingStatusRequired)
				}
			}
		}
	case *workflow.ComprehensionResult:
		if transition.TransitionID == "comprehension_passed" {
			if value.UserConfirmation == nil || value.UserConfirmation.Source != domain.EvidenceSourceUser || value.UserConfirmation.Status != domain.EvidencePassed {
				guard("user_confirmation", domain.GuardUserConfirmationRequired)
			}
			if len(value.ExplainedComponents) == 0 {
				guard("explained_components", domain.GuardRequiredCollectionNonEmpty)
			}
			if len(value.UnresolvedQuestions) != 0 {
				guard("unresolved_questions", domain.GuardCollectionMustBeEmpty)
			}
			if len(value.UnnecessaryAbstractions) != 0 {
				guard("unnecessary_abstractions", domain.GuardCollectionMustBeEmpty)
			}
		}
	case *workflow.RefactorResult:
		if transition.TransitionID == "refactor_ready_for_test" {
			if len(value.Simplifications) == 0 {
				guard("simplifications", domain.GuardRequiredCollectionNonEmpty)
			}
			if value.BehaviorChangeIntended {
				guard("behavior_change_intended", domain.GuardBooleanFalseRequired)
			}
		}
	case *workflow.DeliveryResult:
		if transition.TransitionID == "delivery_complete" {
			validateDeliveryResultAgainstTask(task, value, guard)
		}
	}

	if len(violations) != 0 {
		return domain.InvalidArgumentViolations(violations...)
	}
	if len(guardFailures) != 0 {
		return domain.TransitionGuardFailure(transition.Guard, guardFailures...)
	}
	return nil
}

func validateDeliveryResultAgainstTask(task domain.ProcessTask, result *workflow.DeliveryResult, add func(string, domain.GuardRule)) {
	if task.Test == nil || result.TestRecordID != task.Test.RecordID {
		add("test_record_id", domain.GuardCurrentValueRequired)
	}
	if task.Comprehension == nil || result.ComprehensionRecordID != task.Comprehension.RecordID {
		add("comprehension_record_id", domain.GuardCurrentValueRequired)
	}
	if !currentAcceptance(task, result.Acceptance) {
		add("acceptance", domain.GuardAcceptanceSetCurrent)
	}
	expectedAutomated, expectedManual, ok := currentDeliveryEvidence(task)
	if !ok || !equalIDs(result.AutomatedEvidenceIDs, expectedAutomated) {
		add("automated_evidence_ids", domain.GuardCurrentSetRequired)
	}
	if !ok || !equalIDs(result.ManualEvidenceIDs, expectedManual) {
		add("manual_evidence_ids", domain.GuardCurrentSetRequired)
	}
	if len(result.UnverifiedItems) != 0 {
		add("unverified_items", domain.GuardCollectionMustBeEmpty)
	}
}

func currentAcceptance(task domain.ProcessTask, acceptance []domain.OutcomeCriterion) bool {
	if task.Requirements == nil || len(acceptance) != len(task.Requirements.AcceptanceCriteria) {
		return false
	}
	for index, criterion := range acceptance {
		if criterion.Criterion != task.Requirements.AcceptanceCriteria[index] || criterion.Status != domain.CriterionSatisfied {
			return false
		}
	}
	return true
}

func currentDeliveryEvidence(task domain.ProcessTask) ([]domain.ID, []domain.ID, bool) {
	if task.Test == nil || task.Comprehension == nil {
		return nil, nil, false
	}
	byID := make(map[domain.ID]domain.EvidenceSummary, len(task.Evidence))
	for _, item := range task.Evidence {
		byID[item.EvidenceID] = item
	}
	var automated, manual []domain.ID
	for _, id := range task.Test.EvidenceIDs {
		item, ok := byID[id]
		if !ok || item.Status != domain.EvidencePassed {
			return nil, nil, false
		}
		switch item.Source {
		case domain.EvidenceSourceAutomated:
			automated = append(automated, id)
		case domain.EvidenceSourceUser:
			manual = append(manual, id)
		case domain.EvidenceSourceStatic, domain.EvidenceSourceHostObserved:
		default:
			return nil, nil, false
		}
	}
	confirmation, ok := byID[task.Comprehension.UserEvidenceID]
	if !ok || confirmation.Source != domain.EvidenceSourceUser || confirmation.Status != domain.EvidencePassed {
		return nil, nil, false
	}
	manual = append(manual, task.Comprehension.UserEvidenceID)
	return automated, manual, true
}

func equalIDs(left, right []domain.ID) bool {
	if len(left) != len(right) {
		return false
	}
	for index := range left {
		if left[index] != right[index] {
			return false
		}
	}
	return true
}
