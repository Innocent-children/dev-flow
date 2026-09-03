package application

import (
	"context"
	"github.com/Innocent-children/dev-flow/internal/domain"
	"github.com/Innocent-children/dev-flow/internal/repository"
	"strings"
	"testing"
	"time"
)

func TestOpenTaskIntentConflictAndIDFailureAreZeroWrite(t *testing.T) {
	now := time.Now().UTC()
	digest := domain.Digest(strings.Repeat("a", 64))
	branch := "feature/task"
	head := strings.Repeat("b", 40)
	repositoryPath := testPath("repo")
	binding := domain.RepositoryBinding{WorktreeInstanceDigest: digest, IdentityDigest: digest, HistoryDigest: digest, ContentDigest: digest, CurrentBranch: &branch, CurrentHead: head, HeadTree: head, HistoryRelation: domain.RepositoryHistoryExact, BaseCommitAncestor: true, ObservedAt: now, BindingDigest: digest}
	origin := domain.WorkspaceOrigin{Mode: domain.WorkspaceModeDedicatedWorktree, RemoteName: "origin", BaseBranch: "main", BaseCommit: head, TaskBranch: branch, SourceRepositoryGroupDigest: digest, CanonicalWorktreeRoot: repositoryPath, WorktreeGitDirDigest: digest, ProvisioningReceiptID: "receipt"}
	originInput := WorkspaceOriginInput{Mode: origin.Mode, RemoteName: origin.RemoteName, BaseBranch: origin.BaseBranch, BaseCommit: origin.BaseCommit, TaskBranch: origin.TaskBranch, ProvisioningReceiptID: origin.ProvisioningReceiptID}
	ms := &memoryStore{}
	n := 0
	s, _ := newService(ms, &mutableObserver{binding: binding, origin: origin}, func() time.Time { return now }, func(prefix string) (domain.ID, error) { n++; return domain.ID(prefix + "-id"), nil })
	base := OpenTaskRequest{RequestID: "request-one", Host: domain.HostCodex, RepositoryPath: repositoryPath, WorkspaceOrigin: &originInput, NewTask: &NewTaskInput{Request: "Requirement A", VerificationBudget: domain.VerificationBudget{Level: domain.VerificationTargeted, MaxAutomaticCommands: 1}, MethodProfile: domain.MethodPlain}}
	if _, err := s.OpenTask(context.Background(), base); err != nil {
		t.Fatal(err)
	}
	before := ms.commits
	base.RequestID = "request-two"
	base.NewTask.Request = "Requirement B"
	if _, err := s.OpenTask(context.Background(), base); err != domain.ErrActiveTaskConflict || ms.commits != before {
		t.Fatalf("conflict=%v writes=%d", err, ms.commits-before)
	}
	failed := &memoryStore{}
	bad, _ := newService(failed, &mutableObserver{binding: binding, origin: origin}, func() time.Time { return now }, func(string) (domain.ID, error) { return "", domain.ErrInternal })
	base.NewTask.Request = "Requirement A"
	if _, err := bad.OpenTask(context.Background(), base); err != domain.ErrInternal || failed.commits != 0 {
		t.Fatal("ID failure wrote state")
	}
}

type mutableObserver struct {
	binding domain.RepositoryBinding
	origin  domain.WorkspaceOrigin
	calls   int
}

func (o *mutableObserver) Observe(context.Context, string) (domain.RepositoryBinding, error) {
	o.calls++
	return o.binding, nil
}
func (o *mutableObserver) ObserveWorkspace(context.Context, string, repository.WorkspaceOriginSelection, *domain.RepositoryBinding) (domain.WorkspaceOrigin, domain.RepositoryBinding, error) {
	o.calls++
	return o.origin, o.binding, nil
}
func TestApplyRepositoryDriftIsZeroWrite(t *testing.T) {
	now := time.Now().UTC()
	d := domain.Digest(strings.Repeat("a", 64))
	branch := "feature/task"
	head := strings.Repeat("b", 40)
	repositoryPath := testPath("repo")
	binding := domain.RepositoryBinding{WorktreeInstanceDigest: d, IdentityDigest: d, HistoryDigest: d, ContentDigest: d, CurrentBranch: &branch, CurrentHead: head, HeadTree: head, HistoryRelation: domain.RepositoryHistoryExact, BaseCommitAncestor: true, ObservedAt: now, BindingDigest: d}
	origin := domain.WorkspaceOrigin{Mode: domain.WorkspaceModeDedicatedWorktree, RemoteName: "origin", BaseBranch: "main", BaseCommit: head, TaskBranch: branch, SourceRepositoryGroupDigest: d, CanonicalWorktreeRoot: repositoryPath, WorktreeGitDirDigest: d, ProvisioningReceiptID: "receipt"}
	o := &mutableObserver{binding: binding, origin: origin}
	ms := &memoryStore{}
	s, _ := newService(ms, o, func() time.Time { return now }, func(prefix string) (domain.ID, error) { return domain.ID(prefix + "-id"), nil })
	originInput := WorkspaceOriginInput{Mode: origin.Mode, RemoteName: origin.RemoteName, BaseBranch: origin.BaseBranch, BaseCommit: origin.BaseCommit, TaskBranch: origin.TaskBranch, ProvisioningReceiptID: origin.ProvisioningReceiptID}
	opened, err := s.OpenTask(context.Background(), OpenTaskRequest{RequestID: "request-open", Host: domain.HostCodex, RepositoryPath: repositoryPath, WorkspaceOrigin: &originInput, NewTask: &NewTaskInput{Request: "Requirement", VerificationBudget: domain.VerificationBudget{Level: domain.VerificationTargeted, MaxAutomaticCommands: 1}, MethodProfile: domain.MethodPlain}})
	if err != nil {
		t.Fatal(err)
	}
	o.binding = phase5BindingWithSurface(o.binding, []string{"internal/file.go"}, "c")
	payload := phase5Payload(t, opened.Task, "requirements_ready", "", requirementsNodeResult("Goal", []string{"Accepted"}))
	before := ms.commits
	a := opened.Task.CurrentAction
	_, err = s.ApplyAction(context.Background(), ApplyActionRequest{RequestID: "request-apply", Host: domain.HostCodex, TaskID: opened.Task.TaskID, ExpectedRevision: 1, ActionID: a.ActionID, ActionKind: a.Kind, ProcessID: opened.Task.Process.ID, ProcessDefinitionDigest: opened.Task.Process.DefinitionDigest, SourceCursor: opened.Task.CurrentNode, RepositoryBindingDigest: a.RepositoryBindingDigest, IssuanceIdentityDigest: a.IssuanceIdentityDigest, IssuanceHistoryDigest: a.IssuanceHistoryDigest, IssuanceContentDigest: a.IssuanceContentDigest, Payload: payload})
	if err != domain.ErrRepositoryDrift || ms.commits != before {
		t.Fatalf("drift=%v writes=%d", err, ms.commits-before)
	}
}
