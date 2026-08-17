package store

import (
	"context"
	"database/sql"
	"path/filepath"
	"reflect"
	"testing"
	"time"

	"github.com/Innocent-children/dev-flow/internal/domain"
	"github.com/Innocent-children/dev-flow/internal/workflow"
)

func TestRestartPersistence(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	root := t.TempDir()
	databasePath := filepath.Join(root, "restart.db")

	first, err := Open(ctx, databasePath)
	if err != nil {
		t.Fatalf("open first store: %v", err)
	}

	createdAt := time.Date(2026, time.August, 15, 9, 0, 0, 123456789, time.UTC)
	created := validTask(t, "task-restart", digest("4"), filepath.Join(root, "repository"), createdAt)
	createEvent := taskEvent("event-restart-create", &created, domain.PhaseIntake, createdAt)
	if err := first.CommitTask(ctx, TaskMutation{
		Task:  created,
		Event: createEvent,
		Claim: ClaimAcquire,
	}); err != nil {
		_ = first.Close()
		t.Fatalf("commit initial task: %v", err)
	}

	updatedAt := createdAt.Add(time.Minute)
	middle := advancedTask(t, created, domain.PhaseAssess, domain.ActionPlanChange, updatedAt)
	middle.Evidence = []domain.EvidenceSummary{{
		EvidenceID: "evidence-restart",
		Source:     domain.EvidenceSourceHostObserved,
		Name:       "restart checkpoint",
		Status:     domain.EvidenceObserved,
		Summary:    "the persisted task reached a nonterminal revision",
		Digest:     digest("e"),
		RecordedAt: updatedAt,
	}}
	updateEvent := taskEvent("event-restart-advance", &middle, domain.PhaseIntake, updatedAt)
	appliedActionID := created.CurrentAction.ActionID
	updateEvent.ActionID = &appliedActionID
	middle.LastOperation.ActionID = &appliedActionID
	if err := workflow.ValidateTask(middle); err != nil {
		_ = first.Close()
		t.Fatalf("validate nonterminal restart task: %v", err)
	}
	if err := first.CommitTask(ctx, TaskMutation{
		ExpectedRevision: created.Revision,
		Task:             middle,
		Event:            updateEvent,
		Claim:            ClaimRetain,
	}); err != nil {
		_ = first.Close()
		t.Fatalf("commit nonterminal task: %v", err)
	}

	want := middle.Clone()
	wantEvent := loadLatestRestartEvent(t, ctx, first.db, want.TaskID)
	wantEventCount := restartEventCount(t, ctx, first.db, want.TaskID)
	if err := first.Close(); err != nil {
		t.Fatalf("close first store: %v", err)
	}

	second, err := Open(ctx, databasePath)
	if err != nil {
		t.Fatalf("reopen store: %v", err)
	}
	defer second.Close()

	got, err := second.LoadTask(ctx, want.TaskID)
	if err != nil {
		t.Fatalf("load task after restart: %v", err)
	}
	requireRestartTaskEqual(t, got, want)
	requireRestartCommittedFact(t, wantEvent, got)
	if gotEvent := loadLatestRestartEvent(t, ctx, second.db, got.TaskID); !reflect.DeepEqual(gotEvent, wantEvent) {
		t.Fatal("close/reopen changed the latest committed event")
	}
	if gotCount := restartEventCount(t, ctx, second.db, got.TaskID); gotCount != wantEventCount {
		t.Fatalf("close/reopen event count = %d, want %d", gotCount, wantEventCount)
	}

	// Remove audit rows only after proving task/event parity. A subsequent
	// authoritative read must still come entirely from the task snapshot.
	if _, err := second.db.ExecContext(ctx, `DELETE FROM task_events WHERE task_id = ?`, string(got.TaskID)); err != nil {
		t.Fatalf("prepare snapshot-authority proof: %v", err)
	}
	snapshotOnly, err := second.LoadTask(ctx, got.TaskID)
	if err != nil {
		t.Fatalf("load authoritative snapshot without events: %v", err)
	}
	requireRestartTaskEqual(t, snapshotOnly, want)
}

