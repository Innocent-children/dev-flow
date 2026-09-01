package application

import (
	"context"
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/Innocent-children/dev-flow/internal/domain"
	"github.com/Innocent-children/dev-flow/internal/workflow"
)

func TestPrepareFileChangeChecksPlanAndPersistsDecisions(t *testing.T) {
	now := time.Date(2026, 9, 1, 1, 0, 0, 0, time.UTC)
	t.Run("planned exact and directory paths do not write Task state", func(t *testing.T) {
		service, taskStore := fileScopeService(t, now, fileScopeTask(t, now, []string{"src/exact.go", "tests/**"}))
		for index, path := range []string{"/repo/src/exact.go", "/repo/tests/unit/file_test.go"} {
			result, err := service.PrepareFileChange(context.Background(), PrepareFileChangeRequest{Host: domain.HostCodex, RepositoryPath: "/repo", ToolName: "apply_patch", Paths: []string{path}, IntentDigest: testDigest(byte('b' + index)), PathParseComplete: true})
			if err != nil || result.Decision != FileChangeAllow || taskStore.commits != 0 {
				t.Fatalf("path=%s result=%#v err=%v commits=%d", path, result, err, taskStore.commits)
			}
		}
	})

	t.Run("outside path blocks before write and allow_once matches only the prepared intent", func(t *testing.T) {
		service, taskStore := fileScopeService(t, now, fileScopeTask(t, now, []string{"src/**"}))
		intent := testDigest('c')
		blocked, err := service.PrepareFileChange(context.Background(), PrepareFileChangeRequest{Host: domain.HostCodex, RepositoryPath: "/repo", ToolName: "apply_patch", Paths: []string{"/repo/config/security.yml"}, IntentDigest: intent, PathParseComplete: true})
		if err != nil || blocked.Decision != FileChangeDeny || blocked.ScopeRequestID == "" || taskStore.task.CurrentNode != domain.NodeBlocked || len(taskStore.task.FileScopeRecords) != 1 {
			t.Fatalf("blocked=%#v err=%v task=%#v", blocked, err, taskStore.task)
		}
		resolved, err := service.ResolveBlockerAction(context.Background(), RecoverActionRequest{Host: domain.HostCodex, TaskID: taskStore.task.TaskID, ActionID: taskStore.task.CurrentAction.ActionID, FileScopeDecision: &domain.FileScopeDecisionInput{Choice: domain.FileScopeAllowOnce, Reason: "This configuration controls the requested behavior."}}, "resolve-scope")
		if err != nil || resolved.Task.CurrentNode != domain.NodeImplement || resolved.Task.FileScopeRecords[0].AllowedActionID == nil || resolved.Task.FileScopeRecords[0].Consumed {
			t.Fatalf("resolved=%#v err=%v", resolved, err)
		}
		allowed, err := service.PrepareFileChange(context.Background(), PrepareFileChangeRequest{Host: domain.HostCodex, RepositoryPath: "/repo", ToolName: "apply_patch", Paths: []string{"/repo/config/security.yml"}, IntentDigest: intent, PathParseComplete: true})
		if err != nil || allowed.Decision != FileChangeAllow {
			t.Fatalf("allowed=%#v err=%v", allowed, err)
		}
		second, err := service.PrepareFileChange(context.Background(), PrepareFileChangeRequest{Host: domain.HostCodex, RepositoryPath: "/repo", ToolName: "apply_patch", Paths: []string{"/repo/config/security.yml"}, IntentDigest: testDigest('d'), PathParseComplete: true})
		if err != nil || second.Decision != FileChangeDeny || taskStore.task.CurrentNode != domain.NodeBlocked || len(taskStore.task.FileScopeRecords) != 2 {
			t.Fatalf("second=%#v err=%v records=%#v", second, err, taskStore.task.FileScopeRecords)
		}
	})

	t.Run("reject stays effective for the current Task Plan revision", func(t *testing.T) {
		service, taskStore := fileScopeService(t, now, fileScopeTask(t, now, []string{"src/**"}))
		intent := testDigest('e')
		_, err := service.PrepareFileChange(context.Background(), PrepareFileChangeRequest{Host: domain.HostCodex, RepositoryPath: "/repo", ToolName: "apply_patch", Paths: []string{"/repo/config/security.yml"}, IntentDigest: intent, PathParseComplete: true})
		if err != nil {
			t.Fatal(err)
		}
		_, err = service.ResolveBlockerAction(context.Background(), RecoverActionRequest{Host: domain.HostCodex, TaskID: taskStore.task.TaskID, ActionID: taskStore.task.CurrentAction.ActionID, FileScopeDecision: &domain.FileScopeDecisionInput{Choice: domain.FileScopeReject, Reason: "Keep the existing implementation boundary."}}, "resolve-reject")
		if err != nil {
			t.Fatal(err)
		}
		before := taskStore.commits
		denied, err := service.PrepareFileChange(context.Background(), PrepareFileChangeRequest{Host: domain.HostCodex, RepositoryPath: "/repo", ToolName: "apply_patch", Paths: []string{"/repo/config/security.yml"}, IntentDigest: testDigest('f'), PathParseComplete: true})
		if err != nil || denied.Decision != FileChangeDeny || taskStore.commits != before || taskStore.task.CurrentNode != domain.NodeImplement {
			t.Fatalf("denied=%#v err=%v commits=%d", denied, err, taskStore.commits-before)
		}
	})

	t.Run("expand scope archives the plan and resumes TASKS", func(t *testing.T) {
		service, taskStore := fileScopeService(t, now, fileScopeTask(t, now, []string{"src/**"}))
		_, err := service.PrepareFileChange(context.Background(), PrepareFileChangeRequest{Host: domain.HostCodex, RepositoryPath: "/repo", ToolName: "apply_patch", Paths: []string{"/repo/config/security.yml"}, IntentDigest: testDigest('1'), PathParseComplete: true})
		if err != nil {
			t.Fatal(err)
		}
		result, err := service.ResolveBlockerAction(context.Background(), RecoverActionRequest{Host: domain.HostCodex, TaskID: taskStore.task.TaskID, ActionID: taskStore.task.CurrentAction.ActionID, FileScopeDecision: &domain.FileScopeDecisionInput{Choice: domain.FileScopeExpandScope, Reason: "The file belongs in the current Task Plan."}}, "resolve-expand")
		if err != nil || result.Task.CurrentNode != domain.NodeTasks || result.Task.TaskPlan != nil || len(result.Task.BaselineHistory) != 1 || result.Task.FileScopeRecords[0].Applicability != domain.FileScopeTaskPlanUpdate {
			t.Fatalf("result=%#v err=%v", result, err)
		}
	})
}

