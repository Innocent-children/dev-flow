package application

import (
	"runtime"
	"testing"
	"time"

	"github.com/Innocent-children/dev-flow/internal/domain"
)

func TestNewServiceValidatesDependenciesWithoutSideEffects(t *testing.T) {
	taskStore := &recordingStore{}
	observer := &fixedRepositoryObserver{binding: testBinding()}

	if service, err := NewService(nil, observer); service != nil || err == nil {
		t.Fatalf("NewService(nil, observer) = (%v, %v), want nil error result", service, err)
	} else {
		requireError(t, err, domain.ErrInvalidArgument)
	}
	if service, err := NewService(taskStore, nil); service != nil || err == nil {
		t.Fatalf("NewService(store, nil) = (%v, %v), want nil error result", service, err)
	} else {
		requireError(t, err, domain.ErrInvalidArgument)
	}
	var typedNilStore *recordingStore
	if service, err := NewService(typedNilStore, observer); service != nil || err == nil {
		t.Fatalf("NewService(typed nil store, observer) = (%v, %v), want rejection", service, err)
	} else {
		requireError(t, err, domain.ErrInvalidArgument)
	}
	var typedNilObserver *fixedRepositoryObserver
	if service, err := NewService(taskStore, typedNilObserver); service != nil || err == nil {
		t.Fatalf("NewService(store, typed nil observer) = (%v, %v), want rejection", service, err)
	} else {
		requireError(t, err, domain.ErrInvalidArgument)
	}

	nowCalls := 0
	idCalls := 0
	service, err := newService(
		taskStore,
		observer,
		func() time.Time {
			nowCalls++
			return testTime()
		},
		func(string) (domain.ID, error) {
			idCalls++
			return "unexpected", nil
		},
	)
	if err != nil || service == nil {
		t.Fatalf("newService(valid dependencies) = (%v, %v)", service, err)
	}
	runtime.Gosched()
	if taskStore.loadTaskCalls != 0 || taskStore.loadActiveTaskCalls != 0 || taskStore.commitTaskCalls != 0 {
		t.Fatalf("constructor accessed store: %#v", taskStore)
	}
	if observer.calls != 0 {
		t.Fatalf("constructor observed repository %d times", observer.calls)
	}
	if nowCalls != 0 || idCalls != 0 {
		t.Fatalf("constructor started work: now calls %d, ID calls %d", nowCalls, idCalls)
	}
}
