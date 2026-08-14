package domain

// ID is a caller-provided stable identity.
type ID string

// IsValid reports whether id is a non-empty canonical identifier within Core Limits 0.1.
func (id ID) IsValid() bool { return validateID(id) == nil }

// Digest is a lowercase hexadecimal SHA-256 digest.
type Digest string

// IsValid reports whether digest is a canonical lowercase SHA-256 hexadecimal value.
func (digest Digest) IsValid() bool { return validateDigest(digest) == nil }

type Host string

const (
	HostCodex    Host = "codex"
	HostDeepSeek Host = "deepseek"
)

func (h Host) IsValid() bool { return h == HostCodex || h == HostDeepSeek }

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

type ActionKind string

const (
	ActionAssessTask      ActionKind = "ASSESS_TASK"
	ActionPlanChange      ActionKind = "PLAN_CHANGE"
	ActionImplementChange ActionKind = "IMPLEMENT_CHANGE"
	ActionVerifyChange    ActionKind = "VERIFY_CHANGE"
	ActionReviewChange    ActionKind = "REVIEW_CHANGE"
	ActionPrepareHandoff  ActionKind = "PREPARE_HANDOFF"
	ActionResolveBlocker  ActionKind = "RESOLVE_BLOCKER"
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

type EvidenceSource string

const (
	EvidenceSourceAutomated    EvidenceSource = "automated"
	EvidenceSourceUser         EvidenceSource = "user"
	EvidenceSourceStatic       EvidenceSource = "static"
	EvidenceSourceHostObserved EvidenceSource = "host_observed"
)

func (s EvidenceSource) IsValid() bool {
	return s == EvidenceSourceAutomated || s == EvidenceSourceUser ||
		s == EvidenceSourceStatic || s == EvidenceSourceHostObserved
}

type VerificationLevel string

const (
	VerificationMinimal  VerificationLevel = "minimal"
	VerificationTargeted VerificationLevel = "targeted"
	VerificationFull     VerificationLevel = "full"
)

func (l VerificationLevel) IsValid() bool {
	return l == VerificationMinimal || l == VerificationTargeted || l == VerificationFull
}

type TerminalStatus string

const (
	TerminalCompleted TerminalStatus = "completed"
	TerminalCancelled TerminalStatus = "cancelled"
)

func (s TerminalStatus) IsValid() bool { return s == TerminalCompleted || s == TerminalCancelled }

type RecoveryClassification string

const (
	RecoveryNotStarted             RecoveryClassification = "not_started"
	RecoveryCompletedAndRecorded   RecoveryClassification = "completed_and_recorded"
	RecoveryCompletedButUnrecorded RecoveryClassification = "completed_but_unrecorded"
	RecoveryPartiallyCompleted     RecoveryClassification = "partially_completed"
	RecoveryConflicting            RecoveryClassification = "conflicting"
)

func (c RecoveryClassification) IsValid() bool {
	switch c {
	case RecoveryNotStarted, RecoveryCompletedAndRecorded, RecoveryCompletedButUnrecorded,
		RecoveryPartiallyCompleted, RecoveryConflicting:
		return true
	default:
		return false
	}
}

type EvidenceStatus string

const (
	EvidencePassed   EvidenceStatus = "passed"
	EvidenceFailed   EvidenceStatus = "failed"
	EvidenceSkipped  EvidenceStatus = "skipped"
	EvidenceNotRun   EvidenceStatus = "not_run"
	EvidenceObserved EvidenceStatus = "observed"
)

func (s EvidenceStatus) IsValid() bool {
	switch s {
	case EvidencePassed, EvidenceFailed, EvidenceSkipped, EvidenceNotRun, EvidenceObserved:
		return true
	default:
		return false
	}
}

type AllowedEffect string

const (
	EffectReadRepository          AllowedEffect = "read_repository"
	EffectEditRepositoryFiles     AllowedEffect = "edit_repository_files"
	EffectRunVerificationCommands AllowedEffect = "run_verification_commands"
	EffectPrepareDeliverySummary  AllowedEffect = "prepare_delivery_summary"
	EffectResolveBlocker          AllowedEffect = "resolve_blocker"
)

func (e AllowedEffect) IsValid() bool {
	switch e {
	case EffectReadRepository, EffectEditRepositoryFiles, EffectRunVerificationCommands,
		EffectPrepareDeliverySummary, EffectResolveBlocker:
		return true
	default:
		return false
	}
}

type EvidenceRequirementKind string

const (
	RequirementRepositoryObservation EvidenceRequirementKind = "repository_observation"
	RequirementAssessmentSummary     EvidenceRequirementKind = "assessment_summary"
	RequirementImplementationPlan    EvidenceRequirementKind = "implementation_plan"
	RequirementImplementationSummary EvidenceRequirementKind = "implementation_summary"
	RequirementVerificationSummary   EvidenceRequirementKind = "verification_summary"
	RequirementReviewSummary         EvidenceRequirementKind = "review_summary"
	RequirementDeliverySummary       EvidenceRequirementKind = "delivery_summary"
	RequirementBlockerResolution     EvidenceRequirementKind = "blocker_resolution"
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

type OutcomeCriterionStatus string

const (
	CriterionSatisfied  OutcomeCriterionStatus = "satisfied"
	CriterionUnverified OutcomeCriterionStatus = "unverified"
)

func (s OutcomeCriterionStatus) IsValid() bool {
	return s == CriterionSatisfied || s == CriterionUnverified
}
