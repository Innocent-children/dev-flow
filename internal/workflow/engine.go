package workflow

import (
	"time"

	"github.com/Innocent-children/dev-flow/internal/domain"
)

type ActionBlueprint struct {
	Kind             domain.ActionKind
	AllowedEffects   []domain.AllowedEffect
	RequiredEvidence []domain.EvidenceRequirement
	PayloadContract  domain.Phase
	Guidance         string
}

func BlueprintForPhase(phase domain.Phase) (ActionBlueprint, error) {
	kind, ok := ActionForPhase(phase)
	if !ok {
		return ActionBlueprint{}, domain.NewError(domain.ErrorTaskTerminal, "terminal phase has no next action")
	}
	blueprint := ActionBlueprint{Kind: kind, PayloadContract: phase}
	required := func(kinds ...domain.EvidenceRequirementKind) []domain.EvidenceRequirement {
		items := make([]domain.EvidenceRequirement, len(kinds))
		for i, requirementKind := range kinds {
			items[i] = domain.EvidenceRequirement{Kind: requirementKind, Required: true}
		}
		return items
	}
	switch phase {
	case domain.PhaseIntake:
		blueprint.AllowedEffects = []domain.AllowedEffect{domain.EffectReadRepository}
		blueprint.RequiredEvidence = required(
			domain.RequirementRepositoryObservation,
			domain.RequirementAssessmentSummary,
		)
		blueprint.Guidance = "Assess the task contract and repository without modifying source files."
	case domain.PhaseAssess:
		blueprint.AllowedEffects = []domain.AllowedEffect{domain.EffectReadRepository}
		blueprint.RequiredEvidence = required(
			domain.RequirementRepositoryObservation,
			domain.RequirementImplementationPlan,
		)
		blueprint.Guidance = "Produce the bounded implementation and verification plan."
	case domain.PhasePlan:
		blueprint.AllowedEffects = []domain.AllowedEffect{
			domain.EffectReadRepository,
			domain.EffectEditRepositoryFiles,
		}
		blueprint.RequiredEvidence = required(
			domain.RequirementRepositoryObservation,
			domain.RequirementImplementationSummary,
		)
		blueprint.Guidance = "Implement only the current plan and report the changed surface."
	case domain.PhaseImplement:
		blueprint.AllowedEffects = []domain.AllowedEffect{
			domain.EffectReadRepository,
			domain.EffectRunVerificationCommands,
		}
		blueprint.RequiredEvidence = required(
			domain.RequirementRepositoryObservation,
			domain.RequirementVerificationSummary,
		)
		blueprint.Guidance = "Verify the implementation within the task verification budget."
	case domain.PhaseVerify:
		blueprint.AllowedEffects = []domain.AllowedEffect{domain.EffectReadRepository}
		blueprint.RequiredEvidence = required(
			domain.RequirementRepositoryObservation,
			domain.RequirementReviewSummary,
		)
		blueprint.Guidance = "Review the verified change against the contract and plan."
	case domain.PhaseReview:
		blueprint.AllowedEffects = []domain.AllowedEffect{
			domain.EffectReadRepository,
			domain.EffectPrepareDeliverySummary,
		}
		blueprint.RequiredEvidence = required(
			domain.RequirementRepositoryObservation,
			domain.RequirementReviewSummary,
		)
		blueprint.Guidance = "Prepare the final acceptance mapping and handoff decision."
	case domain.PhaseHandoff:
		blueprint.AllowedEffects = []domain.AllowedEffect{domain.EffectPrepareDeliverySummary}
		blueprint.RequiredEvidence = required(
			domain.RequirementRepositoryObservation,
			domain.RequirementDeliverySummary,
		)
		blueprint.Guidance = "Complete the closed delivery summary for the task."
	case domain.PhaseBlocked:
		blueprint.AllowedEffects = []domain.AllowedEffect{
			domain.EffectReadRepository,
			domain.EffectResolveBlocker,
		}
		blueprint.RequiredEvidence = required(
			domain.RequirementRepositoryObservation,
			domain.RequirementBlockerResolution,
		)
		blueprint.Guidance = "Satisfy the stored blocker condition and return only to its resume phase."
	default:
		return ActionBlueprint{}, domain.NewError(domain.ErrorInvalidArgument, "unknown workflow phase")
	}
	return cloneBlueprint(blueprint), nil
}

func BuildNextAction(
	phase domain.Phase,
	taskID domain.ID,
	revision uint64,
	bindingDigest domain.Digest,
	actionID domain.ID,
	issuedAt time.Time,
) (domain.Action, error) {
	blueprint, err := BlueprintForPhase(phase)
	if err != nil {
		return domain.Action{}, err
	}
	action := domain.Action{
		ActionID:                actionID,
		Kind:                    blueprint.Kind,
		TaskID:                  taskID,
		Revision:                revision,
		RepositoryBindingDigest: bindingDigest,
		AllowedEffects:          blueprint.AllowedEffects,
		RequiredEvidence:        blueprint.RequiredEvidence,
		PayloadContract:         blueprint.PayloadContract,
		Guidance:                blueprint.Guidance,
		IssuedAt:                issuedAt,
	}
	if err := validateActionForPhase(phase, action); err != nil {
		return domain.Action{}, err
	}
	return action, nil
}

// ValidateTask validates Domain invariants and then verifies that the current
// action is the exact blueprint derived from the sole workflow table. Terminal
// tasks have no current action and require no blueprint validation.
func ValidateTask(task domain.Task) error {
	if err := task.Validate(); err != nil {
		return err
	}
	if task.CurrentAction == nil {
		return nil
	}
	return validateActionForPhase(task.Phase, *task.CurrentAction)
}

func validateActionForPhase(phase domain.Phase, action domain.Action) error {
	if err := action.Validate(); err != nil {
		return err
	}
	blueprint, err := BlueprintForPhase(phase)
	if err != nil || action.Kind != blueprint.Kind ||
		action.PayloadContract != blueprint.PayloadContract ||
		action.Guidance != blueprint.Guidance ||
		!sameEffects(action.AllowedEffects, blueprint.AllowedEffects) ||
		!sameEvidenceRequirements(action.RequiredEvidence, blueprint.RequiredEvidence) {
		return domain.NewError(domain.ErrorInvalidArgument, "action does not match its workflow phase")
	}
	return nil
}

func sameEffects(left, right []domain.AllowedEffect) bool {
	if len(left) != len(right) {
		return false
	}
	for i := range left {
		if left[i] != right[i] {
			return false
		}
	}
	return true
}

func sameEvidenceRequirements(left, right []domain.EvidenceRequirement) bool {
	if len(left) != len(right) {
		return false
	}
	for i := range left {
		if left[i] != right[i] {
			return false
		}
	}
	return true
}

func cloneBlueprint(blueprint ActionBlueprint) ActionBlueprint {
	blueprint.AllowedEffects = append([]domain.AllowedEffect(nil), blueprint.AllowedEffects...)
	blueprint.RequiredEvidence = append(
		[]domain.EvidenceRequirement(nil),
		blueprint.RequiredEvidence...,
	)
	return blueprint
}
