package domain

type EvidenceRequirement struct {
	Kind     EvidenceRequirementKind `json:"kind"`
	Required bool                    `json:"required"`
}

func (r EvidenceRequirement) ValidateV2() error {
	switch r.Kind {
	case RequirementRepositoryObservation, "requirements_baseline", "design_baseline", "task_plan_baseline",
		"implementation_summary", "test_summary", "comprehension_assessment", "refactor_summary",
		"delivery_summary", RequirementBlockerResolution:
		return nil
	default:
		return ErrInvalidArgument
	}
}
