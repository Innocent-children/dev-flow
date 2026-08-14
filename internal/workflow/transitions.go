package workflow

import (
	"strings"
	"unicode/utf8"

	"github.com/Innocent-children/dev-flow/internal/domain"
)

// Transition is one row in the authoritative workflow table.
type Transition struct {
	From           domain.Phase
	Action         domain.ActionKind
	Result         domain.ActionResult
	To             domain.Phase
	ResumePhase    bool
	RequiresReason bool
}

var transitionTable = [...]Transition{
	{From: domain.PhaseIntake, Action: domain.ActionAssessTask, Result: domain.ActionResultSucceeded, To: domain.PhaseAssess},
	{From: domain.PhaseAssess, Action: domain.ActionPlanChange, Result: domain.ActionResultSucceeded, To: domain.PhasePlan},
	{From: domain.PhasePlan, Action: domain.ActionImplementChange, Result: domain.ActionResultSucceeded, To: domain.PhaseImplement},
	{From: domain.PhaseImplement, Action: domain.ActionVerifyChange, Result: domain.ActionResultReady, To: domain.PhaseVerify},
	{From: domain.PhaseImplement, Action: domain.ActionVerifyChange, Result: domain.ActionResultFailed, To: domain.PhaseImplement, RequiresReason: true},
	{From: domain.PhaseVerify, Action: domain.ActionReviewChange, Result: domain.ActionResultPass, To: domain.PhaseReview},
	{From: domain.PhaseVerify, Action: domain.ActionReviewChange, Result: domain.ActionResultReworkImplementation, To: domain.PhaseImplement, RequiresReason: true},
	{From: domain.PhaseVerify, Action: domain.ActionReviewChange, Result: domain.ActionResultReplan, To: domain.PhasePlan, RequiresReason: true},
	{From: domain.PhaseReview, Action: domain.ActionPrepareHandoff, Result: domain.ActionResultReady, To: domain.PhaseHandoff},
	{From: domain.PhaseReview, Action: domain.ActionPrepareHandoff, Result: domain.ActionResultReworkImplementation, To: domain.PhaseImplement, RequiresReason: true},
	{From: domain.PhaseReview, Action: domain.ActionPrepareHandoff, Result: domain.ActionResultReplan, To: domain.PhasePlan, RequiresReason: true},
	{From: domain.PhaseHandoff, Action: domain.ActionPrepareHandoff, Result: domain.ActionResultComplete, To: domain.PhaseDone},
	{From: domain.PhaseHandoff, Action: domain.ActionPrepareHandoff, Result: domain.ActionResultReworkImplementation, To: domain.PhaseImplement, RequiresReason: true},
	{From: domain.PhaseHandoff, Action: domain.ActionPrepareHandoff, Result: domain.ActionResultReplan, To: domain.PhasePlan, RequiresReason: true},
	{From: domain.PhaseBlocked, Action: domain.ActionResolveBlocker, Result: domain.ActionResultSucceeded, ResumePhase: true},
}

// Transitions returns a copy of the sole transition table.
func Transitions() []Transition {
	return append([]Transition(nil), transitionTable[:]...)
}

// ActionForPhase derives the phase-to-action mapping from the transition table.
func ActionForPhase(phase domain.Phase) (domain.ActionKind, bool) {
	for _, transition := range transitionTable {
		if transition.From == phase {
			return transition.Action, true
		}
	}
	return "", false
}

// Evaluate returns the one legal destination for an exact phase/action/result tuple.
func Evaluate(
	phase domain.Phase,
	action domain.ActionKind,
	result domain.ActionResult,
	resumePhase *domain.Phase,
	reason string,
) (domain.Phase, error) {
	if !phase.IsValid() || !action.IsValid() || !result.IsValid() {
		return "", domain.NewError(domain.ErrorInvalidArgument, "illegal workflow transition")
	}
	for _, transition := range transitionTable {
		if transition.From != phase || transition.Action != action || transition.Result != result {
			continue
		}
		if transition.RequiresReason && !validReason(reason) {
			return "", domain.NewError(domain.ErrorInvalidArgument, "rework transition requires a reason")
		}
		if transition.ResumePhase {
			if resumePhase == nil || !resumePhase.NormalNonTerminal() {
				return "", domain.NewError(domain.ErrorInvalidArgument, "blocker resolution requires its resume phase")
			}
			return *resumePhase, nil
		}
		return transition.To, nil
	}
	return "", domain.NewError(domain.ErrorInvalidArgument, "illegal workflow transition")
}

func validReason(reason string) bool {
	return utf8.ValidString(reason) && reason != "" && reason == strings.TrimSpace(reason) &&
		len(reason) <= domain.MaxReasonBytes
}
