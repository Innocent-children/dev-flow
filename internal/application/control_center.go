package application

import (
	"github.com/Innocent-children/dev-flow/internal/domain"
	"github.com/Innocent-children/dev-flow/internal/repository"
	"github.com/Innocent-children/dev-flow/internal/store"
)

// ControlCenter exposes Web-facing use cases; Service owns workflow behavior and ControlCenterStore owns persistence.
type ControlCenter struct {
	core  *Service
	tasks store.ControlCenterStore
}

func NewControlCenter(tasks store.ControlCenterStore, observer repository.RepositoryObserver) (*ControlCenter, error) {
	if nilPort(tasks) || nilPort(observer) {
		return nil, domain.ErrInvalidArgument
	}
	core, err := NewService(tasks, observer)
	if err != nil {
		return nil, err
	}
	return &ControlCenter{core: core, tasks: tasks}, nil
}

func (c *ControlCenter) valid() bool {
	return c != nil && c.core != nil && c.core.valid() && !nilPort(c.tasks)
}
