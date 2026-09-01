package store

import (
	"context"
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/Innocent-children/dev-flow/internal/domain"
	"github.com/Innocent-children/dev-flow/internal/workflow"
)

func TestProcessBlockerSnapshotCloseReopenEquality(t *testing.T) {
	path := dbPath(t)
	opened, err := Open(context.Background(), path)
	if err != nil {
		t.Fatal(err)
	}
	initial := testMutation(t, testGraphTask(t))
	if err := opened.CommitTask(context.Background(), initial); err != nil {
		t.Fatal(err)
	}
	task := initial.Task
	now := task.UpdatedAt.Add(time.Second)
	resume := task.CurrentNode
	originalAction := task.CurrentAction.ActionID
	task.CurrentNode = domain.NodeBlocked
	task.ResumeNode = &resume
	task.Revision++
	task.UpdatedAt = now
	observed := domain.Digest(strings.Repeat("d", 64))
	task.Blocker = &domain.ProcessBlocker{BlockerID: "blocker", Code: domain.ErrorTaskBlocked, Cause: domain.BlockerCauseRecoveryPartiallyCompleted, Message: "Restore the issuance binding before continuing.", ResumeNode: resume, ObservedBindingDigest: observed, Condition: domain.BlockerCondition{Kind: domain.BlockerConditionRestoreIssuanceBinding, ExpectedBindingDigest: task.Repository.BindingDigest}, RequiredResolution: "Restore the exact issuance binding.", CreatedAt: now}
	action, err := workflow.BuildProcessAction(workflow.StandardProcess(), domain.NodeBlocked, task.TaskID, task.Revision, task.Repository.BindingDigest, task.Intent.MethodProfile, "resolve-action", now)
	if err != nil {
		t.Fatal(err)
	}
	task.CurrentAction = &action
	payload := domain.Digest(strings.Repeat("e", 64))
	task.LastOperation = &domain.LastOperation{OperationID: "uncertain-operation", Kind: domain.OperationApplyAction, ActionID: &originalAction, FromRevision: 1, ToRevision: 2, PayloadDigest: payload, CommittedAt: now}
	event := TaskEvent{EventID: "blocker-event", TaskID: task.TaskID, Revision: task.Revision, Kind: domain.OperationApplyAction, SourceNode: resume, DestinationNode: domain.NodeBlocked, TransitionReason: "Recovery blocker created.", ActionID: &originalAction, RequestID: "uncertain-operation", PayloadDigest: payload, CreatedAt: now}
	if err := opened.CommitTask(context.Background(), TaskMutation{ExpectedRevision: 1, Task: task, Event: event, Claim: ClaimRetain}); err != nil {
		t.Fatal(err)
	}
	if err := opened.Close(); err != nil {
		t.Fatal(err)
	}
	reopened, err := Open(context.Background(), path)
	if err != nil {
		t.Fatal(err)
	}
	defer reopened.Close()
	loaded, err := reopened.LoadTask(context.Background(), task.TaskID)
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(loaded, task) {
		t.Fatalf("loaded blocker differs\nloaded=%+v\nwant=%+v", loaded, task)
	}
}
