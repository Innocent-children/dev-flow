package application

import (
	"context"
	"errors"
	"fmt"
	"slices"
	"testing"
	"time"

	"github.com/Innocent-children/dev-flow/internal/domain"
)

// TestMultiRepositorySubmissionNamesTheUnqualifiedPath proves a path that omits
// its required repository key fails with the exact work-item member instead of a
// bare INVALID_ARGUMENT, and that the fully qualified form stays accepted.
func TestMultiRepositorySubmissionNamesTheUnqualifiedPath(t *testing.T) {
	service, task := multiRepositoryTasksTask(t)

	unqualified := tasksResultWithoutRevision([]map[string]any{multiRepositoryWorkItem("work-a", nil)})
	_, err := submitTasksResult(t, service, task, "path-submit-unqualified", unqualified)
	assertRepositoryPathViolation(t, err, "payload.node_result.baseline.work_items[0].expected_paths[0]")

	unknownKey := tasksResultWithoutRevision([]map[string]any{multiRepositoryWorkItem("work-a", []string{"api::internal/file.go"})})
	_, err = submitTasksResult(t, service, task, "path-submit-unknown", unknownKey)
	assertRepositoryPathViolation(t, err, "payload.node_result.baseline.work_items[0].expected_paths[0]")

	qualified := tasksResultWithoutRevision([]map[string]any{multiRepositoryWorkItem("work-a", []string{"core::internal/file.go", "docs::src/guide.md"})})
	applied, err := submitTasksResult(t, service, task, "path-submit-qualified", qualified)
	if err != nil {
		t.Fatalf("a fully qualified multi-repository plan was refused: %v", err)
	}
	if applied.CurrentNode != domain.NodeTasks || applied.TaskPlan == nil || len(applied.TaskPlan.WorkItems) != 1 {
		t.Fatalf("task=%+v", applied)
	}
}

// TestMultiRepositorySubmissionNamesTheUnqualifiedArtifact proves the same
// detail for artifact paths, which also carry the repository key.
func TestMultiRepositorySubmissionNamesTheUnqualifiedArtifact(t *testing.T) {
	service, task := multiRepositoryTasksTask(t)
	plan := tasksResultWithoutRevision([]map[string]any{multiRepositoryWorkItem("work-a", []string{"core::internal/file.go"})})

	unqualified := ArtifactSubmission{Path: "docs/task-plan.md", Digest: testDigest('d'), Summary: "The saved plan document."}
	_, err := submitTasksResult(t, service, task, "path-submit-artifact", plan, unqualified)
	assertRepositoryPathViolation(t, err, "payload.artifacts.current[0].path")

	qualified := ArtifactSubmission{Path: "docs::task-plan.md", Digest: testDigest('d'), Summary: "The saved plan document."}
	if _, err := submitTasksResult(t, service, task, "path-apply-artifact", plan, qualified); err != nil {
		t.Fatalf("a qualified artifact path was refused: %v", err)
	}
}

// TestSingleRepositorySubmissionRejectsTheRepositoryPrefix proves the inverse
// rule keeps its detail as well: a single-repository Task must not qualify paths.
func TestSingleRepositorySubmissionRejectsTheRepositoryPrefix(t *testing.T) {
	service, _, _ := phase5Service(t)
	task := openPhase5Task(t, service)
	task = applyPhase5(t, service, task, "requirements_ready", "", requirementsNodeResult("Goal", []string{"criterion"}))
	task = applyPhase5(t, service, task, "design_ready", "", designNodeResult(1, "Direct design"))

	prefixed := tasksResultWithoutRevision([]map[string]any{multiRepositoryWorkItem("work-a", []string{"primary::internal/file.go"})})
	_, err := submitTasksResult(t, service, task, "path-submit-single", prefixed)
	assertRepositoryPathViolation(t, err, "payload.node_result.baseline.work_items[0].expected_paths[0]")
}

