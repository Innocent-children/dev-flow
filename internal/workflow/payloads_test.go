package workflow

import (
	"errors"
	"strings"
	"testing"

	"github.com/Innocent-children/dev-flow/internal/domain"
)

func TestValidatePayloadAcceptsOnlyTheClosedPayloadForEachPhase(t *testing.T) {
	tests := []struct {
		name    string
		phase   domain.Phase
		action  domain.ActionKind
		payload ActionPayload
		result  domain.ActionResult
	}{
		{name: "assessment", phase: domain.PhaseIntake, action: domain.ActionAssessTask, payload: validAssessPayload(), result: domain.ActionResultSucceeded},
		{name: "plan", phase: domain.PhaseAssess, action: domain.ActionPlanChange, payload: validPlanPayload(), result: domain.ActionResultSucceeded},
		{name: "implementation", phase: domain.PhasePlan, action: domain.ActionImplementChange, payload: validImplementPayload(), result: domain.ActionResultSucceeded},
		{name: "verification", phase: domain.PhaseImplement, action: domain.ActionVerifyChange, payload: validVerifyPayload(), result: domain.ActionResultReady},
		{name: "review", phase: domain.PhaseVerify, action: domain.ActionReviewChange, payload: validReviewPayload(), result: domain.ActionResultPass},
		{name: "review handoff", phase: domain.PhaseReview, action: domain.ActionPrepareHandoff, payload: validReviewHandoffPayload(), result: domain.ActionResultReady},
		{name: "complete handoff", phase: domain.PhaseHandoff, action: domain.ActionPrepareHandoff, payload: validCompleteHandoffPayload(), result: domain.ActionResultComplete},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			validated, err := ValidatePayload(tt.phase, tt.action, tt.payload)
			if err != nil {
				t.Fatalf("ValidatePayload() error = %v", err)
			}
			if validated.Result != tt.result || validated.Summary == "" || len(validated.CanonicalBytes) == 0 {
				t.Fatalf("ValidatePayload() = %#v", validated)
			}
			if validated.CanonicalBytes[len(validated.CanonicalBytes)-1] == '\n' {
				t.Fatal("CanonicalBytes contains an encoder newline")
			}
		})
	}

	wrongPayloads := []struct {
		name    string
		phase   domain.Phase
		action  domain.ActionKind
		payload ActionPayload
	}{
		{name: "assessment payload at plan", phase: domain.PhaseAssess, action: domain.ActionPlanChange, payload: validAssessPayload()},
		{name: "plan payload at implementation", phase: domain.PhasePlan, action: domain.ActionImplementChange, payload: validPlanPayload()},
		{name: "review handoff payload at handoff", phase: domain.PhaseHandoff, action: domain.ActionPrepareHandoff, payload: validReviewHandoffPayload()},
		{name: "complete handoff payload at review", phase: domain.PhaseReview, action: domain.ActionPrepareHandoff, payload: validCompleteHandoffPayload()},
		{name: "wrong action for phase", phase: domain.PhaseIntake, action: domain.ActionPlanChange, payload: validAssessPayload()},
	}
	for _, tt := range wrongPayloads {
		t.Run(tt.name, func(t *testing.T) {
			_, err := ValidatePayload(tt.phase, tt.action, tt.payload)
			requireWorkflowError(t, err, domain.ErrInvalidArgument)
		})
	}
}

func TestValidatePayloadRejectsEveryOtherClosedTypeForEachPhase(t *testing.T) {
	contracts := []struct {
		phase   domain.Phase
		action  domain.ActionKind
		payload ActionPayload
	}{
		{phase: domain.PhaseIntake, action: domain.ActionAssessTask, payload: validAssessPayload()},
		{phase: domain.PhaseAssess, action: domain.ActionPlanChange, payload: validPlanPayload()},
		{phase: domain.PhasePlan, action: domain.ActionImplementChange, payload: validImplementPayload()},
		{phase: domain.PhaseImplement, action: domain.ActionVerifyChange, payload: validVerifyPayload()},
		{phase: domain.PhaseVerify, action: domain.ActionReviewChange, payload: validReviewPayload()},
		{phase: domain.PhaseReview, action: domain.ActionPrepareHandoff, payload: validReviewHandoffPayload()},
		{phase: domain.PhaseHandoff, action: domain.ActionPrepareHandoff, payload: validCompleteHandoffPayload()},
	}
	for phaseIndex, contract := range contracts {
		for payloadIndex, candidate := range contracts {
			if phaseIndex == payloadIndex {
				continue
			}
			t.Run(string(contract.phase)+"/wrong-"+string(candidate.phase), func(t *testing.T) {
				_, err := ValidatePayload(contract.phase, contract.action, candidate.payload)
				requireWorkflowError(t, err, domain.ErrInvalidArgument)
			})
		}
	}
}

