package store

import (
	"context"
	"errors"
	"path/filepath"
	"testing"
	"time"

	"github.com/Innocent-children/dev-flow/internal/domain"
)

func TestRepositoryClaimConcurrentAcquireHasSingleWinner(t *testing.T) {
	ctx, cancel := context.WithTimeout(
		context.Background(),
		domain.SQLiteBusyTimeout+time.Second,
	)
	defer cancel()

	databasePath := filepath.Join(t.TempDir(), "claim-race.db")
	firstStore, err := Open(ctx, databasePath)
	if err != nil {
		t.Fatalf("open first store: %v", err)
	}
	defer firstStore.Close()
	secondStore, err := Open(ctx, databasePath)
	if err != nil {
		t.Fatalf("open second store: %v", err)
	}
	defer secondStore.Close()

	now := time.Date(2026, 8, 15, 9, 30, 0, 0, time.UTC)
	repositoryIdentity := digest("7")
	canonicalRoot := t.TempDir()
	firstTask := validTask(t, "task-claim-race-first", repositoryIdentity, canonicalRoot, now)
	firstEvent := taskEvent("event-claim-race-first", &firstTask, domain.PhaseIntake, now)
	secondTask := validTask(t, "task-claim-race-second", repositoryIdentity, canonicalRoot, now)
	secondEvent := taskEvent("event-claim-race-second", &secondTask, domain.PhaseIntake, now)

	type commitResult struct {
		taskID domain.ID
		err    error
	}
	start := make(chan struct{})
	results := make(chan commitResult, 2)
	commit := func(taskStore *SQLite, task domain.Task, event TaskEvent) {
		<-start
		results <- commitResult{
			taskID: task.TaskID,
			err: taskStore.CommitTask(ctx, TaskMutation{
				ExpectedRevision: 0,
				Task:             task,
				Event:            event,
				Claim:            ClaimAcquire,
			}),
		}
	}
	go commit(firstStore, firstTask, firstEvent)
	go commit(secondStore, secondTask, secondEvent)
	close(start)

	firstResult := <-results
	secondResult := <-results
	var winner, loser commitResult
	switch {
	case firstResult.err == nil && errors.Is(secondResult.err, ErrActiveTaskConflict):
		winner, loser = firstResult, secondResult
	case secondResult.err == nil && errors.Is(firstResult.err, ErrActiveTaskConflict):
		winner, loser = secondResult, firstResult
	default:
		t.Fatalf(
			"claim race results = (%s, %v), (%s, %v); want one success and one %v",
			firstResult.taskID,
			firstResult.err,
			secondResult.taskID,
			secondResult.err,
			ErrActiveTaskConflict,
		)
	}

	active, err := firstStore.LoadActiveTask(ctx, repositoryIdentity)
	if err != nil {
		t.Fatalf("load winning active task: %v", err)
	}
	if active.TaskID != winner.taskID {
		t.Fatalf("active task = %s, want winner %s", active.TaskID, winner.taskID)
	}
	if _, err := firstStore.LoadTask(ctx, loser.taskID); !errors.Is(err, ErrTaskNotFound) {
		t.Fatalf("load losing task error = %v, want %v", err, ErrTaskNotFound)
	}

	assertRowCount(t, ctx, firstStore.db, `SELECT COUNT(*) FROM tasks`, "", 1)
	assertRowCount(t, ctx, firstStore.db, `SELECT COUNT(*) FROM task_events`, "", 1)
	assertRowCount(t, ctx, firstStore.db, `SELECT COUNT(*) FROM repository_claims`, "", 1)
	assertRowCount(
		t,
		ctx,
		firstStore.db,
		`SELECT COUNT(*) FROM task_events WHERE task_id = ?`,
		string(loser.taskID),
		0,
	)
}
