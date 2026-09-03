package journeys

import (
	"context"
	"github.com/Innocent-children/dev-flow/internal/application"
	"github.com/Innocent-children/dev-flow/internal/domain"
	"github.com/Innocent-children/dev-flow/internal/repository"
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
func (o graphObserver) ObserveWorkspace(_ context.Context, path string, selection repository.WorkspaceOriginSelection, _ *domain.RepositoryBinding) (domain.WorkspaceOrigin, domain.RepositoryBinding, error) {
	return domain.WorkspaceOrigin{Mode: selection.Mode, RemoteName: selection.RemoteName, BaseBranch: selection.BaseBranch, BaseCommit: selection.BaseCommit, TaskBranch: selection.TaskBranch, SourceRepositoryGroupDigest: o.b.IdentityDigest, CanonicalWorktreeRoot: path, WorktreeGitDirDigest: o.b.WorktreeInstanceDigest, ProvisioningReceiptID: selection.ProvisioningReceiptID}, o.b, nil
}
func TestProcessGraphNavigation(t *testing.T) {
	now := time.Now().UTC()
	d := domain.Digest(strings.Repeat("a", 64))
	branch := "task/navigation"
	head := strings.Repeat("b", 40)
	repositoryPath := testPath("repo")
	b := domain.RepositoryBinding{WorktreeInstanceDigest: d, IdentityDigest: d, HistoryDigest: d, ContentDigest: d, CurrentBranch: &branch, CurrentHead: head, HeadTree: head, HistoryRelation: domain.RepositoryHistoryExact, BaseCommitAncestor: true, ChangedEntries: []domain.RepositoryChangedEntry{}, TaskSurface: []domain.RepositoryChangedEntry{}, ObservedAt: now, BindingDigest: d}
	origin := application.WorkspaceOriginInput{Mode: domain.WorkspaceModeDedicatedWorktree, RemoteName: "origin", BaseBranch: "main", BaseCommit: head, TaskBranch: branch, ProvisioningReceiptID: "receipt-navigation"}
	s := &graphStore{}
	service, err := application.NewService(s, graphObserver{b})
	if err != nil {
		t.Fatal(err)
	}
	opened, err := service.OpenTask(context.Background(), application.OpenTaskRequest{RequestID: "request-open", Host: domain.HostCodex, RepositoryPath: repositoryPath, WorkspaceOrigin: &origin, NewTask: &application.NewTaskInput{Request: "Simplify order submission.", VerificationBudget: domain.VerificationBudget{Level: domain.VerificationTargeted, MaxAutomaticCommands: 4}, MethodProfile: domain.MethodPlain}})
	if err != nil {
		t.Fatal(err)
	}
	a := opened.Task.CurrentAction
	if opened.Task.CurrentNode != "REQUIREMENTS" || len(a.AvailableTransitions) != 1 {
		t.Fatal("requirements projection")
	}
	payload := journeyPayload(t, opened.Task, "requirements_ready", "", map[string]any{"baseline": map[string]any{"goal": "Goal", "scope": []string{}, "out_of_scope": []string{}, "acceptance_criteria": []string{"Accepted"}, "constraints": []string{}, "assumptions": []string{}}, "unresolved_questions": []string{}})
	result, err := service.ApplyAction(context.Background(), journeyApplyRequest(opened.Task, "request-apply", payload))
	if err != nil {
		t.Fatal(err)
	}
	if result.Task.CurrentNode != "DESIGN" || len(result.Task.CurrentAction.AvailableTransitions) != 2 {
		t.Fatal("design edges incomplete")
	}
	before := s.writes
	_, err = service.ApplyAction(context.Background(), journeyApplyRequest(result.Task, "request-invalid", payload))
	if err == nil || s.writes != before {
		t.Fatal("invalid edge wrote")
	}
}
