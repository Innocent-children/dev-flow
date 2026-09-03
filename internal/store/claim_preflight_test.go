package store

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/Innocent-children/dev-flow/internal/domain"
	"github.com/Innocent-children/dev-flow/internal/workflow"
)

func TestClaimPreflightAcceptsActiveAndTerminalCardinality(t *testing.T) {
	for _, terminal := range []bool{false, true} {
		t.Run(map[bool]string{false: "active", true: "terminal"}[terminal], func(t *testing.T) {
			path, _ := claimPreflightDatabase(t, terminal)
			opened, err := Open(context.Background(), path)
			if err != nil {
				t.Fatal(err)
			}
			opened.Close()
		})
	}
}

func TestClaimPreflightRejectsCorruptionWithZeroWriteManifest(t *testing.T) {
	tests := []struct {
		name     string
		terminal bool
		corrupt  func(*testing.T, string, domain.ProcessTask)
	}{
		{"active missing claim", false, func(t *testing.T, path string, _ domain.ProcessTask) {
			execClaimCorruption(t, path, `DELETE FROM repository_claims`)
		}},
		{"active repository mismatch", false, func(t *testing.T, path string, task domain.ProcessTask) {
			db := openRaw(t, path)
			defer db.Close()
			if _, err := db.Exec(`UPDATE repository_claims SET worktree_instance_digest='ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff' WHERE worktree_instance_digest=?`, task.AdditionalRepositories[0].Binding.WorktreeInstanceDigest); err != nil {
				t.Fatal(err)
			}
		}},
		{"active host mismatch", false, func(t *testing.T, path string, _ domain.ProcessTask) {
			execClaimCorruption(t, path, `UPDATE repository_claims SET origin_host='deepseek'`)
		}},
		{"orphan claim", false, func(t *testing.T, path string, _ domain.ProcessTask) {
			execClaimCorruption(t, path, `PRAGMA foreign_keys=OFF; DELETE FROM tasks`)
		}},
		{"active extra claim", false, func(t *testing.T, path string, task domain.ProcessTask) {
			db := openRaw(t, path)
			defer db.Close()
			if _, err := db.Exec(`INSERT INTO repository_claims(worktree_instance_digest,canonical_worktree_root,task_id,origin_host,claimed_at) VALUES(?,?,?,?,?)`, domain.Digest(strings.Repeat("f", 64)), testPath("extra"), task.TaskID, task.OriginHost, formatTime(task.UpdatedAt)); err != nil {
				t.Fatal(err)
			}
		}},
		{"terminal retains claim", true, func(t *testing.T, path string, task domain.ProcessTask) {
			db := openRaw(t, path)
			defer db.Close()
			_, err := db.Exec(`INSERT INTO repository_claims(worktree_instance_digest,canonical_worktree_root,task_id,origin_host,claimed_at) VALUES(?,?,?,?,?)`, task.Repository.WorktreeInstanceDigest, task.WorkspaceOrigin.CanonicalWorktreeRoot, task.TaskID, task.OriginHost, formatTime(task.UpdatedAt))
			if err != nil {
				t.Fatal(err)
			}
		}},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			path, task := claimPreflightDatabase(t, tc.terminal)
			tc.corrupt(t, path, task)
			before := databaseManifest(t, path)
			opened, err := Open(context.Background(), path)
			if opened != nil {
				opened.Close()
			}
			if !errors.Is(err, ErrStorageUnavailable) {
				t.Fatalf("error=%v", err)
			}
			assertDatabaseManifestUnchanged(t, path, before)
		})
	}
}

func TestMultiRepositoryClaimAcquireLoadRetainAndRelease(t *testing.T) {
	path, task := claimPreflightDatabase(t, false)
	opened, err := Open(context.Background(), path)
	if err != nil {
		t.Fatal(err)
	}
	loaded, err := opened.LoadActiveTask(context.Background(), task.AdditionalRepositories[0].Binding.WorktreeInstanceDigest)
	if err != nil || loaded.TaskID != task.TaskID || loaded.Revision != task.Revision {
		t.Fatalf("load from additional repository = %+v, %v", loaded, err)
	}
	retained := retainMutation(t, task)
	if err := opened.CommitTask(context.Background(), retained); err != nil {
		t.Fatal(err)
	}
	terminal := terminalMutation(t, retained.Task)
	if err := opened.CommitTask(context.Background(), terminal); err != nil {
		t.Fatal(err)
	}
	var claims int
	if err := opened.db.QueryRow(`SELECT COUNT(*) FROM repository_claims WHERE task_id=?`, task.TaskID).Scan(&claims); err != nil || claims != 0 {
		t.Fatalf("claims=%d err=%v", claims, err)
	}
	opened.Close()
}