func TestPrepareFileChangeUsesAllDeclaredRepositories(t *testing.T) {
	now := time.Date(2026, 9, 1, 2, 0, 0, 0, time.UTC)
	primary := fileScopeBinding(now, "/core", 'a')
	docs := fileScopeBinding(now, "/docs", 'b')
	task := fileScopeTaskWithBinding(t, now, primary, []string{"src/**"})
	task.PrimaryRepositoryKey = "core"
	task.AdditionalRepositories = []domain.RepositoryScopeEntry{{Key: "docs", Binding: docs}}
	task.TaskPlan.WorkItems[0].ExpectedPaths = []string{"docs::src/**"}
	effective, err := task.EffectiveRepositoryBindingDigest()
	if err != nil {
		t.Fatal(err)
	}
	action, err := workflow.BuildProcessAction(workflow.StandardProcess(), domain.NodeImplement, task.TaskID, task.Revision, effective, task.Intent.MethodProfile, "action-implement", now)
	if err != nil {
		t.Fatal(err)
	}
	task.CurrentAction = &action
	if task.Validate() != nil {
		t.Fatal("multi-repository task invalid")
	}
	taskStore := &multiRepositoryStore{task: &task}
	observer := &multiRepositoryObserver{bindings: map[string]domain.RepositoryBinding{"/core": primary, "/docs": docs}}
	service, err := newService(taskStore, observer, func() time.Time { return now }, sequentialTestIDs())
	if err != nil {
		t.Fatal(err)
	}
	result, err := service.PrepareFileChange(context.Background(), PrepareFileChangeRequest{Host: domain.HostCodex, RepositoryPath: "/core", ToolName: "apply_patch", Paths: []string{"/docs/src/guide.go"}, IntentDigest: testDigest('2'), PathParseComplete: true})
	if err != nil || result.Decision != FileChangeAllow || taskStore.commits != 0 || len(result.Paths) != 1 || result.Paths[0] != "docs::src/guide.go" {
		t.Fatalf("result=%#v err=%v commits=%d", result, err, taskStore.commits)
	}
}