func TestValidatePayloadRequiresSummaryForEveryClosedType(t *testing.T) {
	delivery := validDeliveryData()
	tests := []struct {
		phase   domain.Phase
		action  domain.ActionKind
		payload ActionPayload
	}{
		{phase: domain.PhaseIntake, action: domain.ActionAssessTask, payload: AssessTaskPayload{Result: domain.ActionResultSucceeded, Summary: " ", VerificationBudgetAcknowledged: true}},
		{phase: domain.PhaseAssess, action: domain.ActionPlanChange, payload: PlanChangePayload{Result: domain.ActionResultSucceeded, Summary: " ", Steps: []string{"step"}, VerificationSteps: []string{"check"}}},
		{phase: domain.PhasePlan, action: domain.ActionImplementChange, payload: ImplementChangePayload{Result: domain.ActionResultSucceeded, Summary: " ", NoFileChanges: true, ScopeConfirmed: true}},
		{phase: domain.PhaseImplement, action: domain.ActionVerifyChange, payload: VerifyChangePayload{Result: domain.ActionResultReady, Summary: " "}},
		{phase: domain.PhaseVerify, action: domain.ActionReviewChange, payload: ReviewChangePayload{Result: domain.ActionResultPass, Summary: " "}},
		{phase: domain.PhaseReview, action: domain.ActionPrepareHandoff, payload: ReviewHandoffPayload{Result: domain.ActionResultReady, Summary: " ", Delivery: &delivery}},
		{phase: domain.PhaseHandoff, action: domain.ActionPrepareHandoff, payload: CompleteHandoffPayload{Result: domain.ActionResultComplete, Summary: " ", Delivery: &delivery}},
	}
	for _, tt := range tests {
		t.Run(string(tt.phase), func(t *testing.T) {
			_, err := ValidatePayload(tt.phase, tt.action, tt.payload)
			requireWorkflowError(t, err, domain.ErrInvalidArgument)
		})
	}
}

func TestValidatePayloadRejectsNilAliasesAndBlockedResolution(t *testing.T) {
	var typedNil *AssessTaskPayload
	tests := []struct {
		name    string
		phase   domain.Phase
		action  domain.ActionKind
		payload ActionPayload
	}{
		{name: "nil", phase: domain.PhaseIntake, action: domain.ActionAssessTask, payload: nil},
		{name: "typed nil", phase: domain.PhaseIntake, action: domain.ActionAssessTask, payload: typedNil},
		{name: "result alias", phase: domain.PhaseIntake, action: domain.ActionAssessTask, payload: AssessTaskPayload{Result: "Succeeded", Summary: "assessment", VerificationBudgetAcknowledged: true}},
		{name: "blocked unsupported", phase: domain.PhaseBlocked, action: domain.ActionResolveBlocker, payload: validAssessPayload()},
		{name: "terminal unsupported", phase: domain.PhaseDone, action: domain.ActionPrepareHandoff, payload: validCompleteHandoffPayload()},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := ValidatePayload(tt.phase, tt.action, tt.payload)
			requireWorkflowError(t, err, domain.ErrInvalidArgument)
		})
	}
}

func TestValidatePayloadNormalizesTextAndRejectsDuplicates(t *testing.T) {
	payload := validAssessPayload()
	payload.Summary = "  bounded assessment  "
	payload.Constraints = []string{" first ", "second"}
	payload.Risks = nil
	validated, err := ValidatePayload(domain.PhaseIntake, domain.ActionAssessTask, payload)
	if err != nil {
		t.Fatalf("ValidatePayload() error = %v", err)
	}
	if validated.Summary != "bounded assessment" {
		t.Fatalf("Summary = %q", validated.Summary)
	}
	wantCanonical := `{"result":"succeeded","summary":"bounded assessment","constraints":["first","second"],"risks":[],"intended_changed_surface":[],"verification_budget_acknowledged":true}`
	if string(validated.CanonicalBytes) != wantCanonical {
		t.Fatalf("CanonicalBytes = %s, want %s", validated.CanonicalBytes, wantCanonical)
	}

	payload.Constraints = []string{"same", " same "}
	_, err = ValidatePayload(domain.PhaseIntake, domain.ActionAssessTask, payload)
	requireWorkflowError(t, err, domain.ErrInvalidArgument)

	payload = validAssessPayload()
	payload.Summary = string([]byte{0xff})
	_, err = ValidatePayload(domain.PhaseIntake, domain.ActionAssessTask, payload)
	requireWorkflowError(t, err, domain.ErrInvalidArgument)
}

