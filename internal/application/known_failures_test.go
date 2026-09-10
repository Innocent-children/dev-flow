package application

import (
	"context"
	"encoding/json"
	"path/filepath"
	"testing"

	"github.com/Innocent-children/dev-flow/internal/domain"
	"github.com/Innocent-children/dev-flow/internal/store"
)

func knownFailureNodeResult(task domain.ProcessTask) map[string]any {
	workspace, _ := task.EffectiveWorkspaceDigests()
	result := testNodeResult([]map[string]any{
		evidenceCheck("automated", "failed", "python-suite", 1, false),
		evidenceCheck("automated", "passed", "regression-comparison", 1, false),
		evidenceCheck("automated", "passed", "related-check", 1, false),
	}, []string{"python-suite"}, nil, nil)
	result["known_failure_acceptance"] = domain.KnownFailureAcceptance{
		Source: domain.EvidenceSourceUser, Summary: "The user accepts the listed existing failure after comparison.",
		FailedChecks: []string{"python-suite"}, ComparisonCheck: "regression-comparison",
		TaskPlanRevision: task.TaskPlan.Revision, ContentDigest: workspace.Content,
	}
	return result
}

func TestKnownFailuresPersistAcrossRestartAndReachDelivery(t *testing.T) {
	ctx := context.Background()
	path := filepath.Join(t.TempDir(), "acceptance.db")
	database, err := store.Open(ctx, path)
	if err != nil {
		t.Fatal(err)
	}
	_, _, observer := phase5Service(t)
	service, err := NewService(database, observer)
	if err != nil {
		t.Fatal(err)
	}
	task := phase5TaskAtTest(t, service)
	task = applyPhase5(t, service, task, "tests_accepted_with_known_failures", "The user accepts these existing failures.", knownFailureNodeResult(task))
	if task.CurrentNode != domain.NodeComprehensionReview || task.Test.KnownFailureAcceptance == nil || task.Evidence[0].Status != domain.EvidenceFailed {
		t.Fatal("TEST did not retain the failed result and separate acceptance")
	}
	if err := database.Close(); err != nil {
		t.Fatal(err)
	}
	database, err = store.Open(ctx, path)
	if err != nil {
		t.Fatal(err)
	}
	defer database.Close()
	service, err = NewService(database, observer)
	if err != nil {
		t.Fatal(err)
	}
	task, err = database.LoadTask(ctx, task.TaskID)
	if err != nil {
		t.Fatal(err)
	}
	if task.Test.KnownFailureAcceptance.ComparisonCheck != "regression-comparison" {
		t.Fatal("lost acceptance")
	}
	task = applyPhase5(t, service, task, "comprehension_passed", "", comprehensionNodeResult([]string{"component"}, nil, nil, "user", "passed", nil))
	result := deliveryCompleteNodeResult(task)
	passed := task.Test.EvidenceIDs[1:]
	result["automated_evidence_ids"] = passed
	result["acceptance"] = []domain.OutcomeCriterion{{Criterion: task.Requirements.AcceptanceCriteria[0], Status: domain.CriterionSatisfied, WorkItemIDs: task.Implementation.CompletedWorkItemIDs, EvidenceIDs: passed}}
	task = applyPhase5(t, service, task, "delivery_complete", "", result)
	if task.CurrentNode != domain.NodeDone || task.Evidence[0].Status != domain.EvidenceFailed || task.Test.KnownFailureAcceptance == nil {
		t.Fatal("delivery changed the test result")
	}
	if _, err := database.LoadTask(ctx, task.TaskID); err != nil {
		t.Fatal(err)
	}
}

func TestKnownFailureAcceptanceRejectsIncompleteOrStaleDecision(t *testing.T) {
	for _, scenario := range []string{"missing", "stale-content", "stale-plan", "new-failure", "failed-comparison", "unexecuted", "wrong-failed-items"} {
		t.Run(scenario, func(t *testing.T) {
			service, memory, _ := phase5Service(t)
			task := phase5TaskAtTest(t, service)
			result := knownFailureNodeResult(task)
			acceptance := result["known_failure_acceptance"].(domain.KnownFailureAcceptance)
			checks := result["checks"].([]map[string]any)
			switch scenario {
			case "missing":
				delete(result, "known_failure_acceptance")
			case "stale-content":
				acceptance.ContentDigest = domain.Digest("ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff")
			case "stale-plan":
				acceptance.TaskPlanRevision++
			case "new-failure":
				checks[2]["status"] = "failed"
			case "failed-comparison":
				checks[1]["status"] = "failed"
			case "unexecuted":
				checks[2]["status"] = "not_run"
			case "wrong-failed-items":
				result["failed_items"] = []string{"different-check"}
			}
			if scenario != "missing" {
				result["known_failure_acceptance"] = acceptance
			}
			before := memory.commits
			err := applyTestPayload(t, service, task, "reject-acceptance", "tests_accepted_with_known_failures", "The user accepts known failures.", result)
			if err == nil || memory.commits != before {
				t.Fatalf("err=%v commits=%d", err, memory.commits-before)
			}
		})
	}
}

func TestPermissionOnlyAdjustmentMissingChecksIsCorrectableWithoutCommands(t *testing.T) {
	service, memory, _ := phase5Service(t)
	task := phase5TaskAtTest(t, service)
	adjustment := map[string]any{"basis": "verification_gap", "additional_checks": []any{}, "additional_automatic_commands": 0, "allow_full_suite": true, "allow_manual_handoff": false}
	before := memory.commits
	err := applyTestPayload(t, service, task, "missing-explanation", "verification_budget_increased", "A full suite is required for the shared contract.", budgetAdjustmentNodeResult(adjustment))
	failure := structuredFailure(t, err)
	if !failure.ZeroWrite || len(failure.Violations) != 1 || failure.Violations[0].Rule != domain.RuleBudgetChecksRequired || memory.commits != before {
		t.Fatalf("failure=%+v", failure)
	}
	adjustment["additional_checks"] = []map[string]any{{"name": "suite", "rationale": "The shared contract needs the repository suite."}}
	task = applyPhase5(t, service, task, "verification_budget_increased", "A full suite is required for the shared contract.", budgetAdjustmentNodeResult(adjustment))
	budget, _ := task.CurrentVerificationBudget()
	if !budget.AllowFullSuite || budget.MaxAutomaticCommands != 4 || len(task.Evidence) != 0 {
		raw, _ := json.Marshal(task)
		t.Fatalf("unexpected adjustment: %s", raw)
	}
}

func TestKnownFailuresPublicSubmissionPreservesTheDecisionBinding(t *testing.T) {
	service, _, _ := phase5Service(t)
	task := phase5TaskAtTest(t, service)
	result := knownFailureNodeResult(task)
	result["problem_class"] = "none"
	request := actionSubmission(t, task, "accept-known-failures", "tests_accepted_with_known_failures", result)
	request.Reason = "The user accepted these existing failures after the comparison."
	applied, err := service.SubmitAction(context.Background(), request)
	if err != nil {
		t.Fatal(err)
	}
	if applied.Task.Test == nil || applied.Task.Test.KnownFailureAcceptance == nil || applied.Task.Evidence[0].Status != domain.EvidenceFailed {
		t.Fatal("public submission lost the original outcome")
	}
}
