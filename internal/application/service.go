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
	"github.com/Innocent-children/dev-flow/internal/workflow"
)

type idGenerator func(string) (domain.ID, error)
type Service struct {
	taskStore          store.Store
	repositoryObserver repository.RepositoryObserver
	now                func() time.Time
	newID              idGenerator
}

func NewService(s store.Store, o repository.RepositoryObserver) (*Service, error) {
	return newService(s, o, func() time.Time { return time.Now().UTC() }, randomID)
}
func newService(s store.Store, o repository.RepositoryObserver, now func() time.Time, id idGenerator) (*Service, error) {
	if nilPort(s) || nilPort(o) || now == nil || id == nil {
		return nil, domain.ErrInvalidArgument
	}
	return &Service{taskStore: s, repositoryObserver: o, now: now, newID: id}, nil
}
func nilPort(v any) bool {
	if v == nil {
		return true
	}
	r := reflect.ValueOf(v)
	return r.Kind() == reflect.Pointer && r.IsNil()
}
func (s *Service) valid() bool {
	return s != nil && !nilPort(s.taskStore) && !nilPort(s.repositoryObserver)
}
func randomID(prefix string) (domain.ID, error) {
	var b [16]byte
	if _, err := rand.Read(b[:]); err != nil {
		return "", err
	}
	return domain.ID(prefix + "-" + hex.EncodeToString(b[:])), nil
}
func (s *Service) id(prefix string) (domain.ID, error) {
	id, err := s.newID(prefix)
	if err != nil || !id.IsValid() {
		return "", domain.ErrInternal
	}
	return id, nil
}
func mapStoreError(err error) error {
	switch {
	case errors.Is(err, store.ErrInvalidArgument):
		return domain.ErrInvalidArgument
	case errors.Is(err, store.ErrTaskNotFound):
		return domain.ErrTaskNotFound
	case errors.Is(err, store.ErrActiveTaskConflict):
		return domain.ErrActiveTaskConflict
	case errors.Is(err, store.ErrRevisionConflict):
		return domain.ErrRevisionConflict
	case errors.Is(err, store.ErrTaskTerminal):
		return domain.ErrTaskTerminal
	case errors.Is(err, store.ErrSchemaUnsupported):
		return domain.ErrSchemaUnsupported
	case errors.Is(err, store.ErrProcessUnsupported):
		return domain.ErrProcessUnsupported
	case errors.Is(err, store.ErrStorageUnavailable):
		return domain.ErrStorageUnavailable
	default:
		return domain.ErrInternal
	}
}
func (s *Service) loadOwned(ctx context.Context, host domain.Host, id domain.ID) (domain.ProcessTask, error) {
	task, err := s.taskStore.LoadTask(ctx, id)
	if err != nil {
		return domain.ProcessTask{}, mapStoreError(err)
	}
	if task.OriginHost != host {
		return domain.ProcessTask{}, domain.ErrHostOwnershipConflict
	}
	if workflow.ValidateProcessTask(task) != nil {
		return domain.ProcessTask{}, domain.ErrStorageUnavailable
	}
	return task, nil
}
