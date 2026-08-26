package store

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/Innocent-children/dev-flow/internal/domain"
	"github.com/Innocent-children/dev-flow/internal/workflow"
)

func TestControlCenterReadsCP1(t *testing.T) {
	ctx := context.Background()
	opened, err := Open(ctx, dbPath(t))
	if err != nil {
		t.Fatal(err)
	}
	defer opened.Close()
	first := controlCenterTestTask(t, "task-a", domain.HostCodex, "alpha", "Build alpha dashboard", time.Date(2026, 8, 26, 8, 0, 0, 0, time.UTC))
	second := controlCenterTestTask(t, "task-b", domain.HostDeepSeek, "beta", "Inspect beta workflow", first.UpdatedAt.Add(time.Minute))
	third := controlCenterTestTask(t, "task-c", domain.HostCodex, "gamma", "Ship gamma", first.UpdatedAt.Add(2*time.Minute))
	for _, task := range []domain.ProcessTask{first, second, third} {
		if err := opened.CommitTask(ctx, controlCenterOpenMutation(task)); err != nil {
			t.Fatal(err)
		}
	}
	cancelled := cancelControlCenterTask(second)
	if err := opened.CommitTask(ctx, cancelled.mutation); err != nil {
		t.Fatal(err)
	}

	t.Run("deterministic bounded pages", func(t *testing.T) {
		page, err := opened.ListControlCenterTasks(ctx, TaskListQuery{Page: 1, PageSize: 2})
		if err != nil || len(page.Items) != 2 || !page.HasNext || page.Items[0].Task.TaskID != "task-c" || page.Items[1].Task.TaskID != "task-b" {
			t.Fatalf("page=%#v err=%v", page, err)
		}
		next, err := opened.ListControlCenterTasks(ctx, TaskListQuery{Page: 2, PageSize: 2})
		if err != nil || len(next.Items) != 1 || next.HasNext || next.Items[0].Task.TaskID != "task-a" {
			t.Fatalf("next=%#v err=%v", next, err)
		}
	})

	filters := []struct {
		name  string
		query TaskListQuery
		want  domain.ID
	}{
		{"text", TaskListQuery{Text: "beta", Page: 1, PageSize: 10}, "task-b"},
		{"host", TaskListQuery{Host: domain.HostDeepSeek, Page: 1, PageSize: 10}, "task-b"},
		{"repository", TaskListQuery{Repository: "/repo/alpha", Page: 1, PageSize: 10}, "task-a"},
		{"node", TaskListQuery{Node: domain.NodeCancelled, Page: 1, PageSize: 10}, "task-b"},
		{"lifecycle", TaskListQuery{Lifecycle: "cancelled", Page: 1, PageSize: 10}, "task-b"},
		{"updated time", TaskListQuery{UpdatedFrom: pointerTime(third.UpdatedAt), UpdatedTo: pointerTime(third.UpdatedAt), Page: 1, PageSize: 10}, "task-c"},
	}
	for _, test := range filters {
		t.Run(test.name+" filter", func(t *testing.T) {
			page, err := opened.ListControlCenterTasks(ctx, test.query)
			if err != nil || len(page.Items) != 1 || page.Items[0].Task.TaskID != test.want {
				t.Fatalf("page=%#v err=%v", page, err)
			}
		})
	}

	t.Run("one read returns current snapshot and ordered events", func(t *testing.T) {
		detail, err := opened.LoadControlCenterTask(ctx, "task-b")
		if err != nil || detail.Task.Revision != 2 || len(detail.Events) != 2 || detail.Events[0].Revision != 1 || detail.Events[1].Revision != 2 {
			t.Fatalf("detail=%#v err=%v", detail, err)
		}
		events, err := opened.LoadTaskEvents(ctx, "task-b")
		if err != nil || len(events) != 2 || events[1].DestinationNode != domain.NodeCancelled {
			t.Fatalf("events=%#v err=%v", events, err)
		}
	})
}

type cancelledFixture struct{ mutation TaskMutation }

