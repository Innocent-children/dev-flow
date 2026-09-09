package application

import (
	"context"
	"github.com/Innocent-children/dev-flow/internal/domain"
	"github.com/Innocent-children/dev-flow/internal/store"
	"path/filepath"
	"reflect"
	"testing"
)

func TestPlanningRequiresCurrentUserConfirmation(t *testing.T) {
	service, memory, observer := phase5Service(t)
	task := openPhase5Task(t, service)
	task = applyPhase5(t, service, task, "requirements_ready", "", requirementsNodeResult("Goal", []string{"criterion"}))
	task = applyPhase5(t, service, task, "design_ready", "", designNodeResult(1, "Direct design"))
	task = applyPhase5(t, service, task, "tasks_plan_saved", "", tasksNodeResult(1, []map[string]any{workItem("work-a", []uint32{0}, nil)}))
	if task.CurrentNode != domain.NodeTasks || task.TaskPlan == nil || task.TaskPlan.Confirmation != nil || task.Blocker != nil {
		t.Fatal("draft must remain unconfirmed in TASKS")
	}
	before := memory.commits
	assertApplyFails(t, service, task, "tasks_ready", "", map[string]any{"baseline": nil, "findings": []string{}, "user_confirmation": nil}, domain.ErrTransitionNotAllowed)
	if memory.commits != before {
		t.Fatal("missing confirmation wrote state")
	}
	oldContent := observer.binding.ContentDigest
	observer.binding.ContentDigest = testDigest('e')
	assertApplyFails(t, service, task, "tasks_ready", "", confirmedPlanResult(task), domain.ErrTransitionNotAllowed)
	observer.binding.ContentDigest = oldContent
	old := confirmedPlanResult(task)
	// Even the same plan saved again is a new planning round and needs a current answer.
	task = applyPhase5(t, service, task, "tasks_plan_saved", "", tasksNodeResult(1, []map[string]any{workItem("work-a", []uint32{0}, nil)}))
	assertApplyFails(t, service, task, "tasks_ready", "", old, domain.ErrTransitionNotAllowed)
	revised := workItem("work-a", []uint32{0}, nil)
	revised["expected_paths"] = []string{"internal/extra.go"}
	task = applyPhase5(t, service, task, "tasks_plan_saved", "", tasksNodeResult(1, []map[string]any{revised}))
	assertApplyFails(t, service, task, "tasks_ready", "", old, domain.ErrTransitionNotAllowed)
	for _, field := range []string{"requirements", "design", "plan"} {
		verdict := confirmedPlanResult(task)
		c := verdict["user_confirmation"].(domain.PlanConfirmation)
		switch field {
		case "requirements":
			c.RequirementsDigest = testDigest('f')
		case "design":
			c.DesignDigest = testDigest('f')
		case "plan":
			c.TaskPlanDigest = testDigest('f')
		}
		verdict["user_confirmation"] = c
		assertApplyFails(t, service, task, "tasks_ready", "", verdict, domain.ErrTransitionNotAllowed)
	}
	task = applyPhase5(t, service, task, "tasks_ready", "", confirmedPlanResult(task))
	if task.CurrentNode != domain.NodeImplement || task.TaskPlan.Confirmation == nil || task.TaskPlan.ConfirmedAt == nil || !task.TaskPlan.Confirmation.Matches(task.Requirements, task.Design, task.TaskPlan) {
		t.Fatal("confirmation was not retained against the current content")
	}
	task = applyPhase5(t, service, task, "implementation_requires_design", "A direct consumer requires a revised design.", map[string]any{"task_plan_revision": task.TaskPlan.Revision, "completed_work_item_ids": []string{}, "deviations": []string{}, "findings": []string{"A direct consumer changes the design."}})
	if task.TaskPlan != nil {
		t.Fatal("replanning retained execution authorization")
	}
}

func TestPlanningDraftAndConfirmationSurviveSQLiteRestart(t *testing.T) {
	service, _, _ := phase5Service(t)
	path := filepath.Join(t.TempDir(), "planning.db")
	db, err := store.Open(context.Background(), path)
	if err != nil {
		t.Fatal(err)
	}
	service.taskStore = db
	task := openPhase5Task(t, service)
	task = applyPhase5(t, service, task, "requirements_ready", "", requirementsNodeResult("Goal", []string{"criterion"}))
	task = applyPhase5(t, service, task, "design_ready", "", designNodeResult(1, "Direct design"))
	task = applyPhase5(t, service, task, "tasks_plan_saved", "", tasksNodeResult(1, []map[string]any{workItem("work-a", []uint32{0}, nil)}))
	for _, confirm := range []bool{false, true} {
		if confirm {
			task = applyPhase5(t, service, task, "tasks_ready", "", confirmedPlanResult(task))
		}
		if err = db.Close(); err != nil {
			t.Fatal(err)
		}
		db, err = store.Open(context.Background(), path)
		if err != nil {
			t.Fatal(err)
		}
		service.taskStore = db
		saved, readErr := db.LoadTask(context.Background(), task.TaskID)
		if readErr != nil || !reflect.DeepEqual(task.TaskPlan, saved.TaskPlan) || saved.CurrentNode != task.CurrentNode {
			t.Fatalf("planning restart changed state: %v", readErr)
		}
		task = saved
	}
	defer db.Close()
}
