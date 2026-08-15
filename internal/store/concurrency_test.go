package store

import (
	"context"
	"errors"
	"path/filepath"
	"sync"
	"testing"
	"time"

	"github.com/Innocent-children/dev-flow/internal/domain"
	"github.com/Innocent-children/dev-flow/internal/workflow"
)

func TestTwoHandleRepositoryClaimRace(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), domain.SQLiteBusyTimeout+2*time.Second)
	defer cancel()
	first, second := openConcurrencyStores(t, ctx, filepath.Join(t.TempDir(), "claim-race.db"))
	defer first.Close()
	defer second.Close()

	now := time.Date(2026, time.August, 15, 12, 0, 0, 0, time.UTC)
	repositoryIdentity := digest("7")
	firstTask := validTask(t, "task-claim-first", repositoryIdentity, "/public/repository-race", now)
	firstEvent := taskEvent("event-claim-first", &firstTask, domain.PhaseIntake, now)
	secondTask := validTask(t, "task-claim-second", repositoryIdentity, "/public/repository-race", now)
	secondEvent := taskEvent("event-claim-second", &secondTask, domain.PhaseIntake, now)

	results := runConcurrentCommits(t, ctx,
		concurrentCommit{label: "first", taskID: firstTask.TaskID, store: first, mutation: TaskMutation{Task: firstTask, Event: firstEvent, Claim: ClaimAcquire}},
		concurrentCommit{label: "second", taskID: secondTask.TaskID, store: second, mutation: TaskMutation{Task: secondTask, Event: secondEvent, Claim: ClaimAcquire}},
	)
	winner, loser := requireSingleConcurrencyWinner(t, results, ErrActiveTaskConflict)

	active, err := first.LoadActiveTask(ctx, repositoryIdentity)
	if err != nil || active.TaskID != winner.taskID {
		t.Fatalf("active claim does not identify the single winner: error %v", err)
	}
	if _, err := second.LoadTask(ctx, loser.taskID); !errors.Is(err, ErrTaskNotFound) {
		t.Fatalf("loser task persisted: error %v", err)
	}
	assertRowCount(t, ctx, first.db, `SELECT COUNT(*) FROM tasks`, "", 1)
	assertRowCount(t, ctx, first.db, `SELECT COUNT(*) FROM task_events`, "", 1)
	assertRowCount(t, ctx, first.db, `SELECT COUNT(*) FROM repository_claims`, "", 1)
	assertRowCount(t, ctx, first.db, `SELECT COUNT(*) FROM task_events WHERE task_id = ?`, string(loser.taskID), 0)
}

func TestTwoHandleRevisionCASRace(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), domain.SQLiteBusyTimeout+2*time.Second)
	defer cancel()
	first, second := openConcurrencyStores(t, ctx, filepath.Join(t.TempDir(), "revision-race.db"))
	defer first.Close()
	defer second.Close()

	now := time.Date(2026, time.August, 15, 12, 30, 0, 0, time.UTC)
	initial := validTask(t, "task-revision-race", digest("8"), "/public/revision-race", now)
	initialEvent := taskEvent("event-revision-initial", &initial, domain.PhaseIntake, now)
	if err := first.CommitTask(ctx, TaskMutation{Task: initial, Event: initialEvent, Claim: ClaimAcquire}); err != nil {
		t.Fatalf("initial commit failed: %v", err)
	}

	firstMutation := revisionRaceMutation(t, initial, "first", now.Add(time.Minute))
	secondMutation := revisionRaceMutation(t, initial, "second", now.Add(2*time.Minute))
	results := runConcurrentCommits(t, ctx,
		concurrentCommit{label: "first", taskID: initial.TaskID, store: first, mutation: firstMutation},
		concurrentCommit{label: "second", taskID: initial.TaskID, store: second, mutation: secondMutation},
	)
	winner, loser := requireSingleConcurrencyWinner(t, results, ErrRevisionConflict)

	loaded, err := first.LoadTask(ctx, initial.TaskID)
	if err != nil {
		t.Fatalf("load CAS winner failed: %v", err)
	}
	if loaded.Revision != initial.Revision+1 || loaded.Phase != domain.PhaseAssess || len(loaded.Evidence) != 1 ||
		loaded.Evidence[0].EvidenceID != domain.ID("evidence-"+winner.label) || loaded.LastOperation == nil ||
		loaded.LastOperation.OperationID != domain.ID("request-event-revision-"+winner.label) {
		t.Fatal("persisted snapshot is not exactly the winning mutation")
	}
	assertRowCount(t, ctx, first.db, `SELECT COUNT(*) FROM tasks WHERE task_id = ?`, string(initial.TaskID), 1)
	assertRowCount(t, ctx, first.db, `SELECT COUNT(*) FROM task_events WHERE task_id = ?`, string(initial.TaskID), 2)
	assertRowCount(t, ctx, first.db, `SELECT COUNT(*) FROM task_events WHERE task_id = ? AND revision = 2`, string(initial.TaskID), 1)
	assertRowCount(t, ctx, first.db, `SELECT COUNT(*) FROM task_events WHERE event_id = ?`, "event-revision-"+loser.label, 0)
	assertRowCount(t, ctx, first.db, `SELECT COUNT(*) FROM repository_claims WHERE task_id = ?`, string(initial.TaskID), 1)
}

