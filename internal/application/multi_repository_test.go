package application

import (
	"context"
	"errors"
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
		primary := multiRepositoryBinding(now, "/core", 'a')
		service, taskStore, observer := multiRepositoryService(t, now, map[string]domain.RepositoryBinding{"/core": primary})
		result, err := service.OpenTask(context.Background(), multiRepositoryOpenRequest("request-single", "/core"))
		if err != nil {
			t.Fatal(err)
		}
		if !result.Created || taskStore.commits != 1 || len(result.Task.AdditionalRepositories) != 0 || result.Task.EffectivePrimaryRepositoryKey() != domain.DefaultPrimaryRepositoryKey {
			t.Fatalf("single repository result=%#v commits=%d", result, taskStore.commits)
		}
		if result.Task.CurrentAction.RepositoryBindingDigest != primary.BindingDigest || strings.Join(observer.calls, ",") != "/core" {
			t.Fatalf("single repository digest/calls=%s/%v", result.Task.CurrentAction.RepositoryBindingDigest, observer.calls)
		}
	})

	t.Run("primary and one additional share one action revision and digest", func(t *testing.T) {
		primary := multiRepositoryBinding(now, "/core", 'a')
		docs := multiRepositoryBinding(now, "/docs", 'b')
		service, taskStore, observer := multiRepositoryService(t, now, map[string]domain.RepositoryBinding{"/core": primary, "/docs": docs})
		request := multiRepositoryOpenRequest("request-multi", "/core")
		request.PrimaryRepositoryKey = "core"
		request.AdditionalRepositories = []AdditionalRepositoryInput{{Key: "docs", RepositoryPath: "/docs"}}
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
		if len(result.Task.AdditionalRepositories) != 1 || result.Task.AdditionalRepositories[0].Key != "docs" || strings.Join(observer.calls, ",") != "/core,/docs" {
			t.Fatalf("scope/calls=%#v/%v", result.Task.AdditionalRepositories, observer.calls)
		}
	})
}

func TestMultiRepositoryOpenObservesAdditionalRepositoriesByKey(t *testing.T) {
	now := time.Date(2026, 8, 23, 6, 10, 0, 0, time.UTC)
	bindings := map[string]domain.RepositoryBinding{
		"/core": multiRepositoryBinding(now, "/core", 'a'),
		"/api":  multiRepositoryBinding(now, "/api", 'b'),
		"/docs": multiRepositoryBinding(now, "/docs", 'c'),
	}
	service, _, observer := multiRepositoryService(t, now, bindings)
	request := multiRepositoryOpenRequest("request-order", "/core")
	request.PrimaryRepositoryKey = "core"
	request.AdditionalRepositories = []AdditionalRepositoryInput{{Key: "docs", RepositoryPath: "/docs"}, {Key: "api", RepositoryPath: "/api"}}
	result, err := service.OpenTask(context.Background(), request)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Join(observer.calls, ",") != "/core,/api,/docs" || result.Task.AdditionalRepositories[0].Key != "api" || result.Task.AdditionalRepositories[1].Key != "docs" {
		t.Fatalf("calls=%v scope=%#v", observer.calls, result.Task.AdditionalRepositories)
	}
}

