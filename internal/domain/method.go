package domain

type MethodProfile string

const (
	MethodPlain    MethodProfile = "plain"
	MethodSpecKit  MethodProfile = "spec-kit"
	MethodOpenSpec MethodProfile = "openspec"
)

func (p MethodProfile) IsValid() bool {
	return p == MethodPlain || p == MethodSpecKit || p == MethodOpenSpec
}

type MethodStepID string

func (id MethodStepID) IsValid() bool { return validSemanticID(string(id)) }

type MethodStepStatus string

const (
	MethodStepCompleted     MethodStepStatus = "completed"
	MethodStepNotRun        MethodStepStatus = "not_run"
	MethodStepUnavailable   MethodStepStatus = "unavailable"
	MethodStepPlainFallback MethodStepStatus = "plain_fallback"
)

func (s MethodStepStatus) IsValid() bool {
	return s == MethodStepCompleted || s == MethodStepNotRun || s == MethodStepUnavailable || s == MethodStepPlainFallback
}

type SemanticMethodStep struct {
	StepID   MethodStepID `json:"step_id"`
	Purpose  string       `json:"purpose"`
	Required bool         `json:"required"`
}

func (s SemanticMethodStep) Validate() error {
	if !s.StepID.IsValid() || requireNormalizedText(s.Purpose, MaxGuidanceBytes, true) != nil {
		return ErrInvalidArgument
	}
	return nil
}

type MethodEvidence struct {
	StepID     MethodStepID     `json:"step_id"`
	Status     MethodStepStatus `json:"status"`
	Capability string           `json:"capability"`
	Summary    string           `json:"summary"`
}

func (e MethodEvidence) Validate(steps []SemanticMethodStep) error {
	if err := e.validateSyntax(); err != nil {
		return err
	}
	for _, step := range steps {
		if step.StepID == e.StepID {
			return nil
		}
	}
	return ErrInvalidArgument
}

func (e MethodEvidence) validateSyntax() error {
	if !e.StepID.IsValid() {
		return InvalidArgumentViolations(ExplainedViolation("step_id", RuleValueFormat, "step_id must be a semantic identifier of at most 128 lowercase letters, digits, underscores, dots or hyphens"))
	}
	if !e.Status.IsValid() {
		return InvalidArgumentViolations(ExplainedViolation("status", RuleEnumValueInvalid, "method status must be completed, not_run, unavailable or plain_fallback"))
	}
	if err := requireNormalizedText(e.Summary, MaxEvidenceSummaryBytes, true); err != nil {
		return AtField("summary", err)
	}
	if e.Capability != "" && !validSemanticID(e.Capability) {
		return InvalidArgumentViolations(ExplainedViolation("capability", RuleValueFormat, "capability must be empty or a semantic identifier of at most 128 lowercase letters, digits, underscores, dots or hyphens"))
	}
	if e.Status == MethodStepCompleted && e.Capability == "" || e.Status == MethodStepPlainFallback && e.Capability != "" {
		return InvalidArgumentViolations(ExplainedViolation("capability", RuleMemberDependency, "completed requires a capability; plain_fallback requires an empty capability"))
	}
	return nil
}

func ValidateMethodEvidence(items []MethodEvidence, steps []SemanticMethodStep) error {
	if len(items) > MaxMethodEvidencePerAction || len(steps) > MaxMethodEvidencePerAction {
		return WithExplanation(ErrInvalidArgument, "method evidence or required steps exceed the per-Action item limit")
	}
	stepIndexes := make(map[MethodStepID]int, len(steps))
	for index, step := range steps {
		if step.Validate() != nil || stepIndexes[step.StepID] != 0 {
			return WithExplanation(ErrInvalidArgument, "the current Action contains an invalid or duplicate semantic method step")
		}
		stepIndexes[step.StepID] = index + 1
	}
	seen := make(map[MethodStepID]bool, len(items))
	for _, item := range items {
		if item.validateSyntax() != nil || stepIndexes[item.StepID] == 0 || seen[item.StepID] {
			return WithExplanation(ErrInvalidArgument, "method evidence must use valid values and unique step identifiers present in the current Action")
		}
		seen[item.StepID] = true
	}
	if len(items) != len(steps) {
		return WithExplanation(ErrTransitionNotAllowed, "method evidence must include exactly one result for every required Action method step")
	}
	for index, step := range steps {
		item := items[index]
		if item.StepID != step.StepID {
			return WithExplanation(ErrTransitionNotAllowed, "method evidence must follow the method-step order returned by the current Action")
		}
		if step.Required && item.Status != MethodStepCompleted && item.Status != MethodStepPlainFallback {
			return WithExplanation(ErrTransitionNotAllowed, "a required method step must be completed or use plain_fallback before this transition")
		}
	}
	return nil
}