func TestValidatePayloadEnforcesAggregateByteLimit(t *testing.T) {
	payload := validPlanPayload()
	payload.ExpectedChangedPaths = largePayloadItems("path", domain.MaxBoundedStringListItems, 2_000)
	payload.NonGoals = largePayloadItems("non-goal", domain.MaxBoundedStringListItems, 2_000)
	_, err := ValidatePayload(domain.PhaseAssess, domain.ActionPlanChange, payload)
	requireWorkflowError(t, err, domain.ErrInvalidArgument)
}

func TestValidatePlanPayloadRules(t *testing.T) {
	tests := []struct {
		name   string
		mutate func(*PlanChangePayload)
	}{
		{name: "summary required", mutate: func(p *PlanChangePayload) { p.Summary = " " }},
		{name: "steps required", mutate: func(p *PlanChangePayload) { p.Steps = nil }},
		{name: "verification required", mutate: func(p *PlanChangePayload) { p.VerificationSteps = nil }},
		{name: "questions unresolved", mutate: func(p *PlanChangePayload) { p.UnresolvedQuestions = []string{"Which API?"} }},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			payload := validPlanPayload()
			tt.mutate(&payload)
			_, err := ValidatePayload(domain.PhaseAssess, domain.ActionPlanChange, payload)
			requireWorkflowError(t, err, domain.ErrInvalidArgument)
		})
	}
}

func TestValidateImplementPayloadRules(t *testing.T) {
	tests := []struct {
		name   string
		mutate func(*ImplementChangePayload)
	}{
		{name: "neither path nor no-change", mutate: func(p *ImplementChangePayload) { p.ChangedPaths = nil; p.NoFileChanges = false }},
		{name: "both path and no-change", mutate: func(p *ImplementChangePayload) { p.NoFileChanges = true }},
		{name: "scope unconfirmed", mutate: func(p *ImplementChangePayload) { p.ScopeConfirmed = false }},
		{name: "absolute path", mutate: func(p *ImplementChangePayload) { p.ChangedPaths = []string{"/tmp/file.go"} }},
		{name: "Windows absolute path", mutate: func(p *ImplementChangePayload) { p.ChangedPaths = []string{`C:\tmp\file.go`} }},
		{name: "parent escape", mutate: func(p *ImplementChangePayload) { p.ChangedPaths = []string{"internal/../../secret"} }},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			payload := validImplementPayload()
			tt.mutate(&payload)
			_, err := ValidatePayload(domain.PhasePlan, domain.ActionImplementChange, payload)
			requireWorkflowError(t, err, domain.ErrInvalidArgument)
		})
	}

	noChanges := validImplementPayload()
	noChanges.ChangedPaths = nil
	noChanges.NoFileChanges = true
	if _, err := ValidatePayload(domain.PhasePlan, domain.ActionImplementChange, noChanges); err != nil {
		t.Fatalf("no-file-change payload error = %v", err)
	}
}

func TestValidateVerifyPayloadResultRules(t *testing.T) {
	tests := []struct {
		name   string
		mutate func(*VerifyChangePayload)
	}{
		{name: "ready with failures", mutate: func(p *VerifyChangePayload) { p.FailedItems = []string{"test failed"} }},
		{name: "ready with reason", mutate: func(p *VerifyChangePayload) { p.Reason = "unexpected" }},
		{name: "failed without reason", mutate: func(p *VerifyChangePayload) {
			p.Result = domain.ActionResultFailed
			p.Reason = ""
			p.FailedItems = []string{"test failed"}
		}},
		{name: "failed without failed evidence", mutate: func(p *VerifyChangePayload) {
			p.Result = domain.ActionResultFailed
			p.Reason = "verification failed"
			p.FailedItems = nil
		}},
		{name: "unknown result", mutate: func(p *VerifyChangePayload) { p.Result = domain.ActionResultPass }},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			payload := validVerifyPayload()
			tt.mutate(&payload)
			_, err := ValidatePayload(domain.PhaseImplement, domain.ActionVerifyChange, payload)
			requireWorkflowError(t, err, domain.ErrInvalidArgument)
		})
	}

	failedCheck := validVerifyPayload()
	failedCheck.Result = domain.ActionResultFailed
	failedCheck.Reason = "verification failed"
	failedCheck.Checks[0].Status = domain.EvidenceFailed
	if _, err := ValidatePayload(domain.PhaseImplement, domain.ActionVerifyChange, failedCheck); err != nil {
		t.Fatalf("failed-check payload error = %v", err)
	}
}