func TestMultiRepositoryOpenRejectsInvalidScopeWithoutWrites(t *testing.T) {
	now := time.Date(2026, 8, 23, 6, 20, 0, 0, time.UTC)
	primary := multiRepositoryBinding(now, "/core", 'a')
	docs := multiRepositoryBinding(now, "/docs", 'b')
	duplicateIdentity := docs
	duplicateIdentity.RepositoryIdentity = primary.RepositoryIdentity
	bindings := map[string]domain.RepositoryBinding{"/core": primary, "/docs": docs, "/same": duplicateIdentity}

	tests := []struct {
		name       string
		additional []AdditionalRepositoryInput
		wantCalls  int
	}{
		{name: "duplicate key", additional: []AdditionalRepositoryInput{{Key: "docs", RepositoryPath: "/docs"}, {Key: "docs", RepositoryPath: "/docs"}}, wantCalls: 0},
		{name: "duplicate identity", additional: []AdditionalRepositoryInput{{Key: "same", RepositoryPath: "/same"}}, wantCalls: 2},
		{name: "ninth repository", additional: multiRepositoryInputs(8), wantCalls: 0},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			service, taskStore, observer := multiRepositoryService(t, now, bindings)
			request := multiRepositoryOpenRequest("request-invalid", "/core")
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
	bindings := map[string]domain.RepositoryBinding{
		"/core": multiRepositoryBinding(now, "/core", 'a'),
		"/docs": multiRepositoryBinding(now, "/docs", 'b'),
		"/api":  multiRepositoryBinding(now, "/api", 'c'),
	}
	service, taskStore, observer := multiRepositoryService(t, now, bindings)
	request := multiRepositoryOpenRequest("request-create", "/core")
	request.PrimaryRepositoryKey = "core"
	request.AdditionalRepositories = []AdditionalRepositoryInput{{Key: "docs", RepositoryPath: "/docs"}}
	created, err := service.OpenTask(context.Background(), request)
	if err != nil {
		t.Fatal(err)
	}
	original := *taskStore.task

	mismatch := request
	mismatch.RequestID = "request-mismatch"
	mismatch.AdditionalRepositories = []AdditionalRepositoryInput{{Key: "api", RepositoryPath: "/api"}}
	if _, err := service.OpenTask(context.Background(), mismatch); err != domain.ErrActiveTaskConflict {
		t.Fatalf("scope mismatch error=%v", err)
	}
	if taskStore.commits != 1 || !domain.RepositoryScopeMembershipEqual(original, *taskStore.task) || taskStore.task.TaskID != original.TaskID {
		t.Fatalf("scope mismatch changed task: %#v", taskStore.task)
	}

	observer.calls = nil
	resumed, err := service.OpenTask(context.Background(), OpenTaskRequest{RequestID: "request-resume", Host: domain.HostCodex, RepositoryPath: "/docs"})
	if err != nil {
		t.Fatal(err)
	}
	if resumed.Created || resumed.Task.TaskID != created.Task.TaskID || resumed.Task.Revision != created.Task.Revision || resumed.Task.CurrentAction.ActionID != created.Task.CurrentAction.ActionID || resumed.Task.Repository.RepositoryIdentity != created.Task.Repository.RepositoryIdentity || !domain.RepositoryScopeMembershipEqual(resumed.Task, created.Task) {
		t.Fatalf("resume result=%#v created=%#v", resumed, created)
	}
	if taskStore.commits != 1 || strings.Join(observer.calls, ",") != "/docs" {
		t.Fatalf("resume commits/calls=%d/%v", taskStore.commits, observer.calls)
	}
}

func TestMultiRepositoryOpenOperationDigestIncludesScopeInput(t *testing.T) {
	now := time.Date(2026, 8, 23, 6, 40, 0, 0, time.UTC)
	bindings := map[string]domain.RepositoryBinding{
		"/core": multiRepositoryBinding(now, "/core", 'a'),
		"/docs": multiRepositoryBinding(now, "/docs", 'b'),
		"/api":  multiRepositoryBinding(now, "/api", 'c'),
	}
	open := func(path, key string) domain.Digest {
		service, _, _ := multiRepositoryService(t, now, bindings)
		request := multiRepositoryOpenRequest("request-same", "/core")
		request.PrimaryRepositoryKey = "core"
		request.AdditionalRepositories = []AdditionalRepositoryInput{{Key: domain.RepositoryKey(key), RepositoryPath: path}}
		result, err := service.OpenTask(context.Background(), request)
		if err != nil {
			t.Fatal(err)
		}
		return result.Task.LastOperation.PayloadDigest
	}
	if open("/docs", "docs") == open("/api", "api") {
		t.Fatal("different repository scope inputs produced one open operation digest")
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

func multiRepositoryInputs(count int) []AdditionalRepositoryInput {
	inputs := make([]AdditionalRepositoryInput, count)
	for i := range inputs {
		inputs[i] = AdditionalRepositoryInput{Key: domain.RepositoryKey("repo" + string(rune('a'+i))), RepositoryPath: "/repo" + string(rune('a'+i))}
	}
	return inputs
}
