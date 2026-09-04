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
	origin := domain.WorkspaceOrigin{Mode: domain.WorkspaceModeDedicatedWorktree, RemoteName: "origin", BaseBranch: "main", BaseCommit: head, TaskBranch: branch, SourceRepositoryGroupDigest: digest, CanonicalWorktreeRoot: repositoryPath, WorktreeGitDirDigest: digest, ProvisioningReceiptID: "receipt"}
	originInput := WorkspaceOriginInput{Mode: origin.Mode, RemoteName: origin.RemoteName, BaseBranch: origin.BaseBranch, BaseCommit: origin.BaseCommit, TaskBranch: origin.TaskBranch, ProvisioningReceiptID: origin.ProvisioningReceiptID}
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
	database, err := store.Open(ctx, filepath.Join(t.TempDir(), "control-center-action.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer database.Close()
	now := time.Date(2026, 8, 26, 14, 0, 0, 0, time.UTC)
	digest := domain.Digest(strings.Repeat("a", 64))
	branch, head := "feature/task", strings.Repeat("b", 40)
	repositoryPath := testPath("repo")
	binding := domain.RepositoryBinding{WorktreeInstanceDigest: digest, IdentityDigest: digest, HistoryDigest: digest, ContentDigest: digest, CurrentBranch: &branch, CurrentHead: head, HeadTree: head, HistoryRelation: domain.RepositoryHistoryExact, BaseCommitAncestor: true, ObservedAt: now, BindingDigest: digest}
	origin := domain.WorkspaceOrigin{Mode: domain.WorkspaceModeDedicatedWorktree, RemoteName: "origin", BaseBranch: "main", BaseCommit: head, TaskBranch: branch, SourceRepositoryGroupDigest: digest, CanonicalWorktreeRoot: repositoryPath, WorktreeGitDirDigest: digest, ProvisioningReceiptID: "receipt"}
	originInput := WorkspaceOriginInput{Mode: origin.Mode, RemoteName: origin.RemoteName, BaseBranch: origin.BaseBranch, BaseCommit: origin.BaseCommit, TaskBranch: origin.TaskBranch, ProvisioningReceiptID: origin.ProvisioningReceiptID}
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
	requirementsPayload := phase5Payload(t, *opened.Task, "requirements_ready", "", requirementsNodeResult("Action goal", []string{"Action works"}))
	action := opened.Task.CurrentAction
	first, err := center.SubmitCurrentAction(ctx, SubmitControlCenterActionRequest{RequestID: "submit-action", TaskID: opened.Task.TaskID, ExpectedRevision: opened.Task.Revision, ActionID: action.ActionID, ActionKind: action.Kind, ProcessID: opened.Task.Process.ID, ProcessDefinitionDigest: opened.Task.Process.DefinitionDigest, SourceNode: opened.Task.CurrentNode, RepositoryBindingDigest: action.RepositoryBindingDigest, IssuanceIdentityDigest: action.IssuanceIdentityDigest, IssuanceHistoryDigest: action.IssuanceHistoryDigest, IssuanceContentDigest: action.IssuanceContentDigest, Payload: requirementsPayload})
	if err != nil || !first.Committed || first.Task.CurrentNode != domain.NodeDesign {
		t.Fatalf("submit=%#v err=%v", first, err)
	}

	designPayload := phase5Payload(t, first.Task, "design_ready", "", designNodeResult(1, "Direct design"))
	probe := graphProbe(first.Task, "uncertain-design", designPayload)
	assessed, err := center.AssessTaskOperation(ctx, AssessControlCenterRecoveryRequest{TaskID: first.Task.TaskID, Operation: probe})
	if err != nil || assessed.Assessment == nil || assessed.Assessment.NextAdvice != recovery.AdviceSubmitRecoveryApply || assessed.Committed {
		t.Fatalf("assessment=%#v err=%v", assessed, err)
	}
	recovered, err := center.ApplyTaskRecovery(ctx, ApplyControlCenterRecoveryRequest{TaskID: first.Task.TaskID, Operation: probe, RecoveryAction: recovery.AdviceSubmitRecoveryApply})
	if err != nil || !recovered.Committed || recovered.Task.CurrentNode != domain.NodeTasks {
		t.Fatalf("recovery=%#v err=%v", recovered, err)
	}
	if _, err := center.ApplyTaskRecovery(ctx, ApplyControlCenterRecoveryRequest{TaskID: first.Task.TaskID, Operation: probe, RecoveryAction: recovery.AdviceRetryCurrentAction}); !errors.Is(err, domain.ErrRecoveryUnavailable) {
		t.Fatalf("mismatched recovery advice err=%v", err)
	}
	var retained map[string]any
	if json.Unmarshal(probe.Payload, &retained) != nil || retained["transition_id"] != "design_ready" {
		t.Fatalf("retained payload changed: %s", probe.Payload)
	}
}
