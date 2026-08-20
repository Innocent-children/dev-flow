package domain

import "time"

// Contract 0.1 types remain test-only fixtures for frozen historical validation.
type Phase string

const (
	PhaseIntake    Phase = "INTAKE"
	PhaseAssess    Phase = "ASSESS"
	PhasePlan      Phase = "PLAN"
	PhaseImplement Phase = "IMPLEMENT"
	PhaseVerify    Phase = "VERIFY"
	PhaseReview    Phase = "REVIEW"
	PhaseHandoff   Phase = "HANDOFF"
	PhaseDone      Phase = "DONE"
	PhaseBlocked   Phase = "BLOCKED"
	PhaseCancelled Phase = "CANCELLED"
)

func (p Phase) IsValid() bool {
	switch p {
	case PhaseIntake, PhaseAssess, PhasePlan, PhaseImplement, PhaseVerify, PhaseReview,
		PhaseHandoff, PhaseDone, PhaseBlocked, PhaseCancelled:
		return true
	default:
		return false
	}
}

func (p Phase) Terminal() bool { return p == PhaseDone || p == PhaseCancelled }

func (p Phase) NormalNonTerminal() bool {
	switch p {
	case PhaseIntake, PhaseAssess, PhasePlan, PhaseImplement, PhaseVerify, PhaseReview, PhaseHandoff:
		return true
	default:
		return false
	}
}

const (
	ActionAssessTask      ActionKind = "ASSESS_TASK"
	ActionPlanChange      ActionKind = "PLAN_CHANGE"
	ActionImplementChange ActionKind = "IMPLEMENT_CHANGE"
	ActionVerifyChange    ActionKind = "VERIFY_CHANGE"
	ActionReviewChange    ActionKind = "REVIEW_CHANGE"
	ActionPrepareHandoff  ActionKind = "PREPARE_HANDOFF"
)

func (k ActionKind) IsValid() bool {
	switch k {
	case ActionAssessTask, ActionPlanChange, ActionImplementChange, ActionVerifyChange,
		ActionReviewChange, ActionPrepareHandoff, ActionResolveBlocker:
		return true
	default:
		return false
	}
}

type ActionResult string

const (
	ActionResultSucceeded            ActionResult = "succeeded"
	ActionResultReady                ActionResult = "ready"
	ActionResultFailed               ActionResult = "failed"
	ActionResultPass                 ActionResult = "pass"
	ActionResultReworkImplementation ActionResult = "rework_implementation"
	ActionResultReplan               ActionResult = "replan"
	ActionResultComplete             ActionResult = "complete"
)

func (r ActionResult) IsValid() bool {
	switch r {
	case ActionResultSucceeded, ActionResultReady, ActionResultFailed, ActionResultPass,
		ActionResultReworkImplementation, ActionResultReplan, ActionResultComplete:
		return true
	default:
		return false
	}
}

const EffectEditRepositoryFiles AllowedEffect = "edit_repository_files"

func (e AllowedEffect) IsValid() bool {
	switch e {
	case EffectReadRepository, EffectEditRepositoryFiles, EffectRunVerificationCommands,
		EffectPrepareDeliverySummary, EffectResolveBlocker:
		return true
	default:
		return false
	}
}

const (
	RequirementAssessmentSummary   EvidenceRequirementKind = "assessment_summary"
	RequirementImplementationPlan  EvidenceRequirementKind = "implementation_plan"
	RequirementVerificationSummary EvidenceRequirementKind = "verification_summary"
	RequirementReviewSummary       EvidenceRequirementKind = "review_summary"
)

func (k EvidenceRequirementKind) IsValid() bool {
	switch k {
	case RequirementRepositoryObservation, RequirementAssessmentSummary,
		RequirementImplementationPlan, RequirementImplementationSummary,
		RequirementVerificationSummary, RequirementReviewSummary,
		RequirementDeliverySummary, RequirementBlockerResolution:
		return true
	default:
		return false
	}
}

