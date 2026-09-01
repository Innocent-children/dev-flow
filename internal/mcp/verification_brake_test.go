package mcp

import (
	"reflect"
	"testing"

	"github.com/Innocent-children/dev-flow/internal/domain"
)

func TestTaskProjectionIncludesRecentVerificationAttempts(t *testing.T) {
	attempts := []domain.VerificationAttempt{{TaskRevision: 7, TaskPlanRevision: 2, ImplementationRevision: 3}}
	projected, ok := projectTask(domain.ProcessTask{VerificationAttempts: attempts}).(map[string]any)
	if !ok {
		t.Fatal("task projection has unexpected type")
	}
	if !reflect.DeepEqual(projected["verification_attempts"], attempts) {
		t.Fatalf("verification_attempts=%#v", projected["verification_attempts"])
	}
}