func TestValidateReviewPayloadResultRules(t *testing.T) {
	for _, result := range []domain.ActionResult{domain.ActionResultReworkImplementation, domain.ActionResultReplan} {
		payload := validReviewPayload()
		payload.Result = result
		payload.Reason = " "
		_, err := ValidatePayload(domain.PhaseVerify, domain.ActionReviewChange, payload)
		requireWorkflowError(t, err, domain.ErrInvalidArgument)

		payload.Reason = "bounded reason"
		if _, err := ValidatePayload(domain.PhaseVerify, domain.ActionReviewChange, payload); err != nil {
			t.Fatalf("result %q with reason error = %v", result, err)
		}
	}
	pass := validReviewPayload()
	pass.Reason = "not allowed"
	_, err := ValidatePayload(domain.PhaseVerify, domain.ActionReviewChange, pass)
	requireWorkflowError(t, err, domain.ErrInvalidArgument)
}

func TestValidateHandoffPayloadResultRules(t *testing.T) {
	review := validReviewHandoffPayload()
	review.Delivery = nil
	_, err := ValidatePayload(domain.PhaseReview, domain.ActionPrepareHandoff, review)
	requireWorkflowError(t, err, domain.ErrInvalidArgument)

	for _, result := range []domain.ActionResult{domain.ActionResultReworkImplementation, domain.ActionResultReplan} {
		review := validReviewHandoffPayload()
		review.Result = result
		review.Reason = "rework required"
		_, err := ValidatePayload(domain.PhaseReview, domain.ActionPrepareHandoff, review)
		requireWorkflowError(t, err, domain.ErrInvalidArgument)

		review.Delivery = nil
		if _, err := ValidatePayload(domain.PhaseReview, domain.ActionPrepareHandoff, review); err != nil {
			t.Fatalf("review result %q error = %v", result, err)
		}
	}

	complete := validCompleteHandoffPayload()
	complete.Delivery = nil
	_, err = ValidatePayload(domain.PhaseHandoff, domain.ActionPrepareHandoff, complete)
	requireWorkflowError(t, err, domain.ErrInvalidArgument)

	for _, result := range []domain.ActionResult{domain.ActionResultReworkImplementation, domain.ActionResultReplan} {
		complete := validCompleteHandoffPayload()
		complete.Result = result
		complete.Reason = "rework required"
		_, err := ValidatePayload(domain.PhaseHandoff, domain.ActionPrepareHandoff, complete)
		requireWorkflowError(t, err, domain.ErrInvalidArgument)

		complete.Delivery = nil
		if _, err := ValidatePayload(domain.PhaseHandoff, domain.ActionPrepareHandoff, complete); err != nil {
			t.Fatalf("handoff result %q error = %v", result, err)
		}
	}
}

func TestValidatePayloadEvidenceRules(t *testing.T) {
	tests := []struct {
		name   string
		mutate func(*VerifyChangePayload)
	}{
		{name: "unknown source", mutate: func(p *VerifyChangePayload) { p.Checks[0].Source = "runner" }},
		{name: "unknown status", mutate: func(p *VerifyChangePayload) { p.Checks[0].Status = "ok" }},
		{name: "empty name", mutate: func(p *VerifyChangePayload) { p.Checks[0].Name = " " }},
		{name: "empty summary", mutate: func(p *VerifyChangePayload) { p.Checks[0].Summary = " " }},
		{name: "duplicate name", mutate: func(p *VerifyChangePayload) {
			p.Checks = append(p.Checks, EvidenceInput{Source: domain.EvidenceSourceStatic, Name: " unit ", Status: domain.EvidencePassed, Summary: "duplicate"})
		}},
		{name: "too many with base summary", mutate: func(p *VerifyChangePayload) {
			p.Checks = make([]EvidenceInput, domain.MaxEvidencePerAction)
			for i := range p.Checks {
				p.Checks[i] = EvidenceInput{Source: domain.EvidenceSourceStatic, Name: strings.Repeat("n", i+1), Status: domain.EvidencePassed, Summary: "ok"}
			}
		}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			payload := validVerifyPayload()
			tt.mutate(&payload)
			_, err := ValidatePayload(domain.PhaseImplement, domain.ActionVerifyChange, payload)
			requireWorkflowError(t, err, domain.ErrInvalidArgument)
		})
	}
}

