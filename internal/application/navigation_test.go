package application

import (
	"context"
	"github.com/Innocent-children/dev-flow/internal/domain"
	"github.com/Innocent-children/dev-flow/internal/store"
	"strings"
	"testing"
	"time"
)

type memoryStore struct {
	task         *domain.ProcessTask
	operation    *store.ActionOperation
	commits      int
	stages       int
	commitErr    error
	lastMutation store.TaskMutation
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
	if m.commitErr != nil {
		return m.commitErr
	}
	task := x.Task
	m.task = &task
	if x.Event.Kind == domain.OperationApplyAction || x.Event.Kind == domain.OperationPrepareFileChange || x.Event.Kind == domain.OperationCancelTask {
		m.operation = nil
	}
	m.commits++
	m.lastMutation = x
	return nil
}
func (m *memoryStore) LoadActionOperation(_ context.Context, taskID domain.ID) (store.ActionOperation, bool, error) {
	if m.operation == nil || m.operation.TaskID != taskID {
		return store.ActionOperation{}, false, nil
	}
	copy := *m.operation
	copy.Commit = copy.Commit.Clone()
	if copy.AppliedRevision != nil {
		revision := *copy.AppliedRevision
		copy.AppliedRevision = &revision
	}
	return copy, true, nil
}
func (m *memoryStore) StageActionOperation(_ context.Context, task domain.ProcessTask, commit domain.ActionCommit) error {
	copy := commit.Clone()
	m.operation = &store.ActionOperation{TaskID: task.TaskID, Commit: copy}
	m.stages++
	return nil
}
func (m *memoryStore) CommitActionOperation(_ context.Context, operationID domain.ID, mutation store.TaskMutation) error {
	if m.commitErr != nil {
		return m.commitErr
	}
	if m.operation == nil || m.operation.Commit.Operation.OperationID != operationID {
		return store.ErrInvalidArgument
	}
	task := mutation.Task
	m.task = &task
	revision := task.Revision
	m.operation.AppliedRevision = &revision
	m.commits++
	m.lastMutation = mutation
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
	payload := phase5Payload(t, opened.Task, "requirements_ready", "", requirementsNodeResult("Simplify order submission.", []string{"behavior preserved"}))
	applied, err := service.ApplyAction(context.Background(), ApplyActionRequest{RequestID: "request-apply", Host: domain.HostCodex, TaskID: opened.Task.TaskID, ExpectedRevision: 1, ActionID: opened.Task.CurrentAction.ActionID, ActionKind: opened.Task.CurrentAction.Kind, ProcessID: opened.Task.Process.ID, ProcessDefinitionDigest: opened.Task.Process.DefinitionDigest, SourceCursor: opened.Task.CurrentNode, RepositoryBindingDigest: binding.BindingDigest, Payload: payload})
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
	_, err = service.ApplyAction(context.Background(), ApplyActionRequest{RequestID: "request-bad", Host: domain.HostCodex, TaskID: applied.Task.TaskID, ExpectedRevision: 2, ActionID: applied.Task.CurrentAction.ActionID, ActionKind: applied.Task.CurrentAction.Kind, ProcessID: applied.Task.Process.ID, ProcessDefinitionDigest: applied.Task.Process.DefinitionDigest, SourceCursor: applied.Task.CurrentNode, RepositoryBindingDigest: binding.BindingDigest, Payload: bad})
	if err == nil || ms.commits != before {
		t.Fatal("invalid DESIGN edge wrote state")
	}
	again, _ := service.GetNextAction(context.Background(), GetNextActionRequest{Host: domain.HostCodex, TaskID: applied.Task.TaskID})
	if again.Action.ActionID != applied.Task.CurrentAction.ActionID {
		t.Fatal("read changed action identity")
	}
}
