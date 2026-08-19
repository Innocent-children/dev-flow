package application

import (
	"encoding/json"
	"github.com/Innocent-children/dev-flow/internal/domain"
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
type GetTaskRequest struct {
	Host   domain.Host
	TaskID domain.ID
}
type GetTaskResult struct{ Task domain.ProcessTask }
type GetNextActionRequest struct {
	Host   domain.Host
	TaskID domain.ID
}
type NextActionResult struct {
	TaskID      domain.ID
	Process     domain.ProcessReference
	CurrentNode domain.NodeID
	Revision    uint64
	Action      *domain.ProcessActionV2
	Outcome     *domain.ProcessOutcome
}
type ApplyActionRequest struct {
	RequestID               domain.ID
	Host                    domain.Host
	TaskID                  domain.ID
	ExpectedRevision        uint64
	ActionID                domain.ID
	ActionKind              domain.ActionKind
	ProcessDefinitionDigest domain.Digest
	RepositoryBindingDigest domain.Digest
	Payload                 json.RawMessage
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