func TestMultiRepositoryClaimConflictRollsBackTaskEventAndPartialClaims(t *testing.T) {
	path := dbPath(t)
	opened, err := Open(context.Background(), path)
	if err != nil {
		t.Fatal(err)
	}
	candidate := multiRepositoryGraphTask(t)
	existing := singleRepositoryTaskForBinding(t, "existing-task", candidate.AdditionalRepositories[0])
	if err := opened.CommitTask(context.Background(), openMutation(t, existing, "existing")); err != nil {
		t.Fatal(err)
	}
	if err := opened.CommitTask(context.Background(), openMutation(t, candidate, "candidate")); !errors.Is(err, ErrActiveTaskConflict) {
		t.Fatalf("error=%v", err)
	}
	for _, table := range []string{"tasks", "task_events", "repository_claims"} {
		var count int
		if err := opened.db.QueryRow(`SELECT COUNT(*) FROM `+table+` WHERE task_id=?`, candidate.TaskID).Scan(&count); err != nil || count != 0 {
			t.Fatalf("%s residual=%d err=%v", table, count, err)
		}
	}
	opened.Close()
}

func openMutation(t *testing.T, task domain.ProcessTask, prefix string) TaskMutation {
	t.Helper()
	mutation := testMutation(t, task)
	requestID := domain.ID(prefix + "-request")
	mutation.Event.EventID = domain.ID(prefix + "-event")
	mutation.Event.RequestID = requestID
	mutation.Task.LastOperation.OperationID = requestID
	return mutation
}

func TestMultiRepositoryClaimRetainRejectsMissingExtraAndHostMismatch(t *testing.T) {
	for _, test := range []struct {
		name    string
		corrupt func(*testing.T, *SQLite, domain.ProcessTask)
	}{
		{"missing", func(t *testing.T, opened *SQLite, task domain.ProcessTask) {
			_, err := opened.db.Exec(`DELETE FROM repository_claims WHERE worktree_instance_digest=?`, task.AdditionalRepositories[0].Binding.WorktreeInstanceDigest)
			if err != nil {
				t.Fatal(err)
			}
		}},
		{"extra", func(t *testing.T, opened *SQLite, task domain.ProcessTask) {
			_, err := opened.db.Exec(`INSERT INTO repository_claims(worktree_instance_digest,canonical_worktree_root,task_id,origin_host,claimed_at) VALUES(?,?,?,?,?)`, domain.Digest(strings.Repeat("f", 64)), testPath("extra"), task.TaskID, task.OriginHost, formatTime(task.UpdatedAt))
			if err != nil {
				t.Fatal(err)
			}
		}},
		{"host mismatch", func(t *testing.T, opened *SQLite, task domain.ProcessTask) {
			_, err := opened.db.Exec(`UPDATE repository_claims SET origin_host=? WHERE worktree_instance_digest=?`, domain.HostDeepSeek, task.AdditionalRepositories[0].Binding.WorktreeInstanceDigest)
			if err != nil {
				t.Fatal(err)
			}
		}},
	} {
		t.Run(test.name, func(t *testing.T) {
			path := dbPath(t)
			opened, err := Open(context.Background(), path)
			if err != nil {
				t.Fatal(err)
			}
			task := multiRepositoryGraphTask(t)
			mutation := testMutation(t, task)
			if err := opened.CommitTask(context.Background(), mutation); err != nil {
				t.Fatal(err)
			}
			test.corrupt(t, opened, mutation.Task)
			if err := opened.CommitTask(context.Background(), retainMutation(t, mutation.Task)); !errors.Is(err, ErrStorageUnavailable) {
				t.Fatalf("error=%v", err)
			}
			loaded, err := opened.LoadTask(context.Background(), task.TaskID)
			if err != nil || loaded.Revision != 1 {
				t.Fatalf("task changed after retain safe-stop: revision=%d err=%v", loaded.Revision, err)
			}
			opened.Close()
		})
	}
}

