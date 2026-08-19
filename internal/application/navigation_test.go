package application

import (
	"context"
	"encoding/json"
	"github.com/Innocent-children/dev-flow/internal/domain"
	"github.com/Innocent-children/dev-flow/internal/store"
	"strings"
	"testing"
	"time"
)

type memoryStore struct {
	task    *domain.ProcessTask
	commits int
}

func (m *memoryStore) LoadTask(context.Context, domain.ID) (domain.ProcessTask, error) {
	if m.task == nil {
		return domain.ProcessTask{}, store.ErrTaskNotFound
	}
	return *m.task, nil
}
func (m *memoryStore) LoadActiveTask(context.Context, domain.Digest) (domain.ProcessTask, error) {
	if m.task == nil {
		return domain.ProcessTask{}, store.ErrTaskNotFound
	}
	return *m.task, nil
}
func (m *memoryStore) CommitTask(_ context.Context, x store.TaskMutation) error {
	task := x.Task
	m.task = &task
	m.commits++
	return nil
}

type observer struct{ binding domain.RepositoryBinding }

func (o observer) Observe(context.Context, string) (domain.RepositoryBinding, error) {
	return o.binding, nil
}
func TestProcessGraphNavigation(t *testing.T) {
	now := time.Date(2026, 8, 19, 3, 0, 0, 0, time.UTC)
	digest := domain.Digest(strings.Repeat("a", 64))
	branch := "main"
	head := strings.Repeat("b", 40)
	binding := domain.RepositoryBinding{CanonicalRoot: "/repo", GitCommonDirDigest: digest, RepositoryIdentity: digest, Branch: &branch, Head: &head, WorktreeFingerprint: digest, ObservedAt: now, BindingDigest: digest}
	ms := &memoryStore{}
	n := 0
	service, err := newService(ms, observer{binding}, func() time.Time { return now }, func(prefix string) (domain.ID, error) { n++; return domain.ID(prefix + "-" + string(rune('a'+n))), nil })
	if err != nil {
		t.Fatal(err)
	}
	opened, err := service.OpenTask(context.Background(), OpenTaskRequest{RequestID: "request-open", Host: domain.HostCodex, RepositoryPath: "/repo", NewTask: &NewTaskInput{Request: "Simplify order submission.", VerificationBudget: domain.VerificationBudget{Level: domain.VerificationTargeted, MaxAutomaticCommands: 4, AllowManualHandoff: true}, MethodProfile: domain.MethodSpecKit}})
	if err != nil {
		t.Fatal(err)
	}
	if opened.Task.CurrentNode != domain.NodeRequirements || len(opened.Task.CurrentAction.AvailableTransitions) != 1 {
		t.Fatal("requirements action incomplete")
	}
	payload := json.RawMessage(`{"transition_id":"requirements_ready","summary":"Requirements ready.","reason":"","artifacts":[],"method_evidence":[],"node_result":{"baseline":{"goal":"Simplify order submission.","scope":["request path"],"out_of_scope":["payments"],"acceptance_criteria":["behavior preserved"],"constraints":[],"assumptions":[]},"unresolved_questions":[]}}`)
	applied, err := service.ApplyAction(context.Background(), ApplyActionRequest{RequestID: "request-apply", Host: domain.HostCodex, TaskID: opened.Task.TaskID, ExpectedRevision: 1, ActionID: opened.Task.CurrentAction.ActionID, ActionKind: opened.Task.CurrentAction.Kind, ProcessID: opened.Task.Process.ID, ProcessVersion: opened.Task.Process.Version, ProcessDefinitionDigest: opened.Task.Process.DefinitionDigest, SourceCursor: opened.Task.CurrentNode, RepositoryBindingDigest: binding.BindingDigest, Payload: payload})
	if err != nil {
		t.Fatal(err)
	}
	if applied.Task.CurrentNode != domain.NodeDesign || applied.Task.Revision != 2 || len(applied.Task.CurrentAction.AvailableTransitions) != 2 {
		t.Fatal("design projection incomplete")
	}
	if applied.Task.LastOperation == nil || applied.Task.LastOperation.OperationID != "request-apply" || applied.Task.LastOperation.ToRevision != 2 || applied.Task.LastOperation.PayloadDigest == applied.Task.Process.DefinitionDigest || applied.Task.Requirements.Digest == applied.Task.Process.DefinitionDigest {
		t.Fatal("mutation identities or content digest are not independent")
	}
	before := ms.commits
	bad := payload
	_, err = service.ApplyAction(context.Background(), ApplyActionRequest{RequestID: "request-bad", Host: domain.HostCodex, TaskID: applied.Task.TaskID, ExpectedRevision: 2, ActionID: applied.Task.CurrentAction.ActionID, ActionKind: applied.Task.CurrentAction.Kind, ProcessID: applied.Task.Process.ID, ProcessVersion: applied.Task.Process.Version, ProcessDefinitionDigest: applied.Task.Process.DefinitionDigest, SourceCursor: applied.Task.CurrentNode, RepositoryBindingDigest: binding.BindingDigest, Payload: bad})
	if err == nil || ms.commits != before {
		t.Fatal("invalid DESIGN edge wrote state")
	}
	again, _ := service.GetNextAction(context.Background(), GetNextActionRequest{Host: domain.HostCodex, TaskID: applied.Task.TaskID})
	if again.Action.ActionID != applied.Task.CurrentAction.ActionID {
		t.Fatal("read changed action identity")
	}
}
