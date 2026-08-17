package store

import (
	"context"
	"errors"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"testing"
	"time"

	"github.com/Innocent-children/dev-flow/internal/domain"
	"github.com/Innocent-children/dev-flow/internal/repository"
	"github.com/Innocent-children/dev-flow/internal/workflow"
)

func TestCanonicalAliasObservationsShareSingleRepositoryClaim(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("symlink creation is not reliably available without elevated privileges")
	}
	ctx := context.Background()
	root := t.TempDir()
	repositoryPath := filepath.Join(root, "RepositoryTarget")
	runStoreAliasGit(t, "", "init", "-b", "main", repositoryPath)
	if err := os.WriteFile(filepath.Join(repositoryPath, "tracked.txt"), []byte("initial\n"), 0o644); err != nil {
		t.Fatalf("write alias claim fixture: %v", err)
	}
	runStoreAliasGit(t, repositoryPath, "add", "tracked.txt")
	runStoreAliasGit(t, repositoryPath, "commit", "-m", "initial alias claim fixture")
	aliasPath := filepath.Join(t.TempDir(), "rEpOsItOrYtArGeT")
	if err := os.Symlink(repositoryPath, aliasPath); err != nil {
		t.Fatalf("create alias claim symlink: %v", err)
	}
	observer := repository.NewGitObserver()
	direct, err := observer.Observe(ctx, repositoryPath)
	if err != nil {
		t.Fatalf("observe direct claim repository: %v", err)
	}
	alias, err := observer.Observe(ctx, aliasPath)
	if err != nil {
		t.Fatalf("observe aliased claim repository: %v", err)
	}
	if direct.CanonicalRoot != alias.CanonicalRoot ||
		direct.GitCommonDirDigest != alias.GitCommonDirDigest ||
		direct.RepositoryIdentity != alias.RepositoryIdentity ||
		direct.BindingDigest != alias.BindingDigest {
		t.Fatalf("alias observations did not converge: direct=%#v alias=%#v", direct, alias)
	}

	taskStore, err := Open(ctx, filepath.Join(t.TempDir(), "alias-claim.db"))
	if err != nil {
		t.Fatalf("open alias claim store: %v", err)
	}
	defer taskStore.Close()
	now := time.Date(2026, time.August, 17, 15, 0, 0, 0, time.UTC)
	first := validTask(t, "task-alias-claim", direct.RepositoryIdentity, direct.CanonicalRoot, now)
	first.Repository = direct.Clone()
	firstAction, err := workflow.BuildNextAction(
		first.Phase,
		first.TaskID,
		first.Revision,
		first.Repository.BindingDigest,
		"action-alias-claim",
		now,
	)
	if err != nil {
		t.Fatal(err)
	}
	first.CurrentAction = &firstAction
	firstEvent := taskEvent("event-alias-claim", &first, first.Phase, now)
	if err := taskStore.CommitTask(ctx, TaskMutation{
		Task: first, Event: firstEvent, Claim: ClaimAcquire,
	}); err != nil {
		t.Fatalf("commit canonical alias claim: %v", err)
	}

	second := validTask(t, "task-alias-duplicate", alias.RepositoryIdentity, alias.CanonicalRoot, now.Add(time.Second))
	second.Repository = alias.Clone()
	secondAction, err := workflow.BuildNextAction(
		second.Phase,
		second.TaskID,
		second.Revision,
		second.Repository.BindingDigest,
		"action-alias-duplicate",
		now.Add(time.Second),
	)
	if err != nil {
		t.Fatal(err)
	}
	second.CurrentAction = &secondAction
	secondEvent := taskEvent("event-alias-duplicate", &second, second.Phase, now.Add(time.Second))
	if err := taskStore.CommitTask(ctx, TaskMutation{
		Task: second, Event: secondEvent, Claim: ClaimAcquire,
	}); !errors.Is(err, ErrActiveTaskConflict) {
		t.Fatalf("duplicate alias claim error = %v, want %v", err, ErrActiveTaskConflict)
	}

	active, err := taskStore.LoadActiveTask(ctx, direct.RepositoryIdentity)
	if err != nil || active.TaskID != first.TaskID || active.Repository.CanonicalRoot != direct.CanonicalRoot {
		t.Fatalf("canonical alias active task = %#v, error %v", active, err)
	}
	assertRowCount(t, ctx, taskStore.db, `SELECT COUNT(*) FROM tasks`, "", 1)
	assertRowCount(t, ctx, taskStore.db, `SELECT COUNT(*) FROM task_events`, "", 1)
	assertRowCount(t, ctx, taskStore.db, `SELECT COUNT(*) FROM repository_claims`, "", 1)
	assertRowCount(t, ctx, taskStore.db, `SELECT COUNT(*) FROM task_events WHERE task_id = ?`, string(second.TaskID), 0)
}

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

func runStoreAliasGit(t *testing.T, repositoryPath string, arguments ...string) {
	t.Helper()
	args := []string{
		"-c", "user.name=Dev Flow Test",
		"-c", "user.email=dev-flow@example.invalid",
		"-c", "commit.gpgSign=false",
	}
	if repositoryPath != "" {
		args = append(args, "-C", repositoryPath)
	}
	args = append(args, arguments...)
	if output, err := exec.Command("git", args...).CombinedOutput(); err != nil {
		t.Fatalf("construct alias claim Git fixture: %v\n%s", err, output)
	}
}
