package store

import (
	"context"
	"time"

	"github.com/Innocent-children/dev-flow/internal/domain"
)

// Store is the single persistence port for authoritative task snapshots. A
// committed mutation always contains its compact audit event and repository
// claim operation; callers cannot write those records independently.
type Store interface {
	LoadTask(context.Context, domain.ID) (domain.Task, error)
	LoadActiveTask(context.Context, domain.Digest) (domain.Task, error)
	CommitTask(context.Context, TaskMutation) error
}

// ClaimOperation describes the repository-claim effect committed with a task
// snapshot. It is intentionally closed and is not a general table operation.
type ClaimOperation string

const (
	ClaimAcquire ClaimOperation = "acquire"
	ClaimRetain  ClaimOperation = "retain"
	ClaimRelease ClaimOperation = "release"
)

// TaskMutation is one exact task transaction. ExpectedRevision zero denotes
// creation of revision 1; every other mutation compares the existing task row
// against ExpectedRevision before writing the next revision.
type TaskMutation struct {
	ExpectedRevision uint64
	Task             domain.Task
	Event            TaskEvent
	Claim            ClaimOperation
}

// TaskEvent is the bounded audit fact stored with a committed task snapshot.
// It does not contain task contract text, source content, diffs, or raw output.
type TaskEvent struct {
	EventID       domain.ID
	TaskID        domain.ID
	Revision      uint64
	Kind          domain.OperationKind
	PhaseBefore   domain.Phase
	PhaseAfter    domain.Phase
	ActionID      *domain.ID
	RequestID     domain.ID
	PayloadDigest domain.Digest
	CreatedAt     time.Time
}

var _ Store = (*SQLite)(nil)
