package store

import "github.com/Innocent-children/dev-flow/internal/domain"

// Store errors reuse the one closed Domain error-code vocabulary and retain
// no driver error, SQL text, task contents, or database path.
type ErrorCode = domain.ErrorCode

const (
	ErrorInvalidArgument    = domain.ErrorInvalidArgument
	ErrorTaskNotFound       = domain.ErrorTaskNotFound
	ErrorActiveTaskConflict = domain.ErrorActiveTaskConflict
	ErrorRevisionConflict   = domain.ErrorRevisionConflict
	ErrorTaskTerminal       = domain.ErrorTaskTerminal
	ErrorSchemaUnsupported  = domain.ErrorSchemaUnsupported
	ErrorProcessUnsupported = domain.ErrorProcessUnsupported
	ErrorStorageUnavailable = domain.ErrorStorageUnavailable
)

var (
	ErrInvalidArgument = &domain.Error{
		Code:    ErrorInvalidArgument,
		Message: "the storage request is invalid",
	}
	ErrTaskNotFound = &domain.Error{
		Code:    ErrorTaskNotFound,
		Message: "the task was not found",
	}
	ErrActiveTaskConflict = &domain.Error{
		Code:    ErrorActiveTaskConflict,
		Message: "the repository already has an active task",
	}
	ErrRevisionConflict = &domain.Error{
		Code:    ErrorRevisionConflict,
		Message: "the task revision does not match",
	}
	ErrTaskTerminal      = &domain.Error{Code: ErrorTaskTerminal, Message: "the storage operation requires a terminal task"}
	ErrSchemaUnsupported = &domain.Error{
		Code:    ErrorSchemaUnsupported,
		Message: "the storage schema is unsupported",
	}
	ErrProcessUnsupported = &domain.Error{Code: ErrorProcessUnsupported, Message: "the stored process definition is unsupported"}
	ErrStorageUnavailable = &domain.Error{
		Code:    ErrorStorageUnavailable,
		Message: "the task store is unavailable",
	}
)
