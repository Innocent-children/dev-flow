package domain

type ErrorCode string

const (
	ErrorInvalidArgument            ErrorCode = "INVALID_ARGUMENT"
	ErrorNotGitRepository           ErrorCode = "NOT_GIT_REPOSITORY"
	ErrorTaskNotFound               ErrorCode = "TASK_NOT_FOUND"
	ErrorActiveTaskConflict         ErrorCode = "ACTIVE_TASK_CONFLICT"
	ErrorHostOwnershipConflict      ErrorCode = "HOST_OWNERSHIP_CONFLICT"
	ErrorRevisionConflict           ErrorCode = "REVISION_CONFLICT"
	ErrorActionStale                ErrorCode = "ACTION_STALE"
	ErrorRepositoryDrift            ErrorCode = "REPOSITORY_DRIFT"
	ErrorVerificationBudgetExceeded ErrorCode = "VERIFICATION_BUDGET_EXCEEDED"
	ErrorTaskBlocked                ErrorCode = "TASK_BLOCKED"
	ErrorTaskTerminal               ErrorCode = "TASK_TERMINAL"
	ErrorSchemaUnsupported          ErrorCode = "SCHEMA_UNSUPPORTED"
	ErrorProcessUnsupported         ErrorCode = "PROCESS_UNSUPPORTED"
	ErrorStorageUnavailable         ErrorCode = "STORAGE_UNAVAILABLE"
	ErrorInternal                   ErrorCode = "INTERNAL_ERROR"
)

func (c ErrorCode) IsValid() bool {
	switch c {
	case ErrorInvalidArgument, ErrorNotGitRepository, ErrorTaskNotFound, ErrorActiveTaskConflict,
		ErrorHostOwnershipConflict, ErrorRevisionConflict, ErrorActionStale, ErrorRepositoryDrift,
		ErrorVerificationBudgetExceeded, ErrorTaskBlocked, ErrorTaskTerminal,
		ErrorSchemaUnsupported, ErrorProcessUnsupported, ErrorStorageUnavailable, ErrorInternal:
		return true
	default:
		return false
	}
}

// Error is a stable, typed, non-sensitive domain failure.
type Error struct {
	Code    ErrorCode
	Message string
}

func (e *Error) Error() string {
	if e == nil {
		return ""
	}
	return string(e.Code) + ": " + e.Message
}

func (e *Error) Is(target error) bool {
	other, ok := target.(*Error)
	return ok && e != nil && e.Code == other.Code
}

func NewError(code ErrorCode, message string) *Error {
	if !code.IsValid() {
		code = ErrorInternal
	}
	if normalized, err := normalizeRequiredText(message, MaxErrorMessageBytes); err == nil {
		message = normalized
	} else {
		message = "domain operation failed"
	}
	return &Error{Code: code, Message: message}
}

var (
	ErrInvalidArgument            = &Error{Code: ErrorInvalidArgument, Message: "the domain value is invalid"}
	ErrNotGitRepository           = &Error{Code: ErrorNotGitRepository, Message: "the path is not a Git repository"}
	ErrTaskNotFound               = &Error{Code: ErrorTaskNotFound, Message: "the task was not found"}
	ErrActiveTaskConflict         = &Error{Code: ErrorActiveTaskConflict, Message: "the repository already has an active task"}
	ErrHostOwnershipConflict      = &Error{Code: ErrorHostOwnershipConflict, Message: "the task belongs to another host"}
	ErrRevisionConflict           = &Error{Code: ErrorRevisionConflict, Message: "the task revision is stale"}
	ErrActionStale                = &Error{Code: ErrorActionStale, Message: "the action identity is stale"}
	ErrRepositoryDrift            = &Error{Code: ErrorRepositoryDrift, Message: "the repository binding has changed"}
	ErrVerificationBudgetExceeded = &Error{Code: ErrorVerificationBudgetExceeded, Message: "the verification budget was exceeded"}
	ErrTaskBlocked                = &Error{Code: ErrorTaskBlocked, Message: "the task is blocked"}
	ErrTaskTerminal               = &Error{Code: ErrorTaskTerminal, Message: "the task is terminal"}
	ErrSchemaUnsupported          = &Error{Code: ErrorSchemaUnsupported, Message: "pre-graph data is unsupported; choose a fresh data directory or archive, rename, or delete the old directory outside Core"}
	ErrProcessUnsupported         = &Error{Code: ErrorProcessUnsupported, Message: "the stored process definition is unsupported"}
	ErrStorageUnavailable         = &Error{Code: ErrorStorageUnavailable, Message: "storage is unavailable"}
	ErrInternal                   = &Error{Code: ErrorInternal, Message: "an internal error occurred"}
)
