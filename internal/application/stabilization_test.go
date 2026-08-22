package application

import (
	"context"
	"github.com/Innocent-children/dev-flow/internal/domain"
	"strings"
	"testing"
	"time"
)

func TestOpenTaskIntentConflictAndIDFailureAreZeroWrite(t *testing.T) {
	now := time.Now().UTC()
	digest := domain.Digest(strings.Repeat("a", 64))
	branch := "main"
	head := strings.Repeat("b", 40)
	binding := domain.RepositoryBinding{CanonicalRoot: "/repo", GitCommonDirDigest: digest, RepositoryIdentity: digest, Branch: &branch, Head: &head, WorktreeFingerprint: digest, ObservedAt: now, BindingDigest: digest}
	ms := &memoryStore{}
	n := 0
	s, _ := newService(ms, observer{binding}, func() time.Time { return now }, func(prefix string) (domain.ID, error) { n++; return domain.ID(prefix + "-id"), nil })
	base := OpenTaskRequest{RequestID: "request-one", Host: domain.HostCodex, RepositoryPath: "/repo", NewTask: &NewTaskInput{Request: "Requirement A", VerificationBudget: domain.VerificationBudget{Level: domain.VerificationTargeted, MaxAutomaticCommands: 1}, MethodProfile: domain.MethodPlain}}
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
	bad, _ := newService(failed, observer{binding}, func() time.Time { return now }, func(string) (domain.ID, error) { return "", domain.ErrInternal })
	base.NewTask.Request = "Requirement A"
	if _, err := bad.OpenTask(context.Background(), base); err != domain.ErrInternal || failed.commits != 0 {
		t.Fatal("ID failure wrote state")
	}
}

type mutableObserver struct {
	binding domain.RepositoryBinding
	calls   int
}

func (o *mutableObserver) Observe(context.Context, string) (domain.RepositoryBinding, error) {
	o.calls++
	return o.binding, nil
}
func TestApplyRepositoryDriftIsZeroWrite(t *testing.T) {
	now := time.Now().UTC()
	d := domain.Digest(strings.Repeat("a", 64))
	branch := "main"
	head := strings.Repeat("b", 40)
	binding := domain.RepositoryBinding{CanonicalRoot: "/repo", GitCommonDirDigest: d, RepositoryIdentity: d, Branch: &branch, Head: &head, WorktreeFingerprint: d, ObservedAt: now, BindingDigest: d}
	o := &mutableObserver{binding: binding}
	ms := &memoryStore{}
	s, _ := newService(ms, o, func() time.Time { return now }, func(prefix string) (domain.ID, error) { return domain.ID(prefix + "-id"), nil })
	opened, err := s.OpenTask(context.Background(), OpenTaskRequest{RequestID: "request-open", Host: domain.HostCodex, RepositoryPath: "/repo", NewTask: &NewTaskInput{Request: "Requirement", VerificationBudget: domain.VerificationBudget{Level: domain.VerificationTargeted, MaxAutomaticCommands: 1}, MethodProfile: domain.MethodPlain}})
	if err != nil {
		t.Fatal(err)
	}
	o.binding.BindingDigest = domain.Digest(strings.Repeat("c", 64))
	payload := phase5Payload(t, opened.Task, "requirements_ready", "", requirementsNodeResult("Goal", []string{"Accepted"}))
	before := ms.commits
	a := opened.Task.CurrentAction
	_, err = s.ApplyAction(context.Background(), ApplyActionRequest{RequestID: "request-apply", Host: domain.HostCodex, TaskID: opened.Task.TaskID, ExpectedRevision: 1, ActionID: a.ActionID, ActionKind: a.Kind, ProcessID: opened.Task.Process.ID, ProcessDefinitionDigest: opened.Task.Process.DefinitionDigest, SourceCursor: opened.Task.CurrentNode, RepositoryBindingDigest: binding.BindingDigest, Payload: payload})
	if err != domain.ErrRepositoryDrift || ms.commits != before {
		t.Fatalf("drift=%v writes=%d", err, ms.commits-before)
	}
}
