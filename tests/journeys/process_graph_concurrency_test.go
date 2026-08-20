package journeys

import (
	"context"
	"errors"
	"reflect"
	"sync"
	"testing"

	"github.com/Innocent-children/dev-flow/internal/application"
	"github.com/Innocent-children/dev-flow/internal/domain"
	"github.com/Innocent-children/dev-flow/internal/repository"
	"github.com/Innocent-children/dev-flow/internal/store"
)

func TestProcessGraphConcurrencyJourney(t *testing.T) {
	j := newIterationJourney(t)
	j.toRefactor()
	source := j.task
	payload := refactorRecoveryPayload(t, source)
	operationID := domain.ID("concurrent-recovery-operation")
	writeFeatureFile(t, j.repo, "concurrent recovered refactor")
	beforeEvents, beforeClaims, beforeEvidence := j.eventCount(), j.claimCount(), len(source.Evidence)
	j.close()

	handleA, err := store.Open(context.Background(), j.dbPath)
	if err != nil {
		t.Fatal(err)
	}
	defer handleA.Close()
	handleB, err := store.Open(context.Background(), j.dbPath)
	if err != nil {
		t.Fatal(err)
	}
	defer handleB.Close()

	arrived := make(chan string, 2)
	releaseA, releaseB := make(chan struct{}), make(chan struct{})
	barrierA := &commitBarrierStore{Store: handleA, arrived: arrived, release: releaseA, name: "A"}
	barrierB := &commitBarrierStore{Store: handleB, arrived: arrived, release: releaseB, name: "B"}
	serviceA, err := application.NewService(barrierA, repository.NewGitObserver())
	if err != nil {
		t.Fatal(err)
	}
	serviceB, err := application.NewService(barrierB, repository.NewGitObserver())
	if err != nil {
		t.Fatal(err)
	}

	request := recoveryApplyRequest(source, operationID, payload)
	results := make(chan concurrentApplyResult, 2)
	var group sync.WaitGroup
	group.Add(2)
	go func() {
		defer group.Done()
		result, err := serviceA.ApplyAction(context.Background(), request)
		results <- concurrentApplyResult{name: "A", result: result, err: err}
	}()
	go func() {
		defer group.Done()
		result, err := serviceB.ApplyAction(context.Background(), request)
		results <- concurrentApplyResult{name: "B", result: result, err: err}
	}()
	arrivals := waitForBarrierArrivals(t, arrived, 2)
	if len(arrivals) != 2 || arrivals[0] == arrivals[1] {
		t.Fatalf("arrivals=%v", arrivals)
	}
	close(releaseA)
	first := <-results
	if first.name != "A" || first.err != nil {
		t.Fatalf("first=%+v", first)
	}
	close(releaseB)
	second := <-results
	group.Wait()
	close(results)
	winner, loser := requireOneWinnerOneLoser(t, []concurrentApplyResult{first, second})
	if winner.Task.CurrentNode != domain.NodeTest || winner.Task.Revision != source.Revision+1 || winner.Task.LastOperation == nil || winner.Task.LastOperation.OperationID != operationID || winner.Task.Implementation.Revision != source.Implementation.Revision+1 || len(winner.Task.Evidence) != beforeEvidence {
		t.Fatalf("winner=%+v", winner.Task)
	}
	if !errors.Is(loser.err, domain.ErrRevisionConflict) {
		t.Fatalf("loser=%+v", loser)
	}

	loserService := serviceA
	if loser.name == "B" {
		loserService = serviceB
	}
	readback, err := loserService.GetTask(context.Background(), application.GetTaskRequest{Host: domain.HostCodex, TaskID: source.TaskID, OperationProbe: ptrProbe(recoveryProbe(source, operationID, payload))})
	if err != nil {
		t.Fatal(err)
	}
	if readback.RecoveryAssessment == nil || readback.RecoveryAssessment.Classification != domain.RecoveryCompletedAndRecorded || readback.RecoveryAssessment.CommittedProof == nil || !reflect.DeepEqual(readback.Task, winner.Task) || readback.Task.Blocker != nil {
		t.Fatalf("loser readback=%+v", readback)
	}
	if got := databaseCount(t, j.dbPath, `SELECT COUNT(*) FROM task_events WHERE task_id=?`, source.TaskID); got != beforeEvents+1 {
		t.Fatalf("events=%d", got)
	}
	if got := databaseCount(t, j.dbPath, `SELECT COUNT(*) FROM task_events WHERE task_id=? AND revision=?`, source.TaskID, source.Revision+1); got != 1 {
		t.Fatalf("winner revision events=%d", got)
	}
	if got := databaseCount(t, j.dbPath, `SELECT COUNT(*) FROM repository_claims WHERE task_id=?`, source.TaskID); got != beforeClaims {
		t.Fatalf("claims=%d", got)
	}

	if err := handleA.Close(); err != nil {
		t.Fatal(err)
	}
	if err := handleB.Close(); err != nil {
		t.Fatal(err)
	}
	reopened, err := store.Open(context.Background(), j.dbPath)
	if err != nil {
		t.Fatal(err)
	}
	defer reopened.Close()
	loaded, err := reopened.LoadTask(context.Background(), source.TaskID)
	if err != nil || !reflect.DeepEqual(loaded, winner.Task) {
		t.Fatalf("reopen err=%v loaded=%+v", err, loaded)
	}
}

func ptrProbe(probe application.OperationProbe) *application.OperationProbe { return &probe }
