package store

import (
	"context"
	"errors"

	"github.com/Innocent-children/taskbelay/internal/domain"
	sqlite3 "modernc.org/sqlite/lib"
)

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

/**
 * storageFailure retains a safe decoding reason across storage reads. Driver
 * messages may contain SQL or paths and are never copied into public errors.
 */
func storageFailure(cause error, explanation string) error {
	var failure *domain.Error
	if errors.As(cause, &failure) && failure != nil && failure.PublicExplanation() != "" {
		explanation = failure.PublicExplanation()
	} else if errors.Is(cause, context.Canceled) {
		explanation += " The storage operation was cancelled."
	} else if errors.Is(cause, context.DeadlineExceeded) {
		explanation += " The storage deadline expired."
	} else {
		var coded interface{ Code() int }
		if errors.As(cause, &coded) {
			switch coded.Code() & 0xff {
			case sqlite3.SQLITE_BUSY, sqlite3.SQLITE_LOCKED:
				explanation += " Another database connection holds a conflicting lock."
			case sqlite3.SQLITE_READONLY:
				explanation += " The database is read-only."
			case sqlite3.SQLITE_FULL:
				explanation += " The database or storage device is full."
			case sqlite3.SQLITE_CORRUPT, sqlite3.SQLITE_NOTADB:
				explanation += " The database is corrupt or is not a SQLite database."
			case sqlite3.SQLITE_IOERR:
				explanation += " SQLite encountered a storage I/O failure."
			case sqlite3.SQLITE_CANTOPEN, sqlite3.SQLITE_PERM, sqlite3.SQLITE_AUTH:
				explanation += " SQLite could not open or obtain permission to access the database."
			case sqlite3.SQLITE_CONSTRAINT:
				explanation += " A database constraint rejected the operation."
			default:
				explanation += " SQLite returned an error without a classified safe cause."
			}
		} else {
			explanation += " No classified lower-level cause is available."
		}
	}
	return domain.WithExplanation(ErrStorageUnavailable, explanation)
}

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
