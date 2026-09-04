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
	repositoryPath := testPath("repo")
	t.Run("planned exact and directory paths do not write Task state", func(t *testing.T) {
		service, taskStore := fileScopeService(t, now, fileScopeTask(t, now, []string{"src/exact.go", "tests/**"}))
		for index, path := range []string{testPath("repo", "src", "exact.go"), testPath("repo", "tests", "unit", "file_test.go")} {
			result, err := service.PrepareFileChange(context.Background(), PrepareFileChangeRequest{Host: domain.HostCodex, RepositoryPath: repositoryPath, ToolName: "apply_patch", Paths: []string{path}, IntentDigest: testDigest(byte('b' + index)), PathParseComplete: true})
			if err != nil || result.Decision != FileChangeAllow || taskStore.commits != 0 {
				t.Fatalf("path=%s result=%#v err=%v commits=%d", path, result, err, taskStore.commits)
			}
		}
	})

	t.Run("outside path blocks before write and allow_once matches only the prepared intent", func(t *testing.T) {
		service, taskStore := fileScopeService(t, now, fileScopeTask(t, now, []string{"src/**"}))
		intent := testDigest('c')
		blocked, err := service.PrepareFileChange(context.Background(), PrepareFileChangeRequest{Host: domain.HostCodex, RepositoryPath: repositoryPath, ToolName: "apply_patch", Paths: []string{testPath("repo", "config", "security.yml")}, IntentDigest: intent, PathParseComplete: true})
		if err != nil || blocked.Decision != FileChangeDeny || blocked.ScopeRequestID == "" || taskStore.task.CurrentNode != domain.NodeBlocked || len(taskStore.task.FileScopeRecords) != 1 {
			t.Fatalf("blocked=%#v err=%v task=%#v", blocked, err, taskStore.task)
		}
		resolved, err := service.ResolveBlockerAction(context.Background(), RecoverActionRequest{Host: domain.HostCodex, TaskID: taskStore.task.TaskID, ActionID: taskStore.task.CurrentAction.ActionID, FileScopeDecision: &domain.FileScopeDecisionInput{Choice: domain.FileScopeAllowOnce, Reason: "This configuration controls the requested behavior."}}, "resolve-scope")
		if err != nil || resolved.Task.CurrentNode != domain.NodeImplement || resolved.Task.FileScopeRecords[0].AllowedActionID == nil || resolved.Task.FileScopeRecords[0].Consumed {
			t.Fatalf("resolved=%#v err=%v", resolved, err)
		}
		allowed, err := service.PrepareFileChange(context.Background(), PrepareFileChangeRequest{Host: domain.HostCodex, RepositoryPath: repositoryPath, ToolName: "apply_patch", Paths: []string{testPath("repo", "config", "security.yml")}, IntentDigest: intent, PathParseComplete: true})
		if err != nil || allowed.Decision != FileChangeAllow {
			t.Fatalf("allowed=%#v err=%v", allowed, err)
		}
		second, err := service.PrepareFileChange(context.Background(), PrepareFileChangeRequest{Host: domain.HostCodex, RepositoryPath: repositoryPath, ToolName: "apply_patch", Paths: []string{testPath("repo", "config", "security.yml")}, IntentDigest: testDigest('d'), PathParseComplete: true})
		if err != nil || second.Decision != FileChangeDeny || taskStore.task.CurrentNode != domain.NodeBlocked || len(taskStore.task.FileScopeRecords) != 2 {
			t.Fatalf("second=%#v err=%v records=%#v", second, err, taskStore.task.FileScopeRecords)
		}
	})

	t.Run("reject stays effective for the current Task Plan revision", func(t *testing.T) {
		service, taskStore := fileScopeService(t, now, fileScopeTask(t, now, []string{"src/**"}))
		intent := testDigest('e')
		_, err := service.PrepareFileChange(context.Background(), PrepareFileChangeRequest{Host: domain.HostCodex, RepositoryPath: repositoryPath, ToolName: "apply_patch", Paths: []string{testPath("repo", "config", "security.yml")}, IntentDigest: intent, PathParseComplete: true})
		if err != nil {
			t.Fatal(err)
		}
		_, err = service.ResolveBlockerAction(context.Background(), RecoverActionRequest{Host: domain.HostCodex, TaskID: taskStore.task.TaskID, ActionID: taskStore.task.CurrentAction.ActionID, FileScopeDecision: &domain.FileScopeDecisionInput{Choice: domain.FileScopeReject, Reason: "Keep the existing implementation boundary."}}, "resolve-reject")
		if err != nil {
			t.Fatal(err)
		}
		before := taskStore.commits
		denied, err := service.PrepareFileChange(context.Background(), PrepareFileChangeRequest{Host: domain.HostCodex, RepositoryPath: repositoryPath, ToolName: "apply_patch", Paths: []string{testPath("repo", "config", "security.yml")}, IntentDigest: testDigest('f'), PathParseComplete: true})
		if err != nil || denied.Decision != FileChangeDeny || taskStore.commits != before || taskStore.task.CurrentNode != domain.NodeImplement {
			t.Fatalf("denied=%#v err=%v commits=%d", denied, err, taskStore.commits-before)
		}
	})

	t.Run("expand scope archives the plan and resumes TASKS", func(t *testing.T) {
		service, taskStore := fileScopeService(t, now, fileScopeTask(t, now, []string{"src/**"}))
		_, err := service.PrepareFileChange(context.Background(), PrepareFileChangeRequest{Host: domain.HostCodex, RepositoryPath: repositoryPath, ToolName: "apply_patch", Paths: []string{testPath("repo", "config", "security.yml")}, IntentDigest: testDigest('1'), PathParseComplete: true})
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
	corePath := testPath("core")
	docsPath := testPath("docs")
	primary := fileScopeBinding(now, corePath, 'a')
	docs := fileScopeBinding(now, docsPath, 'b')
	task := fileScopeTaskWithBinding(t, now, primary, []string{"src/**"})
	task.WorkspaceOrigin = fileScopeOrigin(corePath, 'a')
	task.PrimaryRepositoryKey = "core"
	task.AdditionalRepositories = []domain.RepositoryScopeEntry{{Key: "docs", Origin: fileScopeOrigin(docsPath, 'b'), Binding: docs}}
	task.TaskPlan.WorkItems[0].ExpectedPaths = []string{"docs::src/**"}
	workspace, err := task.EffectiveWorkspaceDigests()
	if err != nil {
		t.Fatal(err)
	}
	action, err := workflow.BuildProcessActionForWorkspace(workflow.StandardProcess(), domain.NodeImplement, task.TaskID, task.Revision, workspace, task.Intent.MethodProfile, "action-implement", now)
	if err != nil {
		t.Fatal(err)
	}
	task.CurrentAction = &action
	if task.Validate() != nil {
		t.Fatal("multi-repository task invalid")
	}
	taskStore := &multiRepositoryStore{task: &task}
	observer := &multiRepositoryObserver{bindings: map[string]domain.RepositoryBinding{corePath: primary, docsPath: docs}}
	service, err := newService(taskStore, observer, func() time.Time { return now }, sequentialTestIDs())
	if err != nil {
		t.Fatal(err)
	}
	result, err := service.PrepareFileChange(context.Background(), PrepareFileChangeRequest{Host: domain.HostCodex, RepositoryPath: corePath, ToolName: "apply_patch", Paths: []string{testPath("docs", "src", "guide.go")}, IntentDigest: testDigest('2'), PathParseComplete: true})
	if err != nil || result.Decision != FileChangeAllow || taskStore.commits != 0 || len(result.Paths) != 1 || result.Paths[0] != "docs::src/guide.go" {
		t.Fatalf("result=%#v err=%v commits=%d", result, err, taskStore.commits)
	}
}

func fileScopeService(t *testing.T, now time.Time, task domain.ProcessTask) (*Service, *memoryStore) {
	t.Helper()
	taskStore := &memoryStore{task: &task}
	service, err := newService(taskStore, observer{origin: task.WorkspaceOrigin, binding: task.Repository}, func() time.Time { return now.Add(time.Minute) }, sequentialTestIDs())
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
	return fileScopeTaskWithBinding(t, now, fileScopeBinding(now, testPath("repo"), 'a'), expected)
}

func fileScopeTaskWithBinding(t *testing.T, now time.Time, binding domain.RepositoryBinding, expected []string) domain.ProcessTask {
	t.Helper()
	definition := workflow.StandardProcess()
	task := domain.ProcessTask{
		TaskID: "task-scope", OriginHost: domain.HostCodex,
		Intent:  domain.TaskIntent{Request: "Implement the bounded change.", MethodProfile: domain.MethodPlain},
		Process: definition.Reference, CurrentNode: domain.NodeImplement, WorkspaceOrigin: fileScopeOrigin(testPath("repo"), 'a'), Repository: binding,
		Requirements: &domain.RequirementsBaseline{Revision: 1, Digest: testDigest('4'), Goal: "Implement scope checks.", AcceptanceCriteria: []string{"Writes are scoped."}, CreatedAt: now},
		Design:       &domain.DesignBaseline{Revision: 1, Digest: testDigest('5'), RequirementsRevision: 1, Approach: "Use the existing process.", Decisions: []string{"Reuse BLOCKED."}, CreatedAt: now},
		TaskPlan:     &domain.TaskPlanBaseline{Revision: 1, Digest: testDigest('6'), DesignRevision: 1, WorkItems: []domain.WorkItem{{WorkItemID: "work", Summary: "Implement scope checks.", ExpectedPaths: expected, AcceptanceIndexes: []uint32{0}, VerificationSteps: []string{"Run focused tests."}}}, VerificationPlan: domain.VerificationPlan{Checks: []domain.VerificationPlanCheck{{Name: "focused-test", Rationale: "The check covers the scoped write."}}, InitialBudget: domain.VerificationBudget{Level: domain.VerificationTargeted, MaxAutomaticCommands: 4}}, CreatedAt: now},
		Revision:     4, CreatedAt: now, UpdatedAt: now,
	}
	workspace, err := task.EffectiveWorkspaceDigests()
	if err != nil {
		t.Fatal(err)
	}
	action, err := workflow.BuildProcessActionForWorkspace(definition, domain.NodeImplement, task.TaskID, task.Revision, workspace, task.Intent.MethodProfile, "action-implement", now)
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
	branch := "feature/task"
	head := strings.Repeat(string(seed), 40)
	return domain.RepositoryBinding{WorktreeInstanceDigest: digest, IdentityDigest: digest, HistoryDigest: digest, ContentDigest: digest, CurrentBranch: &branch, CurrentHead: head, HeadTree: head, HistoryRelation: domain.RepositoryHistoryExact, BaseCommitAncestor: true, ObservedAt: now, BindingDigest: digest}
}

func fileScopeOrigin(root string, seed byte) domain.WorkspaceOrigin {
	digest := testDigest(seed)
	return domain.WorkspaceOrigin{Mode: domain.WorkspaceModeDedicatedWorktree, RemoteName: "origin", BaseBranch: "main", BaseCommit: strings.Repeat(string(seed), 40), TaskBranch: "feature/task", SourceRepositoryGroupDigest: digest, CanonicalWorktreeRoot: root, WorktreeGitDirDigest: digest, ProvisioningReceiptID: domain.ID("receipt-" + string(seed))}
}

func testDigest(seed byte) domain.Digest { return domain.Digest(strings.Repeat(string(seed), 64)) }