func controlCenterTestTask(t *testing.T, id domain.ID, host domain.Host, key, request string, now time.Time) domain.ProcessTask {
	t.Helper()
	sum := sha256.Sum256([]byte(key))
	digest := domain.Digest(hex.EncodeToString(sum[:]))
	branch, head := "main", strings.Repeat("b", 40)
	definition := workflow.StandardProcess()
	action, err := workflow.BuildProcessAction(definition, domain.NodeRequirements, id, 1, digest, domain.MethodPlain, domain.ID("action-"+string(id)), now)
	if err != nil {
		t.Fatal(err)
	}
	return domain.ProcessTask{TaskID: id, OriginHost: host, Intent: domain.TaskIntent{Request: request, KnownAcceptanceCriteria: []string{"The task is visible."}, VerificationBudget: domain.VerificationBudget{Level: domain.VerificationTargeted, MaxAutomaticCommands: 1}, MethodProfile: domain.MethodPlain}, Process: definition.Reference, CurrentNode: domain.NodeRequirements, CurrentAction: &action, PrimaryRepositoryKey: domain.RepositoryKey(key), Repository: domain.RepositoryBinding{CanonicalRoot: "/repo/" + key, GitCommonDirDigest: digest, RepositoryIdentity: digest, Branch: &branch, Head: &head, WorktreeFingerprint: digest, ObservedAt: now, BindingDigest: digest}, Revision: 1, CreatedAt: now, UpdatedAt: now}
}

func controlCenterOpenMutation(task domain.ProcessTask) TaskMutation {
	payload := domain.Digest(strings.Repeat("f", 64))
	task.LastOperation = &domain.LastOperation{OperationID: domain.ID("open-" + string(task.TaskID)), Kind: domain.OperationOpenTask, FromRevision: 0, ToRevision: 1, PayloadDigest: payload, CommittedAt: task.CreatedAt}
	return TaskMutation{Task: task, Event: TaskEvent{EventID: domain.ID("event-" + string(task.TaskID)), TaskID: task.TaskID, Revision: 1, Kind: domain.OperationOpenTask, SourceNode: domain.NodeRequirements, DestinationNode: domain.NodeRequirements, RequestID: task.LastOperation.OperationID, PayloadDigest: payload, CreatedAt: task.CreatedAt}, Claim: ClaimAcquire}
}

func cancelControlCenterTask(task domain.ProcessTask) cancelledFixture {
	now := task.UpdatedAt.Add(30 * time.Second)
	payload := domain.Digest(strings.Repeat("e", 64))
	task.CurrentNode = domain.NodeCancelled
	task.CurrentAction = nil
	task.Revision = 2
	task.UpdatedAt = now
	task.CompletedAt = &now
	task.Outcome = &domain.ProcessOutcome{Status: domain.TerminalCancelled, Summary: "Cancelled for the read fixture.", FinalRepositoryDigest: task.Repository.BindingDigest, CompletedAt: now}
	task.LastOperation = &domain.LastOperation{OperationID: "cancel-task-b", Kind: domain.OperationCancelTask, FromRevision: 1, ToRevision: 2, PayloadDigest: payload, CommittedAt: now}
	return cancelledFixture{mutation: TaskMutation{ExpectedRevision: 1, Task: task, Event: TaskEvent{EventID: "cancel-event-task-b", TaskID: task.TaskID, Revision: 2, Kind: domain.OperationCancelTask, SourceNode: domain.NodeRequirements, DestinationNode: domain.NodeCancelled, RequestID: "cancel-task-b", PayloadDigest: payload, CreatedAt: now}, Claim: ClaimRelease}}
}

func pointerTime(value time.Time) *time.Time { return &value }

