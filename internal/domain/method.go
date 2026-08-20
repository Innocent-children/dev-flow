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
	if e.validateSyntax() != nil {
		return ErrInvalidArgument
	}
	for _, step := range steps {
		if step.StepID == e.StepID {
			return nil
		}
	}
	return ErrInvalidArgument
}

func (e MethodEvidence) validateSyntax() error {
	if !e.StepID.IsValid() || !e.Status.IsValid() || requireNormalizedText(e.Summary, MaxEvidenceSummaryBytes, true) != nil {
		return ErrInvalidArgument
	}
	if e.Capability != "" && !validSemanticID(e.Capability) {
		return ErrInvalidArgument
	}
	if e.Status == MethodStepCompleted && e.Capability == "" || e.Status == MethodStepPlainFallback && e.Capability != "" {
		return ErrInvalidArgument
	}
	return nil
}

func ValidateMethodEvidence(items []MethodEvidence, steps []SemanticMethodStep) error {
	if len(items) > MaxMethodEvidencePerAction || len(steps) > MaxMethodEvidencePerAction {
		return ErrInvalidArgument
	}
	stepIndexes := make(map[MethodStepID]int, len(steps))
	for index, step := range steps {
		if step.Validate() != nil || stepIndexes[step.StepID] != 0 {
			return ErrInvalidArgument
		}
		stepIndexes[step.StepID] = index + 1
	}
	seen := make(map[MethodStepID]bool, len(items))
	for _, item := range items {
		if item.validateSyntax() != nil || stepIndexes[item.StepID] == 0 || seen[item.StepID] {
			return ErrInvalidArgument
		}
		seen[item.StepID] = true
	}
	if len(items) != len(steps) {
		return ErrTransitionNotAllowed
	}
	for index, step := range steps {
		item := items[index]
		if item.StepID != step.StepID {
			return ErrTransitionNotAllowed
		}
		if step.Required && item.Status != MethodStepCompleted && item.Status != MethodStepPlainFallback {
			return ErrTransitionNotAllowed
		}
	}
	return nil
}
