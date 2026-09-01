package application

import (
	"context"
	"errors"
	"fmt"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/Innocent-children/dev-flow/internal/domain"
	"github.com/Innocent-children/dev-flow/internal/store"
)

type multiRepositoryStore struct {
	task    *domain.ProcessTask
	commits int
}

func (s *multiRepositoryStore) LoadTask(_ context.Context, taskID domain.ID) (domain.ProcessTask, error) {
	if s.task == nil || s.task.TaskID != taskID {
		return domain.ProcessTask{}, store.ErrTaskNotFound
	}
	return *s.task, nil
}

func (s *multiRepositoryStore) LoadActiveTask(_ context.Context, identity domain.Digest) (domain.ProcessTask, error) {
	if s.task == nil || s.task.CurrentNode.Terminal() {
		return domain.ProcessTask{}, store.ErrTaskNotFound
	}
	if s.task.Repository.RepositoryIdentity == identity {
		return *s.task, nil
	}
	for _, entry := range s.task.AdditionalRepositories {
		if entry.Binding.RepositoryIdentity == identity {
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

func TestMultiRepositoryOpenPreservesSingleRepositoryAndCreatesOneTask(t *testing.T) {
	now := time.Date(2026, 8, 23, 6, 0, 0, 0, time.UTC)
	t.Run("single repository compatibility", func(t *testing.T) {
		corePath := testPath("core")
		primary := multiRepositoryBinding(now, corePath, 'a')
		service, taskStore, observer := multiRepositoryService(t, now, map[string]domain.RepositoryBinding{corePath: primary})
		result, err := service.OpenTask(context.Background(), multiRepositoryOpenRequest("request-single", corePath))
		if err != nil {
			t.Fatal(err)
		}
		if !result.Created || taskStore.commits != 1 || len(result.Task.AdditionalRepositories) != 0 || result.Task.EffectivePrimaryRepositoryKey() != domain.DefaultPrimaryRepositoryKey {
			t.Fatalf("single repository result=%#v commits=%d", result, taskStore.commits)
		}
		if result.Task.CurrentAction.RepositoryBindingDigest != primary.BindingDigest || strings.Join(observer.calls, ",") != corePath {
			t.Fatalf("single repository digest/calls=%s/%v", result.Task.CurrentAction.RepositoryBindingDigest, observer.calls)
		}
	})

	t.Run("primary and one additional share one action revision and digest", func(t *testing.T) {
		corePath := testPath("core")
		docsPath := testPath("docs")
		primary := multiRepositoryBinding(now, corePath, 'a')
		docs := multiRepositoryBinding(now, docsPath, 'b')
		service, taskStore, observer := multiRepositoryService(t, now, map[string]domain.RepositoryBinding{corePath: primary, docsPath: docs})
		request := multiRepositoryOpenRequest("request-multi", corePath)
		request.PrimaryRepositoryKey = "core"
		request.AdditionalRepositories = []AdditionalRepositoryInput{{Key: "docs", RepositoryPath: docsPath}}
		result, err := service.OpenTask(context.Background(), request)
		if err != nil {
			t.Fatal(err)
		}
		effective, err := result.Task.EffectiveRepositoryBindingDigest()
		if err != nil {
			t.Fatal(err)
		}
		if !result.Created || taskStore.commits != 1 || result.Task.Revision != 1 || result.Task.CurrentAction == nil || result.Task.CurrentAction.Revision != 1 || result.Task.CurrentAction.RepositoryBindingDigest != effective || effective == primary.BindingDigest {
			t.Fatalf("multi repository result=%#v effective=%s", result, effective)
		}
		if len(result.Task.AdditionalRepositories) != 1 || result.Task.AdditionalRepositories[0].Key != "docs" || strings.Join(observer.calls, ",") != strings.Join([]string{corePath, docsPath}, ",") {
			t.Fatalf("scope/calls=%#v/%v", result.Task.AdditionalRepositories, observer.calls)
		}
	})
}

func TestMultiRepositoryOpenObservesAdditionalRepositoriesByKey(t *testing.T) {
	now := time.Date(2026, 8, 23, 6, 10, 0, 0, time.UTC)
	corePath, apiPath, docsPath := testPath("core"), testPath("api"), testPath("docs")
	bindings := map[string]domain.RepositoryBinding{
		corePath: multiRepositoryBinding(now, corePath, 'a'),
		apiPath:  multiRepositoryBinding(now, apiPath, 'b'),
		docsPath: multiRepositoryBinding(now, docsPath, 'c'),
	}
	service, _, observer := multiRepositoryService(t, now, bindings)
	request := multiRepositoryOpenRequest("request-order", corePath)
	request.PrimaryRepositoryKey = "core"
	request.AdditionalRepositories = []AdditionalRepositoryInput{{Key: "docs", RepositoryPath: docsPath}, {Key: "api", RepositoryPath: apiPath}}
	result, err := service.OpenTask(context.Background(), request)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Join(observer.calls, ",") != strings.Join([]string{corePath, apiPath, docsPath}, ",") || result.Task.AdditionalRepositories[0].Key != "api" || result.Task.AdditionalRepositories[1].Key != "docs" {
		t.Fatalf("calls=%v scope=%#v", observer.calls, result.Task.AdditionalRepositories)
	}
}

func TestMultiRepositoryOpenRejectsInvalidScopeWithoutWrites(t *testing.T) {
	now := time.Date(2026, 8, 23, 6, 20, 0, 0, time.UTC)
	corePath, docsPath, samePath := testPath("core"), testPath("docs"), testPath("same")
	primary := multiRepositoryBinding(now, corePath, 'a')
	docs := multiRepositoryBinding(now, docsPath, 'b')
	duplicateIdentity := docs
	duplicateIdentity.RepositoryIdentity = primary.RepositoryIdentity
	bindings := map[string]domain.RepositoryBinding{corePath: primary, docsPath: docs, samePath: duplicateIdentity}

	tests := []struct {
		name       string
		additional []AdditionalRepositoryInput
		wantCalls  int
	}{
		{name: "duplicate key", additional: []AdditionalRepositoryInput{{Key: "docs", RepositoryPath: docsPath}, {Key: "docs", RepositoryPath: docsPath}}, wantCalls: 0},
		{name: "duplicate identity", additional: []AdditionalRepositoryInput{{Key: "same", RepositoryPath: samePath}}, wantCalls: 2},
		{name: "ninth repository", additional: multiRepositoryInputs(8), wantCalls: 0},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			service, taskStore, observer := multiRepositoryService(t, now, bindings)
			request := multiRepositoryOpenRequest("request-invalid", corePath)
			request.PrimaryRepositoryKey = "core"
			request.AdditionalRepositories = test.additional
			if _, err := service.OpenTask(context.Background(), request); err != domain.ErrInvalidArgument {
				t.Fatalf("error=%v", err)
			}
			if taskStore.commits != 0 || len(observer.calls) != test.wantCalls {
				t.Fatalf("commits=%d calls=%v", taskStore.commits, observer.calls)
			}
		})
	}
}

func TestMultiRepositoryOpenRejectsScopeMismatchAndResumesFromAdditionalIdentity(t *testing.T) {
	now := time.Date(2026, 8, 23, 6, 30, 0, 0, time.UTC)
	corePath, docsPath, apiPath := testPath("core"), testPath("docs"), testPath("api")
	bindings := map[string]domain.RepositoryBinding{
		corePath: multiRepositoryBinding(now, corePath, 'a'),
		docsPath: multiRepositoryBinding(now, docsPath, 'b'),
		apiPath:  multiRepositoryBinding(now, apiPath, 'c'),
	}
	service, taskStore, observer := multiRepositoryService(t, now, bindings)
	request := multiRepositoryOpenRequest("request-create", corePath)
	request.PrimaryRepositoryKey = "core"
	request.AdditionalRepositories = []AdditionalRepositoryInput{{Key: "docs", RepositoryPath: docsPath}}
	created, err := service.OpenTask(context.Background(), request)
	if err != nil {
		t.Fatal(err)
	}
	original := *taskStore.task

	mismatch := request
	mismatch.RequestID = "request-mismatch"
	mismatch.AdditionalRepositories = []AdditionalRepositoryInput{{Key: "api", RepositoryPath: apiPath}}
	if _, err := service.OpenTask(context.Background(), mismatch); err != domain.ErrActiveTaskConflict {
		t.Fatalf("scope mismatch error=%v", err)
	}
	if taskStore.commits != 1 || !domain.RepositoryScopeMembershipEqual(original, *taskStore.task) || taskStore.task.TaskID != original.TaskID {
		t.Fatalf("scope mismatch changed task: %#v", taskStore.task)
	}

	observer.calls = nil
	resumed, err := service.OpenTask(context.Background(), OpenTaskRequest{RequestID: "request-resume", Host: domain.HostCodex, RepositoryPath: docsPath})
	if err != nil {
		t.Fatal(err)
	}
	if resumed.Created || resumed.Task.TaskID != created.Task.TaskID || resumed.Task.Revision != created.Task.Revision || resumed.Task.CurrentAction.ActionID != created.Task.CurrentAction.ActionID || resumed.Task.Repository.RepositoryIdentity != created.Task.Repository.RepositoryIdentity || !domain.RepositoryScopeMembershipEqual(resumed.Task, created.Task) {
		t.Fatalf("resume result=%#v created=%#v", resumed, created)
	}
	if taskStore.commits != 1 || strings.Join(observer.calls, ",") != docsPath {
		t.Fatalf("resume commits/calls=%d/%v", taskStore.commits, observer.calls)
	}
}

func TestMultiRepositoryOpenOperationDigestIncludesScopeInput(t *testing.T) {
	now := time.Date(2026, 8, 23, 6, 40, 0, 0, time.UTC)
	corePath, docsPath, apiPath := testPath("core"), testPath("docs"), testPath("api")
	bindings := map[string]domain.RepositoryBinding{
		corePath: multiRepositoryBinding(now, corePath, 'a'),
		docsPath: multiRepositoryBinding(now, docsPath, 'b'),
		apiPath:  multiRepositoryBinding(now, apiPath, 'c'),
	}
	open := func(path, key string) domain.Digest {
		service, _, _ := multiRepositoryService(t, now, bindings)
		request := multiRepositoryOpenRequest("request-same", corePath)
		request.PrimaryRepositoryKey = "core"
		request.AdditionalRepositories = []AdditionalRepositoryInput{{Key: domain.RepositoryKey(key), RepositoryPath: path}}
		result, err := service.OpenTask(context.Background(), request)
		if err != nil {
			t.Fatal(err)
		}
		return result.Task.LastOperation.PayloadDigest
	}
	if open(docsPath, "docs") == open(apiPath, "api") {
		t.Fatal("different repository scope inputs produced one open operation digest")
	}
}

func TestLinkedWorktreesOwnIndependentTasksAndClaims(t *testing.T) {
	ctx := context.Background()
	database, err := store.Open(ctx, filepath.Join(t.TempDir(), "linked-worktrees.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer database.Close()

	now := time.Date(2026, 8, 30, 1, 0, 0, 0, time.UTC)
	group := domain.Digest(strings.Repeat("a", 64))
	left := linkedWorktreeBinding(now, testPath("worktrees", "left"), group, 'b')
	right := linkedWorktreeBinding(now, testPath("worktrees", "right"), group, 'c')
	observer := &multiRepositoryObserver{bindings: map[string]domain.RepositoryBinding{
		left.CanonicalRoot:  left,
		right.CanonicalRoot: right,
	}}
	sequence := 0
	service, err := newService(database, observer, func() time.Time { return now }, func(prefix string) (domain.ID, error) {
		sequence++
		return domain.ID(fmt.Sprintf("%s-linked-%d", prefix, sequence)), nil
	})
	if err != nil {
		t.Fatal(err)
	}

	open := func(requestID domain.ID, path, request string) OpenTaskResult {
		result, openErr := service.OpenTask(ctx, OpenTaskRequest{
			RequestID: requestID, Host: domain.HostCodex, RepositoryPath: path,
			NewTask: &NewTaskInput{Request: request, KnownAcceptanceCriteria: []string{"The worktree owns an independent Task."}, VerificationBudget: domain.VerificationBudget{Level: domain.VerificationTargeted, MaxAutomaticCommands: 2}, MethodProfile: domain.MethodPlain},
		})
		if openErr != nil {
			t.Fatalf("open %s: %v", path, openErr)
		}
		return result
	}
	leftTask := open("request-left", left.CanonicalRoot, "Implement the left change.")
	rightTask := open("request-right", right.CanonicalRoot, "Implement the right change.")
	if !leftTask.Created || !rightTask.Created || leftTask.Task.TaskID == rightTask.Task.TaskID {
		t.Fatalf("linked worktree tasks were not independent: left=%+v right=%+v", leftTask, rightTask)
	}
	if leftTask.Task.Repository.GitCommonDirDigest != rightTask.Task.Repository.GitCommonDirDigest ||
		leftTask.Task.Repository.RepositoryIdentity == rightTask.Task.Repository.RepositoryIdentity {
		t.Fatalf("linked worktree grouping or identity is incorrect: left=%+v right=%+v", leftTask.Task.Repository, rightTask.Task.Repository)
	}
	center := &ControlCenter{core: service, tasks: database}
	listed, err := center.ListTasks(ctx, ListControlCenterTasksRequest{Filter: TaskListFilter{Page: 1}})
	if err != nil || len(listed.Items) != 2 {
		t.Fatalf("list linked worktree tasks=%+v err=%v", listed, err)
	}
	paths := map[string]bool{}
	for _, item := range listed.Items {
		if item.RepositoryGroupID != group {
			t.Fatalf("task %s group=%s want=%s", item.TaskID, item.RepositoryGroupID, group)
		}
		paths[item.WorktreePath] = true
	}
	if !paths[left.CanonicalRoot] || !paths[right.CanonicalRoot] {
		t.Fatalf("linked worktree paths=%v", paths)
	}

	conflict := OpenTaskRequest{RequestID: "request-left-conflict", Host: domain.HostCodex, RepositoryPath: left.CanonicalRoot, NewTask: &NewTaskInput{Request: "A different left task.", KnownAcceptanceCriteria: []string{"A second Task is rejected."}, VerificationBudget: domain.VerificationBudget{Level: domain.VerificationTargeted, MaxAutomaticCommands: 1}, MethodProfile: domain.MethodPlain}}
	if _, conflictErr := service.OpenTask(ctx, conflict); !errors.Is(conflictErr, domain.ErrActiveTaskConflict) {
		t.Fatalf("same-worktree conflict error=%v", conflictErr)
	}

	payload := phase5Payload(t, leftTask.Task, "requirements_ready", "", requirementsNodeResult("Complete the left task.", []string{"The left Task advances independently."}))
	action := leftTask.Task.CurrentAction
	advanced, err := service.ApplyAction(ctx, ApplyActionRequest{RequestID: "apply-left", Host: domain.HostCodex, TaskID: leftTask.Task.TaskID, ExpectedRevision: leftTask.Task.Revision, ActionID: action.ActionID, ActionKind: action.Kind, ProcessID: leftTask.Task.Process.ID, ProcessDefinitionDigest: leftTask.Task.Process.DefinitionDigest, SourceCursor: leftTask.Task.CurrentNode, RepositoryBindingDigest: action.RepositoryBindingDigest, Payload: payload})
	if err != nil || advanced.Task.Revision != 2 || advanced.Task.CurrentNode != domain.NodeDesign {
		t.Fatalf("advance left=%+v err=%v", advanced, err)
	}
	retainedRight, err := database.LoadTask(ctx, rightTask.Task.TaskID)
	if err != nil || retainedRight.Revision != 1 || retainedRight.CurrentNode != domain.NodeRequirements {
		t.Fatalf("right Task changed with left Task: right=%+v err=%v", retainedRight, err)
	}

	cancelled, err := service.CancelTask(ctx, CancelTaskRequest{RequestID: "cancel-left", Host: domain.HostCodex, TaskID: advanced.Task.TaskID, ExpectedRevision: advanced.Task.Revision, Reason: "Finish the isolation check."})
	if err != nil || cancelled.Task.CurrentNode != domain.NodeCancelled {
		t.Fatalf("cancel left=%+v err=%v", cancelled, err)
	}
	if _, err := database.LoadActiveTask(ctx, left.RepositoryIdentity); !errors.Is(err, store.ErrTaskNotFound) {
		t.Fatalf("left claim remains after cancellation: %v", err)
	}
	activeRight, err := database.LoadActiveTask(ctx, right.RepositoryIdentity)
	if err != nil || activeRight.TaskID != rightTask.Task.TaskID || activeRight.Revision != 1 {
		t.Fatalf("right claim changed after left cancellation: right=%+v err=%v", activeRight, err)
	}
}

func multiRepositoryService(t *testing.T, now time.Time, bindings map[string]domain.RepositoryBinding) (*Service, *multiRepositoryStore, *multiRepositoryObserver) {
	t.Helper()
	taskStore := &multiRepositoryStore{}
	observer := &multiRepositoryObserver{bindings: bindings}
	service, err := newService(taskStore, observer, func() time.Time { return now }, func(prefix string) (domain.ID, error) {
		return domain.ID(prefix + "-multi"), nil
	})
	if err != nil {
		t.Fatal(err)
	}
	return service, taskStore, observer
}

func multiRepositoryOpenRequest(requestID domain.ID, repositoryPath string) OpenTaskRequest {
	return OpenTaskRequest{
		RequestID:      requestID,
		Host:           domain.HostCodex,
		RepositoryPath: repositoryPath,
		NewTask: &NewTaskInput{
			Request:            "Update one bounded feature.",
			VerificationBudget: domain.VerificationBudget{Level: domain.VerificationTargeted, MaxAutomaticCommands: 2},
			MethodProfile:      domain.MethodPlain,
		},
	}
}

func multiRepositoryBinding(now time.Time, root string, marker byte) domain.RepositoryBinding {
	digest := domain.Digest(strings.Repeat(string(marker), 64))
	branch := "main"
	head := strings.Repeat(string(marker), 40)
	return domain.RepositoryBinding{
		CanonicalRoot:       root,
		GitCommonDirDigest:  digest,
		RepositoryIdentity:  digest,
		Branch:              &branch,
		Head:                &head,
		WorktreeFingerprint: digest,
		ObservedAt:          now,
		BindingDigest:       digest,
	}
}

func linkedWorktreeBinding(now time.Time, root string, group domain.Digest, marker byte) domain.RepositoryBinding {
	digest := domain.Digest(strings.Repeat(string(marker), 64))
	branch := "main"
	head := strings.Repeat("d", 40)
	return domain.RepositoryBinding{
		CanonicalRoot:       root,
		GitCommonDirDigest:  group,
		RepositoryIdentity:  digest,
		Branch:              &branch,
		Head:                &head,
		WorktreeFingerprint: digest,
		ObservedAt:          now,
		BindingDigest:       digest,
	}
}

func multiRepositoryInputs(count int) []AdditionalRepositoryInput {
	inputs := make([]AdditionalRepositoryInput, count)
	for i := range inputs {
		name := "repo" + string(rune('a'+i))
		inputs[i] = AdditionalRepositoryInput{Key: domain.RepositoryKey(name), RepositoryPath: testPath(name)}
	}
	return inputs
}
