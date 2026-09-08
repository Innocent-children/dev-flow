package application

import (
	"context"
	"errors"
	"path/filepath"
	"reflect"
	"testing"

	"github.com/Innocent-children/dev-flow/internal/domain"
	"github.com/Innocent-children/dev-flow/internal/store"
)

func TestImplementationRequiresEveryPlannedWorkItem(t *testing.T) {
	service, memory, _ := phase5Service(t)
	task := twoItemPlan(t, service)
	for _, completed := range [][]string{nil, {"work-a"}, {"work-a", "work-a"}} {
		result := implementationNodeResult(1, completed, true, nil)
		delete(result, "task_plan_revision")
		result["problem_class"] = "none"
		beforeCommits, beforeStages := memory.commits, memory.stages
		_, err := service.SubmitAction(context.Background(), actionSubmission(t, task, "incomplete", "implementation_ready_for_test", result))
		var failure *domain.Error
		if !errors.Is(err, domain.ErrTransitionNotAllowed) || !errors.As(err, &failure) || !failure.ZeroWrite || memory.commits != beforeCommits || memory.stages != beforeStages {
			t.Fatalf("completed=%v err=%v commits=%d stages=%d", completed, err, memory.commits, memory.stages)
		}
	}
	result := implementationNodeResult(1, []string{"work-b", "work-a"}, true, nil)
	delete(result, "task_plan_revision")
	result["problem_class"] = "none"
	applied, err := service.SubmitAction(context.Background(), actionSubmission(t, task, "complete", "implementation_ready_for_test", result))
	if err != nil || applied.Task.CurrentNode != domain.NodeTest {
		t.Fatalf("complete implementation=%+v err=%v", applied, err)
	}
}

func TestRefactorCannotSendIncompleteWorkToTest(t *testing.T) {
	service, memory, _ := phase5Service(t)
	task := twoItemPlan(t, service)
	task = applyPhase5(t, service, task, "implementation_needs_refactor", "Simplify before finishing the remaining item.", implementationNodeResult(1, []string{"work-a"}, true, []string{"Simplification needed"}))
	before := memory.commits
	assertApplyFails(t, service, task, "refactor_ready_for_test", "", refactorNodeResult(nil, true, []string{"Simplified the helper"}, false, nil), domain.ErrTransitionNotAllowed)
	if memory.commits != before {
		t.Fatal("partial refactor changed Task state")
	}
}

