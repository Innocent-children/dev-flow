package application

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"reflect"
	"time"

	"github.com/Innocent-children/dev-flow/internal/domain"
	"github.com/Innocent-children/dev-flow/internal/repository"
	"github.com/Innocent-children/dev-flow/internal/store"
)

type idGenerator func(prefix string) (domain.ID, error)

// Service coordinates the bounded application use cases. It owns no global
// state and starts no background work.
type Service struct {
	taskStore          store.Store
	repositoryObserver repository.RepositoryObserver
	now                func() time.Time
	newID              idGenerator
}

// NewService constructs an application service without opening storage or
// observing a repository.
func NewService(
	taskStore store.Store,
	repositoryObserver repository.RepositoryObserver,
) (*Service, error) {
	return newService(taskStore, repositoryObserver, func() time.Time {
		return time.Now().UTC()
	}, randomID)
}

func newService(
	taskStore store.Store,
	repositoryObserver repository.RepositoryObserver,
	now func() time.Time,
	newID idGenerator,
) (*Service, error) {
	if nilStore(taskStore) || nilRepositoryObserver(repositoryObserver) || now == nil || newID == nil {
		return nil, domain.ErrInvalidArgument
	}
	return &Service{
		taskStore:          taskStore,
		repositoryObserver: repositoryObserver,
		now:                now,
		newID:              newID,
	}, nil
}

func nilStore(taskStore store.Store) bool {
	if taskStore == nil {
		return true
	}
	value := reflect.ValueOf(taskStore)
	return value.Kind() == reflect.Pointer && value.IsNil()
}

func nilRepositoryObserver(observer repository.RepositoryObserver) bool {
	if observer == nil {
		return true
	}
	value := reflect.ValueOf(observer)
	return value.Kind() == reflect.Pointer && value.IsNil()
}

func (s *Service) valid() bool {
	return s != nil && !nilStore(s.taskStore) && !nilRepositoryObserver(s.repositoryObserver) && s.now != nil && s.newID != nil
}

func randomID(prefix string) (domain.ID, error) {
	var entropy [16]byte
	if _, err := rand.Read(entropy[:]); err != nil {
		return "", err
	}
	id := domain.ID(prefix + "-" + hex.EncodeToString(entropy[:]))
	if !id.IsValid() {
		return "", domain.ErrInternal
	}
	return id, nil
}

func (s *Service) generateID(prefix string) (domain.ID, error) {
	id, err := s.newID(prefix)
	if err != nil || !id.IsValid() {
		return "", domain.ErrInternal
	}
	return id, nil
}

func validateReadRequest(ctx context.Context, host domain.Host, taskID domain.ID) error {
	if ctx == nil || !host.IsValid() || !taskID.IsValid() {
		return domain.ErrInvalidArgument
	}
	return nil
}

func contextFailure(ctx context.Context, err error) error {
	if ctx != nil && ctx.Err() != nil {
		return ctx.Err()
	}
	if errors.Is(err, context.Canceled) {
		return context.Canceled
	}
	if errors.Is(err, context.DeadlineExceeded) {
		return context.DeadlineExceeded
	}
	return nil
}

func mapStoreError(ctx context.Context, err error) error {
	if err == nil {
		return nil
	}
	if contextErr := contextFailure(ctx, err); contextErr != nil {
		return contextErr
	}
	switch {
	case errors.Is(err, store.ErrTaskNotFound):
		return domain.ErrTaskNotFound
	case errors.Is(err, store.ErrActiveTaskConflict):
		return domain.ErrActiveTaskConflict
	case errors.Is(err, store.ErrSchemaUnsupported):
		return domain.ErrSchemaUnsupported
	case errors.Is(err, store.ErrStorageUnavailable):
		return domain.ErrStorageUnavailable
	default:
		return domain.ErrInternal
	}
}

func mapRepositoryError(ctx context.Context, err error) error {
	if contextErr := contextFailure(ctx, err); contextErr != nil {
		return contextErr
	}
	switch {
	case errors.Is(err, repository.ErrInvalidRepositoryPath):
		return domain.ErrInvalidArgument
	case errors.Is(err, repository.ErrNotGitRepository):
		return domain.ErrNotGitRepository
	default:
		return domain.ErrInternal
	}
}

func (s *Service) loadOwnedTask(
	ctx context.Context,
	host domain.Host,
	taskID domain.ID,
) (domain.Task, error) {
	task, err := s.taskStore.LoadTask(ctx, taskID)
	if err != nil {
		return domain.Task{}, mapStoreError(ctx, err)
	}
	if task.OriginHost != host {
		return domain.Task{}, domain.ErrHostOwnershipConflict
	}
	return task, nil
}