func TestControlCenterLifecycleCP2(t *testing.T) {
	ctx := context.Background()
	opened, err := Open(ctx, dbPath(t))
	if err != nil {
		t.Fatal(err)
	}
	defer opened.Close()
	now := time.Date(2026, 8, 26, 11, 0, 0, 0, time.UTC)
	active := controlCenterTestTask(t, "task-active", domain.HostCodex, "active", "Keep active", now)
	terminalSource := controlCenterTestTask(t, "task-terminal", domain.HostCodex, "terminal", "Manage terminal", now.Add(time.Minute))
	for _, task := range []domain.ProcessTask{active, terminalSource} {
		if err := opened.CommitTask(ctx, controlCenterOpenMutation(task)); err != nil {
			t.Fatal(err)
		}
	}
	terminal := cancelControlCenterTask(terminalSource).mutation.Task
	terminal.TaskID = terminalSource.TaskID
	terminal.LastOperation.OperationID = "cancel-task-terminal"
	cancel := cancelControlCenterTask(terminalSource).mutation
	cancel.Task = terminal
	cancel.Event.EventID = "cancel-event-task-terminal"
	cancel.Event.TaskID = terminal.TaskID
	cancel.Event.RequestID = terminal.LastOperation.OperationID
	if err := opened.CommitTask(ctx, cancel); err != nil {
		t.Fatal(err)
	}

	if _, err := opened.SetTaskArchived(ctx, ArchiveTaskMutation{TaskID: active.TaskID, ExpectedRevision: 1, Archived: true, ArchivedAt: now}); !errors.Is(err, ErrTaskTerminal) {
		t.Fatalf("active archive err=%v", err)
	}
	archivedAt := now.Add(2 * time.Minute)
	archived, err := opened.SetTaskArchived(ctx, ArchiveTaskMutation{TaskID: terminal.TaskID, ExpectedRevision: 2, Archived: true, ArchivedAt: archivedAt})
	if err != nil || archived == nil || !archived.Equal(archivedAt) {
		t.Fatalf("archive=%v err=%v", archived, err)
	}
	repeated, err := opened.SetTaskArchived(ctx, ArchiveTaskMutation{TaskID: terminal.TaskID, ExpectedRevision: 2, Archived: true, ArchivedAt: archivedAt.Add(time.Minute)})
	if err != nil || repeated == nil || !repeated.Equal(archivedAt) {
		t.Fatalf("idempotent archive=%v err=%v", repeated, err)
	}
	if _, err := opened.SetTaskArchived(ctx, ArchiveTaskMutation{TaskID: terminal.TaskID, ExpectedRevision: 1, Archived: false}); !errors.Is(err, ErrRevisionConflict) {
		t.Fatalf("stale restore err=%v", err)
	}
	detail, err := opened.LoadControlCenterTask(ctx, terminal.TaskID)
	if err != nil || detail.ArchivedAt == nil || detail.Task.Revision != 2 {
		t.Fatalf("archive changed workflow facts: detail=%#v err=%v", detail, err)
	}
	if restored, err := opened.SetTaskArchived(ctx, ArchiveTaskMutation{TaskID: terminal.TaskID, ExpectedRevision: 2}); err != nil || restored != nil {
		t.Fatalf("restore=%v err=%v", restored, err)
	}

	basePurge := PurgeTaskMutation{TaskID: terminal.TaskID, ExpectedRevision: 2, TypedTaskID: terminal.TaskID, Reason: "Remove completed fixture.", Irreversible: true}
	if err := opened.PurgeTask(ctx, PurgeTaskMutation{TaskID: terminal.TaskID, ExpectedRevision: 2, TypedTaskID: "wrong", Reason: basePurge.Reason, Irreversible: true}); !errors.Is(err, ErrInvalidArgument) {
		t.Fatalf("mismatched confirmation err=%v", err)
	}
	if err := opened.PurgeTask(ctx, PurgeTaskMutation{TaskID: active.TaskID, ExpectedRevision: 1, TypedTaskID: active.TaskID, Reason: basePurge.Reason, Irreversible: true}); !errors.Is(err, ErrTaskTerminal) {
		t.Fatalf("active purge err=%v", err)
	}
	if _, err := opened.db.ExecContext(ctx, `INSERT INTO repository_claims(repository_identity,task_id,origin_host,claimed_at) VALUES(?,?,?,?)`, terminal.Repository.RepositoryIdentity, terminal.TaskID, terminal.OriginHost, formatTime(now)); err != nil {
		t.Fatal(err)
	}
	if err := opened.PurgeTask(ctx, basePurge); !errors.Is(err, ErrStorageUnavailable) {
		t.Fatalf("claimed purge err=%v", err)
	}
	if _, err := opened.LoadControlCenterTask(ctx, terminal.TaskID); err != nil {
		t.Fatalf("failed purge changed task: %v", err)
	}
	if _, err := opened.db.ExecContext(ctx, `DELETE FROM repository_claims WHERE task_id=?`, terminal.TaskID); err != nil {
		t.Fatal(err)
	}
	if err := opened.PurgeTask(ctx, basePurge); err != nil {
		t.Fatal(err)
	}
	if _, err := opened.LoadTask(ctx, terminal.TaskID); !errors.Is(err, ErrTaskNotFound) {
		t.Fatalf("purged task err=%v", err)
	}
	if _, err := opened.LoadTask(ctx, active.TaskID); err != nil {
		t.Fatalf("unrelated task removed: %v", err)
	}
}