func TestValidateDeliveryMatchesContractAndEvidenceAuthority(t *testing.T) {
	contract := workflowTestContract(t, true)
	evidence := []domain.EvidenceSummary{
		workflowEvidence("evidence-auto", domain.EvidenceSourceAutomated),
		workflowEvidence("evidence-user", domain.EvidenceSourceUser),
	}
	delivery := validDeliveryData()
	if err := ValidateDelivery(delivery, contract, evidence); err != nil {
		t.Fatalf("ValidateDelivery() error = %v", err)
	}

	tests := []struct {
		name   string
		mutate func(*DeliveryData)
	}{
		{name: "acceptance count", mutate: func(d *DeliveryData) { d.Acceptance = nil }},
		{name: "acceptance order or text", mutate: func(d *DeliveryData) { d.Acceptance[0].Criterion = "different" }},
		{name: "duplicate IDs across lists", mutate: func(d *DeliveryData) { d.ManualEvidenceIDs = []domain.ID{"evidence-auto"} }},
		{name: "automated wrong source", mutate: func(d *DeliveryData) {
			d.AutomatedEvidenceIDs = []domain.ID{"evidence-user"}
			d.ManualEvidenceIDs = nil
		}},
		{name: "manual wrong source", mutate: func(d *DeliveryData) {
			d.ManualEvidenceIDs = []domain.ID{"evidence-auto"}
			d.AutomatedEvidenceIDs = nil
		}},
		{name: "missing evidence", mutate: func(d *DeliveryData) { d.AutomatedEvidenceIDs = []domain.ID{"evidence-missing"} }},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			candidate := cloneDeliveryData(delivery)
			tt.mutate(&candidate)
			requireWorkflowError(t, ValidateDelivery(candidate, contract, evidence), domain.ErrInvalidArgument)
		})
	}

	manualDisallowed := workflowTestContract(t, false)
	requireWorkflowError(t, ValidateDelivery(delivery, manualDisallowed, evidence), domain.ErrInvalidArgument)
}

func validAssessPayload() AssessTaskPayload {
	return AssessTaskPayload{
		Result:                         domain.ActionResultSucceeded,
		Summary:                        "assessment summary",
		Constraints:                    []string{},
		Risks:                          []string{},
		IntendedChangedSurface:         []string{},
		VerificationBudgetAcknowledged: true,
	}
}

func validPlanPayload() PlanChangePayload {
	return PlanChangePayload{
		Result:               domain.ActionResultSucceeded,
		Summary:              "plan summary",
		Steps:                []string{"implement the bounded change"},
		ExpectedChangedPaths: []string{"internal/workflow/payloads.go"},
		NonGoals:             []string{},
		VerificationSteps:    []string{"run the targeted test"},
		UnresolvedQuestions:  []string{},
	}
}

func validImplementPayload() ImplementChangePayload {
	return ImplementChangePayload{
		Result:         domain.ActionResultSucceeded,
		Summary:        "implementation summary",
		ChangedPaths:   []string{"internal/workflow/payloads.go"},
		NoFileChanges:  false,
		Deviations:     []string{},
		ScopeConfirmed: true,
	}
}

func validVerifyPayload() VerifyChangePayload {
	return VerifyChangePayload{
		Result:  domain.ActionResultReady,
		Summary: "verification summary",
		Checks: []EvidenceInput{{
			Source:       domain.EvidenceSourceAutomated,
			Name:         "unit",
			Status:       domain.EvidencePassed,
			Summary:      "targeted unit test passed",
			CommandCount: 1,
		}},
		FailedItems:        []string{},
		UnverifiedItems:    []string{},
		ManualHandoffItems: []string{},
	}
}

func validReviewPayload() ReviewChangePayload {
	return ReviewChangePayload{
		Result:        domain.ActionResultPass,
		Summary:       "review summary",
		Findings:      []string{},
		ResidualRisks: []string{},
	}
}

