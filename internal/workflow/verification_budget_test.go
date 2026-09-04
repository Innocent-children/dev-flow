package workflow

import (
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/Innocent-children/dev-flow/internal/domain"
)

func requireWorkflowError(t *testing.T, err, target error) {
	t.Helper()
	if !errors.Is(err, target) {
		t.Fatalf("error = %v, want %v", err, target)
	}
}

func TestEvaluateVerificationBudgetAcceptsExactRemainingCommands(t *testing.T) {
	budget := verificationTestBudget()
	existing := []domain.EvidenceSummary{verificationExistingEvidence("existing", domain.EvidenceSourceAutomated, 1)}
	incoming := []NormalizedEvidenceInput{{
		Source:       domain.EvidenceSourceAutomated,
		Name:         "incoming",
		Status:       domain.EvidencePassed,
		Summary:      "two commands passed",
		CommandCount: 2,
	}}
	if err := EvaluateVerificationBudget(budget, 1, existing, incoming, nil); err != nil {
		t.Fatalf("EvaluateVerificationBudget() error = %v", err)
	}
}

func TestEvaluateVerificationBudgetAcceptsUserEvidenceAfterAutomaticBudgetExhausted(t *testing.T) {
	budget := verificationTestBudget()
	budget.MaxAutomaticCommands = 4
	existing := []domain.EvidenceSummary{verificationExistingEvidence("automatic-budget", domain.EvidenceSourceAutomated, 4)}
	user := []NormalizedEvidenceInput{{Source: domain.EvidenceSourceUser, Name: "developer-v1", Status: domain.EvidencePassed, Summary: "Developer reported 21 of 21 passed", CommandCount: 0, FullSuite: false}}
	if err := EvaluateVerificationBudget(budget, 1, existing, user, nil); err != nil {
		t.Fatalf("completed user evidence consumed automatic budget: %v", err)
	}
	for _, invalid := range []NormalizedEvidenceInput{
		{Source: domain.EvidenceSourceUser, Name: "user-command", Status: domain.EvidencePassed, Summary: "invalid", CommandCount: 1},
		{Source: domain.EvidenceSourceUser, Name: "user-suite", Status: domain.EvidencePassed, Summary: "invalid", FullSuite: true},
	} {
		requireWorkflowError(t, EvaluateVerificationBudget(budget, 1, existing, []NormalizedEvidenceInput{invalid}, nil), domain.ErrInvalidArgument)
	}
}

func TestEvaluateVerificationBudgetRejectsExceededCommandTotalIncludingExisting(t *testing.T) {
	budget := verificationTestBudget()
	existing := []domain.EvidenceSummary{verificationExistingEvidence("existing", domain.EvidenceSourceAutomated, 2)}
	incoming := []NormalizedEvidenceInput{{
		Source:       domain.EvidenceSourceAutomated,
		Name:         "incoming",
		Status:       domain.EvidencePassed,
		Summary:      "two more commands",
		CommandCount: 2,
	}}
	requireWorkflowError(t, EvaluateVerificationBudget(budget, 1, existing, incoming, nil), domain.ErrVerificationBudgetExceeded)
}

func TestEvaluateVerificationBudgetEnforcesFullSuiteAndManualPermissions(t *testing.T) {
	tests := []struct {
		name     string
		incoming []NormalizedEvidenceInput
		manual   []string
	}{
		{name: "full suite", incoming: []NormalizedEvidenceInput{{Source: domain.EvidenceSourceAutomated, Name: "suite", Status: domain.EvidencePassed, Summary: "suite passed", CommandCount: 1, FullSuite: true, FullSuiteReason: "The shared contract affects every package."}}},
		{name: "user evidence", incoming: []NormalizedEvidenceInput{{Source: domain.EvidenceSourceUser, Name: "manual", Status: domain.EvidencePassed, Summary: "user checked"}}},
		{name: "manual handoff item", manual: []string{"user must verify UI"}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			budget := verificationTestBudget()
			budget.AllowManualHandoff = false
			requireWorkflowError(t, EvaluateVerificationBudget(budget, 1, nil, tt.incoming, tt.manual), domain.ErrVerificationBudgetExceeded)
		})
	}
}

func TestEvaluateVerificationBudgetRejectsMalformedEvidenceAsInvalidArgument(t *testing.T) {
	tests := []struct {
		name     string
		incoming []NormalizedEvidenceInput
	}{
		{name: "non-automated command", incoming: []NormalizedEvidenceInput{{Source: domain.EvidenceSourceStatic, Name: "static", Status: domain.EvidencePassed, Summary: "inspection", CommandCount: 1}}},
		{name: "non-automated full suite", incoming: []NormalizedEvidenceInput{{Source: domain.EvidenceSourceUser, Name: "manual", Status: domain.EvidencePassed, Summary: "inspection", FullSuite: true}}},
		{name: "unknown source", incoming: []NormalizedEvidenceInput{{Source: "unknown", Name: "check", Status: domain.EvidencePassed, Summary: "inspection"}}},
		{name: "unknown status", incoming: []NormalizedEvidenceInput{{Source: domain.EvidenceSourceStatic, Name: "check", Status: "ok", Summary: "inspection"}}},
		{name: "unnormalized name", incoming: []NormalizedEvidenceInput{{Source: domain.EvidenceSourceStatic, Name: " check ", Status: domain.EvidencePassed, Summary: "inspection"}}},
		{name: "duplicate name", incoming: []NormalizedEvidenceInput{
			{Source: domain.EvidenceSourceStatic, Name: "check", Status: domain.EvidencePassed, Summary: "first"},
			{Source: domain.EvidenceSourceAutomated, Name: "check", Status: domain.EvidencePassed, Summary: "second", CommandCount: 1},
		}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			requireWorkflowError(t, EvaluateVerificationBudget(verificationTestBudget(), 1, nil, tt.incoming, nil), domain.ErrInvalidArgument)
		})
	}
}

