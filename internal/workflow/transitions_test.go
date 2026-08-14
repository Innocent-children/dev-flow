package workflow

import (
	"errors"
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/Innocent-children/dev-flow/internal/domain"
)

func TestTransitionTableCoversEveryLegalEdge(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name   string
		from   domain.Phase
		action domain.ActionKind
		result domain.ActionResult
		resume *domain.Phase
		reason string
		want   domain.Phase
	}{
		{"intake", domain.PhaseIntake, domain.ActionAssessTask, domain.ActionResultSucceeded, nil, "", domain.PhaseAssess},
		{"assess", domain.PhaseAssess, domain.ActionPlanChange, domain.ActionResultSucceeded, nil, "", domain.PhasePlan},
		{"plan", domain.PhasePlan, domain.ActionImplementChange, domain.ActionResultSucceeded, nil, "", domain.PhaseImplement},
		{"implementation ready", domain.PhaseImplement, domain.ActionVerifyChange, domain.ActionResultReady, nil, "", domain.PhaseVerify},
		{"implementation failed", domain.PhaseImplement, domain.ActionVerifyChange, domain.ActionResultFailed, nil, "verification failed", domain.PhaseImplement},
		{"verification pass", domain.PhaseVerify, domain.ActionReviewChange, domain.ActionResultPass, nil, "", domain.PhaseReview},
		{"verification rework", domain.PhaseVerify, domain.ActionReviewChange, domain.ActionResultReworkImplementation, nil, "finding", domain.PhaseImplement},
		{"verification replan", domain.PhaseVerify, domain.ActionReviewChange, domain.ActionResultReplan, nil, "plan gap", domain.PhasePlan},
		{"review ready", domain.PhaseReview, domain.ActionPrepareHandoff, domain.ActionResultReady, nil, "", domain.PhaseHandoff},
		{"review rework", domain.PhaseReview, domain.ActionPrepareHandoff, domain.ActionResultReworkImplementation, nil, "finding", domain.PhaseImplement},
		{"review replan", domain.PhaseReview, domain.ActionPrepareHandoff, domain.ActionResultReplan, nil, "plan gap", domain.PhasePlan},
		{"handoff complete", domain.PhaseHandoff, domain.ActionPrepareHandoff, domain.ActionResultComplete, nil, "", domain.PhaseDone},
		{"handoff rework", domain.PhaseHandoff, domain.ActionPrepareHandoff, domain.ActionResultReworkImplementation, nil, "finding", domain.PhaseImplement},
		{"handoff replan", domain.PhaseHandoff, domain.ActionPrepareHandoff, domain.ActionResultReplan, nil, "plan gap", domain.PhasePlan},
	}
	resume := domain.PhaseVerify
	tests = append(tests, struct {
		name   string
		from   domain.Phase
		action domain.ActionKind
		result domain.ActionResult
		resume *domain.Phase
		reason string
		want   domain.Phase
	}{"blocker resolved", domain.PhaseBlocked, domain.ActionResolveBlocker, domain.ActionResultSucceeded, &resume, "", resume})

	if got, want := len(Transitions()), len(tests); got != want {
		t.Fatalf("transition count = %d, want %d", got, want)
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()
			got, err := Evaluate(test.from, test.action, test.result, test.resume, test.reason)
			if err != nil {
				t.Fatalf("Evaluate() error = %v", err)
			}
			if got != test.want {
				t.Fatalf("Evaluate() = %s, want %s", got, test.want)
			}
		})
	}
}