// TestRepositoryPathFailureReportsEveryInvalidPath covers errors beyond the
// former 64-entry cutoff, including artifact paths after the work items.
func TestRepositoryPathFailureReportsEveryInvalidPath(t *testing.T) {
	service, task := multiRepositoryTasksTask(t)
	items := make([]map[string]any, 0, 2)
	wantPaths := []string{"payload.artifacts.current[0].path", "payload.artifacts.other_process[0].path"}
	for itemIndex := 0; itemIndex < 2; itemIndex++ {
		paths := make([]string, 0, 40)
		for pathIndex := 0; pathIndex < 40; pathIndex++ {
			paths = append(paths, fmt.Sprintf("internal/unqualified-%d-%d.go", itemIndex, pathIndex))
			wantPaths = append(wantPaths, fmt.Sprintf("payload.node_result.baseline.work_items[%d].expected_paths[%d]", itemIndex, pathIndex))
		}
		items = append(items, multiRepositoryWorkItem(domain.ID(fmt.Sprintf("work-%d", itemIndex)), paths))
	}
	slices.Sort(wantPaths)
	result := tasksResultWithoutRevision(items)
	result["problem_class"] = phase5ProblemClass("tasks_plan_saved")
	request := actionSubmission(t, task, "path-submit-all-invalid", "tasks_plan_saved", result)
	request.CurrentArtifacts = []ArtifactSubmission{{Path: "docs/task-plan.md", Digest: testDigest('d'), Summary: "The saved plan document."}}
	request.OtherProcessArtifacts = []ArtifactSubmission{{Path: "notes/overview.md", Digest: testDigest('e'), Summary: "The related notes."}}
	_, err := service.SubmitAction(context.Background(), request)
	var typed *domain.Error
	if !errors.As(err, &typed) || typed.Code != domain.ErrorInvalidArgument || !typed.ZeroWrite {
		t.Fatalf("error=%v", err)
	}
	if got := domain.ViolationPaths(err); !slices.Equal(got, wantPaths) {
		t.Fatalf("violation paths=%v want=%v", got, wantPaths)
	}
	for _, violation := range typed.Violations {
		if violation.Rule != domain.RuleRepositoryPathInvalid {
			t.Fatalf("violation=%#v", violation)
		}
	}
}

// multiRepositoryTasksTask opens a two-repository Task and advances it to TASKS,
// where the current Action expects a task plan baseline.
func multiRepositoryTasksTask(t *testing.T) (*Service, domain.ProcessTask) {
	t.Helper()
	now := time.Date(2026, 9, 21, 4, 0, 0, 0, time.UTC)
	corePath, docsPath := testPath("core"), testPath("docs")
	core := multiRepositoryBinding(now, corePath, 'a')
	docs := multiRepositoryBinding(now, docsPath, 'b')
	service, err := newService(&memoryStore{}, &multiRepositoryObserver{bindings: map[string]domain.RepositoryBinding{corePath: core, docsPath: docs}}, func() time.Time { return now }, sequentialTestIDs())
	if err != nil {
		t.Fatal(err)
	}
	request := multiRepositoryOpenRequest("open-path-scope", corePath, core)
	request.PrimaryRepositoryKey = "core"
	request.AdditionalRepositories = []AdditionalRepositoryInput{additionalRepositoryInput("docs", docsPath, docs)}
	opened, err := service.OpenTask(context.Background(), request)
	if err != nil {
		t.Fatal(err)
	}
	task := applyPhase5(t, service, opened.Task, "requirements_ready", "", requirementsNodeResult("Goal", []string{"criterion"}))
	task = applyPhase5(t, service, task, "design_ready", "", designNodeResult(1, "Use the existing design."))
	return service, task
}

// submitTasksResult submits one TASKS plan through the ordinary submission path,
// including the transition problem class and optional current artifact.
func submitTasksResult(t *testing.T, service *Service, task domain.ProcessTask, requestID domain.ID, nodeResult map[string]any, artifacts ...ArtifactSubmission) (domain.ProcessTask, error) {
	t.Helper()
	nodeResult["problem_class"] = phase5ProblemClass("tasks_plan_saved")
	request := actionSubmission(t, task, requestID, "tasks_plan_saved", nodeResult)
	request.CurrentArtifacts = append([]ArtifactSubmission(nil), artifacts...)
	result, err := service.SubmitAction(context.Background(), request)
	if err != nil {
		return domain.ProcessTask{}, err
	}
	return result.Task, nil
}

func multiRepositoryWorkItem(id domain.ID, paths []string) map[string]any {
	item := workItem(string(id), []uint32{0}, nil)
	if paths != nil {
		item["expected_paths"] = paths
	}
	return item
}

func assertRepositoryPathViolation(t *testing.T, err error, wantPaths ...string) {
	t.Helper()
	var typed *domain.Error
	if !errors.As(err, &typed) || typed.Code != domain.ErrorInvalidArgument {
		t.Fatalf("error=%v", err)
	}
	if !typed.ZeroWrite || len(typed.Violations) == 0 {
		t.Fatalf("violations=%#v", typed.Violations)
	}
	for _, violation := range typed.Violations {
		if violation.Rule != domain.RuleRepositoryPathInvalid {
			t.Fatalf("violation=%#v", violation)
		}
	}
	if got := domain.ViolationPaths(err); !slices.Equal(got, wantPaths) {
		t.Fatalf("violation paths=%v want=%v", got, wantPaths)
	}
}