type concurrentCommit struct {
	label    string
	taskID   domain.ID
	store    *SQLite
	mutation TaskMutation
}

type concurrentCommitResult struct {
	label  string
	taskID domain.ID
	err    error
}

func runConcurrentCommits(
	t *testing.T,
	ctx context.Context,
	first concurrentCommit,
	second concurrentCommit,
) [2]concurrentCommitResult {
	t.Helper()
	ready := make(chan struct{}, 2)
	start := make(chan struct{})
	resultChannel := make(chan concurrentCommitResult, 2)
	var workers sync.WaitGroup
	for _, input := range []concurrentCommit{first, second} {
		input := input
		workers.Add(1)
		go func() {
			defer workers.Done()
			ready <- struct{}{}
			select {
			case <-start:
			case <-ctx.Done():
				resultChannel <- concurrentCommitResult{label: input.label, taskID: input.taskID, err: ctx.Err()}
				return
			}
			resultChannel <- concurrentCommitResult{
				label: input.label, taskID: input.taskID,
				err: input.store.CommitTask(ctx, input.mutation),
			}
		}()
	}
	for range 2 {
		select {
		case <-ready:
		case <-ctx.Done():
			close(start)
			workers.Wait()
			t.Fatalf("workers did not reach the bounded start gate: %v", ctx.Err())
		}
	}
	close(start)
	var results [2]concurrentCommitResult
	for index := range results {
		select {
		case results[index] = <-resultChannel:
		case <-ctx.Done():
			workers.Wait()
			t.Fatalf("concurrent commits did not finish before the deadline: %v", ctx.Err())
		}
	}
	workers.Wait()
	return results
}

func requireSingleConcurrencyWinner(
	t *testing.T,
	results [2]concurrentCommitResult,
	loserError error,
) (concurrentCommitResult, concurrentCommitResult) {
	t.Helper()
	switch {
	case results[0].err == nil && errors.Is(results[1].err, loserError):
		return results[0], results[1]
	case results[1].err == nil && errors.Is(results[0].err, loserError):
		return results[1], results[0]
	default:
		t.Fatalf("race did not produce one success and one stable conflict: errors %v / %v", results[0].err, results[1].err)
		return concurrentCommitResult{}, concurrentCommitResult{}
	}
}

func openConcurrencyStores(t *testing.T, ctx context.Context, databasePath string) (*SQLite, *SQLite) {
	t.Helper()
	first, err := Open(ctx, databasePath)
	if err != nil {
		t.Fatalf("open first database handle: %v", err)
	}
	second, err := Open(ctx, databasePath)
	if err != nil {
		_ = first.Close()
		t.Fatalf("open second database handle: %v", err)
	}
	if first == second || first.db == second.db {
		_ = first.Close()
		_ = second.Close()
		t.Fatal("concurrency proof did not use independent SQLite handles")
	}
	return first, second
}

func revisionRaceMutation(t *testing.T, initial domain.Task, label string, at time.Time) TaskMutation {
	t.Helper()
	next := advancedTask(t, initial, domain.PhaseAssess, domain.ActionPlanChange, at)
	next.Evidence = []domain.EvidenceSummary{{
		EvidenceID: domain.ID("evidence-" + label), Source: domain.EvidenceSourceHostObserved,
		Name: "assessment_summary", Status: domain.EvidenceObserved,
		Summary: "one competing assessment", Digest: digest("e"), RecordedAt: at,
	}}
	event := taskEvent("event-revision-"+label, &next, domain.PhaseIntake, at)
	if err := workflow.ValidateTask(next); err != nil {
		t.Fatalf("construct CAS mutation: %v", err)
	}
	return TaskMutation{ExpectedRevision: initial.Revision, Task: next, Event: event, Claim: ClaimRetain}
}