func TestEvaluateRejectsForbiddenTransitionsAndAliases(t *testing.T) {
	t.Parallel()
	resumeTerminal := domain.PhaseDone
	tests := []struct {
		name   string
		from   domain.Phase
		action domain.ActionKind
		result domain.ActionResult
		resume *domain.Phase
		reason string
	}{
		{"skip", domain.PhaseIntake, domain.ActionImplementChange, domain.ActionResultSucceeded, nil, ""},
		{"wrong action", domain.PhaseVerify, domain.ActionVerifyChange, domain.ActionResultPass, nil, ""},
		{"deprecated result alias", domain.PhaseVerify, domain.ActionReviewChange, domain.ActionResult("passed-or-accepted"), nil, ""},
		{"terminal source", domain.PhaseDone, domain.ActionPrepareHandoff, domain.ActionResultComplete, nil, ""},
		{"missing rework reason", domain.PhaseVerify, domain.ActionReviewChange, domain.ActionResultReplan, nil, ""},
		{"noncanonical reason", domain.PhaseVerify, domain.ActionReviewChange, domain.ActionResultReplan, nil, " padded "},
		{"blocker missing resume", domain.PhaseBlocked, domain.ActionResolveBlocker, domain.ActionResultSucceeded, nil, ""},
		{"blocker terminal resume", domain.PhaseBlocked, domain.ActionResolveBlocker, domain.ActionResultSucceeded, &resumeTerminal, ""},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()
			if _, err := Evaluate(test.from, test.action, test.result, test.resume, test.reason); err == nil {
				t.Fatal("Evaluate() succeeded, want error")
			}
		})
	}

	if got, err := Evaluate(
		domain.PhaseVerify,
		domain.ActionReviewChange,
		domain.ActionResultReplan,
		nil,
		strings.Repeat("r", domain.MaxReasonBytes),
	); err != nil || got != domain.PhasePlan {
		t.Fatalf("reason at byte limit: phase=%s error=%v", got, err)
	}
	if _, err := Evaluate(
		domain.PhaseVerify,
		domain.ActionReviewChange,
		domain.ActionResultReplan,
		nil,
		strings.Repeat("r", domain.MaxReasonBytes+1),
	); err == nil {
		t.Fatal("reason over byte limit was accepted")
	}
}

func TestPhaseActionMappingAndBlueprints(t *testing.T) {
	t.Parallel()
	type expectedBlueprint struct {
		kind         domain.ActionKind
		effects      []domain.AllowedEffect
		requirements []domain.EvidenceRequirementKind
	}
	want := map[domain.Phase]expectedBlueprint{
		domain.PhaseIntake: {
			kind:    domain.ActionAssessTask,
			effects: []domain.AllowedEffect{domain.EffectReadRepository},
			requirements: []domain.EvidenceRequirementKind{
				domain.RequirementRepositoryObservation,
				domain.RequirementAssessmentSummary,
			},
		},
		domain.PhaseAssess: {
			kind:    domain.ActionPlanChange,
			effects: []domain.AllowedEffect{domain.EffectReadRepository},
			requirements: []domain.EvidenceRequirementKind{
				domain.RequirementRepositoryObservation,
				domain.RequirementImplementationPlan,
			},
		},
		domain.PhasePlan: {
			kind: domain.ActionImplementChange,
			effects: []domain.AllowedEffect{
				domain.EffectReadRepository,
				domain.EffectEditRepositoryFiles,
			},
			requirements: []domain.EvidenceRequirementKind{
				domain.RequirementRepositoryObservation,
				domain.RequirementImplementationSummary,
			},
		},
		domain.PhaseImplement: {
			kind: domain.ActionVerifyChange,
			effects: []domain.AllowedEffect{
				domain.EffectReadRepository,
				domain.EffectRunVerificationCommands,
			},
			requirements: []domain.EvidenceRequirementKind{
				domain.RequirementRepositoryObservation,
				domain.RequirementVerificationSummary,
			},
		},
		domain.PhaseVerify: {
			kind:    domain.ActionReviewChange,
			effects: []domain.AllowedEffect{domain.EffectReadRepository},
			requirements: []domain.EvidenceRequirementKind{
				domain.RequirementRepositoryObservation,
				domain.RequirementReviewSummary,
			},
		},
		domain.PhaseReview: {
			kind: domain.ActionPrepareHandoff,
			effects: []domain.AllowedEffect{
				domain.EffectReadRepository,
				domain.EffectPrepareDeliverySummary,
			},
			requirements: []domain.EvidenceRequirementKind{
				domain.RequirementRepositoryObservation,
				domain.RequirementReviewSummary,
			},
		},
		domain.PhaseHandoff: {
			kind: domain.ActionPrepareHandoff,
			effects: []domain.AllowedEffect{
				domain.EffectReadRepository,
				domain.EffectPrepareDeliverySummary,
			},
			requirements: []domain.EvidenceRequirementKind{
				domain.RequirementRepositoryObservation,
				domain.RequirementDeliverySummary,
			},
		},
		domain.PhaseBlocked: {
			kind: domain.ActionResolveBlocker,
			effects: []domain.AllowedEffect{
				domain.EffectReadRepository,
				domain.EffectResolveBlocker,
			},
			requirements: []domain.EvidenceRequirementKind{
				domain.RequirementRepositoryObservation,
				domain.RequirementBlockerResolution,
			},
		},
	}
	for phase, expected := range want {
		phase, expected := phase, expected
		t.Run(string(phase), func(t *testing.T) {
			t.Parallel()
			got, ok := ActionForPhase(phase)
			if !ok || got != expected.kind {
				t.Fatalf("ActionForPhase(%s) = %s, %v; want %s, true", phase, got, ok, expected.kind)
			}
			blueprint, err := BlueprintForPhase(phase)
			if err != nil || blueprint.Kind != expected.kind || blueprint.PayloadContract != phase ||
				blueprint.Guidance == "" || !reflect.DeepEqual(blueprint.AllowedEffects, expected.effects) ||
				!reflect.DeepEqual(requirementKinds(blueprint.RequiredEvidence), expected.requirements) {
				t.Fatalf("BlueprintForPhase(%s) = %+v, %v", phase, blueprint, err)
			}
		})
	}
	for _, phase := range []domain.Phase{domain.PhaseDone, domain.PhaseCancelled} {
		if _, ok := ActionForPhase(phase); ok {
			t.Fatalf("terminal phase %s has an action", phase)
		}
		if _, err := BlueprintForPhase(phase); domainErrorCode(err) != domain.ErrorTaskTerminal {
			t.Fatalf("terminal phase %s error = %v, want %s", phase, err, domain.ErrorTaskTerminal)
		}
	}
	if _, err := BlueprintForPhase(domain.Phase("UNKNOWN")); domainErrorCode(err) != domain.ErrorInvalidArgument {
		t.Fatalf("unknown phase error = %v, want %s", err, domain.ErrorInvalidArgument)
	}
}

