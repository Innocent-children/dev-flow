package application

import (
	"encoding/json"
	"time"

	"github.com/Innocent-children/dev-flow/internal/domain"
	"github.com/Innocent-children/dev-flow/internal/recovery"
	"github.com/Innocent-children/dev-flow/internal/store"
	"github.com/Innocent-children/dev-flow/internal/workflow"
)

type TaskListFilter struct {
	Text        string
	Host        domain.Host
	Repository  string
	Node        domain.NodeID
	Lifecycle   string
	UpdatedFrom *time.Time
	UpdatedTo   *time.Time
	Page        int
}

type ListControlCenterTasksRequest struct {
	Filter TaskListFilter
}

type GetControlCenterTaskRequest struct {
	TaskID domain.ID
}

type ControlCenterTaskSummary struct {
	TaskID         domain.ID
	RequestSummary string
	OriginHost     domain.Host
	ExecutionHost  domain.Host
	CurrentNode    domain.NodeID
	Lifecycle      string
	Revision       uint64
	UpdatedAt      time.Time
	Archived       bool
	RepositoryKeys []domain.RepositoryKey
	Blocker        *string
	Outcome        *string
}

type ControlCenterTaskList struct {
	Page    int
	HasNext bool
	Items   []ControlCenterTaskSummary
}

type ControlCenterDashboard struct {
	Counts map[string]int
	Recent []ControlCenterTaskSummary
}

type ControlCenterTaskDetail struct {
	Task     domain.ProcessTask
	Archived bool
	Events   []store.TaskEvent
	Graph    workflow.ControlCenterGraph
	ReadOnly bool
}

type SetTaskArchiveRequest struct {
	RequestID        domain.ID
	TaskID           domain.ID
	ExpectedRevision uint64
	Archived         bool
}

type PurgeControlCenterTaskRequest struct {
	RequestID        domain.ID
	TaskID           domain.ID
	ExpectedRevision uint64
	TypedTaskID      domain.ID
	Reason           string
	Irreversible     bool
}

type CancelControlCenterTaskRequest struct {
	RequestID        domain.ID
	TaskID           domain.ID
	ExpectedRevision uint64
	Reason           string
	Confirmed        bool
}

type ControlCenterMutationResult struct {
	Task     *domain.ProcessTask
	Archived *bool
	Purged   bool
}

type NewTaskInput struct {
	Request                 string
	InitialScope            []string
	InitialOutOfScope       []string
	KnownAcceptanceCriteria []string
	VerificationBudget      domain.VerificationBudget
	MethodProfile           domain.MethodProfile
}
type AdditionalRepositoryInput struct {
	Key            domain.RepositoryKey `json:"key"`
	RepositoryPath string               `json:"repository_path"`
}
type OpenTaskRequest struct {
	RequestID              domain.ID
	Host                   domain.Host
	RepositoryPath         string
	PrimaryRepositoryKey   domain.RepositoryKey
	AdditionalRepositories []AdditionalRepositoryInput
	NewTask                *NewTaskInput
}
type OpenTaskResult struct {
	Created bool
	Task    domain.ProcessTask
}
type OperationProbe struct {
	OperationID             domain.ID
	ProcessID               domain.ProcessID
	ProcessDefinitionDigest domain.Digest
	SourceCursor            domain.NodeID
	ExpectedRevision        uint64
	ActionID                domain.ID
	ActionKind              domain.ActionKind
	RepositoryBindingDigest domain.Digest
	Payload                 json.RawMessage
}

func (p OperationProbe) Reference() domain.OperationReference {
	return domain.OperationReference{OperationID: p.OperationID, Process: domain.ProcessReference{ID: p.ProcessID, DefinitionDigest: p.ProcessDefinitionDigest}, SourceCursor: p.SourceCursor, ExpectedRevision: p.ExpectedRevision, ActionID: p.ActionID, ActionKind: p.ActionKind, RepositoryBindingDigest: p.RepositoryBindingDigest}
}

type RecoveryApplyInput struct {
	OperationID  domain.ID
	SourceCursor domain.NodeID
}
type GetTaskRequest struct {
	Host           domain.Host
	TaskID         domain.ID
	OperationProbe *OperationProbe
}
type GetTaskResult struct {
	Task               domain.ProcessTask
	RecoveryAssessment *recovery.RecoveryAssessment
}
type GetNextActionRequest struct {
	Host           domain.Host
	TaskID         domain.ID
	OperationProbe *OperationProbe
}
type NextActionResult struct {
	TaskID             domain.ID
	Process            domain.ProcessReference
	CurrentNode        domain.NodeID
	Revision           uint64
	MethodProfile      domain.MethodProfile
	Action             *domain.ProcessAction
	Outcome            *domain.ProcessOutcome
	Blocker            *domain.ProcessBlocker
	RecoveryAssessment *recovery.RecoveryAssessment
}
type ApplyActionRequest struct {
	RequestID               domain.ID
	Host                    domain.Host
	TaskID                  domain.ID
	ExpectedRevision        uint64
	ActionID                domain.ID
	ActionKind              domain.ActionKind
	ProcessID               domain.ProcessID
	ProcessDefinitionDigest domain.Digest
	SourceCursor            domain.NodeID
	RepositoryBindingDigest domain.Digest
	Payload                 json.RawMessage
	RecoveryApply           *RecoveryApplyInput
}
type ApplyActionResult struct{ Task domain.ProcessTask }
type CancelTaskRequest struct {
	RequestID        domain.ID
	Host             domain.Host
	TaskID           domain.ID
	ExpectedRevision uint64
	Reason           string
}
type CancelTaskResult struct{ Task domain.ProcessTask }
