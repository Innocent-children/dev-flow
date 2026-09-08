package application

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"path/filepath"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/Innocent-children/dev-flow/internal/domain"
	"github.com/Innocent-children/dev-flow/internal/recovery"
	"github.com/Innocent-children/dev-flow/internal/store"
	"github.com/Innocent-children/dev-flow/internal/workflow"
)

func TestControlCenterLifecycleCP2(t *testing.T) {
	ctx := context.Background()
	database, err := store.Open(ctx, filepath.Join(t.TempDir(), "control-center.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer database.Close()
	now := time.Date(2026, 8, 26, 12, 0, 0, 0, time.UTC)
	digest := domain.Digest(strings.Repeat("a", 64))
	branch, head := "feature/task", strings.Repeat("b", 40)
	repositoryPath := testPath("repo")
	binding := domain.RepositoryBinding{WorktreeInstanceDigest: digest, IdentityDigest: digest, HistoryDigest: digest, ContentDigest: digest, CurrentBranch: &branch, CurrentHead: head, HeadTree: head, HistoryRelation: domain.RepositoryHistoryExact, BaseCommitAncestor: true, ObservedAt: now, BindingDigest: digest}
	origin := domain.WorkspaceOrigin{Mode: domain.WorkspaceModeDedicatedWorktree, SourceType: "remote", RemoteName: "origin", BaseBranch: "main", BaseCommit: head, TaskBranch: branch, SourceRepositoryGroupDigest: digest, CanonicalWorktreeRoot: repositoryPath, WorktreeGitDirDigest: digest, ProvisioningReceiptID: "receipt"}
	originInput := WorkspaceOriginInput{Mode: origin.Mode, SourceType: origin.SourceType, CarryChanges: origin.CarryChanges, RemoteName: origin.RemoteName, BaseBranch: origin.BaseBranch, BaseCommit: origin.BaseCommit, TaskBranch: origin.TaskBranch, ProvisioningReceiptID: origin.ProvisioningReceiptID}
	var sequence atomic.Int64
	core, err := newService(database, &mutableObserver{binding: binding, origin: origin}, func() time.Time { return now }, func(prefix string) (domain.ID, error) {
		return domain.ID(fmt.Sprintf("%s-%d", prefix, sequence.Add(1))), nil
	})
	if err != nil {
		t.Fatal(err)
	}
	center := &ControlCenter{core: core, tasks: database}
	request := OpenTaskRequest{RequestID: "open-request", Host: domain.HostCodex, RepositoryPath: repositoryPath, WorkspaceOrigin: &originInput, PrimaryRepositoryKey: domain.DefaultPrimaryRepositoryKey, NewTask: &NewTaskInput{Request: "Manage the task lifecycle.", KnownAcceptanceCriteria: []string{"Lifecycle operations are authoritative."}, MethodProfile: domain.MethodPlain}}
	opened, err := center.OpenOrResumeTask(ctx, request)
	if err != nil || opened.Task == nil || opened.Task.Revision != 1 {
		t.Fatalf("open=%#v err=%v", opened, err)
	}
	resumed, err := center.OpenOrResumeTask(ctx, OpenTaskRequest{RequestID: "resume-request", Host: domain.HostCodex, RepositoryPath: repositoryPath})
	if err != nil || resumed.Task == nil || resumed.Task.TaskID != opened.Task.TaskID || resumed.Task.Revision != 1 {
		t.Fatalf("resume=%#v err=%v", resumed, err)
	}

	results := make(chan error, 2)
	start := make(chan struct{})
	var wait sync.WaitGroup
	for index := 0; index < 2; index++ {
		index := index
		wait.Add(1)
		go func() {
			defer wait.Done()
			<-start
			_, cancelErr := center.CancelLifecycleTask(ctx, CancelControlCenterTaskRequest{RequestID: domain.ID(fmt.Sprintf("cancel-request-%d", index)), TaskID: opened.Task.TaskID, ExpectedRevision: 1, Reason: "Stop the active task.", Confirmed: true})
			results <- cancelErr
		}()
	}
	close(start)
	wait.Wait()
	close(results)
	committed, stale := 0, 0
	for result := range results {
		switch {
		case result == nil:
			committed++
		case errors.Is(result, domain.ErrRevisionConflict):
			stale++
		default:
			t.Fatalf("unexpected concurrent result: %v", result)
		}
	}
	if committed != 1 || stale != 1 {
		t.Fatalf("committed=%d stale=%d", committed, stale)
	}

	current, err := database.LoadTask(ctx, opened.Task.TaskID)
	if err != nil || current.CurrentNode != domain.NodeCancelled || current.Revision != 2 {
		t.Fatalf("cancelled=%#v err=%v", current, err)
	}
	archive, err := center.SetTaskArchive(ctx, SetTaskArchiveRequest{RequestID: "archive-request", TaskID: current.TaskID, ExpectedRevision: 2, Archived: true})
	if err != nil || archive.Archived == nil || !*archive.Archived {
		t.Fatalf("archive=%#v err=%v", archive, err)
	}
	repeated, err := center.SetTaskArchive(ctx, SetTaskArchiveRequest{RequestID: "archive-repeat", TaskID: current.TaskID, ExpectedRevision: 2, Archived: true})
	if err != nil || repeated.Archived == nil || !*repeated.Archived {
		t.Fatalf("repeated=%#v err=%v", repeated, err)
	}
	if _, err := center.SetTaskArchive(ctx, SetTaskArchiveRequest{RequestID: "restore-request", TaskID: current.TaskID, ExpectedRevision: 2}); err != nil {
		t.Fatal(err)
	}
	purged, err := center.PurgeLifecycleTask(ctx, PurgeControlCenterTaskRequest{RequestID: "purge-request", TaskID: current.TaskID, ExpectedRevision: 2, TypedTaskID: current.TaskID, Reason: "Remove the cancelled task.", Irreversible: true})
	if err != nil || !purged.Purged {
		t.Fatalf("purged=%#v err=%v", purged, err)
	}
	if _, err := database.LoadTask(ctx, current.TaskID); !errors.Is(err, store.ErrTaskNotFound) {
		t.Fatalf("purged task remains: %v", err)
	}
}

func TestControlCenterActionAndRecoveryCP3(t *testing.T) {
	ctx := context.Background()
	databasePath := filepath.Join(t.TempDir(), "control-center-action.db")
	database, err := store.Open(ctx, databasePath)
	if err != nil {
		t.Fatal(err)
	}
	defer database.Close()
	now := time.Date(2026, 8, 26, 14, 0, 0, 0, time.UTC)
	digest := domain.Digest(strings.Repeat("a", 64))
	branch, head := "feature/task", strings.Repeat("b", 40)
	repositoryPath := testPath("repo")
	binding := domain.RepositoryBinding{WorktreeInstanceDigest: digest, IdentityDigest: digest, HistoryDigest: digest, ContentDigest: digest, CurrentBranch: &branch, CurrentHead: head, HeadTree: head, HistoryRelation: domain.RepositoryHistoryExact, BaseCommitAncestor: true, ObservedAt: now, BindingDigest: digest}
	origin := domain.WorkspaceOrigin{Mode: domain.WorkspaceModeDedicatedWorktree, SourceType: "remote", RemoteName: "origin", BaseBranch: "main", BaseCommit: head, TaskBranch: branch, SourceRepositoryGroupDigest: digest, CanonicalWorktreeRoot: repositoryPath, WorktreeGitDirDigest: digest, ProvisioningReceiptID: "receipt"}
	originInput := WorkspaceOriginInput{Mode: origin.Mode, SourceType: origin.SourceType, CarryChanges: origin.CarryChanges, RemoteName: origin.RemoteName, BaseBranch: origin.BaseBranch, BaseCommit: origin.BaseCommit, TaskBranch: origin.TaskBranch, ProvisioningReceiptID: origin.ProvisioningReceiptID}
	var sequence atomic.Int64
	core, err := newService(database, &mutableObserver{binding: binding, origin: origin}, func() time.Time { return now }, func(prefix string) (domain.ID, error) {
		return domain.ID(fmt.Sprintf("%s-%d", prefix, sequence.Add(1))), nil
	})
	if err != nil {
		t.Fatal(err)
	}
	center := &ControlCenter{core: core, tasks: database}
	opened, err := center.OpenOrResumeTask(ctx, OpenTaskRequest{RequestID: "open-action", Host: domain.HostCodex, RepositoryPath: repositoryPath, WorkspaceOrigin: &originInput, PrimaryRepositoryKey: domain.DefaultPrimaryRepositoryKey, NewTask: &NewTaskInput{Request: "Execute the current action.", KnownAcceptanceCriteria: []string{"Core advances the task."}, MethodProfile: domain.MethodPlain}})
	if err != nil {
		t.Fatal(err)
	}

	requirementsPayload := webSubmissionPayload(t, *opened.Task, "requirements_ready", requirementsNodeResult("Action goal", []string{"Action works"}))
	action := opened.Task.CurrentAction
	first, err := center.SubmitCurrentAction(ctx, SubmitControlCenterActionRequest{RequestID: "submit-action", TaskID: opened.Task.TaskID, ExpectedRevision: opened.Task.Revision, ActionID: action.ActionID, Payload: requirementsPayload})
	if err != nil || !first.Committed || first.Task.CurrentNode != domain.NodeDesign {
		t.Fatalf("submit=%#v err=%v", first, err)
	}
	operation, found, err := database.LoadActionOperation(ctx, first.Task.TaskID)
	if err != nil || !found || !operation.RecordedBy(first.Task) {
		t.Fatalf("ordinary HTTP operation was not retained: %+v %v", operation, err)
	}

	failing := &controlCenterCommitFailureStore{SQLite: database, fail: true}
	center, err = NewControlCenter(failing, &mutableObserver{binding: binding, origin: origin})
	if err != nil {
		t.Fatal(err)
	}
	design := designNodeResult(1, "Direct design")
	delete(design["baseline"].(map[string]any), "requirements_revision")
	designPayload := webSubmissionPayload(t, first.Task, "design_ready", design)
	pendingID := first.Task.CurrentAction.ActionID
	_, err = center.SubmitCurrentAction(ctx, SubmitControlCenterActionRequest{RequestID: "uncertain-design", TaskID: first.Task.TaskID, ExpectedRevision: first.Task.Revision, ActionID: pendingID, Payload: designPayload})
	if !errors.Is(err, domain.ErrStorageUnavailable) {
		t.Fatalf("failure=%v", err)
	}
	if err := database.Close(); err != nil {
		t.Fatal(err)
	}
	database, err = store.Open(ctx, databasePath)
	if err != nil {
		t.Fatal(err)
	}
	defer database.Close()
	center, err = NewControlCenter(database, &mutableObserver{binding: binding, origin: origin})
	if err != nil {
		t.Fatal(err)
	}
	detail, err := center.GetTaskDetail(ctx, GetControlCenterTaskRequest{TaskID: first.Task.TaskID})
	if err != nil || detail.PendingActionID == nil || *detail.PendingActionID != pendingID || detail.Task.Revision != first.Task.Revision {
		t.Fatalf("pending after reopen=%+v err=%v", detail.PendingActionID, err)
	}
	assessed, err := center.AssessTaskOperation(ctx, AssessControlCenterRecoveryRequest{TaskID: first.Task.TaskID, ActionID: pendingID})
	if err != nil || assessed.Assessment == nil || assessed.Assessment.NextAdvice != recovery.AdviceSubmitRecoveryApply {
		t.Fatalf("assessment=%+v err=%v", assessed, err)
	}
	recovered, err := center.ApplyTaskRecovery(ctx, ApplyControlCenterRecoveryRequest{TaskID: first.Task.TaskID, ActionID: pendingID})
	if err != nil || recovered.Task.CurrentNode != domain.NodeTasks {
		t.Fatalf("recovery=%+v err=%v", recovered, err)
	}
	duplicate, err := center.ApplyTaskRecovery(ctx, ApplyControlCenterRecoveryRequest{TaskID: first.Task.TaskID, ActionID: pendingID})
	if err != nil || duplicate.Task.Revision != recovered.Task.Revision {
		t.Fatalf("duplicate=%+v err=%v", duplicate, err)
	}
	detail, err = center.GetTaskDetail(ctx, GetControlCenterTaskRequest{TaskID: first.Task.TaskID})
	if err != nil || detail.PendingActionID != nil || len(detail.Events) != 3 {
		t.Fatalf("detail after recovery=%+v err=%v", detail, err)
	}
	_, err = center.SubmitCurrentAction(ctx, SubmitControlCenterActionRequest{RequestID: "stale-submit", TaskID: first.Task.TaskID, ExpectedRevision: first.Task.Revision, ActionID: pendingID, Payload: designPayload})
	if !errors.Is(err, domain.ErrRevisionConflict) {
		t.Fatalf("stale page error=%v", err)
	}
}

type controlCenterCommitFailureStore struct {
	*store.SQLite
	fail bool
}

func (s *controlCenterCommitFailureStore) CommitActionOperation(ctx context.Context, id domain.ID, mutation store.TaskMutation) error {
	if s.fail {
		return store.ErrStorageUnavailable
	}
	return s.SQLite.CommitActionOperation(ctx, id, mutation)
}

func webSubmissionPayload(t *testing.T, task domain.ProcessTask, transition domain.TransitionID, result map[string]any) json.RawMessage {
	t.Helper()
	result["problem_class"] = "none"
	methods := map[domain.MethodStepID]MethodResultSubmission{}
	for _, step := range task.CurrentAction.SemanticMethodSteps {
		methods[step.StepID] = MethodResultSubmission{Summary: "Complete current work."}
	}
	artifacts := map[string]any{"other_process": []any{}}
	if _, allowed := workflow.PrimaryArtifactRoleForNode(task.CurrentNode); allowed {
		artifacts["current"] = []any{}
	}
	raw, err := json.Marshal(map[string]any{"transition_id": transition, "summary": "Current semantic work completed.", "reason": "", "artifacts": artifacts, "method_results": methods, "node_result": result})
	if err != nil {
		t.Fatal(err)
	}
	return raw
}

func TestControlCenterBlockerSubmissionRetainsCoreAssembledPayload(t *testing.T) {
	ctx := context.Background()
	database, err := store.Open(ctx, filepath.Join(t.TempDir(), "blocker.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer database.Close()
	_, _, observer := phase5Service(t)
	center, err := NewControlCenter(database, observer)
	if err != nil {
		t.Fatal(err)
	}
	task := phase5TaskAtRefactor(t, center.core)
	observer.binding = graphChangedBinding(task.Repository, []string{"internal/file.go"}, "c")
	blocked, err := center.core.ApplyAction(ctx, graphRecoveryApply(task, "partial-work", json.RawMessage("null")))
	if err != nil {
		t.Fatal(err)
	}
	observer.binding = task.Repository
	resolved, err := center.SubmitCurrentAction(ctx, SubmitControlCenterActionRequest{
		RequestID: "resolve-from-webui", TaskID: task.TaskID, ExpectedRevision: blocked.Task.Revision,
		ActionID: blocked.Task.CurrentAction.ActionID, Payload: json.RawMessage(`{}`),
	})
	if err != nil || resolved.Task.CurrentNode != domain.NodeRefactor || resolved.Task.Blocker != nil {
		t.Fatalf("resolution=%+v err=%v", resolved, err)
	}
	operation, found, err := database.LoadActionOperation(ctx, task.TaskID)
	if err != nil || !found || !operation.RecordedBy(resolved.Task) || operation.Commit.Operation.SourceCursor != domain.NodeBlocked {
		t.Fatalf("retained blocker operation=%+v err=%v", operation, err)
	}
}