func TestEvaluateVerificationBudgetCountsEachEvidenceOnce(t *testing.T) {
	budget := verificationTestBudget()
	budget.MaxAutomaticCommands = 2
	incoming := []NormalizedEvidenceInput{{
		Source:       domain.EvidenceSourceAutomated,
		Name:         "single",
		Status:       domain.EvidencePassed,
		Summary:      "exact budget",
		CommandCount: 2,
	}}
	if err := EvaluateVerificationBudget(budget, 1, nil, incoming, nil); err != nil {
		t.Fatalf("one evidence was counted more than once: %v", err)
	}
}

func TestEvaluateVerificationBudgetChecksExistingFullSuiteButDoesNotReclassifyRetainedUserEvidence(t *testing.T) {
	fullSuite := verificationExistingEvidence("suite", domain.EvidenceSourceAutomated, 1)
	fullSuite.FullSuite = true
	fullSuite.FullSuiteReason = "The shared contract affects every package."
	budget := verificationTestBudget()
	budget.AllowFullSuite = false
	requireWorkflowError(t, EvaluateVerificationBudget(budget, 1, []domain.EvidenceSummary{fullSuite}, nil, nil), domain.ErrVerificationBudgetExceeded)

	manual := verificationExistingEvidence("manual", domain.EvidenceSourceUser, 0)
	budget = verificationTestBudget()
	budget.AllowManualHandoff = false
	if err := EvaluateVerificationBudget(budget, 1, []domain.EvidenceSummary{manual}, nil, nil); err != nil {
		t.Fatalf("retained user evidence was reclassified as a new TEST handoff: %v", err)
	}
}

func TestEvaluateVerificationBudgetEnforcesRetainedEvidenceLimit(t *testing.T) {
	existing := make([]domain.EvidenceSummary, domain.MaxRetainedEvidenceItems)
	for i := range existing {
		existing[i] = verificationExistingEvidence(domain.ID("evidence-"+strings.Repeat("x", i/10)+string(rune('a'+i%10))), domain.EvidenceSourceStatic, 0)
	}
	incoming := []NormalizedEvidenceInput{{Source: domain.EvidenceSourceStatic, Name: "new", Status: domain.EvidencePassed, Summary: "new evidence"}}
	requireWorkflowError(t, EvaluateVerificationBudget(verificationTestBudget(), 1, existing, incoming, nil), domain.ErrVerificationBudgetExceeded)
}

func verificationTestBudget() domain.VerificationBudget {
	return domain.VerificationBudget{
		Level:                domain.VerificationTargeted,
		MaxAutomaticCommands: 3,
		AllowFullSuite:       false,
		AllowManualHandoff:   true,
	}
}

func verificationExistingEvidence(id domain.ID, source domain.EvidenceSource, commands int) domain.EvidenceSummary {
	return domain.EvidenceSummary{
		EvidenceID:       id,
		TaskPlanRevision: 1,
		Source:           source,
		Name:             string(id),
		Status:           domain.EvidencePassed,
		Summary:          "existing evidence",
		Digest:           domain.Digest(strings.Repeat("b", 64)),
		CommandCount:     commands,
		RecordedAt:       workflowTestTime(),
	}
}

func TestEvaluateVerificationBudgetCountsOnlyCurrentTaskPlanRevision(t *testing.T) {
	budget := verificationTestBudget()
	old := verificationExistingEvidence("old-plan", domain.EvidenceSourceAutomated, 3)
	old.TaskPlanRevision = 1
	incoming := []NormalizedEvidenceInput{{Source: domain.EvidenceSourceAutomated, Name: "current-plan", Status: domain.EvidencePassed, Summary: "Current targeted check passed.", CommandCount: 3}}
	if err := EvaluateVerificationBudget(budget, 2, []domain.EvidenceSummary{old}, incoming, nil); err != nil {
		t.Fatalf("old Task Plan consumption leaked into the current plan: %v", err)
	}
}

func TestEvidenceFullSuiteRequiresCurrentSpecificReason(t *testing.T) {
	budget := verificationTestBudget()
	budget.AllowFullSuite = true
	check := NormalizedEvidenceInput{Source: domain.EvidenceSourceAutomated, Name: "full", Status: domain.EvidencePassed, Summary: "Full suite passed.", CommandCount: 1, FullSuite: true}
	requireWorkflowError(t, EvaluateVerificationBudget(budget, 1, nil, []NormalizedEvidenceInput{check}, nil), domain.ErrInvalidArgument)
	check.FullSuiteReason = "The changed shared schema is consumed by every package in the suite."
	if err := EvaluateVerificationBudget(budget, 1, nil, []NormalizedEvidenceInput{check}, nil); err != nil {
		t.Fatalf("specific full-suite reason rejected: %v", err)
	}
}

func workflowTestTime() time.Time {
	return time.Date(2026, time.August, 15, 9, 0, 0, 0, time.UTC)
}
