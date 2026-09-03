package application

import (
	"context"
	"errors"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/Innocent-children/dev-flow/internal/domain"
	"github.com/Innocent-children/dev-flow/internal/repository"
	"github.com/Innocent-children/dev-flow/internal/store"
)

type multiRepositoryStore struct {
	task    *domain.ProcessTask
	commits int
}

func (s *multiRepositoryStore) LoadTask(_ context.Context, id domain.ID) (domain.ProcessTask, error) {
	if s.task == nil || s.task.TaskID != id {
		return domain.ProcessTask{}, store.ErrTaskNotFound
	}
	return *s.task, nil
}

func (s *multiRepositoryStore) LoadActiveTask(_ context.Context, identity domain.Digest) (domain.ProcessTask, error) {
	if s.task == nil || s.task.CurrentNode.Terminal() {
		return domain.ProcessTask{}, store.ErrTaskNotFound
	}
	if s.task.Repository.WorktreeInstanceDigest == identity {
		return *s.task, nil
	}
	for _, entry := range s.task.AdditionalRepositories {
		if entry.Binding.WorktreeInstanceDigest == identity {
			return *s.task, nil
		}
	}
	return domain.ProcessTask{}, store.ErrTaskNotFound
}

func (s *multiRepositoryStore) CommitTask(_ context.Context, mutation store.TaskMutation) error {
	if mutation.Task.Validate() != nil {
		return store.ErrInvalidArgument
	}
	task := mutation.Task
	s.task = &task
	s.commits++
	return nil
}

type multiRepositoryObserver struct {
	bindings map[string]domain.RepositoryBinding
	calls    []string
}

func (o *multiRepositoryObserver) Observe(_ context.Context, path string) (domain.RepositoryBinding, error) {
	o.calls = append(o.calls, path)
	binding, ok := o.bindings[path]
	if !ok {
		return domain.RepositoryBinding{}, errors.New("repository unavailable")
	}
	return binding, nil
}

func (o *multiRepositoryObserver) ObserveWorkspace(_ context.Context, path string, selection repository.WorkspaceOriginSelection, _ *domain.RepositoryBinding) (domain.WorkspaceOrigin, domain.RepositoryBinding, error) {
	binding, err := o.Observe(context.Background(), path)
	if err != nil {
		return domain.WorkspaceOrigin{}, domain.RepositoryBinding{}, err
	}
	return originForBinding(path, selection, binding), binding, nil
}

func TestMultiRepositoryOpenCreatesOneTaskAfterEveryOriginIsObserved(t *testing.T) {
	now := time.Date(2026, 9, 3, 2, 0, 0, 0, time.UTC)
	corePath, docsPath := testPath("core"), testPath("docs")
	core := multiRepositoryBinding(now, corePath, 'a')
	docs := multiRepositoryBinding(now, docsPath, 'b')
	service, memory, observer := multiRepositoryService(t, now, map[string]domain.RepositoryBinding{corePath: core, docsPath: docs})
	request := multiRepositoryOpenRequest("open-multi", corePath, core)
	request.PrimaryRepositoryKey = "core"
	request.AdditionalRepositories = []AdditionalRepositoryInput{additionalRepositoryInput("docs", docsPath, docs)}
	opened, err := service.OpenTask(context.Background(), request)
	if err != nil || !opened.Created || memory.commits != 1 || len(opened.Task.AdditionalRepositories) != 1 {
		t.Fatalf("opened=%+v commits=%d err=%v", opened, memory.commits, err)
	}
	if strings.Join(observer.calls, ",") != strings.Join([]string{corePath, docsPath, corePath, docsPath}, ",") {
		t.Fatalf("calls=%v", observer.calls)
	}
	workspace, err := opened.Task.EffectiveWorkspaceDigests()
	if err != nil || opened.Task.CurrentAction.RepositoryBindingDigest != workspace.Binding || opened.Task.CurrentAction.IssuanceContentDigest != workspace.Content {
		t.Fatalf("workspace=%+v err=%v", workspace, err)
	}
}