func TestImplementationAndDeliveryGuardsRequireExplainedPaths(t *testing.T) {
	now := time.Date(2026, 9, 1, 3, 0, 0, 0, time.UTC)
	task := fileScopeTask(t, now, []string{"src/**"})
	transition, err := workflow.TransitionFor(workflow.StandardProcess(), domain.NodeImplement, "implementation_ready_for_test")
	if err != nil {
		t.Fatal(err)
	}
	result := &workflow.ImplementationResult{ProblemClass: workflow.ProblemNone, TaskPlanRevision: 1, CompletedWorkItemIDs: []domain.ID{"work"}, ChangedPaths: []string{"config/security.yml"}}
	err = validateActionResultAgainstTask(task, transition, result)
	var typed *domain.Error
	if !errorsAs(err, &typed) || typed.Guard == nil || len(typed.Guard.Failures) != 1 || typed.Guard.Failures[0].Rule != domain.ViolationRule(domain.GuardChangedPathsExplained) {
		t.Fatalf("guard error=%#v", err)
	}
	record := domain.FileScopeRecord{RequestID: "scope-record", Paths: []string{"config/security.yml"}, IntentDigest: testDigest('3'), TaskPlanRevision: 1, SourceNode: domain.NodeImplement, SourceActionID: "source-action", Decision: domain.FileScopeAllowOnce, Reason: "Allowed for this implementation.", Applicability: domain.FileScopeExactWrite, AllowedActionID: &task.CurrentAction.ActionID, CreatedAt: now, DecidedAt: &now}
	task.FileScopeRecords = []domain.FileScopeRecord{record}
	if err := validateActionResultAgainstTask(task, transition, result); err != nil {
		t.Fatalf("authorized path rejected: %v", err)
	}
	recordTaskChangedPaths(&task, result.ChangedPaths, task.CurrentAction.ActionID)
	if !task.FileScopeRecords[0].Consumed || len(unexplainedTaskPaths(task, nil)) != 0 || task.Validate() != nil {
		t.Fatalf("consumption/task invalid: %#v", task.FileScopeRecords[0])
	}
}

func fileScopeService(t *testing.T, now time.Time, task domain.ProcessTask) (*Service, *memoryStore) {
	t.Helper()
	taskStore := &memoryStore{task: &task}
	service, err := newService(taskStore, observer{binding: task.Repository}, func() time.Time { return now.Add(time.Minute) }, sequentialTestIDs())
	if err != nil {
		t.Fatal(err)
	}
	return service, taskStore
}

func sequentialTestIDs() idGenerator {
	index := 0
	return func(prefix string) (domain.ID, error) {
		index++
		return domain.ID(fmt.Sprintf("%s-%d", prefix, index)), nil
	}
}

func fileScopeTask(t *testing.T, now time.Time, expected []string) domain.ProcessTask {
	t.Helper()
	return fileScopeTaskWithBinding(t, now, fileScopeBinding(now, "/repo", 'a'), expected)
}

func fileScopeTaskWithBinding(t *testing.T, now time.Time, binding domain.RepositoryBinding, expected []string) domain.ProcessTask {
	t.Helper()
	definition := workflow.StandardProcess()
	task := domain.ProcessTask{
		TaskID: "task-scope", OriginHost: domain.HostCodex,
		Intent:  domain.TaskIntent{Request: "Implement the bounded change.", VerificationBudget: domain.VerificationBudget{Level: domain.VerificationTargeted, MaxAutomaticCommands: 4}, MethodProfile: domain.MethodPlain},
		Process: definition.Reference, CurrentNode: domain.NodeImplement, Repository: binding,
		Requirements: &domain.RequirementsBaseline{Revision: 1, Digest: testDigest('4'), Goal: "Implement scope checks.", AcceptanceCriteria: []string{"Writes are scoped."}, CreatedAt: now},
		Design:       &domain.DesignBaseline{Revision: 1, Digest: testDigest('5'), RequirementsRevision: 1, Approach: "Use the existing process.", Decisions: []string{"Reuse BLOCKED."}, CreatedAt: now},
		TaskPlan:     &domain.TaskPlanBaseline{Revision: 1, Digest: testDigest('6'), DesignRevision: 1, WorkItems: []domain.WorkItem{{WorkItemID: "work", Summary: "Implement scope checks.", ExpectedPaths: expected, AcceptanceIndexes: []uint32{0}, VerificationSteps: []string{"Run focused tests."}}}, CreatedAt: now},
		Revision:     4, CreatedAt: now, UpdatedAt: now,
	}
	effective, err := task.EffectiveRepositoryBindingDigest()
	if err != nil {
		t.Fatal(err)
	}
	action, err := workflow.BuildProcessAction(definition, domain.NodeImplement, task.TaskID, task.Revision, effective, task.Intent.MethodProfile, "action-implement", now)
	if err != nil {
		t.Fatal(err)
	}
	task.CurrentAction = &action
	if task.Validate() != nil {
		t.Fatal("file-scope task invalid")
	}
	return task
}

func fileScopeBinding(now time.Time, root string, seed byte) domain.RepositoryBinding {
	digest := testDigest(seed)
	branch := "main"
	head := strings.Repeat(string(seed), 40)
	return domain.RepositoryBinding{CanonicalRoot: root, GitCommonDirDigest: digest, RepositoryIdentity: digest, Branch: &branch, Head: &head, WorktreeFingerprint: digest, ObservedAt: now, BindingDigest: digest}
}

func testDigest(seed byte) domain.Digest { return domain.Digest(strings.Repeat(string(seed), 64)) }

func errorsAs(err error, target **domain.Error) bool {
	if err == nil {
		return false
	}
	value, ok := err.(*domain.Error)
	if ok {
		*target = value
	}
	return ok
}