func TestDeliveryLinksRejectOmissionsAndPersistCurrentReferences(t *testing.T) {
	ctx := context.Background()
	path := filepath.Join(t.TempDir(), "completion.db")
	database, err := store.Open(ctx, path)
	if err != nil {
		t.Fatal(err)
	}
	defer database.Close()
	_, _, observer := phase5Service(t)
	service, err := NewService(database, observer)
	if err != nil {
		t.Fatal(err)
	}
	task := twoItemPlan(t, service)
	task = applyPhase5(t, service, task, "implementation_ready_for_test", "", implementationNodeResult(1, []string{"work-a", "work-b"}, true, nil))
	task = applyPhase5(t, service, task, "tests_passed", "", testNodeResult([]map[string]any{evidenceCheck("automated", "passed", "old-check", 1, false)}, nil, nil, nil))
	oldEvidence := task.Test.EvidenceIDs[0]
	task = applyPhase5(t, service, task, "evidence_insufficient", "A current check must cover both criteria.", comprehensionNodeResult(nil, []string{"Check both criteria"}, nil, "", "", []string{"Verification gap"}))
	task = applyPhase5(t, service, task, "tests_passed", "", testNodeResult([]map[string]any{
		evidenceCheck("automated", "passed", "current-check", 1, false), evidenceCheck("user", "passed", "manual-check", 0, false),
	}, nil, nil, nil))
	task = applyPhase5(t, service, task, "comprehension_passed", "", comprehensionNodeResult([]string{"Both work items"}, nil, nil, "user", "passed", nil))
	cases := map[string]func([]domain.OutcomeCriterion) []domain.OutcomeCriterion{
		"missing criterion": func(v []domain.OutcomeCriterion) []domain.OutcomeCriterion { return v[:1] },
		"missing work":      func(v []domain.OutcomeCriterion) []domain.OutcomeCriterion { v[0].WorkItemIDs = nil; return v },
		"unrelated work": func(v []domain.OutcomeCriterion) []domain.OutcomeCriterion {
			v[0].WorkItemIDs = []domain.ID{"work-b"}
			return v
		},
		"missing evidence": func(v []domain.OutcomeCriterion) []domain.OutcomeCriterion { v[0].EvidenceIDs = nil; return v },
		"historical evidence": func(v []domain.OutcomeCriterion) []domain.OutcomeCriterion {
			v[0].EvidenceIDs = []domain.ID{oldEvidence}
			return v
		},
		"comprehension is not acceptance": func(v []domain.OutcomeCriterion) []domain.OutcomeCriterion {
			v[0].EvidenceIDs = []domain.ID{task.Comprehension.UserEvidenceID}
			return v
		},
		"duplicate evidence": func(v []domain.OutcomeCriterion) []domain.OutcomeCriterion {
			v[0].EvidenceIDs = []domain.ID{task.Test.EvidenceIDs[0], task.Test.EvidenceIDs[0]}
			return v
		},
	}
	for name, mutate := range cases {
		t.Run(name, func(t *testing.T) {
			payload := deliverySubmissionResult(task)
			payload["acceptance"] = mutate(linkedAcceptance(task))
			_, err := service.SubmitAction(ctx, actionSubmission(t, task, "invalid-delivery", "delivery_complete", payload))
			if !errors.Is(err, domain.ErrInvalidArgument) && !errors.Is(err, domain.ErrTransitionNotAllowed) {
				t.Fatalf("error=%v", err)
			}
			current, loadErr := database.LoadTask(ctx, task.TaskID)
			_, retained, operationErr := database.LoadActionOperation(ctx, task.TaskID)
			if loadErr != nil || operationErr != nil || retained || current.Revision != task.Revision {
				t.Fatal("rejected delivery changed stored state")
			}
		})
	}
	payload := deliverySubmissionResult(task)
	acceptance := linkedAcceptance(task)
	acceptance[1].EvidenceIDs = []domain.ID{task.Test.EvidenceIDs[1]}
	payload["acceptance"] = acceptance
	done, err := service.SubmitAction(ctx, actionSubmission(t, task, "valid-delivery", "delivery_complete", payload))
	if err != nil || done.Task.CurrentNode != domain.NodeDone {
		t.Fatalf("delivery=%+v err=%v", done, err)
	}
	if err := database.Close(); err != nil {
		t.Fatal(err)
	}
	reopened, err := store.Open(ctx, path)
	if err != nil {
		t.Fatal(err)
	}
	defer reopened.Close()
	loaded, err := reopened.LoadTask(ctx, task.TaskID)
	if err != nil || !reflect.DeepEqual(loaded.Outcome.Acceptance, acceptance) {
		t.Fatalf("saved acceptance=%+v err=%v", loaded.Outcome, err)
	}
}

func twoItemPlan(t *testing.T, service *Service) domain.ProcessTask {
	t.Helper()
	task := openPhase5Task(t, service)
	task = applyPhase5(t, service, task, "requirements_ready", "", requirementsNodeResult("Both items", []string{"Criterion A", "Criterion B"}))
	task = applyPhase5(t, service, task, "design_ready", "", designNodeResult(1, "Two explicit work items"))
	return applyPhase5(t, service, task, "tasks_ready", "", tasksNodeResult(1, []map[string]any{workItem("work-a", []uint32{0}, nil), workItem("work-b", []uint32{1}, nil)}))
}
