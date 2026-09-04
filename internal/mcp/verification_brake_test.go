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

func TestTaskProjectionIncludesCurrentVerificationPlanUsageAndReasons(t *testing.T) {
	initial := domain.VerificationBudget{Level: domain.VerificationTargeted, MaxAutomaticCommands: 1}
	current := initial
	current.MaxAutomaticCommands = 2
	task := domain.ProcessTask{
		TaskPlan:                      &domain.TaskPlanBaseline{Revision: 2, VerificationPlan: domain.VerificationPlan{Checks: []domain.VerificationPlanCheck{{Name: "targeted", Rationale: "The check covers the changed package."}}, InitialBudget: initial}},
		Evidence:                      []domain.EvidenceSummary{{TaskPlanRevision: 2, Source: domain.EvidenceSourceAutomated, CommandCount: 1}},
		VerificationBudgetAdjustments: []domain.VerificationBudgetAdjustment{{Revision: 1, TaskPlanRevision: 2, Basis: domain.VerificationAdjustmentNewRisk, Reason: "A newly identified caller needs one check.", AdditionalChecks: []domain.VerificationPlanCheck{{Name: "caller", Rationale: "The caller shares the contract."}}, AdditionalAutomaticCommands: 1, PreviousBudget: initial, CurrentBudget: current}},
	}
	projected := projectTask(task).(map[string]any)
	verification := projected["verification"].(map[string]any)
	if verification["plan"] == nil || verification["current_budget"] != current || verification["usage"] != task.CurrentVerificationUsage() || !reflect.DeepEqual(verification["adjustments"], task.VerificationBudgetAdjustments) {
		t.Fatalf("verification=%#v", verification)
	}
}