func claimPreflightDatabase(t *testing.T, terminal bool) (string, domain.ProcessTask) {
	t.Helper()
	path := dbPath(t)
	opened, err := Open(context.Background(), path)
	if err != nil {
		t.Fatal(err)
	}
	task := multiRepositoryGraphTask(t)
	mutation := testMutation(t, task)
	if err := opened.CommitTask(context.Background(), mutation); err != nil {
		t.Fatal(err)
	}
	task = mutation.Task
	if terminal {
		now := task.UpdatedAt.Add(time.Second)
		task.CurrentNode = domain.NodeCancelled
		task.CurrentAction = nil
		task.Revision++
		task.UpdatedAt = now
		task.CompletedAt = &now
		effectiveDigest, err := task.EffectiveRepositoryBindingDigest()
		if err != nil {
			t.Fatal(err)
		}
		task.Outcome = &domain.ProcessOutcome{Status: domain.TerminalCancelled, Summary: "Task cancelled.", FinalRepositoryDigest: effectiveDigest, CompletedAt: now}
		payload := domain.Digest(strings.Repeat("d", 64))
		task.LastOperation = &domain.LastOperation{OperationID: "cancel-request", Kind: domain.OperationCancelTask, FromRevision: 1, ToRevision: 2, PayloadDigest: payload, CommittedAt: now}
		event := TaskEvent{EventID: "cancel-event", TaskID: task.TaskID, Revision: 2, Kind: domain.OperationCancelTask, SourceNode: domain.NodeRequirements, DestinationNode: domain.NodeCancelled, RequestID: "cancel-request", PayloadDigest: payload, CreatedAt: now}
		if err := opened.CommitTask(context.Background(), TaskMutation{ExpectedRevision: 1, Task: task, Event: event, Claim: ClaimRelease}); err != nil {
			t.Fatal(err)
		}
	}
	if err := opened.Close(); err != nil {
		t.Fatal(err)
	}
	return path, task
}

func multiRepositoryGraphTask(t *testing.T) domain.ProcessTask {
	t.Helper()
	task := testGraphTask(t)
	additional := task.Repository.Clone()
	additional.WorktreeInstanceDigest = domain.Digest(strings.Repeat("d", 64))
	additional.IdentityDigest = domain.Digest(strings.Repeat("e", 64))
	additional.HistoryDigest = domain.Digest(strings.Repeat("f", 64))
	additional.ContentDigest = domain.Digest(strings.Repeat("1", 64))
	additional.BindingDigest = domain.Digest(strings.Repeat("1", 64))
	origin := task.WorkspaceOrigin
	origin.CanonicalWorktreeRoot = testPath("docs")
	origin.SourceRepositoryGroupDigest = domain.Digest(strings.Repeat("d", 64))
	origin.WorktreeGitDirDigest = domain.Digest(strings.Repeat("e", 64))
	origin.ProvisioningReceiptID = "receipt-docs"
	task.PrimaryRepositoryKey = "core"
	task.AdditionalRepositories = []domain.RepositoryScopeEntry{{Key: "docs", Origin: origin, Binding: additional}}
	workspace, err := task.EffectiveWorkspaceDigests()
	if err != nil {
		t.Fatal(err)
	}
	task.CurrentAction.RepositoryBindingDigest = workspace.Binding
	task.CurrentAction.IssuanceIdentityDigest = workspace.Identity
	task.CurrentAction.IssuanceHistoryDigest = workspace.History
	task.CurrentAction.IssuanceContentDigest = workspace.Content
	if err := workflow.ValidateProcessTask(task); err != nil {
		t.Fatal(err)
	}
	return task
}

func singleRepositoryTaskForBinding(t *testing.T, taskID domain.ID, entry domain.RepositoryScopeEntry) domain.ProcessTask {
	t.Helper()
	task := testGraphTask(t)
	task.TaskID = taskID
	task.WorkspaceOrigin, task.Repository = entry.Origin, entry.Binding
	workspace, _ := task.EffectiveWorkspaceDigests()
	action, err := workflow.BuildProcessActionForWorkspace(workflow.StandardProcess(), task.CurrentNode, task.TaskID, task.Revision, workspace, task.Intent.MethodProfile, domain.ID(string(taskID)+"-action"), task.CreatedAt)
	if err != nil {
		t.Fatal(err)
	}
	task.CurrentAction = &action
	return task
}

