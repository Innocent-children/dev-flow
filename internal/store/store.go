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

type ActionOperationStore interface {
	Store
	LoadActionOperation(context.Context, domain.ID) (ActionOperation, bool, error)
	StageActionOperation(context.Context, domain.ProcessTask, domain.ActionCommit) error
	CommitActionOperation(context.Context, domain.ID, TaskMutation) error
}

type ActionOperation struct {
	TaskID          domain.ID
	Commit          domain.ActionCommit
	AppliedRevision *uint64
}

type TaskListQuery struct {
	Text        string
	Host        domain.Host
	Repository  string
	Node        domain.NodeID
	Lifecycle   string
	UpdatedFrom *time.Time
	UpdatedTo   *time.Time
	Page        int
	PageSize    int
}

type ControlCenterTask struct {
	Task       domain.ProcessTask
	ArchivedAt *time.Time
	Events     []TaskEvent
}

type ControlCenterTaskPage struct {
	Items   []ControlCenterTask
	Page    int
	HasNext bool
}

type ArchiveTaskMutation struct {
	TaskID           domain.ID
	ExpectedRevision uint64
	Archived         bool
	ArchivedAt       time.Time
}

type PurgeTaskMutation struct {
	TaskID           domain.ID
	ExpectedRevision uint64
	TypedTaskID      domain.ID
	Reason           string
	Irreversible     bool
}

// ControlCenterStore owns existing Task persistence and the bounded read models used by ControlCenter.
type ControlCenterStore interface {
	Store
	ListControlCenterTasks(context.Context, TaskListQuery) (ControlCenterTaskPage, error)
	LoadControlCenterTask(context.Context, domain.ID) (ControlCenterTask, error)
	LoadTaskEvents(context.Context, domain.ID) ([]TaskEvent, error)
	SetTaskArchived(context.Context, ArchiveTaskMutation) (*time.Time, error)
	PurgeTask(context.Context, PurgeTaskMutation) error
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

func repositoryClaimIdentities(task domain.ProcessTask) []domain.Digest {
	identities := make([]domain.Digest, 0, len(task.AdditionalRepositories)+1)
	identities = append(identities, task.Repository.RepositoryIdentity)
	for _, entry := range task.AdditionalRepositories {
		identities = append(identities, entry.Binding.RepositoryIdentity)
	}
	return identities
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
var _ ActionOperationStore = (*SQLite)(nil)