func TestBlockedTaskRestartRetainsIssuanceAndResolutionState(t *testing.T) {
	ctx := context.Background()
	root := t.TempDir()
	databasePath := filepath.Join(root, "blocked-restart.db")
	first, err := Open(ctx, databasePath)
	if err != nil {
		t.Fatalf("open blocked restart store: %v", err)
	}
	now := time.Date(2026, time.August, 17, 16, 0, 0, 0, time.UTC)
	initial := validTask(t, "task-blocked-restart", digest("6"), filepath.Join(root, "repository"), now)
	initial.Evidence = []domain.EvidenceSummary{{
		EvidenceID: "evidence-before-blocker", Source: domain.EvidenceSourceHostObserved,
		Name: "history", Status: domain.EvidenceObserved, Summary: "retained before blocker",
		Digest: digest("e"), RecordedAt: now,
	}}
	initialEvent := taskEvent("event-blocked-restart-open", &initial, initial.Phase, now)
	if err := first.CommitTask(ctx, TaskMutation{
		Task: initial, Event: initialEvent, Claim: ClaimAcquire,
	}); err != nil {
		_ = first.Close()
		t.Fatalf("commit blocked restart source: %v", err)
	}

	blockedAt := now.Add(time.Minute)
	blocked := initial.Clone()
	blocked.Revision++
	blocked.Phase = domain.PhaseBlocked
	blocked.UpdatedAt = blockedAt
	resumePhase := initial.Phase
	blocked.ResumePhase = &resumePhase
	blocked.Blocker = &domain.Blocker{
		BlockerID:             "blocker-restart",
		Code:                  domain.ErrorTaskBlocked,
		Cause:                 domain.RecoveryPartiallyCompleted,
		Message:               "recovery evidence is partial",
		ResumePhase:           resumePhase,
		ObservedBindingDigest: digest("7"),
		Condition: domain.BlockerCondition{
			Kind:                  domain.BlockerConditionRestoreIssuanceBinding,
			ExpectedBindingDigest: initial.Repository.BindingDigest,
		},
		RequiredResolution: "restore the issuance binding",
		CreatedAt:          blockedAt,
	}
	resolveAction, err := workflow.BuildNextAction(
		domain.PhaseBlocked,
		blocked.TaskID,
		blocked.Revision,
		blocked.Repository.BindingDigest,
		"action-resolve-restart",
		blockedAt,
	)
	if err != nil {
		_ = first.Close()
		t.Fatal(err)
	}
	blocked.CurrentAction = &resolveAction
	blockedEvent := taskEvent("event-blocked-restart", &blocked, initial.Phase, blockedAt)
	originalActionID := initial.CurrentAction.ActionID
	blockedEvent.ActionID = &originalActionID
	blocked.LastOperation.ActionID = &originalActionID
	if err := workflow.ValidateTask(blocked); err != nil {
		_ = first.Close()
		t.Fatalf("construct blocked restart task: %v", err)
	}
	if err := first.CommitTask(ctx, TaskMutation{
		ExpectedRevision: initial.Revision, Task: blocked,
		Event: blockedEvent, Claim: ClaimRetain,
	}); err != nil {
		_ = first.Close()
		t.Fatalf("commit blocked restart task: %v", err)
	}
	want := blocked.Clone()
	wantEvent := loadLatestRestartEvent(t, ctx, first.db, blocked.TaskID)
	wantEventCount := restartEventCount(t, ctx, first.db, blocked.TaskID)
	if err := first.Close(); err != nil {
		t.Fatalf("close blocked restart source: %v", err)
	}

	second, err := Open(ctx, databasePath)
	if err != nil {
		t.Fatalf("reopen blocked restart store: %v", err)
	}
	defer second.Close()
	got, err := second.LoadTask(ctx, blocked.TaskID)
	if err != nil {
		t.Fatalf("load blocked task after restart: %v", err)
	}
	requireRestartTaskEqual(t, got, want)
	requireRestartCommittedFact(t, wantEvent, got)
	if got.Phase != domain.PhaseBlocked || got.Blocker == nil ||
		got.Blocker.BlockerID != blocked.Blocker.BlockerID ||
		got.Blocker.Condition != blocked.Blocker.Condition || got.ResumePhase == nil ||
		*got.ResumePhase != resumePhase || got.CurrentAction == nil ||
		got.CurrentAction.Kind != domain.ActionResolveBlocker ||
		got.Repository.BindingDigest != initial.Repository.BindingDigest {
		t.Fatalf("blocked restart state = %#v", got)
	}
	active, err := second.LoadActiveTask(ctx, got.Repository.RepositoryIdentity)
	if err != nil || active.TaskID != got.TaskID || active.Revision != got.Revision {
		t.Fatalf("blocked restart claim = %#v, error %v", active, err)
	}
	if gotCount := restartEventCount(t, ctx, second.db, got.TaskID); gotCount != wantEventCount {
		t.Fatalf("blocked restart event count = %d, want %d", gotCount, wantEventCount)
	}
	readAgain, err := second.LoadTask(ctx, got.TaskID)
	if err != nil || !reflect.DeepEqual(readAgain, got) ||
		restartEventCount(t, ctx, second.db, got.TaskID) != wantEventCount {
		t.Fatalf("ordinary blocked read changed persistence: task=%#v error=%v", readAgain, err)
	}
}