func validReviewHandoffPayload() ReviewHandoffPayload {
	delivery := validDeliveryData()
	return ReviewHandoffPayload{
		Result:   domain.ActionResultReady,
		Summary:  "handoff preparation",
		Delivery: &delivery,
	}
}

func validCompleteHandoffPayload() CompleteHandoffPayload {
	delivery := validDeliveryData()
	return CompleteHandoffPayload{
		Result:   domain.ActionResultComplete,
		Summary:  "delivery summary",
		Delivery: &delivery,
	}
}

func validDeliveryData() DeliveryData {
	return DeliveryData{
		Acceptance: []domain.OutcomeCriterion{{
			Criterion: "criterion one",
			Status:    domain.CriterionSatisfied,
		}},
		AutomatedEvidenceIDs: []domain.ID{"evidence-auto"},
		ManualEvidenceIDs:    []domain.ID{"evidence-user"},
		UnverifiedItems:      []string{},
		Risks:                []string{},
	}
}

func workflowTestContract(t *testing.T, allowManual bool) domain.Contract {
	t.Helper()
	contract, err := domain.NewContract(
		"goal",
		nil,
		nil,
		[]string{"criterion one"},
		domain.VerificationBudget{
			Level:                domain.VerificationTargeted,
			MaxAutomaticCommands: 3,
			AllowManualHandoff:   allowManual,
		},
	)
	if err != nil {
		t.Fatalf("NewContract() error = %v", err)
	}
	return contract
}

func workflowEvidence(id domain.ID, source domain.EvidenceSource) domain.EvidenceSummary {
	return domain.EvidenceSummary{
		EvidenceID:   id,
		Source:       source,
		Name:         string(id),
		Status:       domain.EvidencePassed,
		Summary:      "bounded evidence",
		Digest:       domain.Digest(strings.Repeat("a", 64)),
		CommandCount: map[bool]int{true: 1}[source == domain.EvidenceSourceAutomated],
		RecordedAt:   workflowTestTime(),
	}
}

func cloneDeliveryData(input DeliveryData) DeliveryData {
	return DeliveryData{
		Acceptance:           append([]domain.OutcomeCriterion(nil), input.Acceptance...),
		AutomatedEvidenceIDs: append([]domain.ID(nil), input.AutomatedEvidenceIDs...),
		ManualEvidenceIDs:    append([]domain.ID(nil), input.ManualEvidenceIDs...),
		UnverifiedItems:      append([]string(nil), input.UnverifiedItems...),
		Risks:                append([]string(nil), input.Risks...),
	}
}

func largePayloadItems(prefix string, count, width int) []string {
	items := make([]string, count)
	for i := range items {
		leader := prefix + strings.Repeat("x", i%7) + "-"
		items[i] = leader + strings.Repeat(string(rune('a'+i%26)), width-len(leader)) + string(rune('A'+i%26))
	}
	return items
}

func requireWorkflowError(t *testing.T, err error, target error) {
	t.Helper()
	if !errors.Is(err, target) {
		t.Fatalf("error = %v, want %v", err, target)
	}
}

func TestValidatedPayloadReturnsIndependentCopies(t *testing.T) {
	payload := validCompleteHandoffPayload()
	validated, err := ValidatePayload(domain.PhaseHandoff, domain.ActionPrepareHandoff, payload)
	if err != nil {
		t.Fatalf("ValidatePayload() error = %v", err)
	}
	payload.Delivery.Acceptance[0].Criterion = "mutated input"
	payload.Delivery.AutomatedEvidenceIDs[0] = "mutated-input"
	if validated.Delivery.Acceptance[0].Criterion != "criterion one" ||
		validated.Delivery.AutomatedEvidenceIDs[0] != "evidence-auto" {
		t.Fatalf("validated delivery retained input aliases: %#v", validated.Delivery)
	}
	validated.Delivery.Risks = append(validated.Delivery.Risks, "caller mutation")
	again, err := ValidatePayload(domain.PhaseHandoff, domain.ActionPrepareHandoff, validCompleteHandoffPayload())
	if err != nil || again.Delivery.Acceptance[0].Criterion != "criterion one" ||
		again.Delivery.AutomatedEvidenceIDs[0] != "evidence-auto" || len(again.Delivery.Risks) != 0 {
		t.Fatalf("subsequent validation changed: %#v, %v", again.Delivery, err)
	}
}
