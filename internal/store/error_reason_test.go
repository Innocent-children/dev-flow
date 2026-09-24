package store

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"testing"

	"github.com/Innocent-children/dev-flow/internal/domain"
	sqlite3 "modernc.org/sqlite/lib"
)

type diagnosticSQLiteError int

func (e diagnosticSQLiteError) Error() string { return "private SQL and /private/database" }
func (e diagnosticSQLiteError) Code() int     { return int(e) }

func TestStorageFailureClassifiesWithoutDriverText(t *testing.T) {
	for _, tc := range []struct {
		name     string
		cause    error
		fragment string
	}{
		{"lock", diagnosticSQLiteError(sqlite3.SQLITE_BUSY), "lock"},
		{"readonly", diagnosticSQLiteError(sqlite3.SQLITE_READONLY), "read-only"},
		{"full", diagnosticSQLiteError(sqlite3.SQLITE_FULL), "full"},
		{"corrupt", diagnosticSQLiteError(sqlite3.SQLITE_CORRUPT), "corrupt"},
		{"io", diagnosticSQLiteError(sqlite3.SQLITE_IOERR), "I/O"},
		{"permission", diagnosticSQLiteError(sqlite3.SQLITE_PERM), "permission"},
		{"constraint", diagnosticSQLiteError(sqlite3.SQLITE_CONSTRAINT), "constraint"},
		{"cancelled", context.Canceled, "cancelled"},
		{"deadline", context.DeadlineExceeded, "deadline"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			failure := storageFailure(fmt.Errorf("wrapped private details: %w", tc.cause), "The Task transaction could not be committed.")
			var typed *domain.Error
			if !errors.As(failure, &typed) || !errors.Is(failure, ErrStorageUnavailable) || !strings.Contains(typed.PublicExplanation(), tc.fragment) || typed.ZeroWrite {
				t.Fatalf("failure=%+v", failure)
			}
			if strings.Contains(typed.PublicExplanation(), "private") {
				t.Fatal("driver text leaked")
			}
		})
	}
}

func TestStorageFailurePreservesTheSpecificDecodeReason(t *testing.T) {
	inner := domain.WithExplanation(ErrStorageUnavailable, "The saved Task snapshot contains trailing JSON data.")
	failure := storageFailure(inner, "The Task row could not be read.").(*domain.Error)
	if failure.PublicExplanation() != inner.PublicExplanation() {
		t.Fatalf("explanation=%s", failure.PublicExplanation())
	}
}
