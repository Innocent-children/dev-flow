package application

import (
	"github.com/Innocent-children/dev-flow/internal/domain"
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

// NextActionResult is the persisted next-action projection for one task.
// Terminal tasks carry Outcome instead of Action.
type NextActionResult struct {
	TaskID   domain.ID
	Phase    domain.Phase
	Revision uint64
	Action   *domain.Action
	Outcome  *domain.Outcome
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