func (r EvidenceRequirement) Validate() error {
	if !r.Kind.IsValid() {
		return ErrInvalidArgument
	}
	return nil
}

type Action struct {
	ActionID                ID                    `json:"action_id"`
	Kind                    ActionKind            `json:"kind"`
	TaskID                  ID                    `json:"task_id"`
	Revision                uint64                `json:"revision"`
	RepositoryBindingDigest Digest                `json:"repository_binding_digest"`
	AllowedEffects          []AllowedEffect       `json:"allowed_effects"`
	RequiredEvidence        []EvidenceRequirement `json:"required_evidence"`
	PayloadContract         Phase                 `json:"payload_contract"`
	Guidance                string                `json:"guidance"`
	IssuedAt                time.Time             `json:"issued_at"`
}

func (a Action) Validate() error {
	if validateID(a.ActionID) != nil || validateID(a.TaskID) != nil || !a.Kind.IsValid() ||
		a.Revision == 0 || validateDigest(a.RepositoryBindingDigest) != nil ||
		(!a.PayloadContract.NormalNonTerminal() && a.PayloadContract != PhaseBlocked) ||
		requireNormalizedText(a.Guidance, MaxGuidanceBytes, true) != nil || validateUTC(a.IssuedAt) != nil ||
		len(a.AllowedEffects) == 0 || len(a.AllowedEffects) > MaxBoundedStringListItems ||
		len(a.RequiredEvidence) == 0 || len(a.RequiredEvidence) > MaxEvidencePerAction {
		return ErrInvalidArgument
	}
	effects := make(map[AllowedEffect]struct{}, len(a.AllowedEffects))
	for _, effect := range a.AllowedEffects {
		if !effect.IsValid() {
			return ErrInvalidArgument
		}
		if _, duplicate := effects[effect]; duplicate {
			return ErrInvalidArgument
		}
		effects[effect] = struct{}{}
	}
	requirements := make(map[EvidenceRequirementKind]struct{}, len(a.RequiredEvidence))
	for _, requirement := range a.RequiredEvidence {
		if requirement.Validate() != nil {
			return ErrInvalidArgument
		}
		if _, duplicate := requirements[requirement.Kind]; duplicate {
			return ErrInvalidArgument
		}
		requirements[requirement.Kind] = struct{}{}
	}
	return nil
}

func (a Action) Clone() Action {
	a.AllowedEffects = append([]AllowedEffect(nil), a.AllowedEffects...)
	a.RequiredEvidence = append([]EvidenceRequirement(nil), a.RequiredEvidence...)
	return a
}

type Blocker struct {
	BlockerID             ID                     `json:"blocker_id"`
	Code                  ErrorCode              `json:"code"`
	Cause                 RecoveryClassification `json:"cause"`
	Message               string                 `json:"message"`
	ResumePhase           Phase                  `json:"resume_phase"`
	ObservedBindingDigest Digest                 `json:"observed_binding_digest"`
	Condition             BlockerCondition       `json:"condition"`
	RequiredResolution    string                 `json:"required_resolution"`
	CreatedAt             time.Time              `json:"created_at"`
}

func (b Blocker) Validate() error {
	if validateID(b.BlockerID) != nil || b.Code != ErrorTaskBlocked ||
		(b.Cause != RecoveryPartiallyCompleted && b.Cause != RecoveryConflicting) ||
		!b.ResumePhase.NormalNonTerminal() || requireNormalizedText(b.Message, MaxBlockerMessageBytes, true) != nil ||
		validateDigest(b.ObservedBindingDigest) != nil || b.Condition.Validate() != nil ||
		requireNormalizedText(b.RequiredResolution, MaxResolutionTextBytes, true) != nil || validateUTC(b.CreatedAt) != nil {
		return ErrInvalidArgument
	}
	return nil
}

func clonePhasePointer(value *Phase) *Phase {
	if value == nil {
		return nil
	}
	copy := *value
	return &copy
}
