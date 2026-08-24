package store

import (
	"bytes"
	"context"
	"reflect"
	"testing"

	"github.com/Innocent-children/dev-flow/internal/domain"
)

func TestStrictCodecAndRestart(t *testing.T) {
	task := multiRepositoryGraphTask(t)
	task.Requirements = &domain.RequirementsBaseline{Revision: 1, Digest: task.Process.DefinitionDigest, Goal: "Graph storage", AcceptanceCriteria: []string{"Restart exactly"}, CreatedAt: task.CreatedAt}
	raw, err := encodeTask(task)
	if err != nil {
		t.Fatal(err)
	}
	decoded, err := decodeTask(raw)
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(task, decoded) {
		t.Fatal("codec changed task")
	}
	overLimit := task
	overLimit.BaselineHistory = make([]domain.BaselineReference, domain.MaxRetainedBaselineReferences+1)
	if _, err := encodeTask(overLimit); err == nil {
		t.Fatal("over-limit aggregate accepted")
	}
	unknown := append(bytes.TrimSuffix(raw, []byte("}")), []byte(`,"unknown":true}`)...)
	if _, err := decodeTask(unknown); err == nil {
		t.Fatal("unknown field accepted")
	}
	duplicate := append([]byte(`{"task_id":"task",`), raw[1:]...)
	if _, err := decodeTask(duplicate); err == nil {
		t.Fatal("duplicate field accepted")
	}
	path := dbPath(t)
	store, err := Open(context.Background(), path)
	if err != nil {
		t.Fatal(err)
	}
	mutation := testMutation(t, task)
	if err := store.CommitTask(context.Background(), mutation); err != nil {
		t.Fatal(err)
	}
	store.Close()
	store, err = Open(context.Background(), path)
	if err != nil {
		t.Fatal(err)
	}
	defer store.Close()
	reopened, err := store.LoadTask(context.Background(), task.TaskID)
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(mutation.Task, reopened) {
		t.Fatal("restart changed task/action")
	}
	beforeDigest, err := mutation.Task.EffectiveRepositoryBindingDigest()
	if err != nil {
		t.Fatal(err)
	}
	afterDigest, err := reopened.EffectiveRepositoryBindingDigest()
	if err != nil || beforeDigest != afterDigest || len(reopened.AdditionalRepositories) != 1 {
		t.Fatalf("scope restart digest=%s want=%s additions=%d err=%v", afterDigest, beforeDigest, len(reopened.AdditionalRepositories), err)
	}
}
