package application

import (
	"github.com/Innocent-children/dev-flow/internal/domain"
	"github.com/Innocent-children/dev-flow/internal/recovery"
	"github.com/Innocent-children/dev-flow/internal/workflow"
)

// OpenTaskRequest either creates a governed task from NewTask or resumes the
// active task for the observed repository when NewTask is nil.
type OpenTaskRequest struct {
	RequestID      domain.ID
	Host           domain.Host
	RepositoryPath string
	NewTask        *NewTaskInput
}

// NewTaskInput contains only caller-owned contract fields. Task, action,
// revision, repository, and workflow identity remain Core-owned.
type NewTaskInput struct {
	Goal               string
	Scope              []string
	OutOfScope         []string
	AcceptanceCriteria []string
	VerificationBudget domain.VerificationBudget
}

// OpenTaskResult identifies whether this call created a task or resumed the
// persisted active task.
type OpenTaskResult struct {
	Created bool
	Task    domain.Task
}

type OperationProbe struct {
	OperationID             domain.ID
	SourcePhase             domain.Phase
	ExpectedRevision        uint64
	ActionID                domain.ID
	ActionKind              domain.ActionKind
	RepositoryBindingDigest domain.Digest
	Payload                 workflow.ActionPayload
}

type GetTaskRequest struct {
	Host           domain.Host
	TaskID         domain.ID
	OperationProbe *OperationProbe
}

type GetNextActionRequest struct {
	Host           domain.Host
	TaskID         domain.ID
	OperationProbe *OperationProbe
}

type GetTaskResult struct {
	Task               domain.Task
	RecoveryAssessment *recovery.RecoveryAssessment
}

// NextActionResult is the persisted next-action projection for one task.
// Terminal tasks carry Outcome instead of Action.
type NextActionResult struct {
	TaskID             domain.ID
	Phase              domain.Phase
	Revision           uint64
	Action             *domain.Action
	Blocker            *domain.Blocker
	Outcome            *domain.Outcome
	RecoveryAssessment *recovery.RecoveryAssessment
}

// ApplyActionRequest binds one closed payload to the exact persisted action
// identity and issuance repository binding.
type ApplyActionRequest struct {
	RequestID               domain.ID
	Host                    domain.Host
	TaskID                  domain.ID
	ExpectedRevision        uint64
	ActionID                domain.ID
	ActionKind              domain.ActionKind
	RepositoryBindingDigest domain.Digest
	Payload                 workflow.ActionPayload
	RecoveryApply           *RecoveryApplyInput
}

type RecoveryApplyInput struct {
	OperationID domain.ID
	SourcePhase domain.Phase
}

type ApplyActionResult struct {
	Task domain.Task
}

// CancelTaskRequest explicitly terminates one host-owned task without using
// or regenerating its current action identity.
type CancelTaskRequest struct {
	RequestID        domain.ID
	Host             domain.Host
	TaskID           domain.ID
	ExpectedRevision uint64
	Reason           string
}

type CancelTaskResult struct {
	Task domain.Task
}
