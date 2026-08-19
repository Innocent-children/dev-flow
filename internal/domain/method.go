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
	capability, err := normalizeOptionalText(e.Capability, MaxIdentifierBytes)
	if !e.StepID.IsValid() || !e.Status.IsValid() || err != nil || capability != e.Capability ||
		requireNormalizedText(e.Summary, MaxEvidenceSummaryBytes, true) != nil {
		return ErrInvalidArgument
	}
	for _, step := range steps {
		if step.StepID == e.StepID {
			return nil
		}
	}
	return ErrInvalidArgument
}