func requireRestartTaskEqual(t *testing.T, got, want domain.Task) {
	t.Helper()
	if got.TaskID != want.TaskID || got.OriginHost != want.OriginHost ||
		got.Phase != want.Phase || got.Revision != want.Revision {
		t.Fatal("restart changed task identity, ownership, phase, or revision")
	}
	if !got.Contract.Equal(want.Contract) ||
		!reflect.DeepEqual(got.Contract.VerificationBudget(), want.Contract.VerificationBudget()) {
		t.Fatal("restart changed the immutable contract or verification budget")
	}
	if !reflect.DeepEqual(got.Repository, want.Repository) {
		t.Fatal("restart changed the persisted repository binding")
	}
	if got.CurrentAction == nil || want.CurrentAction == nil ||
		got.CurrentAction.ActionID != want.CurrentAction.ActionID ||
		got.CurrentAction.Kind != want.CurrentAction.Kind ||
		got.CurrentAction.Revision != want.CurrentAction.Revision ||
		got.CurrentAction.RepositoryBindingDigest != want.CurrentAction.RepositoryBindingDigest ||
		!reflect.DeepEqual(got.CurrentAction, want.CurrentAction) {
		t.Fatal("restart changed the persisted current action")
	}
	if !reflect.DeepEqual(got.Evidence, want.Evidence) ||
		!reflect.DeepEqual(got.LastOperation, want.LastOperation) {
		t.Fatal("restart changed evidence or the last committed operation")
	}
	if !got.CreatedAt.Equal(want.CreatedAt) || !got.UpdatedAt.Equal(want.UpdatedAt) ||
		!reflect.DeepEqual(got.ResumePhase, want.ResumePhase) ||
		!reflect.DeepEqual(got.Blocker, want.Blocker) ||
		!reflect.DeepEqual(got.Outcome, want.Outcome) ||
		!reflect.DeepEqual(got.CompletedAt, want.CompletedAt) {
		t.Fatal("restart changed task timestamps or optional state")
	}
}

func requireRestartCommittedFact(t *testing.T, event TaskEvent, task domain.Task) {
	t.Helper()
	operation := task.LastOperation
	if operation == nil || event.Revision != task.Revision ||
		event.RequestID != operation.OperationID || event.Kind != operation.Kind ||
		!sameOptionalID(event.ActionID, operation.ActionID) ||
		event.PayloadDigest != operation.PayloadDigest ||
		!event.CreatedAt.Equal(operation.CommittedAt) {
		t.Fatal("latest event and LastOperation do not describe the same committed fact")
	}
}

func loadLatestRestartEvent(t *testing.T, ctx context.Context, db *sql.DB, taskID domain.ID) TaskEvent {
	t.Helper()
	var (
		event                            TaskEvent
		revision                         int64
		kind, before, after              string
		actionID                         sql.NullString
		requestID, payloadDigest, atText string
	)
	if err := db.QueryRowContext(
		ctx,
		`SELECT event_id, revision, event_type, phase_before, phase_after,
		        action_id, request_id, payload_digest, created_at
		   FROM task_events
		  WHERE task_id = ?
		  ORDER BY revision DESC
		  LIMIT 1`,
		string(taskID),
	).Scan(
		&event.EventID,
		&revision,
		&kind,
		&before,
		&after,
		&actionID,
		&requestID,
		&payloadDigest,
		&atText,
	); err != nil {
		t.Fatalf("load latest task event: %v", err)
	}
	at, err := time.Parse(time.RFC3339Nano, atText)
	if err != nil || revision < 1 {
		t.Fatal("latest task event has an invalid revision or timestamp")
	}
	event.TaskID = taskID
	event.Revision = uint64(revision)
	event.Kind = domain.OperationKind(kind)
	event.PhaseBefore = domain.Phase(before)
	event.PhaseAfter = domain.Phase(after)
	if actionID.Valid {
		value := domain.ID(actionID.String)
		event.ActionID = &value
	}
	event.RequestID = domain.ID(requestID)
	event.PayloadDigest = domain.Digest(payloadDigest)
	event.CreatedAt = at
	return event
}

func restartEventCount(t *testing.T, ctx context.Context, db *sql.DB, taskID domain.ID) int {
	t.Helper()
	var count int
	if err := db.QueryRowContext(
		ctx,
		`SELECT COUNT(*) FROM task_events WHERE task_id = ?`,
		string(taskID),
	).Scan(&count); err != nil {
		t.Fatalf("count task events: %v", err)
	}
	return count
}