func TestBuildNextActionUsesOnlyCallerInputs(t *testing.T) {
	t.Parallel()
	issuedAt := time.Date(2026, 8, 14, 1, 2, 3, 0, time.UTC)
	digest := domain.Digest("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")
	action, err := BuildNextAction(domain.PhasePlan, "task-1", 3, digest, "action-1", issuedAt)
	if err != nil {
		t.Fatalf("BuildNextAction() error = %v", err)
	}
	if action.Kind != domain.ActionImplementChange || action.TaskID != "task-1" ||
		action.ActionID != "action-1" || action.Revision != 3 ||
		action.PayloadContract != domain.PhasePlan || !action.IssuedAt.Equal(issuedAt) {
		t.Fatalf("BuildNextAction() = %+v", action)
	}
	for _, mutate := range []func(*domain.Action){
		func(candidate *domain.Action) { candidate.Kind = domain.ActionPlanChange },
		func(candidate *domain.Action) { candidate.PayloadContract = domain.PhaseAssess },
		func(candidate *domain.Action) {
			candidate.AllowedEffects = []domain.AllowedEffect{domain.EffectReadRepository}
		},
		func(candidate *domain.Action) { candidate.RequiredEvidence[0].Kind = domain.RequirementDeliverySummary },
	} {
		candidate := action.Clone()
		mutate(&candidate)
		if err := validateActionForPhase(domain.PhasePlan, candidate); err == nil {
			t.Fatalf("noncanonical action passed phase validation: %+v", candidate)
		}
	}
	first, err := BlueprintForPhase(domain.PhasePlan)
	if err != nil {
		t.Fatal(err)
	}
	first.AllowedEffects[0] = domain.EffectResolveBlocker
	second, err := BlueprintForPhase(domain.PhasePlan)
	if err != nil {
		t.Fatal(err)
	}
	if second.AllowedEffects[0] == domain.EffectResolveBlocker {
		t.Fatal("BlueprintForPhase returned shared mutable slices")
	}
}

func requirementKinds(requirements []domain.EvidenceRequirement) []domain.EvidenceRequirementKind {
	kinds := make([]domain.EvidenceRequirementKind, len(requirements))
	for i, requirement := range requirements {
		if !requirement.Required {
			return nil
		}
		kinds[i] = requirement.Kind
	}
	return kinds
}

func domainErrorCode(err error) domain.ErrorCode {
	var domainError *domain.Error
	if errors.As(err, &domainError) {
		return domainError.Code
	}
	return ""
}
