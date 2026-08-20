package store

import (
	"context"
	"time"

	"github.com/Innocent-children/dev-flow/internal/domain"
)

type Store interface {
	LoadTask(context.Context, domain.ID) (domain.ProcessTask, error)
	LoadActiveTask(context.Context, domain.Digest) (domain.ProcessTask, error)
	CommitTask(context.Context, TaskMutation) error
}
type ClaimOperation string

const (
	ClaimAcquire ClaimOperation = "acquire"
	ClaimRetain  ClaimOperation = "retain"
	ClaimRelease ClaimOperation = "release"
)

type TaskMutation struct {
	ExpectedRevision uint64
	Task             domain.ProcessTask
	Event            TaskEvent
	Claim            ClaimOperation
}
type TaskEvent struct {
	EventID          domain.ID
	TaskID           domain.ID
	Revision         uint64
	Kind             domain.OperationKind
	SourceNode       domain.NodeID
	DestinationNode  domain.NodeID
	TransitionID     *domain.TransitionID
	TransitionReason string
	ActionID         *domain.ID
	RequestID        domain.ID
	PayloadDigest    domain.Digest
	CreatedAt        time.Time
}

var _ Store = (*SQLite)(nil)