func retainMutation(t *testing.T, task domain.ProcessTask) TaskMutation {
	t.Helper()
	now := task.UpdatedAt.Add(time.Second)
	resume := task.CurrentNode
	originalAction := task.CurrentAction.ActionID
	task.CurrentNode = domain.NodeBlocked
	task.ResumeNode = &resume
	task.Revision++
	task.UpdatedAt = now
	workspace, err := task.EffectiveWorkspaceDigests()
	if err != nil {
		t.Fatal(err)
	}
	task.Blocker = &domain.ProcessBlocker{BlockerID: "blocker", Code: domain.ErrorTaskBlocked, Cause: domain.BlockerCauseRecoveryPartiallyCompleted, Message: "Restore the issuance binding before continuing.", ResumeNode: resume, ObservedBindingDigest: domain.Digest(strings.Repeat("2", 64)), Condition: domain.BlockerCondition{Kind: domain.BlockerConditionRestoreIssuanceBinding, ExpectedBindingDigest: workspace.Binding, ExpectedIdentityDigest: workspace.Identity, ExpectedHistoryDigest: workspace.History, ExpectedContentDigest: workspace.Content}, RequiredResolution: "Restore the exact issuance binding.", CreatedAt: now}
	action, err := workflow.BuildProcessActionForWorkspace(workflow.StandardProcess(), domain.NodeBlocked, task.TaskID, task.Revision, workspace, task.Intent.MethodProfile, "resolve-action", now)
	if err != nil {
		t.Fatal(err)
	}
	task.CurrentAction = &action
	payload := domain.Digest(strings.Repeat("3", 64))
	task.LastOperation = &domain.LastOperation{OperationID: "retain-operation", Kind: domain.OperationApplyAction, ActionID: &originalAction, FromRevision: task.Revision - 1, ToRevision: task.Revision, PayloadDigest: payload, CommittedAt: now}
	event := TaskEvent{EventID: "retain-event", TaskID: task.TaskID, Revision: task.Revision, Kind: domain.OperationApplyAction, SourceNode: resume, DestinationNode: domain.NodeBlocked, TransitionReason: "Recovery blocker created.", ActionID: &originalAction, RequestID: "retain-operation", PayloadDigest: payload, CreatedAt: now}
	return TaskMutation{ExpectedRevision: task.Revision - 1, Task: task, Event: event, Claim: ClaimRetain}
}

func terminalMutation(t *testing.T, task domain.ProcessTask) TaskMutation {
	t.Helper()
	now := task.UpdatedAt.Add(time.Second)
	source := task.CurrentNode
	task.CurrentNode = domain.NodeCancelled
	task.CurrentAction = nil
	task.Blocker = nil
	task.ResumeNode = nil
	task.Revision++
	task.UpdatedAt = now
	task.CompletedAt = &now
	digest, err := task.EffectiveRepositoryBindingDigest()
	if err != nil {
		t.Fatal(err)
	}
	task.Outcome = &domain.ProcessOutcome{Status: domain.TerminalCancelled, Summary: "Task cancelled.", FinalRepositoryDigest: digest, CompletedAt: now}
	payload := domain.Digest(strings.Repeat("4", 64))
	task.LastOperation = &domain.LastOperation{OperationID: "release-operation", Kind: domain.OperationCancelTask, FromRevision: task.Revision - 1, ToRevision: task.Revision, PayloadDigest: payload, CommittedAt: now}
	event := TaskEvent{EventID: "release-event", TaskID: task.TaskID, Revision: task.Revision, Kind: domain.OperationCancelTask, SourceNode: source, DestinationNode: domain.NodeCancelled, RequestID: "release-operation", PayloadDigest: payload, CreatedAt: now}
	return TaskMutation{ExpectedRevision: task.Revision - 1, Task: task, Event: event, Claim: ClaimRelease}
}

func execClaimCorruption(t *testing.T, path, statement string) {
	t.Helper()
	db := openRaw(t, path)
	defer db.Close()
	if _, err := db.Exec(statement); err != nil {
		t.Fatal(err)
	}
}
