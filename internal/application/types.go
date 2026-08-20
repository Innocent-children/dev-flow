package application

import (
	"encoding/json"
	"github.com/Innocent-children/dev-flow/internal/domain"
	"github.com/Innocent-children/dev-flow/internal/recovery"
)

type NewTaskInput struct {
	Request                 string
	InitialScope            []string
	InitialOutOfScope       []string
	KnownAcceptanceCriteria []string
	VerificationBudget      domain.VerificationBudget
	MethodProfile           domain.MethodProfile
}
type OpenTaskRequest struct {
	RequestID      domain.ID
	Host           domain.Host
	RepositoryPath string
	NewTask        *NewTaskInput
}
type OpenTaskResult struct {
	Created bool
	Task    domain.ProcessTask
}
type OperationProbe struct {
	OperationID             domain.ID
	ProcessID               domain.ProcessID
	ProcessVersion          uint32
	ProcessDefinitionDigest domain.Digest
	SourceCursor            domain.NodeID
	ExpectedRevision        uint64
	ActionID                domain.ID
	ActionKind              domain.ActionKind
	RepositoryBindingDigest domain.Digest
	Payload                 json.RawMessage
}

func (p OperationProbe) Reference() domain.OperationReference {
	return domain.OperationReference{OperationID: p.OperationID, Process: domain.ProcessReference{ID: p.ProcessID, Version: p.ProcessVersion, DefinitionDigest: p.ProcessDefinitionDigest}, SourceCursor: p.SourceCursor, ExpectedRevision: p.ExpectedRevision, ActionID: p.ActionID, ActionKind: p.ActionKind, RepositoryBindingDigest: p.RepositoryBindingDigest}
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
	Action             *domain.ProcessActionV2
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
	ProcessVersion          uint32
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
