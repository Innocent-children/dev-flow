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
	if !phase.IsValid() {
		return ActionBlueprint{}, domain.NewError(domain.ErrorInvalidArgument, "unknown workflow phase")
	}
	if phase.Terminal() {
		return ActionBlueprint{}, domain.NewError(domain.ErrorTaskTerminal, "terminal phase has no next action")
	}
	kind, ok := ActionForPhase(phase)
	if !ok {
		return ActionBlueprint{}, domain.NewError(domain.ErrorInternal, "workflow phase has no action blueprint")
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
		blueprint.Guidance = `Assess the task contract and repository without modifying source files. Use the example keys in dev_flow_apply_action.payload; required_evidence names are not payload keys. Example payload: {"result":"succeeded","summary":"Assessed the bounded task.","constraints":[],"risks":[],"intended_changed_surface":["relative/path"],"verification_budget_acknowledged":true}.`
	case domain.PhaseAssess:
		blueprint.AllowedEffects = []domain.AllowedEffect{domain.EffectReadRepository}
		blueprint.RequiredEvidence = required(
			domain.RequirementRepositoryObservation,
			domain.RequirementImplementationPlan,
		)
		blueprint.Guidance = `Produce the bounded implementation and verification plan. Use this shape in dev_flow_apply_action.payload. Example payload: {"result":"succeeded","summary":"Prepared the bounded plan.","steps":["Make the bounded change."],"expected_changed_paths":["relative/path"],"non_goals":[],"verification_steps":["Run the targeted check."],"unresolved_questions":[]}.`
	case domain.PhasePlan:
		blueprint.AllowedEffects = []domain.AllowedEffect{
			domain.EffectReadRepository,
			domain.EffectEditRepositoryFiles,
		}
		blueprint.RequiredEvidence = required(
			domain.RequirementRepositoryObservation,
			domain.RequirementImplementationSummary,
		)
		blueprint.Guidance = `Implement only the current plan and report the changed surface. Use this shape in dev_flow_apply_action.payload. Example payload: {"result":"succeeded","summary":"Implemented the bounded change.","changed_paths":["relative/path"],"no_file_changes":false,"deviations":[],"scope_confirmed":true}.`
	case domain.PhaseImplement:
		blueprint.AllowedEffects = []domain.AllowedEffect{
			domain.EffectReadRepository,
			domain.EffectRunVerificationCommands,
		}
		blueprint.RequiredEvidence = required(
			domain.RequirementRepositoryObservation,
			domain.RequirementVerificationSummary,
		)
		blueprint.Guidance = `Verify the implementation within the task verification budget. Use the exact result, source, and status values shown here. Example payload: {"result":"ready","summary":"Targeted verification passed.","checks":[{"source":"automated","name":"targeted_check","status":"passed","summary":"Targeted check passed.","command_count":1,"full_suite":false}],"failed_items":[],"unverified_items":[],"manual_handoff_items":[],"reason":""}.`
	case domain.PhaseVerify:
		blueprint.AllowedEffects = []domain.AllowedEffect{domain.EffectReadRepository}
		blueprint.RequiredEvidence = required(
			domain.RequirementRepositoryObservation,
			domain.RequirementReviewSummary,
		)
		blueprint.Guidance = `Review the verified change against the contract and plan. Example payload: {"result":"pass","summary":"Verified change accepted.","findings":[],"residual_risks":[],"reason":""}.`
	case domain.PhaseReview:
		blueprint.AllowedEffects = []domain.AllowedEffect{
			domain.EffectReadRepository,
			domain.EffectPrepareDeliverySummary,
		}
		blueprint.RequiredEvidence = required(
			domain.RequirementRepositoryObservation,
			domain.RequirementReviewSummary,
		)
		blueprint.Guidance = `Prepare the final acceptance mapping and handoff decision. Copy every contract acceptance criterion. Put only source "automated" evidence IDs in automated_evidence_ids and only source "user" evidence IDs in manual_evidence_ids; omit host_observed and static evidence IDs from both lists. Replace angle-bracket values and repeat acceptance items as needed. Example payload: {"result":"ready","summary":"Handoff prepared.","delivery":{"acceptance":[{"criterion":"<exact acceptance criterion>","status":"satisfied"}],"automated_evidence_ids":["<automated evidence_id>"],"manual_evidence_ids":[],"unverified_items":[],"risks":[]},"reason":""}.`
	case domain.PhaseHandoff:
		blueprint.AllowedEffects = []domain.AllowedEffect{
			domain.EffectReadRepository,
			domain.EffectPrepareDeliverySummary,
		}
		blueprint.RequiredEvidence = required(
			domain.RequirementRepositoryObservation,
			domain.RequirementDeliverySummary,
		)
		blueprint.Guidance = `Complete the closed delivery summary for the task. Copy every contract acceptance criterion. Put only source "automated" evidence IDs in automated_evidence_ids and only source "user" evidence IDs in manual_evidence_ids; omit host_observed and static evidence IDs from both lists. Replace angle-bracket values and repeat acceptance items as needed. Example payload: {"result":"complete","summary":"Delivery complete.","delivery":{"acceptance":[{"criterion":"<exact acceptance criterion>","status":"satisfied"}],"automated_evidence_ids":["<automated evidence_id>"],"manual_evidence_ids":[],"unverified_items":[],"risks":[]},"reason":""}.`
	case domain.PhaseBlocked:
		blueprint.AllowedEffects = []domain.AllowedEffect{
			domain.EffectReadRepository,
			domain.EffectResolveBlocker,
		}
		blueprint.RequiredEvidence = required(
			domain.RequirementRepositoryObservation,
			domain.RequirementBlockerResolution,
		)
		blueprint.Guidance = `Satisfy the stored blocker condition and return only to its resume phase. Copy the current blocker identity and condition values. Example payload: {"result":"succeeded","blocker_id":"<current blocker_id>","summary":"Blocker condition satisfied.","resolution_evidence":{"condition":{"kind":"restore_issuance_binding","expected_binding_digest":"<expected binding digest>"},"observed_binding_digest":"<observed binding digest>"}}.`
	default:
		return ActionBlueprint{}, domain.NewError(domain.ErrorInternal, "workflow phase has no action blueprint")
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