func TestMultiRepositoryOpenFailureLeavesNoPartialTask(t *testing.T) {
	now := time.Date(2026, 9, 3, 2, 0, 0, 0, time.UTC)
	corePath, docsPath := testPath("core"), testPath("docs")
	core := multiRepositoryBinding(now, corePath, 'a')
	docs := multiRepositoryBinding(now, docsPath, 'b')
	service, memory, _ := multiRepositoryService(t, now, map[string]domain.RepositoryBinding{corePath: core})
	request := multiRepositoryOpenRequest("open-fail", corePath, core)
	request.PrimaryRepositoryKey = "core"
	request.AdditionalRepositories = []AdditionalRepositoryInput{additionalRepositoryInput("docs", docsPath, docs)}
	if _, err := service.OpenTask(context.Background(), request); err == nil || memory.commits != 0 || memory.task != nil {
		t.Fatalf("err=%v commits=%d task=%+v", err, memory.commits, memory.task)
	}
}

func multiRepositoryService(t *testing.T, now time.Time, bindings map[string]domain.RepositoryBinding) (*Service, *multiRepositoryStore, *multiRepositoryObserver) {
	t.Helper()
	memory := &multiRepositoryStore{}
	observer := &multiRepositoryObserver{bindings: bindings}
	service, err := newService(memory, observer, func() time.Time { return now }, sequentialTestIDs())
	if err != nil {
		t.Fatal(err)
	}
	return service, memory, observer
}

func multiRepositoryOpenRequest(requestID domain.ID, path string, binding domain.RepositoryBinding) OpenTaskRequest {
	input := workspaceInputForBinding(path, binding)
	return OpenTaskRequest{
		RequestID:       requestID,
		Host:            domain.HostCodex,
		RepositoryPath:  path,
		WorkspaceOrigin: &input,
		NewTask: &NewTaskInput{
			Request:            "Update one bounded feature.",
			VerificationBudget: domain.VerificationBudget{Level: domain.VerificationTargeted, MaxAutomaticCommands: 2},
			MethodProfile:      domain.MethodPlain,
		},
	}
}

func additionalRepositoryInput(key domain.RepositoryKey, path string, binding domain.RepositoryBinding) AdditionalRepositoryInput {
	return AdditionalRepositoryInput{Key: key, RepositoryPath: path, WorkspaceOrigin: workspaceInputForBinding(path, binding)}
}

func workspaceInputForBinding(path string, binding domain.RepositoryBinding) WorkspaceOriginInput {
	branch := "feature/" + filepath.Base(path)
	if binding.CurrentBranch != nil {
		branch = *binding.CurrentBranch
	}
	return WorkspaceOriginInput{Mode: domain.WorkspaceModeDedicatedWorktree, RemoteName: "origin", BaseBranch: "main", BaseCommit: binding.CurrentHead, TaskBranch: branch, ProvisioningReceiptID: domain.ID("receipt-" + filepath.Base(path))}
}

func originForBinding(path string, selection repository.WorkspaceOriginSelection, binding domain.RepositoryBinding) domain.WorkspaceOrigin {
	return domain.WorkspaceOrigin{Mode: selection.Mode, RemoteName: selection.RemoteName, BaseBranch: selection.BaseBranch, BaseCommit: selection.BaseCommit, TaskBranch: selection.TaskBranch, SourceRepositoryGroupDigest: binding.IdentityDigest, CanonicalWorktreeRoot: path, WorktreeGitDirDigest: binding.WorktreeInstanceDigest, ProvisioningReceiptID: selection.ProvisioningReceiptID}
}

func multiRepositoryBinding(now time.Time, path string, marker byte) domain.RepositoryBinding {
	digest := domain.Digest(strings.Repeat(string(marker), 64))
	branch := "feature/" + filepath.Base(path)
	head := strings.Repeat(string(marker), 40)
	return domain.RepositoryBinding{WorktreeInstanceDigest: digest, IdentityDigest: digest, HistoryDigest: digest, ContentDigest: digest, CurrentBranch: &branch, CurrentHead: head, HeadTree: head, HistoryRelation: domain.RepositoryHistoryExact, BaseCommitAncestor: true, ObservedAt: now, BindingDigest: digest}
}
