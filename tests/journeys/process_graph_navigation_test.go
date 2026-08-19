package journeys

import (
	"context"
	"encoding/json"
	"github.com/Innocent-children/dev-flow/internal/application"
	"github.com/Innocent-children/dev-flow/internal/domain"
	"github.com/Innocent-children/dev-flow/internal/store"
	"strings"
	"testing"
	"time"
)

type graphStore struct {
	task   *domain.ProcessTask
	writes int
}

func (s *graphStore) LoadTask(context.Context, domain.ID) (domain.ProcessTask, error) {
	if s.task == nil {
		return domain.ProcessTask{}, store.ErrTaskNotFound
	}
	return *s.task, nil
}
func (s *graphStore) LoadActiveTask(context.Context, domain.Digest) (domain.ProcessTask, error) {
	if s.task == nil {
		return domain.ProcessTask{}, store.ErrTaskNotFound
	}
	return *s.task, nil
}
func (s *graphStore) CommitTask(_ context.Context, m store.TaskMutation) error {
	v := m.Task
	s.task = &v
	s.writes++
	return nil
}

type graphObserver struct{ b domain.RepositoryBinding }

func (o graphObserver) Observe(context.Context, string) (domain.RepositoryBinding, error) {
	return o.b, nil
}
func TestProcessGraphNavigation(t *testing.T) {
	now := time.Now().UTC()
	d := domain.Digest(strings.Repeat("a", 64))
	branch := "main"
	head := strings.Repeat("b", 40)
	b := domain.RepositoryBinding{CanonicalRoot: "/repo", GitCommonDirDigest: d, RepositoryIdentity: d, Branch: &branch, Head: &head, WorktreeFingerprint: d, ObservedAt: now, BindingDigest: d}
	s := &graphStore{}
	service, err := application.NewService(s, graphObserver{b})
	if err != nil {
		t.Fatal(err)
	}
	opened, err := service.OpenTask(context.Background(), application.OpenTaskRequest{RequestID: "request-open", Host: domain.HostCodex, RepositoryPath: "/repo", NewTask: &application.NewTaskInput{Request: "Simplify order submission.", VerificationBudget: domain.VerificationBudget{Level: domain.VerificationTargeted, MaxAutomaticCommands: 4}, MethodProfile: domain.MethodPlain}})
	if err != nil {
		t.Fatal(err)
	}
	a := opened.Task.CurrentAction
	if opened.Task.CurrentNode != "REQUIREMENTS" || len(a.AvailableTransitions) != 1 {
		t.Fatal("requirements projection")
	}
	payload := json.RawMessage(`{"transition_id":"requirements_ready","summary":"Ready.","reason":"","artifacts":[],"method_evidence":[],"node_result":{"baseline":{"goal":"Goal","scope":[],"out_of_scope":[],"acceptance_criteria":["Accepted"],"constraints":[],"assumptions":[]},"unresolved_questions":[]}}`)
	result, err := service.ApplyAction(context.Background(), application.ApplyActionRequest{RequestID: "request-apply", Host: domain.HostCodex, TaskID: opened.Task.TaskID, ExpectedRevision: 1, ActionID: a.ActionID, ActionKind: a.Kind, ProcessDefinitionDigest: opened.Task.Process.DefinitionDigest, RepositoryBindingDigest: b.BindingDigest, Payload: payload})
	if err != nil {
		t.Fatal(err)
	}
	if result.Task.CurrentNode != "DESIGN" || len(result.Task.CurrentAction.AvailableTransitions) != 2 {
		t.Fatal("design edges incomplete")
	}
	before := s.writes
	_, err = service.ApplyAction(context.Background(), application.ApplyActionRequest{RequestID: "request-invalid", Host: domain.HostCodex, TaskID: result.Task.TaskID, ExpectedRevision: 2, ActionID: result.Task.CurrentAction.ActionID, ActionKind: result.Task.CurrentAction.Kind, ProcessDefinitionDigest: result.Task.Process.DefinitionDigest, RepositoryBindingDigest: b.BindingDigest, Payload: payload})
	if err == nil || s.writes != before {
		t.Fatal("invalid edge wrote")
	}
}
