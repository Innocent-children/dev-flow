package store

import (
	"bytes"
	"context"
	"encoding/json"
	"reflect"
	"testing"

	"github.com/Innocent-children/dev-flow/internal/domain"
)

func TestStrictCodecAndRestart(t *testing.T) {
	task := multiRepositoryGraphTask(t)
	task.Requirements = &domain.RequirementsBaseline{Revision: 1, Digest: task.Process.DefinitionDigest, Goal: "Graph storage", AcceptanceCriteria: []string{"Restart exactly"}, CreatedAt: task.CreatedAt}
	task.Evidence = []domain.EvidenceSummary{{EvidenceID: "verification-evidence", Source: domain.EvidenceSourceAutomated, Name: "targeted-test", Status: domain.EvidenceFailed, Summary: "Failure retained across restart.", Digest: task.Process.DefinitionDigest, CommandCount: 1, RecordedAt: task.CreatedAt}}
	task.VerificationAttempts = []domain.VerificationAttempt{{TaskRevision: task.Revision, TaskPlanRevision: 1, ImplementationRevision: 1, DestinationNode: domain.NodeRequirements, EvidenceIDs: []domain.ID{"verification-evidence"}, ResultDigest: task.Process.DefinitionDigest, FailureDigest: task.Process.DefinitionDigest, Failed: true, RecordedAt: task.CreatedAt}}
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
	var formerSnapshot map[string]any
	if json.Unmarshal(raw, &formerSnapshot) != nil {
		t.Fatal("current snapshot is not JSON")
	}
	delete(formerSnapshot, "verification_attempts")
	delete(formerSnapshot, "file_scope_records")
	delete(formerSnapshot, "task_changed_paths")
	formerRaw, err := json.Marshal(formerSnapshot)
	if err != nil {
		t.Fatal(err)
	}
	formerDecoded, err := decodeTask(formerRaw)
	if err != nil || len(formerDecoded.VerificationAttempts) != 0 || len(formerDecoded.FileScopeRecords) != 0 || len(formerDecoded.TaskChangedPaths) != 0 {
		t.Fatalf("former snapshot attempts=%d scope=%d paths=%d err=%v", len(formerDecoded.VerificationAttempts), len(formerDecoded.FileScopeRecords), len(formerDecoded.TaskChangedPaths), err)
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

func TestStrictCodecRetainsFileScopeDecisionsAndTaskPaths(t *testing.T) {
	task := fullGraphTask(t)
	now := task.CreatedAt
	allowedActionID := domain.ID("implementation-action")
	task.TaskChangedPaths = []string{"internal/extra.go"}
	task.FileScopeRecords = []domain.FileScopeRecord{{
		RequestID: "scope-request", Paths: []string{"internal/extra.go"}, IntentDigest: task.Repository.BindingDigest,
		TaskPlanRevision: 1, SourceNode: domain.NodeImplement, SourceActionID: "source-action",
		Decision: domain.FileScopeAllowOnce, Reason: "Allow the exact implementation write.", Applicability: domain.FileScopeExactWrite,
		AllowedActionID: &allowedActionID, Consumed: true, CreatedAt: now, DecidedAt: &now,
	}}
	raw, err := encodeTask(task)
	if err != nil {
		t.Fatal(err)
	}
	decoded, err := decodeTask(raw)
	if err != nil || !reflect.DeepEqual(task.FileScopeRecords, decoded.FileScopeRecords) || !reflect.DeepEqual(task.TaskChangedPaths, decoded.TaskChangedPaths) {
		t.Fatalf("decoded scope=%#v paths=%#v err=%v", decoded.FileScopeRecords, decoded.TaskChangedPaths, err)
	}
}
